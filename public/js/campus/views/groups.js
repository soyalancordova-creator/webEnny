/* ============================================================
   COMUNIDADES Y GRUPOS · listado y página de comunidad
   ------------------------------------------------------------
   El chat vive solo en la bandeja de Mensajes (chat.js): aquí no
   hay pestaña de chat, solo un botón que abre #/mensajes/grupo/:id.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, richText, avatar, ago, toast, modal, confirmBox, loading, empty } from '../ui.js';
import { compressImage } from '../media.js';
import { composer, mountList, prependPost } from './feed.js';

function cover(g) { return g.cover ? `<img src="${esc(g.cover)}" alt="">` : ''; }
function privacyLabel(g) { return g.privacy === 'private' ? `${icon('lock')}Privada` : `${icon('globe')}Pública`; }

const isChurch = (g) => (g.info && g.info.kind) === 'iglesia';
/** Una comunidad se sigue; a un grupo se entra (y a una iglesia, se congrega uno). */
export const joinWord = (g) => {
  if (!g.isGroup) return 'Seguir';
  if (g.privacy === 'private') return 'Solicitar acceso';
  return isChurch(g) ? 'Congregarme' : 'Unirme';
};
/** Cómo se llama a quien pertenece. */
export const memberWord = (g, n) => (g.isGroup ? (n === 1 ? 'integrante' : 'integrantes') : (n === 1 ? 'seguidor' : 'seguidores'));

function joinButton(g) {
  if (g.myStatus === 'active') return '';
  if (g.myStatus === 'pending') return '<button class="btn btn-ghost btn-sm" disabled><span>Solicitud enviada</span></button>';
  return `<button class="btn btn-fill btn-sm" data-join><span>${joinWord(g)}</span></button>`;
}

async function doJoin(ctx, g, after) {
  try {
    const st = await ctx.store.joinGroup(g.id);
    toast(st === 'active'
      ? (!g.isGroup ? `Ahora sigues a ${g.name}.` : isChurch(g) ? `Ya te congregas en ${g.name}.` : `Te uniste a ${g.name}.`)
      : 'Solicitud enviada. Te avisamos cuando te acepten.');
    after();
  } catch (e) { toast(e.message); }
}

/* ---------- listado (sirve para comunidades y para grupos) ---------- */
export function renderGroups(ctx, view) { return lista(ctx, view, 'community'); }
export function renderGrupos(ctx, view) { return lista(ctx, view, 'group'); }

async function lista(ctx, view, type) {
  const esGrupo = type === 'group';
  const titulo = esGrupo ? 'Grupos' : 'Comunidades';
  ctx.setTitle(titulo);
  view.innerHTML = `<div style="max-width:1180px;margin:0 auto">
    <div class="pg-head"><h1>${titulo}</h1>
      <div class="cx-row">
        <button class="cx-iconbtn" id="gFilt" aria-label="Filtrar">${icon('sliders')}<span class="fdot" hidden></span></button>
        <button class="cx-iconbtn" id="newG" aria-label="Crear ${esGrupo ? 'grupo' : 'comunidad'}">${icon('plus')}</button>
      </div></div>
    <div class="cx-search" style="max-width:none;margin-bottom:1.1rem">${icon('search')}
      <input id="gq" placeholder="Buscar ${esGrupo ? 'grupo' : 'comunidad'}…"></div>
    <div class="gl" id="gl"></div></div>`;

  const gl = $('#gl', view); let mine = false, term = '', t = 0;
  const load = async () => {
    loading(gl);
    try {
      const gs = await ctx.store.listGroups({ q: term, mine, type });
      if (!gs.length) { empty(gl, 'users', mine ? `Todavía no sigues ning${esGrupo ? 'ún grupo' : 'una comunidad'}.` : 'No encontramos nada con ese nombre.'); return; }
      gl.innerHTML = gs.map((g) => `<article class="cx-card gcd" data-id="${esc(g.id)}">
        <a class="cv" href="#/${esGrupo ? 'grupo' : 'comunidad'}/${esc(g.id)}">${cover(g)}</a>
        <div class="bd"><span class="pill">${privacyLabel(g)}</span><h3><a href="#/${esGrupo ? 'grupo' : 'comunidad'}/${esc(g.id)}">${esc(g.name)}</a></h3><p>${esc(g.description)}</p>
          <div class="ft"><small>${icon('users')}${g.members} ${memberWord(g, g.members)}</small>${g.myStatus === 'active'
            ? `<a class="btn btn-ghost btn-sm" href="#/${esGrupo ? 'grupo' : 'comunidad'}/${esc(g.id)}"><span>Abrir</span></a>` : joinButton(g)}</div></div></article>`).join('');
      $$('.gcd', gl).forEach((el) => { const b = $('[data-join]', el); if (b) b.onclick = () => doJoin(ctx, gs.find((g) => g.id === el.dataset.id), load); });
    } catch (e) { empty(gl, 'info', e.message); }
  };
  $('#gFilt', view).onclick = (e) => {
    mine = !mine;
    e.currentTarget.classList.toggle('on', mine);
    $('#gFilt .fdot', view).hidden = !mine;
    toast(mine ? (esGrupo ? 'Solo mis grupos' : 'Solo las que sigo') : 'Viendo todo');
    load();
  };
  $('#gq', view).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { term = e.target.value.trim(); load(); }, 260); };
  $('#newG', view).onclick = () => createGroupDialog(ctx, type);
  load();
}

