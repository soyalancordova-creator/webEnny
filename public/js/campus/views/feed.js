/* ============================================================
   FEED · publicaciones, reacciones, comentarios, guardados
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, richText, avatar, ago, toast, modal, confirmBox, lightbox, popMenu, loading, empty } from '../ui.js';
import { compressImage, kb } from '../media.js';

export const TYPES = {
  reflexion: { label: 'Reflexión', ic: 'edit' },
  pregunta: { label: 'Pregunta', ic: 'info' },
  recomendacion: { label: 'Recomendación', ic: 'heart' },
  oracion: { label: 'Petición de oración', ic: 'church' },
  testimonio: { label: 'Testimonio', ic: 'sparkle' },
};
export const REACTIONS = {
  amen: { emo: '🕊️', label: 'Amén' },
  orando: { emo: '🙏', label: 'Orando' },
  aleluya: { emo: '🙌', label: 'Aleluya' },
};

const VERSES = [
  ['Todo lo que respira alabe a JAH. Aleluya.', 'Salmos 150:6'],
  ['Cantad alegres a Dios, habitantes de toda la tierra.', 'Salmos 100:1'],
  ['Cantadle cántico nuevo; hacedlo bien, tañendo con júbilo.', 'Salmos 33:3'],
  ['Y todo lo que hacéis, sea de palabra o de hecho, hacedlo todo en el nombre del Señor Jesús.', 'Colosenses 3:17'],
  ['Hablando entre vosotros con salmos, con himnos y cánticos espirituales.', 'Efesios 5:19'],
  ['Alabad a Dios en su santuario; alabadle con salterio y arpa.', 'Salmos 150:1'],
  ['Mi fortaleza y mi cántico es JAH, y él me ha sido por salvación.', 'Salmos 118:14'],
];
export function verseOfDay() {
  const d = new Date(); const k = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % VERSES.length;
  return VERSES[k];
}

// un solo listener para cerrar el selector de reacciones abierto con pulsación larga
document.addEventListener('pointerdown', (e) => {
  document.querySelectorAll('.rx-pop.show').forEach((p) => { if (!p.parentElement.contains(e.target)) p.classList.remove('show'); });
}, { capture: true });

/* ---------- tarjeta de publicación ---------- */
function mediaGrid(media) {
  if (!media || !media.length) return '';
  const shown = media.slice(0, 4), n = shown.length;
  return `<div class="post-grid n${n}">${shown.map((m, i) => `<button data-lb="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(m.url)}" alt="" loading="lazy"></button>`).join('')}</div>`;
}

function reactSummary(p) {
  const total = p.counts.amen + p.counts.orando + p.counts.aleluya;
  const emos = Object.keys(REACTIONS).filter((k) => p.counts[k]).sort((a, b) => p.counts[b] - p.counts[a]).map((k) => `<span>${REACTIONS[k].emo}</span>`).join('');
  return `<div class="post-sum">${total ? `<span class="emos">${emos}</span><button data-who>${total}</button>` : ''}<span class="sp"></span>${p.counts.comments ? `<button data-cm>${p.counts.comments} comentario${p.counts.comments === 1 ? '' : 's'}</button>` : ''}</div>`;
}

export function postHTML(p) {
  const t = TYPES[p.type] || TYPES.reflexion;
  const mine = p.mine ? REACTIONS[p.mine] : null;
  return `<article class="cx-card post" data-id="${esc(p.id)}">
    <div class="post-h">
      <a href="#/perfil/${esc(p.author.id)}">${avatar(p.author)}</a>
      <div class="who"><a href="#/perfil/${esc(p.author.id)}">${esc(p.author.name)}</a>
        <span>${esc(p.author.service || '')}${p.author.service ? ' · ' : ''}${ago(p.created_at)}${p.group ? ` · en <a href="#/comunidad/${esc(p.group.id)}" style="color:var(--wine)">${esc(p.group.name)}</a>` : ''}</span></div>
      <span class="pill ${p.type === 'oracion' ? 'wine' : 'gold'}">${icon(t.ic)}${esc(t.label)}</span>
      <button class="cx-iconbtn" data-more aria-label="Más opciones" style="width:34px;height:34px">${icon('more')}</button>
    </div>
    ${p.body ? `<div class="post-body">${richText(p.body)}</div>` : ''}
    ${mediaGrid(p.media)}
    ${reactSummary(p)}
    <div class="post-act">
      <div class="pa-rx" style="position:relative;display:grid">
        <button class="pa${mine ? ' on' : ''}" data-rx aria-label="Reaccionar">${mine ? `<span class="emo">${mine.emo}</span><span class="t">${mine.label}</span>` : `<span class="emo">🕊️</span><span class="t">Amén</span>`}</button>
        <div class="rx-pop" role="menu">${Object.entries(REACTIONS).map(([k, r]) => `<button data-kind="${k}" role="menuitem" aria-label="${r.label}"><span>${r.emo}</span><small>${r.label}</small></button>`).join('')}</div>
      </div>
      <button class="pa" data-cm>${icon('comment')}<span class="t">Comentar</span></button>
      <button class="pa" data-share>${icon('share')}<span class="t">Compartir</span></button>
      <button class="pa${p.saved ? ' saved' : ''}" data-save>${icon('bookmark')}<span class="t">${p.saved ? 'Guardado' : 'Guardar'}</span></button>
    </div>
    <div class="cm" hidden></div>
  </article>`;
}

