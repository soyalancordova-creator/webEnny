/* ============================================================
   COMUNIDADES · listado, página de comunidad con chat abierto
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, richText, avatar, ago, clock, dayLabel, toast, modal, confirmBox, lightbox, loading, empty } from '../ui.js';
import { compressImage } from '../media.js';
import { composer, mountList, prependPost } from './feed.js';

function cover(g) { return g.cover ? `<img src="${esc(g.cover)}" alt="">` : ''; }
function privacyLabel(g) { return g.privacy === 'private' ? `${icon('lock')}Privada` : `${icon('globe')}Pública`; }

function joinButton(g) {
  if (g.myStatus === 'active') return '';
  if (g.myStatus === 'pending') return '<button class="btn btn-ghost btn-sm" disabled><span>Solicitud enviada</span></button>';
  return `<button class="btn btn-fill btn-sm" data-join><span>${g.privacy === 'private' ? 'Solicitar acceso' : 'Unirme'}</span></button>`;
}

async function doJoin(ctx, g, after) {
  try {
    const st = await ctx.store.joinGroup(g.id);
    toast(st === 'active' ? `Te uniste a ${g.name}.` : 'Solicitud enviada. Te avisamos cuando te acepten.');
    after();
  } catch (e) { toast(e.message); }
}

/* ---------- listado ---------- */
export async function renderGroups(ctx, view) {
  ctx.setTitle('Comunidades');
  view.innerHTML = `<div style="max-width:1180px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Comunidades</span><h1>Grupos con propósito</h1><p>Conversa, aprende y ora con personas que sirven como tú.</p></div>
      <button class="btn btn-fill btn-sm" id="newG"><span>${icon('plus')} Crear comunidad</span></button></div>
    <div class="cx-row" style="margin-bottom:1rem"><button class="cx-chip on" data-f="all">Todas</button><button class="cx-chip" data-f="mine">Mis comunidades</button>
      <input id="gq" placeholder="Buscar comunidad…" style="margin-left:auto;padding:.55rem .9rem;border-radius:12px;border:1px solid var(--hair);background:var(--bg);color:var(--ink);font:inherit;font-size:.86rem;min-width:220px"></div>
    <div class="gl" id="gl"></div></div>`;
  const gl = $('#gl', view); let mine = false, term = '', t = 0;
  const load = async () => {
    loading(gl);
    try {
      const gs = await ctx.store.listGroups({ q: term, mine });
      if (!gs.length) { empty(gl, 'users', mine ? 'Todavía no te unes a ninguna comunidad.' : 'No encontramos comunidades con ese nombre.'); return; }
      gl.innerHTML = gs.map((g) => `<article class="cx-card gcd" data-id="${esc(g.id)}">
        <a class="cv" href="#/comunidad/${esc(g.id)}">${cover(g)}</a>
        <div class="bd"><span class="pill">${privacyLabel(g)}</span><h3><a href="#/comunidad/${esc(g.id)}">${esc(g.name)}</a></h3><p>${esc(g.description)}</p>
          <div class="ft"><small>${icon('users')}${g.members} integrantes</small>${g.myStatus === 'active' ? `<a class="btn btn-ghost btn-sm" href="#/comunidad/${esc(g.id)}"><span>Abrir</span></a>` : joinButton(g)}</div></div></article>`).join('');
      $$('.gcd', gl).forEach((el) => { const b = $('[data-join]', el); if (b) b.onclick = () => doJoin(ctx, gs.find((g) => g.id === el.dataset.id), load); });
    } catch (e) { empty(gl, 'info', e.message); }
  };
  $$('[data-f]', view).forEach((b) => { b.onclick = () => { mine = b.dataset.f === 'mine'; $$('[data-f]', view).forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  $('#gq', view).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { term = e.target.value.trim(); load(); }, 260); };
  $('#newG', view).onclick = () => createGroupDialog(ctx);
  load();
}

function createGroupDialog(ctx) {
  let coverImg = null;
  const m = modal({ title: 'Crear una comunidad', body: `<div style="display:grid;gap:.9rem">
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
      const g = await ctx.store.createGroup({ name: $('#gN', m.body).value, description: $('#gD', m.body).value, rules: $('#gR', m.body).value, privacy: $('#gP', m.body).value, cover: coverImg });
      m.close(); toast('Comunidad creada.'); ctx.go(`#/comunidad/${g.id}`);
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

/* ---------- página de comunidad ---------- */
export async function renderGroup(ctx, view, [id, tab]) {
  let g;
  try { g = await ctx.store.getGroup(id); } catch (e) { empty(view, 'info', e.message); return; }
  ctx.setTitle(g.name);
  const member = g.myStatus === 'active';
  tab = tab || (member ? 'chat' : 'publicaciones');
  view.innerHTML = `<div style="max-width:1180px;margin:0 auto">
    <div class="gp-cover">${cover(g)}</div>
    <div class="gp-head"><span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('users')}</span>
      <div><h1>${esc(g.name)}</h1><div class="meta"><span>${privacyLabel(g)}</span><span>${g.members} integrantes</span><span>Creada por ${esc(g.owner ? g.owner.name : '')}</span></div></div>
      <div class="acts">${joinButton(g)}<button class="btn btn-ghost btn-sm" data-invite style="color:#fff;border-color:rgba(255,255,255,.4)"><span>${icon('link')} Invitar</span></button>
      ${member && g.myRole !== 'owner' ? `<button class="btn btn-ghost btn-sm" data-leave style="color:#fff;border-color:rgba(255,255,255,.4)"><span>Salir</span></button>` : ''}</div>
    </div>
    <nav class="gp-tabs" role="tablist">
      ${[['chat', 'comment', 'Chat'], ['publicaciones', 'feed', 'Publicaciones'], ['integrantes', 'users', `Integrantes <span class="n">${g.members}${g.canManage && g.pending ? ` · ${g.pending} por aprobar` : ''}</span>`], ['info', 'info', 'Información']]
        .map(([k, ic, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" role="tab">${icon(ic)}${l}</button>`).join('')}
    </nav>
    <div class="gp-grid"><div id="tabBody" style="min-width:0"></div><aside id="gside" style="display:grid;gap:1rem"></aside></div>
  </div>`;
  const b = $('[data-join]', view); if (b) b.onclick = () => doJoin(ctx, g, () => renderGroup(ctx, view, [id, tab]));
  $('[data-invite]', view).onclick = async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/comunidad/${g.id}`); toast('Enlace copiado. Quien lo abra necesita cuenta para entrar.'); };
  const lv = $('[data-leave]', view);
  if (lv) lv.onclick = async () => { if (!(await confirmBox(`¿Salir de ${g.name}?`, 'Salir'))) return; try { await ctx.store.leaveGroup(g.id); toast('Saliste de la comunidad.'); ctx.go('#/comunidades'); } catch (e) { toast(e.message); } };
  $$('[data-tab]', view).forEach((t) => { t.onclick = () => ctx.go(`#/comunidad/${g.id}/${t.dataset.tab}`); });

  sidebar(ctx, g, $('#gside', view));
  const body = $('#tabBody', view);
  if (tab === 'chat') return chatTab(ctx, g, body);
  if (tab === 'integrantes') return membersTab(ctx, g, body, view);
  if (tab === 'info') return infoTab(g, body);
  return postsTab(ctx, g, body);
}

