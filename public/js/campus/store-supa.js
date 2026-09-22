/* ============================================================
   STORE SUPABASE · misma interfaz que store-demo.js
   ------------------------------------------------------------
   El navegador no decide nada de seguridad: cada consulta pasa por
   RLS (supabase/campus.sql). Si una política niega, aquí solo se
   traduce el error a un mensaje humano.
============================================================ */

const TTL = 3600; // segundos de validez de URLs firmadas

export function createSupaStore(sb, cfg = {}) {
  const pcache = new Map();          // id → perfil público
  const ucache = new Map();          // `${bucket}/${path}` → { url, exp }
  let meCache = null;

  const fail = (e, fallback) => {
    if (!e) return;
    const m = e.message || '';
    if (/row-level security|permission denied|violates row-level/i.test(m)) throw new Error(fallback || 'No tienes permiso para hacer esto.');
    if (/Vas muy rápido/.test(m)) throw new Error('Vas muy rápido. Espera un momento antes de volver a publicar.');
    if (/JWT|expired/i.test(m)) throw new Error('Tu sesión terminó. Vuelve a entrar.');
    throw new Error(m || fallback || 'Algo salió mal.');
  };
  const q = async (p, msg) => { const r = await p; fail(r.error, msg); return r.data; };
  const uid = async () => { const { data } = await sb.auth.getSession(); if (!data.session) throw new Error('Tu sesión terminó. Vuelve a entrar.'); return data.session.user.id; };

  const pub = (p) => p && { id: p.id, name: p.full_name || 'Alumno', avatar: p.avatar_url || '', service: p.service || '', role: p.role };
  async function people(ids) {
    const need = [...new Set(ids.filter((i) => i && !pcache.has(i)))];
    if (need.length) {
      const rows = await q(sb.from('public_profiles').select('*').in('id', need));
      rows.forEach((r) => pcache.set(r.id, r));
    }
    const out = {}; ids.forEach((i) => { if (i) out[i] = pub(pcache.get(i)) || { id: i, name: 'Alumno', avatar: '' }; }); return out;
  }

  async function signed(bucket, paths) {
    const now = Date.now(), out = {}, need = [];
    paths.filter(Boolean).forEach((p) => { const c = ucache.get(bucket + '/' + p); if (c && c.exp > now + 60000) out[p] = c.url; else need.push(p); });
    if (need.length) {
      const { data, error } = await sb.storage.from(bucket).createSignedUrls([...new Set(need)], TTL);
      if (!error) (data || []).forEach((d) => { if (d.signedUrl) { ucache.set(bucket + '/' + d.path, { url: d.signedUrl, exp: now + TTL * 1000 }); out[d.path] = d.signedUrl; } });
    }
    return out;
  }

  async function upload(bucket, path, blob, contentType) {
    const { error } = await sb.storage.from(bucket).upload(path, blob, { upsert: true, contentType: contentType || blob.type, cacheControl: '3600' });
    fail(error, 'No se pudo subir el archivo.');
    return path;
  }
  const ext = (t) => (/webp/.test(t) ? 'webp' : /png/.test(t) ? 'png' : 'jpg');

  const activeSub = (s) => s && ['active', 'cancelled'].includes(s.status) && s.current_period_end && new Date(s.current_period_end) > new Date() ? s : null;

  return {
    mode: 'supabase',
    sb,

    /* ---------- sesión ---------- */
    async me(force = false) {
      if (meCache && !force) return meCache;
      const { data } = await sb.auth.getSession(); const s = data.session; if (!s) return null;
      const p = await q(sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
      if (!p) return null;
      const sub = await q(sb.from('subscriptions').select('*').eq('user_id', s.user.id).maybeSingle());
      const a = activeSub(sub);
      meCache = { id: p.id, name: p.full_name || 'Alumno', avatar: p.avatar_url || '', cover: p.cover_url || '', service: p.service || '', church: p.church || '',
        city: p.city || '', bio: p.bio || '', social: p.social || '', privacy: p.privacy || 'public', role: p.role, email: s.user.email,
        created_at: p.created_at, isAdmin: p.role === 'admin', subscription: a, hasAccess: !!a || p.role === 'admin' };
      pcache.set(p.id, p);
      return meCache;
    },
    async signOut() { meCache = null; await sb.auth.signOut(); },

    /* ---------- perfiles ---------- */
    async getProfile(id) {
      const me = await uid();
      const p = await q(sb.from('public_profiles').select('*').eq('id', id).maybeSingle());
      if (!p) throw new Error('Perfil no encontrado.');
      pcache.set(id, p);
      const hidden = p.privacy === 'private' && id !== me;
      const [posts, groups] = await Promise.all([
        sb.from('feed_posts').select('id', { count: 'exact', head: true }).eq('author_id', id).is('community_id', null),
        sb.from('community_members').select('community_id', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'active'),
      ]);
      return { ...pub(p), cover: p.cover_url || '', bio: p.bio || '', church: p.church || '', city: p.city || '', social: p.social || '',
        privacy: p.privacy, created_at: p.created_at, hidden, isMe: id === me, stats: { posts: posts.count || 0, groups: groups.count || 0, amens: 0 } };
    },
    async updateMe(patch) {
      const me = await uid(); const row = {};
      const map = { name: 'full_name', service: 'service', church: 'church', city: 'city', bio: 'bio', social: 'social', privacy: 'privacy' };
      Object.keys(map).forEach((k) => { if (k in patch) row[map[k]] = String(patch[k] ?? '').slice(0, k === 'bio' ? 400 : 120); });
      row.updated_at = new Date().toISOString();
      await q(sb.from('profiles').update(row).eq('id', me));
      pcache.delete(me); meCache = null; return this.me(true);
    },
    async uploadAvatar(img) {
      const me = await uid(); const path = `${me}/avatar.${ext(img.type)}`;
      await upload('avatars', path, img.blob);
      const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      await q(sb.from('profiles').update({ avatar_url: url }).eq('id', me)); meCache = null; pcache.delete(me); return url;
    },
    async uploadCover(img) {
      const me = await uid(); const path = `${me}/cover.${ext(img.type)}`;
      await upload('avatars', path, img.blob);
      const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      await q(sb.from('profiles').update({ cover_url: url }).eq('id', me)); meCache = null; pcache.delete(me); return url;
    },
    async searchPeople(term) {
      let r = sb.from('public_profiles').select('*').limit(20);
      if (term) r = r.ilike('full_name', `%${term.replace(/[%_]/g, '')}%`);
      const rows = await q(r); rows.forEach((p) => pcache.set(p.id, p)); return rows.map(pub);
    },

    /* ---------- publicaciones ---------- */
    async _decorate(rows) {
      if (!rows.length) return [];
      const me = await uid(); const ids = rows.map((p) => p.id);
      const [media, rx, cms, saves, auth] = await Promise.all([
        q(sb.from('feed_media').select('post_id,path,width,height,position').in('post_id', ids).order('position')),
        q(sb.from('feed_reactions').select('post_id,user_id,kind').in('post_id', ids)),
        q(sb.from('feed_comments').select('post_id').in('post_id', ids)),
        q(sb.from('feed_saves').select('post_id').eq('user_id', me).in('post_id', ids)),
        people(rows.map((p) => p.author_id)),
      ]);
      const urls = await signed('feed', media.map((m) => m.path));
      const cids = [...new Set(rows.map((p) => p.community_id).filter(Boolean))];
      const comms = cids.length ? await q(sb.from('communities').select('id,name').in('id', cids)) : [];
      const isAdmin = (await this.me()).isAdmin;
      return rows.map((p) => {
        const r = rx.filter((x) => x.post_id === p.id);
        const counts = { amen: 0, orando: 0, aleluya: 0, comments: cms.filter((c) => c.post_id === p.id).length };
        r.forEach((x) => { counts[x.kind]++; });
        const c = comms.find((k) => k.id === p.community_id);
        return { id: p.id, author: auth[p.author_id], type: p.type, body: p.body, created_at: p.created_at,
          media: media.filter((m) => m.post_id === p.id).map((m) => ({ url: urls[m.path], w: m.width, h: m.height })).filter((m) => m.url),
          group: c ? { id: c.id, name: c.name } : null, counts, mine: (r.find((x) => x.user_id === me) || {}).kind || null,
          saved: saves.some((s) => s.post_id === p.id), canEdit: p.author_id === me || isAdmin };
      });
    },
    async listPosts({ groupId = null, type = null, authorId = null, saved = false, limit = 30 } = {}) {
      const me = await uid();
      let r = sb.from('feed_posts').select('id,author_id,community_id,type,body,created_at').order('created_at', { ascending: false }).limit(limit);
      if (groupId) r = r.eq('community_id', groupId);
      else if (authorId) r = r.eq('author_id', authorId);
      else if (saved) {
        const s = await q(sb.from('feed_saves').select('post_id').eq('user_id', me).order('created_at', { ascending: false }).limit(100));
        if (!s.length) return []; r = r.in('id', s.map((x) => x.post_id));
      } else r = r.is('community_id', null);
      if (type) r = r.eq('type', type);
      return this._decorate(await q(r, 'Esta comunidad es privada.'));
    },
    async getPost(id) {
      const p = await q(sb.from('feed_posts').select('id,author_id,community_id,type,body,created_at').eq('id', id).maybeSingle());
      if (!p) throw new Error('Publicación no disponible.');
      return (await this._decorate([p]))[0];
    },
    async createPost({ body, type = 'reflexion', groupId = null, images = [] }) {
      const me = await uid(); body = String(body || '').trim().slice(0, 3000);
      if (!body && !images.length) throw new Error('Escribe algo o agrega una foto.');
      const post = await q(sb.from('feed_posts').insert({ author_id: me, community_id: groupId, type, body }).select('id,author_id,community_id,type,body,created_at').single(), 'Únete a la comunidad para publicar.');
      try {
        for (let i = 0; i < Math.min(images.length, 6); i++) {
          const img = images[i]; const path = `${me}/${post.id}/${i}.${ext(img.type)}`;
          await upload('feed', path, img.blob);
          await q(sb.from('feed_media').insert({ post_id: post.id, path, width: img.width, height: img.height, position: i }));
        }
      } catch (e) { await sb.from('feed_posts').delete().eq('id', post.id); throw e; }
      return (await this._decorate([post]))[0];
    },
    async deletePost(id) {
      const media = await q(sb.from('feed_media').select('path').eq('post_id', id));
      await q(sb.from('feed_posts').delete().eq('id', id), 'No puedes borrar esta publicación.');
      if (media.length) await sb.storage.from('feed').remove(media.map((m) => m.path));
    },
    async react(postId, kind) {
      const me = await uid();
      if (!['amen', 'orando', 'aleluya'].includes(kind)) throw new Error('Reacción inválida.');
      const cur = await q(sb.from('feed_reactions').select('kind').eq('post_id', postId).eq('user_id', me).maybeSingle());
      if (cur && cur.kind === kind) await q(sb.from('feed_reactions').delete().eq('post_id', postId).eq('user_id', me));
      else if (cur) await q(sb.from('feed_reactions').update({ kind }).eq('post_id', postId).eq('user_id', me));
      else await q(sb.from('feed_reactions').insert({ post_id: postId, user_id: me, kind }));
      return this.getPost(postId);
    },
    async reactors(postId) {
      const rows = await q(sb.from('feed_reactions').select('user_id,kind').eq('post_id', postId));
      const ppl = await people(rows.map((r) => r.user_id));
      return rows.map((r) => ({ user: ppl[r.user_id], kind: r.kind }));
    },
    async toggleSave(postId) {
      const me = await uid();
      const cur = await q(sb.from('feed_saves').select('post_id').eq('user_id', me).eq('post_id', postId).maybeSingle());
      if (cur) { await q(sb.from('feed_saves').delete().eq('user_id', me).eq('post_id', postId)); return false; }
      await q(sb.from('feed_saves').insert({ user_id: me, post_id: postId })); return true;
    },
    async report(kind, id, reason) {
      const me = await uid();
      await q(sb.from('reports').insert({ reporter_id: me, target_kind: kind, target_id: id, reason: String(reason || '').slice(0, 500) }));
    },

    /* ---------- comentarios ---------- */
    async listComments(postId) {
      const me = await uid();
      const rows = await q(sb.from('feed_comments').select('*').eq('post_id', postId).order('created_at'));
      const [ppl, post] = await Promise.all([people(rows.map((r) => r.author_id)), sb.from('feed_posts').select('author_id').eq('id', postId).maybeSingle()]);
      const isAdmin = (await this.me()).isAdmin; const postAuthor = post.data && post.data.author_id;
      return rows.map((c) => ({ id: c.id, parent_id: c.parent_id, body: c.body, created_at: c.created_at, author: ppl[c.author_id], canDelete: c.author_id === me || isAdmin || postAuthor === me }));
    },
    async addComment(postId, body, parentId = null) {
      const me = await uid(); body = String(body || '').trim().slice(0, 1500); if (!body) throw new Error('Escribe un comentario.');
      return q(sb.from('feed_comments').insert({ post_id: postId, author_id: me, body, parent_id: parentId }).select().single());
    },
    async deleteComment(id) { await q(sb.from('feed_comments').delete().eq('id', id), 'No puedes borrar este comentario.'); },

    /* ---------- comunidades ---------- */
    async _groups(rows) {
      if (!rows.length) return [];
      const me = await uid(); const ids = rows.map((g) => g.id);
      const [mine, stats, owners] = await Promise.all([
        q(sb.from('community_members').select('community_id,role,status').eq('user_id', me).in('community_id', ids)),
        q(sb.from('community_stats').select('*').in('community_id', ids)),
        people(rows.map((g) => g.owner_id)),
      ]);
      const isAdmin = (await this.me()).isAdmin;
      return rows.map((g) => {
        const m = mine.find((x) => x.community_id === g.id); const st = stats.find((x) => x.community_id === g.id) || {};
        return { id: g.id, name: g.name, description: g.description, rules: g.rules, privacy: g.privacy, cover: g.cover_url || '', created_at: g.created_at,
          owner: owners[g.owner_id], members: st.members || 0, pending: st.pending || 0, myStatus: m ? m.status : null, myRole: m ? m.role : null,
          canManage: isAdmin || !!(m && m.status === 'active' && ['owner', 'admin'].includes(m.role)) };
      });
    },
    async listGroups({ q: term = '', mine = false } = {}) {
      const me = await uid();
      let r = sb.from('communities').select('*').order('created_at', { ascending: false }).limit(60);
      if (term) r = r.ilike('name', `%${term.replace(/[%_]/g, '')}%`);
      if (mine) {
        const m = await q(sb.from('community_members').select('community_id').eq('user_id', me).eq('status', 'active'));
        if (!m.length) return []; r = r.in('id', m.map((x) => x.community_id));
      }
      return this._groups(await q(r));
    },
    async getGroup(id) {
      const g = await q(sb.from('communities').select('*').eq('id', id).maybeSingle());
      if (!g) throw new Error('Comunidad no encontrada.');
      return (await this._groups([g]))[0];
    },
    async createGroup({ name, description, privacy = 'public', cover = null, rules = '' }) {
      const me = await uid();
      const g = await q(sb.from('communities').insert({ name: String(name || '').trim().slice(0, 60), description: String(description || '').trim().slice(0, 400),
        rules: String(rules || '').slice(0, 800), privacy: privacy === 'private' ? 'private' : 'public', owner_id: me }).select().single(), 'No se pudo crear la comunidad.');
      if (cover) {
        const path = `${g.id}/cover.${ext(cover.type)}`;
        await upload('community', path, cover.blob);
        await q(sb.from('communities').update({ cover_url: sb.storage.from('community').getPublicUrl(path).data.publicUrl }).eq('id', g.id));
      }
      return this.getGroup(g.id);
    },
    async joinGroup(id) {
      const me = await uid(); const g = await this.getGroup(id);
      if (g.myStatus) return g.myStatus;
      const status = g.privacy === 'private' ? 'pending' : 'active';
      await q(sb.from('community_members').insert({ community_id: id, user_id: me, role: 'member', status }));
      return status;
    },
    async leaveGroup(id) {
      const me = await uid();
      await q(sb.from('community_members').delete().eq('community_id', id).eq('user_id', me), 'Eres la dueña de esta comunidad: no puedes salir sin transferirla.');
    },
    async listMembers(id) {
      const me = await uid();
      const rows = await q(sb.from('community_members').select('*').eq('community_id', id).order('joined_at'));
      const ppl = await people(rows.map((r) => r.user_id));
      return rows.map((r) => ({ user: ppl[r.user_id], role: r.role, status: r.status, joined_at: r.joined_at, isMe: r.user_id === me }))
        .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.status === 'pending' ? -1 : 0));
    },
    async setMember(groupId, userId, action) {
      const base = sb.from('community_members');
      if (action === 'approve') await q(base.update({ status: 'active' }).eq('community_id', groupId).eq('user_id', userId), 'Solo quien administra la comunidad puede aprobar.');
      if (action === 'remove') await q(base.delete().eq('community_id', groupId).eq('user_id', userId), 'No se puede quitar a esta persona.');
      if (action === 'admin') {
        const cur = await q(base.select('role').eq('community_id', groupId).eq('user_id', userId).single());
        await q(sb.from('community_members').update({ role: cur.role === 'admin' ? 'member' : 'admin' }).eq('community_id', groupId).eq('user_id', userId));
      }
    },
    async _msgs(rows) {
      const me = await uid();
      const [ppl, urls] = await Promise.all([people(rows.map((m) => m.author_id)), signed('chat', rows.map((m) => m.image_path))]);
      return rows.map((m) => ({ id: m.id, body: m.body, image: m.image_path ? urls[m.image_path] || null : null, created_at: m.created_at, author: ppl[m.author_id], mine: m.author_id === me }));
    },
    async listMessages(groupId) {
      const rows = await q(sb.from('community_messages').select('*').eq('community_id', groupId).order('created_at', { ascending: false }).limit(200), 'Únete a la comunidad para ver el chat.');
      return this._msgs(rows.reverse());
    },
    async sendMessage(groupId, { body = '', image = null }) {
      const me = await uid(); body = String(body).trim().slice(0, 2000); if (!body && !image) return null;
      let image_path = null;
      if (image) image_path = await upload('chat', `${groupId}/${me}/${Date.now()}.${ext(image.type)}`, image.blob);
      const row = await q(sb.from('community_messages').insert({ community_id: groupId, author_id: me, body, image_path }).select().single(), 'Únete a la comunidad para escribir.');
      return (await this._msgs([row]))[0];
    },
    subscribeMessages(groupId, cb) {
      const ch = sb.channel(`chat-${groupId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${groupId}` },
          async (payload) => { try { cb((await this._msgs([payload.new]))[0]); } catch (_) {} })
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    /* ---------- notificaciones ---------- */
    async listNotifications() {
      const me = await uid();
      const [rows, reads] = await Promise.all([
        q(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)),
        q(sb.from('notification_reads').select('notification_id').eq('user_id', me)),
      ]);
      const ppl = await people(rows.map((n) => n.actor_id)); const rd = new Set(reads.map((r) => r.notification_id));
      return rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, created_at: n.created_at, actor: ppl[n.actor_id] || null, read: rd.has(n.id) }));
    },
    async unreadCount() { return (await this.listNotifications()).filter((n) => !n.read).length; },
    async markRead(id) {
      const me = await uid();
      const ids = id === 'all' ? (await this.listNotifications()).filter((n) => !n.read).map((n) => n.id) : [id];
      if (ids.length) await q(sb.from('notification_reads').upsert(ids.map((n) => ({ user_id: me, notification_id: n })), { onConflict: 'user_id,notification_id', ignoreDuplicates: true }));
    },
    onNotify(cb) {
      const ch = sb.channel('notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => cb()).subscribe();
      return () => sb.removeChannel(ch);
    },

    /* ---------- biblioteca ---------- */
    async listCollections() {
      const [cols, sc] = await Promise.all([q(sb.from('score_collections').select('*').order('position')), q(sb.from('scores').select('collection_id').eq('published', true))]);
      return cols.map((c) => ({ ...c, count: sc.filter((s) => s.collection_id === c.id).length }));
    },
    async listScores({ q: term = '', instrument = '', level = '', collection = '', favorites = false } = {}) {
      const me = await this.me(); let r = sb.from('scores').select('*').order('position').order('created_at', { ascending: false });
      if (!me.isAdmin) r = r.eq('published', true);
      if (instrument) r = r.eq('instrument', instrument);
      if (level) r = r.eq('level', level);
      if (collection) r = r.eq('collection_id', collection);
      if (term) r = r.or(`title.ilike.%${term.replace(/[%_,()]/g, '')}%,composer.ilike.%${term.replace(/[%_,()]/g, '')}%`);
      const [rows, favs] = await Promise.all([q(r), q(sb.from('score_favorites').select('score_id').eq('user_id', me.id))]);
      const fav = new Set(favs.map((f) => f.score_id));
      return rows.filter((s) => !favorites || fav.has(s.id)).map((s) => ({ ...s, collection: s.collection_id, locked: !s.free && !me.hasAccess, favorite: fav.has(s.id), hasMedia: s.has_media }));
    },
    async getScore(id) {
      const me = await this.me();
      const s = await q(sb.from('scores').select('*').eq('id', id).maybeSingle());
      if (!s) throw new Error('Obra no disponible.');
      const a = await q(sb.from('score_assets').select('*').eq('score_id', id).maybeSingle());
      if (!a) { if (!s.free && !me.hasAccess) { const e = new Error('Necesitas una suscripción activa para abrir esta obra.'); e.code = 'PAYWALL'; throw e; } throw new Error('Esta obra aún no tiene archivo MusicXML.'); }
      const paths = [a.xml_path, a.pdf_path];
      const media = a.media_url && !/^https?:/.test(a.media_url) ? a.media_url : null;
      const [u1, u2] = await Promise.all([signed('scores', paths), media ? signed('score-media', [media]) : {}]);
      const xml = await (await fetch(u1[a.xml_path])).text();
      const fav = await q(sb.from('score_favorites').select('score_id').eq('user_id', me.id).eq('score_id', id).maybeSingle());
      return { ...s, collection: s.collection_id, xml, pdf_url: a.pdf_path ? u1[a.pdf_path] : '', media_url: media ? u2[media] : (a.media_url || ''), sync: a.sync, favorite: !!fav };
    },
    async toggleFavorite(scoreId) {
      const me = await uid();
      const cur = await q(sb.from('score_favorites').select('score_id').eq('user_id', me).eq('score_id', scoreId).maybeSingle());
      if (cur) { await q(sb.from('score_favorites').delete().eq('user_id', me).eq('score_id', scoreId)); return false; }
      await q(sb.from('score_favorites').insert({ user_id: me, score_id: scoreId })); return true;
    },

    /* ---------- suscripción ---------- */
    async mySubscription() { return (await this.me(true)).subscription; },
    /** Confirma en el servidor una suscripción aprobada en PayPal. El servidor la verifica con PayPal. */
    async activatePayPal(subscriptionID) {
      const { data } = await sb.auth.getSession(); if (!data.session) throw new Error('Tu sesión terminó.');
      const r = await fetch('/api/paypal/activate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ subscriptionID }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No pudimos confirmar el pago. Si se cobró, escríbenos y lo activamos.');
      meCache = null; return this.me(true);
    },
    async cancelSubscription() {
      const { data } = await sb.auth.getSession();
      const r = await fetch('/api/paypal/cancel', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!r.ok) throw new Error('No pudimos cancelar. Escríbenos y lo hacemos por ti.');
      meCache = null;
    },

    /* ---------- administración (RLS exige rol admin en cada tabla) ---------- */
    async adminStats() { const s = await q(sb.from('campus_stats').select('*').single()); return { users: s.users, newUsers7d: s.new_users_7d, activeSubs: s.active_subs, scores: s.scores, posts: s.posts, groups: s.groups, reports: s.reports }; },
    async adminUsers() {
      const [ps, subs] = await Promise.all([q(sb.from('profiles').select('*').order('created_at', { ascending: false })), q(sb.from('subscriptions').select('*'))]);
      return ps.map((p) => ({ ...pub(p), created_at: p.created_at, city: p.city, subscription: subs.find((s) => s.user_id === p.id) || null }));
    },
    async adminAllScores() {
      const [rows, assets] = await Promise.all([q(sb.from('scores').select('*').order('created_at', { ascending: false })), q(sb.from('score_assets').select('*'))]);
      return rows.map((s) => { const a = assets.find((x) => x.score_id === s.id) || {}; return { ...s, collection: s.collection_id, sync: a.sync || null, media_url: a.media_url || '', hasXml: !!a.xml_path, hasPdf: !!a.pdf_path }; });
    },
    async adminScoreXml(id) {
      const a = await q(sb.from('score_assets').select('xml_path').eq('score_id', id).maybeSingle());
      if (!a || !a.xml_path) return null;
      const u = await signed('scores', [a.xml_path]); return (await fetch(u[a.xml_path])).text();
    },
    async adminSaveScore(meta, xmlText, files = {}) {
      const row = {}; ['title', 'composer', 'instrument', 'level', 'key_label', 'bpm', 'free', 'tags', 'published'].forEach((k) => { if (k in meta) row[k] = meta[k]; });
      if ('collection' in meta) row.collection_id = meta.collection || null;
      row.updated_at = new Date().toISOString();
      const s = meta.id
        ? await q(sb.from('scores').update(row).eq('id', meta.id).select().single())
        : await q(sb.from('scores').insert(row).select().single());
      const asset = { score_id: s.id };
      if (xmlText) asset.xml_path = await upload('scores', `${s.id}/score.musicxml`, new Blob([xmlText], { type: 'application/vnd.recordare.musicxml+xml' }));
      if (files.pdf) asset.pdf_path = await upload('scores', `${s.id}/original.pdf`, files.pdf, 'application/pdf');
      if (files.media) { const e = (files.media.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, ''); asset.media_url = await upload('score-media', `${s.id}/media.${e}`, files.media); }
      if ('media_url' in meta && !files.media) asset.media_url = meta.media_url || null;
      if (Object.keys(asset).length > 1) {
        await q(sb.from('score_assets').upsert(asset, { onConflict: 'score_id' }));
        if ('media_url' in asset) await q(sb.from('scores').update({ has_media: !!asset.media_url }).eq('id', s.id));
      }
      return s;
    },
    async adminSaveSync(id, sync) { await q(sb.from('score_assets').upsert({ score_id: id, sync }, { onConflict: 'score_id' })); },
    async adminDeleteScore(id) {
      const a = await q(sb.from('score_assets').select('*').eq('score_id', id).maybeSingle());
      await q(sb.from('scores').delete().eq('id', id));
      if (a) {
        const f = [a.xml_path, a.pdf_path].filter(Boolean); if (f.length) await sb.storage.from('scores').remove(f);
        if (a.media_url && !/^https?:/.test(a.media_url)) await sb.storage.from('score-media').remove([a.media_url]);
      }
    },
    async adminSaveCollection(c) {
      const row = { title: String(c.title || '').slice(0, 80), description: String(c.description || '').slice(0, 300) };
      return c.id ? q(sb.from('score_collections').update(row).eq('id', c.id).select().single()) : q(sb.from('score_collections').insert(row).select().single());
    },
    async adminDeleteCollection(id) { await q(sb.from('score_collections').delete().eq('id', id)); },
    async adminBroadcast({ title, body, link }) {
      title = String(title || '').trim().slice(0, 120); if (!title) throw new Error('Escribe un título.');
      link = String(link || '').trim(); if (link && !link.startsWith('#/')) link = '';
      await q(sb.from('notifications').insert({ user_id: null, kind: 'broadcast', title, body: String(body || '').slice(0, 600), link, actor_id: await uid() }));
    },
    async adminBroadcasts() { return q(sb.from('notifications').select('*').is('user_id', null).order('created_at', { ascending: false }).limit(50)); },
    async adminReports() {
      const rows = await q(sb.from('reports').select('*').order('created_at', { ascending: false }).limit(100));
      const ppl = await people(rows.map((r) => r.reporter_id));
      const postIds = rows.filter((r) => r.target_kind === 'post').map((r) => r.target_id);
      const comIds = rows.filter((r) => r.target_kind === 'comment').map((r) => r.target_id);
      const [ps, cs] = await Promise.all([postIds.length ? q(sb.from('feed_posts').select('id,body,author_id').in('id', postIds)) : [], comIds.length ? q(sb.from('feed_comments').select('id,body,author_id').in('id', comIds)) : []]);
      const authors = await people([...ps, ...cs].map((x) => x.author_id));
      return rows.map((r) => { const t = (r.target_kind === 'post' ? ps : cs).find((x) => x.id === r.target_id); return { ...r, reporter: ppl[r.reporter_id], target: t ? { body: t.body, author: authors[t.author_id] } : null }; });
    },
    async adminResolveReport(id, remove) {
      const r = await q(sb.from('reports').select('*').eq('id', id).single());
      if (remove) { if (r.target_kind === 'post') await this.deletePost(r.target_id); if (r.target_kind === 'comment') await this.deleteComment(r.target_id); }
      await q(sb.from('reports').update({ status: remove ? 'removed' : 'dismissed' }).eq('id', id));
    },
  };
}