function createGroupDialog(ctx, type = 'group') {
  const esGrupo = type === 'group';
  let coverImg = null;
  const m = modal({ title: esGrupo ? 'Crear un grupo' : 'Crear una comunidad', body: `<div style="display:grid;gap:.9rem">
    <p class="muted" style="font-size:.86rem;line-height:1.5">${esGrupo
      ? 'Un grupo tiene chat e integrantes: sirve para tu equipo, tu ensayo o tu ministerio.'
      : 'Una comunidad es un espacio de anuncios: solo publicas tú y las personas te siguen.'}</p>
    <div class="fld"><label>¿Qué representa?</label><select id="gK"><option value="grupo">${esGrupo ? 'Un equipo o ministerio' : 'Una marca, proyecto o persona'}</option><option value="iglesia">Una iglesia</option></select></div>
    <div class="fld"><label>Nombre</label><input id="gN" maxlength="60" placeholder="Ej. Violinistas de adoración"></div>
    <div class="fld"><label>Propósito</label><textarea id="gD" maxlength="400" placeholder="¿Qué conversaciones tendrá esta comunidad?"></textarea></div>
    <div class="fld"><label>Normas (opcional)</label><textarea id="gR" maxlength="800" style="min-height:80px" placeholder="Ej. Hablamos con gracia. Lo que se comparte en oración, se queda aquí."></textarea></div>
    <div class="two"><div class="fld"><label>Privacidad</label><select id="gP"><option value="public">Pública · cualquiera entra</option><option value="private">Privada · se aprueba cada ingreso</option></select></div>
      <div class="fld"><label>Portada</label><label class="btn btn-ghost btn-sm" style="justify-content:center"><span id="gCl">Elegir foto</span><input type="file" id="gC" accept="image/*" hidden></label></div></div>
    <div class="cx-row" style="justify-content:flex-end"><button class="btn btn-fill btn-sm" id="gGo"><span>Crear comunidad</span></button></div></div>` });
  $('#gC', m.body).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { coverImg = await compressImage(f, { maxSide: 1600, quality: 0.8 }); $('#gCl', m.body).textContent = 'Portada lista ✓'; } catch (err) { toast(err.message); } };
  $('#gGo', m.body).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const g = await ctx.store.createGroup({ name: $('#gN', m.body).value, description: $('#gD', m.body).value, rules: $('#gR', m.body).value, privacy: $('#gP', m.body).value, cover: coverImg, kind: $('#gK', m.body).value, type });
      m.close(); toast(`${esGrupo ? 'Grupo creado' : 'Comunidad creada'}. Completa sus datos en Configuración.`); ctx.go(`#/${esGrupo ? 'grupo' : 'comunidad'}/${g.id}/ajustes`);
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