async function sidebar(ctx, g, el) {
  el.innerHTML = `<section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.4rem">Sobre esta comunidad</h3><p class="muted" style="font-size:.88rem;line-height:1.6">${richText(g.description)}</p>
    ${g.rules ? `<h4 style="font-family:var(--sans);font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);font-weight:400;margin:1rem 0 .4rem">Normas</h4><p class="muted" style="font-size:.85rem;line-height:1.55;white-space:pre-wrap">${esc(g.rules)}</p>` : ''}</section>
    <section class="cx-card cx-pad"><div class="cx-row" style="justify-content:space-between"><h3 style="font-size:1.05rem">Integrantes</h3><a class="cx-chip" href="#/comunidad/${esc(g.id)}/integrantes">Ver todos</a></div><div class="mini-list" id="memPrev"></div></section>`;
  try {
    const ms = (await ctx.store.listMembers(g.id)).filter((m) => m.status === 'active').slice(0, 6);
    $('#memPrev', el).innerHTML = ms.map((m) => `<a href="#/perfil/${esc(m.user.id)}">${avatar(m.user, 'sm')}<div style="min-width:0"><b>${esc(m.user.name)}</b><small>${m.role === 'owner' ? 'Fundadora' : m.role === 'admin' ? 'Moderación' : esc(m.user.service || 'Integrante')}</small></div></a>`).join('');
  } catch (_) { $('#memPrev', el).innerHTML = '<p class="muted" style="font-size:.84rem">Visible para integrantes.</p>'; }
}