/* ---------- comportamiento de una tarjeta ---------- */
export function wirePost(el, p, ctx, { onRemove, openComments = false } = {}) {
  const { store } = ctx;
  let post = p;
  const repaint = (np) => {
    post = np;
    const open = !$('.cm', el).hidden;
    const fresh = document.createElement('div'); fresh.innerHTML = postHTML(np);
    const nel = fresh.firstElementChild; el.replaceWith(nel);
    wirePost(nel, np, ctx, { onRemove, openComments: open });
  };

  $$('[data-lb]', el).forEach((b) => { b.onclick = () => lightbox(post.media.map((m) => m.url), +b.dataset.lb); });

  const rxBtn = $('[data-rx]', el), pop = $('.rx-pop', el);
  const react = async (kind) => { try { repaint(await store.react(post.id, kind)); } catch (e) { toast(e.message); } };
  rxBtn.onclick = () => { if (el._lp) { el._lp = false; return; } react(post.mine || 'amen'); };
  // en táctil, mantener presionado abre el selector
  let lpT = 0;
  rxBtn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; lpT = setTimeout(() => { el._lp = true; pop.classList.add('show'); }, 420); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => rxBtn.addEventListener(ev, () => clearTimeout(lpT)));
  $$('[data-kind]', pop).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); pop.classList.remove('show'); react(b.dataset.kind); }; });

  const who = $('[data-who]', el);
  if (who) who.onclick = async () => {
    const list = await store.reactors(post.id);
    modal({ title: 'Reacciones', body: `<div class="mem">${list.map((r) => `<a class="mem-item" href="#/perfil/${esc(r.user.id)}">${avatar(r.user, 'sm')}<div class="who"><b>${esc(r.user.name)}</b></div><span style="font-size:1.2rem">${REACTIONS[r.kind].emo}</span></a>`).join('')}</div>` });
  };

  const cmBox = $('.cm', el);
  const toggleCm = async (force) => {
    const show = force ?? cmBox.hidden;
    cmBox.hidden = !show;
    if (show) await mountComments(cmBox, post, ctx, (n) => { post.counts.comments = n; const s = $('.post-sum', el); s.outerHTML = reactSummary(post); const ns = $('.post-sum', el); const w = $('[data-who]', ns); if (w) w.onclick = who && who.onclick; $$('[data-cm]', ns).forEach((b) => { b.onclick = () => toggleCm(); }); });
  };
  $$('[data-cm]', el).forEach((b) => { b.onclick = () => toggleCm(); });

  $('[data-share]', el).onclick = async () => {
    const url = `${location.origin}${location.pathname}#/publicacion/${post.id}`;
    const text = (post.body || '').slice(0, 140);
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.name} en ${ctx.APP}`, text, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado. Solo lo pueden abrir personas con cuenta.'); }
    } catch (_) { /* cancelado */ }
  };

  $('[data-save]', el).onclick = async () => {
    try { const s = await store.toggleSave(post.id); repaint({ ...post, saved: s }); toast(s ? 'Guardado. Lo encuentras en Guardados.' : 'Quitado de Guardados.'); }
    catch (e) { toast(e.message); }
  };

  $('[data-more]', el).onclick = (e) => {
    const items = [{ label: 'Copiar enlace', icon: 'link', run: async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/publicacion/${post.id}`); toast('Enlace copiado.'); } }];
    if (post.canEdit) items.push({ label: 'Eliminar publicación', icon: 'trash', danger: true, run: async () => {
      if (!(await confirmBox('¿Eliminar esta publicación? No se puede deshacer.', 'Eliminar'))) return;
      try { await store.deletePost(post.id); el.remove(); toast('Publicación eliminada.'); if (onRemove) onRemove(); } catch (err) { toast(err.message); }
    } });
    if (post.author.id !== ctx.me.id) items.push({ label: 'Reportar', icon: 'flag', run: () => reportDialog(ctx, 'post', post.id) });
    popMenu(e.currentTarget, items);
  };

  if (openComments) toggleCm(true);
}