/* ---------- página de comunidad ---------- */
export async function renderGroup(ctx, view, [id, tab]) {
  let g;
  try { g = await ctx.store.getGroup(id); } catch (e) { empty(view, 'info', e.message); return; }
  ctx.setTitle(g.name);
  const member = g.myStatus === 'active';
  const base = g.isGroup ? 'grupo' : 'comunidad';
  // el chat vive solo en la bandeja de Mensajes, no dentro del grupo
  tab = (tab && tab !== 'chat') ? tab : 'publicaciones';
  view.innerHTML = `<div style="max-width:1180px;margin:0 auto">
    <div class="gp-cover">${cover(g)}</div>
    <div class="gp-head"><span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('users')}</span>
      <div><h1>${esc(g.name)}</h1><div class="meta"><span>${privacyLabel(g)}</span><span>${g.members} ${memberWord(g, g.members)}</span><span>Creada por ${esc(g.owner ? g.owner.name : '')}</span></div></div>
      <div class="acts">${joinButton(g)}
      ${g.isGroup && member ? `<a class="btn btn-ghost btn-sm" href="#/mensajes/grupo/${esc(g.id)}" style="color:#fff;border-color:rgba(255,255,255,.4)"><span>${icon('comment')} Chat</span></a>` : ''}
      <button class="btn btn-ghost btn-sm" data-invite style="color:#fff;border-color:rgba(255,255,255,.4)"><span>${icon('link')} Invitar</span></button>
      ${member && g.myRole !== 'owner' ? `<button class="btn btn-ghost btn-sm" data-leave style="color:#fff;border-color:rgba(255,255,255,.4)"><span>Salir</span></button>` : ''}</div>
    </div>
    <nav class="gp-tabs" role="tablist">
      ${[['publicaciones', 'feed', 'Publicaciones'],
         ['integrantes', 'users', `${g.isGroup ? 'Integrantes' : 'Seguidores'} <span class="n">${g.showMembers ? g.members : '·'}${g.canManage && g.pending ? ` · ${g.pending} por aprobar` : ''}</span>`],
         ['info', 'info', 'Información'],
         ...(g.canManage ? [['ajustes', 'settings', 'Configuración']] : [])]
        .map(([k, ic, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" role="tab">${icon(ic)}${l}</button>`).join('')}
    </nav>
    <div class="gp-grid"><div id="tabBody" style="min-width:0"></div><aside id="gside" style="display:grid;gap:1rem"></aside></div>
  </div>`;
  const b = $('[data-join]', view); if (b) b.onclick = () => doJoin(ctx, g, () => renderGroup(ctx, view, [id, tab]));
  $('[data-invite]', view).onclick = async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/${base}/${g.id}`); toast('Enlace copiado. Quien lo abra necesita cuenta para entrar.'); };
  const lv = $('[data-leave]', view);
  if (lv) lv.onclick = async () => {
    if (!(await confirmBox(g.isGroup ? `¿Salir de ${g.name}?` : `¿Dejar de seguir a ${g.name}?`, g.isGroup ? 'Salir' : 'Dejar de seguir'))) return;
    try { await ctx.store.leaveGroup(g.id); toast(g.isGroup ? 'Saliste del grupo.' : 'Dejaste de seguir.'); ctx.go(g.isGroup ? '#/grupos' : '#/comunidades'); } catch (e) { toast(e.message); }
  };
  $$('[data-tab]', view).forEach((t) => { t.onclick = () => ctx.go(`#/${base}/${g.id}/${t.dataset.tab}`); });

  sidebar(ctx, g, $('#gside', view));
  const body = $('#tabBody', view);
  if (tab === 'integrantes') return membersTab(ctx, g, body, view);
  if (tab === 'info') return infoTab(g, body);
  if (tab === 'ajustes') return settingsTab(ctx, g, body, view);
  return postsTab(ctx, g, body);
}