function infoTab(g, el) {
  el.innerHTML = `<section class="cx-card cx-pad" style="display:grid;gap:1rem">
    <div><span class="eyebrow">Propósito</span><p style="margin-top:.5rem;line-height:1.7">${richText(g.description)}</p></div>
    ${g.rules ? `<div><span class="eyebrow">Normas</span><p style="margin-top:.5rem;white-space:pre-wrap;line-height:1.7">${esc(g.rules)}</p></div>` : ''}
    <div class="pf-facts"><div>${icon(g.privacy === 'private' ? 'lock' : 'globe')}${g.privacy === 'private' ? 'Privada: cada ingreso lo aprueba quien la administra. Solo los integrantes ven el chat.' : 'Pública: cualquier persona con cuenta puede unirse y leer las publicaciones.'}</div>
      <div>${icon('calendar')}Creada el ${new Date(g.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div>${icon('user')}Fundada por ${esc(g.owner ? g.owner.name : '')}</div></div></section>`;
}

async function postsTab(ctx, g, el) {
  const canSee = g.privacy === 'public' || g.myStatus === 'active';
  if (!canSee) { el.innerHTML = lockedCard(g); const b = $('[data-join2]', el); if (b) b.onclick = () => doJoin(ctx, g, () => location.reload()); return; }
  el.innerHTML = '<div class="fd-col"><div id="cmpG"></div><div class="fd-col" id="gList"></div></div>';
  const list = $('#gList', el);
  if (g.myStatus === 'active') $('#cmpG', el).appendChild(composer(ctx, { groupId: g.id, onPosted: (p) => prependPost(list, p, ctx) }));
  await mountList(list, ctx, { groupId: g.id }, 'Aún no hay publicaciones en esta comunidad.');
}

function lockedCard(g) {
  return `<div class="cx-card ch-lock">${icon('lock')}<h3 style="margin:.6rem 0 .4rem">${g.privacy === 'private' ? 'Comunidad privada' : 'Únete para conversar'}</h3>
    <p class="muted" style="max-width:40ch;margin:0 auto 1.2rem">${g.myStatus === 'pending' ? 'Tu solicitud está pendiente. Te avisamos cuando te acepten.' : g.privacy === 'private' ? 'Solo los integrantes aprobados ven el chat y las publicaciones.' : 'El chat es para integrantes. Únete para escribir y leer.'}</p>
    ${g.myStatus === 'pending' ? '' : `<button class="btn btn-fill btn-sm" data-join2><span>${g.privacy === 'private' ? 'Solicitar acceso' : 'Unirme'}</span></button>`}</div>`;
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
    <section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.5rem">${active.length} integrantes</h3><div class="mem">${active.map(row).join('')}</div></section>`;
  $$('[data-a]', el).forEach((b) => {
    b.onclick = async () => {
      const u = b.closest('[data-u]').dataset.u;
      if (b.dataset.a === 'remove' && !(await confirmBox('¿Quitar a esta persona de la comunidad?', 'Quitar'))) return;
      try { await ctx.store.setMember(g.id, u, b.dataset.a); toast('Listo.'); renderGroup(ctx, view, [g.id, 'integrantes']); } catch (e) { toast(e.message); }
    };
  });
}