export function reportDialog(ctx, kind, id) {
  const m = modal({ title: 'Reportar contenido', body: `<p class="muted" style="font-size:.9rem;margin-bottom:1rem">Tu reporte es anónimo para la otra persona. El equipo lo revisa.</p>
    <div class="fld"><label>Motivo</label><select id="rpR"><option>Contenido ofensivo o irrespetuoso</option><option>Spam o publicidad</option><option>Información falsa</option><option>Partitura sin permiso de autor</option><option>Otro</option></select></div>
    <div class="fld" style="margin-top:.8rem"><label>Detalle (opcional)</label><textarea id="rpD" maxlength="400"></textarea></div>
    <div class="cx-row" style="justify-content:flex-end;margin-top:1.1rem"><button class="btn btn-fill btn-sm" id="rpGo"><span>Enviar reporte</span></button></div>` });
  $('#rpGo', m.body).onclick = async () => {
    try { await ctx.store.report(kind, id, `${$('#rpR', m.body).value}. ${$('#rpD', m.body).value}`.trim()); m.close(); toast('Gracias. Lo revisaremos.'); } catch (e) { toast(e.message); }
  };
}

/* ---------- comentarios ---------- */
async function mountComments(box, post, ctx, onCount) {
  const { store } = ctx;
  box.innerHTML = '<div class="cx-row"><span class="spin"></span></div>';
  let list = [];
  try { list = await store.listComments(post.id); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  let replyTo = null;
  const item = (c) => `<div class="cm-item" data-c="${esc(c.id)}">${avatar(c.author, 'sm')}<div class="cm-bub">
    <div class="b"><a class="n" href="#/perfil/${esc(c.author.id)}">${esc(c.author.name)}</a>${richText(c.body)}</div>
    <div class="meta"><span>${ago(c.created_at)}</span>${c.parent_id ? '' : `<button data-reply="${esc(c.id)}" data-name="${esc(c.author.name)}">Responder</button>`}${c.canDelete ? `<button data-del="${esc(c.id)}">Eliminar</button>` : `<button data-rep="${esc(c.id)}">Reportar</button>`}</div>
    ${c.parent_id ? '' : `<div class="cm-replies">${list.filter((r) => r.parent_id === c.id).map(item).join('')}</div>`}
  </div></div>`;
  const draw = () => {
    box.innerHTML = `${list.filter((c) => !c.parent_id).map(item).join('')}
      <form class="cm-form">${avatar(ctx.me, 'sm')}<input maxlength="1500" placeholder="${replyTo ? `Respondiendo a ${esc(replyTo.name)}…` : 'Escribe un comentario con gracia…'}" aria-label="Comentario"><button aria-label="Enviar">${icon('send')}</button></form>
      ${replyTo ? '<button class="cx-chip" data-cancel style="justify-self:start">Cancelar respuesta</button>' : ''}`;
    const f = $('form', box), inp = $('input', f);
    f.onsubmit = async (e) => {
      e.preventDefault(); const v = inp.value.trim(); if (!v) return;
      inp.disabled = true;
      try { await store.addComment(post.id, v, replyTo && replyTo.id); list = await store.listComments(post.id); replyTo = null; draw(); onCount(list.length); $('input', box).focus(); }
      catch (err) { toast(err.message); inp.disabled = false; }
    };
    $$('[data-reply]', box).forEach((b) => { b.onclick = () => { replyTo = { id: b.dataset.reply, name: b.dataset.name }; draw(); $('input', box).focus(); }; });
    $$('[data-del]', box).forEach((b) => { b.onclick = async () => { if (!(await confirmBox('¿Eliminar este comentario?', 'Eliminar'))) return; try { await store.deleteComment(b.dataset.del); list = await store.listComments(post.id); draw(); onCount(list.length); } catch (err) { toast(err.message); } }; });
    $$('[data-rep]', box).forEach((b) => { b.onclick = () => reportDialog(ctx, 'comment', b.dataset.rep); });
    const c = $('[data-cancel]', box); if (c) c.onclick = () => { replyTo = null; draw(); };
  };
  draw();
}

/* ---------- composer ---------- */
export function composer(ctx, { groupId = null, onPosted }) {
  const el = document.createElement('section');
  el.className = 'cx-card cx-pad cmp';
  let images = [];
  el.innerHTML = `<div class="cmp-row">${avatar(ctx.me)}<textarea maxlength="3000" placeholder="¿Qué está inspirando tu música hoy?" aria-label="Escribe una publicación"></textarea></div>
    <div class="cmp-media"></div>
    <div class="cmp-foot">
      <label class="cmp-tool">${icon('image')}Fotos<input type="file" accept="image/*" multiple hidden></label>
      <select aria-label="Tipo de publicación">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>
      <span class="sp"></span>
      <button class="btn btn-fill btn-sm" data-pub disabled><span>Publicar</span></button>
    </div>`;
  const ta = $('textarea', el), pubBtn = $('[data-pub]', el), mediaBox = $('.cmp-media', el);
  const sync = () => { pubBtn.disabled = !ta.value.trim() && !images.length; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, innerHeight * 0.4) + 'px'; };
  ta.addEventListener('input', sync);
  const drawMedia = () => {
    mediaBox.innerHTML = images.map((im, i) => `<figure><img src="${im.preview}" alt=""><button data-rm="${i}" aria-label="Quitar">${icon('x')}</button><small>${kb(im.after)}</small></figure>`).join('');
    $$('[data-rm]', mediaBox).forEach((b) => { b.onclick = () => { URL.revokeObjectURL(images[+b.dataset.rm].preview); images.splice(+b.dataset.rm, 1); drawMedia(); sync(); }; });
  };
  $('input[type=file]', el).onchange = async (e) => {
    const files = [...e.target.files].slice(0, 6 - images.length); e.target.value = '';
    if (!files.length) { toast('Máximo 6 fotos por publicación.'); return; }
    for (const f of files) {
      try { const c = await compressImage(f, { maxSide: 1600, quality: 0.8 }); images.push({ ...c, preview: URL.createObjectURL(c.blob) }); }
      catch (err) { toast(err.message); }
    }
    const before = images.reduce((a, b) => a + b.before, 0), after = images.reduce((a, b) => a + b.after, 0);
    if (images.length) toast(`Fotos optimizadas: ${kb(before)} → ${kb(after)}`);
    drawMedia(); sync();
  };
  pubBtn.onclick = async () => {
    pubBtn.disabled = true; pubBtn.innerHTML = '<span class="spin"></span>';
    try {
      const p = await ctx.store.createPost({ body: ta.value, type: $('select', el).value, groupId, images: images.map(({ blob, width, height, type }) => ({ blob, width, height, type })) });
      images.forEach((im) => URL.revokeObjectURL(im.preview)); images = [];
      ta.value = ''; drawMedia(); sync(); toast('Publicado. Gracias por compartir.');
      if (onPosted) onPosted(p);
    } catch (e) { toast(e.message); }
    pubBtn.innerHTML = '<span>Publicar</span>'; sync();
  };
  return el;
}