async function sidebar(ctx, g, el) {
  el.innerHTML = `<section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.4rem">Sobre esta comunidad</h3><p class="muted" style="font-size:.88rem;line-height:1.6">${richText(g.description)}</p>
    ${g.rules ? `<h4 style="font-family:var(--sans);font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400;margin:1rem 0 .4rem">Normas</h4><p class="muted" style="font-size:.85rem;line-height:1.55;white-space:pre-wrap">${esc(g.rules)}</p>` : ''}</section>
    <section class="cx-card cx-pad"><div class="cx-row" style="justify-content:space-between"><h3 style="font-size:1.05rem">${g.isGroup ? 'Integrantes' : 'Seguidores'}</h3><a class="cx-chip" href="#/${g.isGroup ? 'grupo' : 'comunidad'}/${esc(g.id)}/integrantes">Ver todos</a></div><div class="mini-list" id="memPrev"></div></section>`;
  if (!g.showMembers) { $('#memPrev', el).innerHTML = '<p class="muted" style="font-size:.84rem">La lista de integrantes es solo para quienes pertenecen a la comunidad.</p>'; return; }
  try {
    const ms = (await ctx.store.listMembers(g.id)).filter((m) => m.status === 'active').slice(0, 6);
    $('#memPrev', el).innerHTML = ms.map((m) => `<a href="#/perfil/${esc(m.user.id)}">${avatar(m.user, 'sm')}<div style="min-width:0"><b>${esc(m.user.name)}</b><small>${m.role === 'owner' ? 'Fundadora' : m.role === 'admin' ? 'Moderación' : esc(m.user.service || 'Integrante')}</small></div></a>`).join('');
  } catch (_) { $('#memPrev', el).innerHTML = '<p class="muted" style="font-size:.84rem">Visible para integrantes.</p>'; }
}