/* ---------- chat ---------- */
async function chatTab(ctx, g, el) {
  if (g.myStatus !== 'active' && !ctx.me.isAdmin) { el.innerHTML = lockedCard(g); const b = $('[data-join2]', el); if (b) b.onclick = () => doJoin(ctx, g, () => location.reload()); return; }
  el.innerHTML = `<section class="cx-card ch"><div class="ch-list" id="chList" aria-live="polite"></div>
    <form class="ch-form" id="chF"><label class="cx-iconbtn" aria-label="Enviar foto" style="cursor:pointer">${icon('image')}<input type="file" accept="image/*" hidden id="chImg"></label>
      <textarea id="chT" rows="1" maxlength="2000" placeholder="Escribe con gracia…" aria-label="Mensaje"></textarea>
      <button class="cx-iconbtn ch-send" aria-label="Enviar">${icon('send')}</button></form></section>`;
  const list = $('#chList', el), ta = $('#chT', el);
  const seen = new Set(); let last = null;
  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  const add = (m, scroll = true) => {
    if (!m || seen.has(m.id)) return; seen.add(m.id);
    const d = new Date(m.created_at);
    if (!last || new Date(last.created_at).toDateString() !== d.toDateString()) {
      const s = document.createElement('div'); s.className = 'ch-day'; s.textContent = dayLabel(m.created_at); list.appendChild(s); last = null;
    }
    const grp = !last || last.author.id !== m.author.id || d - new Date(last.created_at) > 5 * 60000;
    const row = document.createElement('div');
    row.className = `ch-msg${m.mine ? ' me' : ''}${grp ? ' grp' : ''}`;
    row.innerHTML = `<a href="#/perfil/${esc(m.author.id)}">${avatar(m.author, 'sm')}</a><div class="bub"><a class="nm" href="#/perfil/${esc(m.author.id)}">${esc(m.author.name)}</a>${m.image ? `<img src="${esc(m.image)}" alt="Foto">` : ''}${m.body ? richText(m.body) : ''}<time>${clock(m.created_at)}</time></div>`;
    const im = $('img', row); if (im) im.onclick = () => lightbox([m.image]);
    const stick = nearBottom();
    list.appendChild(row); last = m;
    if (scroll || stick) list.scrollTop = list.scrollHeight;
  };
  try { (await ctx.store.listMessages(g.id)).forEach((m) => add(m, false)); list.scrollTop = list.scrollHeight; }
  catch (e) { list.innerHTML = `<div class="ch-lock">${esc(e.message)}</div>`; return; }
  if (!seen.size) list.innerHTML = '<div class="cx-empty">Sé la primera persona en escribir.</div>';

  const send = async (payload) => {
    const e = list.querySelector('.cx-empty'); if (e) e.remove();
    try { add(await ctx.store.sendMessage(g.id, payload)); } catch (err) { toast(err.message); }
  };
  $('#chF', el).onsubmit = (e) => { e.preventDefault(); const v = ta.value.trim(); if (!v) return; ta.value = ''; ta.style.height = ''; send({ body: v }); };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chF', el).requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
  $('#chImg', el).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const img = await compressImage(f, { maxSide: 1400, quality: 0.78 }); await send({ body: ta.value.trim(), image: img }); ta.value = ''; }
    catch (err) { toast(err.message); }
  };
  const unsub = ctx.store.subscribeMessages(g.id, (m) => { const e = list.querySelector('.cx-empty'); if (e) e.remove(); add(m, false); });
  ta.focus({ preventScroll: true });
  return () => unsub && unsub();
}