/* ---------- lista reutilizable (feed general y de comunidad) ---------- */
export async function mountList(listEl, ctx, query, emptyText = 'Todavía no hay publicaciones aquí.') {
  loading(listEl);
  let posts;
  try { posts = await ctx.store.listPosts(query); } catch (e) { empty(listEl, 'lock', e.message); return []; }
  if (!posts.length) { empty(listEl, 'feed', emptyText); return []; }
  listEl.innerHTML = posts.map(postHTML).join('');
  $$('.post', listEl).forEach((el, i) => wirePost(el, posts[i], ctx));
  return posts;
}

export function prependPost(listEl, p, ctx) {
  const e = listEl.querySelector('.cx-empty'); if (e) listEl.innerHTML = '';
  const tmp = document.createElement('div'); tmp.innerHTML = postHTML(p);
  const el = tmp.firstElementChild; listEl.prepend(el); wirePost(el, p, ctx);
}

/* ---------- vistas ---------- */
export async function renderFeed(ctx, view) {
  ctx.setTitle('Comunidad');
  const [v, ref] = verseOfDay();
  view.innerHTML = `<div class="fd">
    <div class="fd-col">
      <div class="cx-h" style="margin-bottom:.2rem"><div><span class="eyebrow">Comunidad</span><h1>Un lugar para crear y servir</h1>
        <p>Comparte una reflexión, una pregunta o un pedido de oración con músicos que aman a Jesús.</p></div></div>
      <div id="cmpHost"></div>
      <div class="cx-row" id="filters">
        <button class="cx-chip on" data-t="">Todo</button>
        ${Object.entries(TYPES).map(([k, t]) => `<button class="cx-chip" data-t="${k}">${icon(t.ic)}${t.label}</button>`).join('')}
      </div>
      <div class="fd-col" id="list"></div>
    </div>
    <aside class="fd-rail">
      <section class="cx-card verse"><span class="eyebrow">Versículo del día</span><q style="margin-top:.6rem">${esc(v)}</q><cite>${esc(ref)} · RVR1960</cite></section>
      <section class="cx-card cx-pad"><div class="cx-row" style="justify-content:space-between"><h3 style="font-size:1.1rem">Mis comunidades</h3><a class="cx-chip" href="#/comunidades">Ver todas</a></div><div class="mini-list" id="myGroups"></div></section>
      <section class="cx-card cx-pad"><h3 style="font-size:1.1rem">Nuevo en la biblioteca</h3><div class="mini-list" id="newScores"></div></section>
    </aside>
  </div>`;
  const list = $('#list', view);
  let type = '';
  $('#cmpHost', view).appendChild(composer(ctx, { onPosted: (p) => { if (!type || p.type === type) prependPost(list, p, ctx); } }));
  $$('#filters [data-t]', view).forEach((b) => { b.onclick = () => { type = b.dataset.t; $$('#filters .cx-chip', view).forEach((x) => x.classList.toggle('on', x === b)); mountList(list, ctx, { type: type || null }); }; });
  mountList(list, ctx, {});

  ctx.store.listGroups({ mine: true }).then((gs) => {
    $('#myGroups', view).innerHTML = gs.length ? gs.slice(0, 5).map((g) => `<a href="#/comunidad/${esc(g.id)}"><span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('users')}</span><div style="min-width:0"><b>${esc(g.name)}</b><small>${g.members} integrantes</small></div></a>`).join('')
      : '<p class="muted" style="font-size:.86rem;margin-top:.5rem">Aún no te unes a ninguna. <a href="#/comunidades" style="color:var(--wine)">Descubre comunidades</a>.</p>';
  }).catch(() => {});
  ctx.store.listScores({}).then((ss) => {
    $('#newScores', view).innerHTML = ss.slice(0, 3).map((s) => `<a href="#/obra/${esc(s.id)}"><span class="gthumb">${icon('music')}</span><div style="min-width:0"><b>${esc(s.title)}</b><small>${esc(s.instrument)} · ${esc(s.level)}${s.locked ? ' · 🔒' : ''}</small></div></a>`).join('');
  }).catch(() => {});
}

export async function renderPost(ctx, view, [id]) {
  ctx.setTitle('Publicación');
  view.innerHTML = `<div style="max-width:680px;margin:0 auto"><a href="#/comunidad" class="cx-chip" style="margin-bottom:1rem">${icon('back')}Volver</a><div id="one"></div></div>`;
  const box = $('#one', view); loading(box);
  try {
    const p = await ctx.store.getPost(id);
    box.innerHTML = postHTML(p); wirePost(box.firstElementChild, p, ctx, { openComments: true, onRemove: () => ctx.go('#/comunidad') });
  } catch (e) { empty(box, 'lock', e.message); }
}

export async function renderSaved(ctx, view) {
  ctx.setTitle('Guardados');
  view.innerHTML = `<div style="max-width:680px;margin:0 auto"><div class="cx-h"><div><span class="eyebrow">Solo tú lo ves</span><h1>Guardados</h1><p>Publicaciones que quieres volver a leer.</p></div></div><div class="fd-col" id="list"></div></div>`;
  await mountList($('#list', view), ctx, { saved: true }, 'Todavía no guardas nada. Usa "Guardar" en cualquier publicación.');
}