function infoTab(g, el) {
  const i = g.info || {};
  const line = (ic, v, href) => (v ? `<div>${icon(ic)}${href ? `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:var(--wine)">${esc(v)}</a>` : esc(v)}</div>` : '');
  const contacto = [line('map', i.address), line('clock', i.schedule), line('phone', i.phone, i.phone ? `tel:${i.phone.replace(/\s/g, '')}` : ''), line('mail', i.email, i.email ? `mailto:${i.email}` : ''), line('link', i.site, i.site ? (/^https?:/.test(i.site) ? i.site : `https://${i.site}`) : '')].join('');
  el.innerHTML = `<section class="cx-card cx-pad" style="display:grid;gap:1rem">
    <div><span class="eyebrow">${g.info && g.info.kind === 'iglesia' ? 'La congregación' : 'Propósito'}</span><p style="margin-top:.5rem;line-height:1.7">${richText(g.description)}</p></div>
    ${contacto ? `<div><span class="eyebrow">Dónde encontrarnos</span><div class="pf-facts" style="margin-top:.5rem">${contacto}</div></div>` : ''}
    ${g.rules ? `<div><span class="eyebrow">Normas</span><p style="margin-top:.5rem;white-space:pre-wrap;line-height:1.7">${esc(g.rules)}</p></div>` : ''}
    <div class="pf-facts"><div>${icon(g.privacy === 'private' ? 'lock' : 'globe')}${g.privacy === 'private' ? 'Privada: cada ingreso lo aprueba quien la administra. Solo los integrantes ven el chat.' : 'Pública: cualquier persona con cuenta puede unirse y leer las publicaciones.'}</div>
      <div>${icon('calendar')}Creada el ${new Date(g.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div>${icon('user')}Fundada por ${esc(g.owner ? g.owner.name : '')}</div></div></section>`;
}

/* ---------- configuración interna de la comunidad ---------- */
function settingsTab(ctx, g, el, view) {
  const i = g.info || {}, show = g.show || {};
  const sw = (k, on, label, help) => `<div class="set-row"><div><b>${esc(label)}</b><small>${esc(help)}</small></div>
    <button class="sw${on ? ' on' : ''}" data-show="${k}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}"></button></div>`;
  el.innerHTML = `<section class="cx-card cx-pad set-card">
      <h3>${icon('settings')} Datos de la comunidad</h3>
      <form id="gForm" style="display:grid;gap:.9rem">
        <div class="two"><div class="fld"><label>Nombre</label><input name="name" maxlength="60" value="${esc(g.name)}"></div>
          <div class="fld"><label>Tipo</label><select name="kind"><option value="grupo"${i.kind !== 'iglesia' ? ' selected' : ''}>Grupo</option><option value="iglesia"${i.kind === 'iglesia' ? ' selected' : ''}>Iglesia</option></select></div></div>
        <div class="fld"><label>Propósito</label><textarea name="description" maxlength="400">${esc(g.description)}</textarea></div>
        <div class="fld"><label>Normas</label><textarea name="rules" maxlength="800">${esc(g.rules || '')}</textarea></div>
        <div class="two"><div class="fld"><label>Dirección</label><input name="address" maxlength="160" value="${esc(i.address || '')}" placeholder="Calle, ciudad"></div>
          <div class="fld"><label>Horarios</label><input name="schedule" maxlength="160" value="${esc(i.schedule || '')}" placeholder="Domingos 10:00 · Ensayo jueves 19:00"></div></div>
        <div class="two"><div class="fld"><label>Teléfono</label><input name="phone" maxlength="40" value="${esc(i.phone || '')}"></div>
          <div class="fld"><label>Correo</label><input name="email" type="email" maxlength="120" value="${esc(i.email || '')}"></div></div>
        <div class="two"><div class="fld"><label>Sitio o red social</label><input name="site" maxlength="160" value="${esc(i.site || '')}"></div>
          <div class="fld"><label>Privacidad</label><select name="privacy"><option value="public"${g.privacy !== 'private' ? ' selected' : ''}>Pública · cualquiera entra</option><option value="private"${g.privacy === 'private' ? ' selected' : ''}>Privada · se aprueba cada ingreso</option></select></div></div>
        <div class="cx-row" style="justify-content:space-between;align-items:center">
          <label class="btn btn-ghost btn-sm"><span>${icon('image')} Cambiar portada</span><input type="file" accept="image/*" hidden id="gCov"></label>
          <button class="btn btn-fill btn-sm"><span>Guardar cambios</span></button></div>
      </form>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('eye')} Qué ve quien no es integrante</h3>
      <p class="muted" style="margin-bottom:.4rem">Ustedes deciden qué datos salen del grupo. Los integrantes siempre los ven.</p>
      ${sw('address', show.address !== false, 'Dirección', 'Dónde se reúnen.')}
      ${sw('schedule', show.schedule !== false, 'Horarios', 'Servicios y ensayos.')}
      ${sw('contact', show.contact !== false, 'Teléfono, correo y sitio', 'Datos para contactarlos.')}
      ${sw('members', show.members !== false, 'Lista de integrantes', 'Quiénes pertenecen a la comunidad.')}
    </section>
    ${g.myRole === 'owner' || ctx.me.isAdmin ? `<section class="cx-card cx-pad set-card">
      <h3>${icon('trash')} Eliminar comunidad</h3>
      <p class="muted">Se borran sus publicaciones y su chat. No se puede deshacer.</p>
      <button class="btn btn-ghost btn-sm" id="gDel" style="color:var(--err);border-color:var(--err)"><span>Eliminar ${esc(g.name)}</span></button>
    </section>` : ''}`;

  const reload = () => renderGroup(ctx, view, [g.id, 'ajustes']);
  $('#gForm', el).onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await ctx.store.updateGroup(g.id, { name: d.name, description: d.description, rules: d.rules, privacy: d.privacy,
        info: { kind: d.kind, address: d.address, schedule: d.schedule, phone: d.phone, email: d.email, site: d.site } });
      toast('Comunidad actualizada.'); reload();
    } catch (err) { toast(err.message); }
  };
  $('#gCov', el).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const cover = await compressImage(f, { maxSide: 1600, quality: 0.8 }); await ctx.store.updateGroup(g.id, { cover }); toast('Portada actualizada.'); reload(); }
    catch (err) { toast(err.message); }
  };
  $$('[data-show]', el).forEach((b) => {
    b.onclick = async () => {
      const on = !b.classList.contains('on');
      try { await ctx.store.updateGroup(g.id, { show: { [b.dataset.show]: on } }); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
      catch (err) { toast(err.message); }
    };
  });
  const del = $('#gDel', el);
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`¿Eliminar ${g.name} con todo su contenido?`, 'Eliminar'))) return;
    try { await ctx.store.deleteGroup(g.id); toast('Comunidad eliminada.'); ctx.go('#/comunidades'); } catch (err) { toast(err.message); }
  };
}

async function postsTab(ctx, g, el) {
  const canSee = g.privacy === 'public' || g.myStatus === 'active';
  if (!canSee) { el.innerHTML = lockedCard(g); const b = $('[data-join2]', el); if (b) b.onclick = () => doJoin(ctx, g, () => location.reload()); return; }
  el.innerHTML = '<div class="fd-col"><div id="cmpG"></div><div class="fd-col" id="gList"></div></div>';
  const list = $('#gList', el);
  const puedePublicar = g.isGroup ? g.myStatus === 'active' : g.canManage;
  if (puedePublicar) $('#cmpG', el).appendChild(composer(ctx, { groupId: g.id }));
  else if (!g.isGroup) $('#cmpG', el).innerHTML = `<p class="muted" style="font-size:.86rem;padding:.2rem .2rem 1rem">${icon('megaphone')} En esta comunidad publica solo ${esc(g.owner ? g.owner.name : 'quien la creó')}.</p>`;
  await mountList(list, ctx, { groupId: g.id }, `Aún no hay publicaciones en est${g.isGroup ? 'e grupo' : 'a comunidad'}.`);
}

function lockedCard(g) {
  return `<div class="cx-card ch-lock">${icon('lock')}<h3 style="margin:.6rem 0 .4rem">${g.privacy === 'private' ? 'Comunidad privada' : 'Únete para conversar'}</h3>
    <p class="muted" style="max-width:40ch;margin:0 auto 1.2rem">${g.myStatus === 'pending' ? 'Tu solicitud está pendiente. Te avisamos cuando te acepten.' : g.privacy === 'private' ? 'Solo los integrantes aprobados ven el chat y las publicaciones.' : 'El chat es para integrantes. Únete para escribir y leer.'}</p>
    ${g.myStatus === 'pending' ? '' : `<button class="btn btn-fill btn-sm" data-join2><span>${joinWord(g)}</span></button>`}</div>`;
}

async function membersTab(ctx, g, el, view) {
  loading(el);
  let ms;
  try { ms = await ctx.store.listMembers(g.id); } catch (e) { el.innerHTML = lockedCard(g); return; }
  const pending = ms.filter((m) => m.status === 'pending');
  const active = ms.filter((m) => m.status === 'active');
  const row = (m) => `<div class="mem-item" data-u="${esc(m.user.id)}"><a href="#/perfil/${esc(m.user.id)}">${avatar(m.user)}</a><div class="who"><a href="#/perfil/${esc(m.user.id)}"><b>${esc(m.user.name)}${m.isMe ? ' (tú)' : ''}</b></a><small>${m.role === 'owner' ? 'Fundadora' : m.role === 'admin' ? 'Moderación' : esc(m.user.service || 'Integrante')} · desde ${ago(m.joined_at)}</small></div>
    ${g.canManage && m.role !== 'owner' && !m.isMe ? (m.status === 'pending'
      ? '<button class="btn btn-fill btn-sm" data-a="approve"><span>Aprobar</span></button><button class="cx-chip" data-a="remove">Rechazar</button>'
      : `<button class="cx-chip" data-a="admin">${m.role === 'admin' ? 'Quitar moderación' : 'Hacer moderador'}</button><button class="cx-chip" data-a="remove">Quitar</button>`) : ''}</div>`;
  el.innerHTML = `${pending.length ? `<section class="cx-card cx-pad" style="margin-bottom:1rem"><h3 style="font-size:1.05rem;margin-bottom:.5rem">Solicitudes por aprobar</h3><div class="mem">${pending.map(row).join('')}</div></section>` : ''}
    <section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.5rem">${active.length} ${memberWord(g, active.length)}</h3><div class="mem">${active.map(row).join('')}</div></section>`;
  $$('[data-a]', el).forEach((b) => {
    b.onclick = async () => {
      const u = b.closest('[data-u]').dataset.u;
      if (b.dataset.a === 'remove' && !(await confirmBox('¿Quitar a esta persona de la comunidad?', 'Quitar'))) return;
      try { await ctx.store.setMember(g.id, u, b.dataset.a); toast('Listo.'); renderGroup(ctx, view, [g.id, 'integrantes']); } catch (e) { toast(e.message); }
    };
  });
}
