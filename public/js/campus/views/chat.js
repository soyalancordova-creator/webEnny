/* ============================================================
   MENSAJES · pantalla completa, al estilo WhatsApp
   ------------------------------------------------------------
   La burbuja flotante abre la bandeja (#/mensajes): junta los
   chats directos con hermanos y los grupos a los que perteneces.
   Cada conversación directa abre su propia pantalla (#/mensajes/:id).
   El chat de un grupo también vive aquí, no dentro del grupo:
   #/mensajes/grupo/:id, con la misma pinta pero varios autores.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, richText, avatar, ago, clock, dayLabel, toast, lightbox, empty } from '../ui.js';
import { compressImage } from '../media.js';

let burbuja = null;

/* ---------- botón flotante: abre la bandeja completa ---------- */
export function montarBurbuja(ctx) {
  if (burbuja) return;
  burbuja = document.createElement('button');
  burbuja.className = 'chat-fab';
  burbuja.id = 'chatFab';
  burbuja.setAttribute('aria-label', 'Mensajes');
  burbuja.innerHTML = `${icon('comment')}<span class="badge" hidden></span>`;
  burbuja.onclick = () => ctx.go('#/mensajes');
  document.body.appendChild(burbuja);
  refrescarBadge(ctx);
  setInterval(() => refrescarBadge(ctx), 45000);
}

export async function refrescarBadge(ctx) {
  if (!burbuja) return;
  try {
    const n = await ctx.store.chatUnread();
    const b = $('.badge', burbuja);
    b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
    burbuja.classList.toggle('tiene', !!n);
  } catch (_) {}
}

/** Atajo desde un perfil: abre directo la conversación con esa persona. */
export function abrirChat(ctx, persona) { ctx.go(`#/mensajes/${persona.id}`); }

/* ---------- bandeja: directos + grupos, todo junto ---------- */
export async function renderMensajes(ctx, view) {
  ctx.setTitle('Mensajes');
  view.innerHTML = `<div class="msg">
    <header class="msg-top">
      <button class="cx-iconbtn" data-back aria-label="Volver">${icon('back')}</button>
      <b>Mensajes</b><span class="sp"></span>
    </header>
    <div class="msg-body" id="mb"><div class="cx-empty"><span class="spin"></span></div></div>
  </div>`;
  $('[data-back]', view).onclick = () => ctx.go('#/comunidad');
  const body = $('#mb', view);

  let directos = [], grupos = [];
  try {
    [directos, grupos] = await Promise.all([
      ctx.store.listChats().catch(() => []),
      ctx.store.listGroups({ mine: true, type: 'group' }).catch(() => []),
    ]);
  } catch (_) {}

  if (!directos.length && !grupos.length) {
    body.innerHTML = `<div class="chat-vacio">${icon('comment')}
      <p>Todavía no tienes conversaciones.</p>
      <small>Conéctate con un hermano y escríbele desde su perfil, o entra a un grupo con chat.</small></div>`;
    return;
  }

  const filas = [
    ...directos.map((c) => ({
      href: `#/mensajes/${c.user.id}`, avatar: avatar(c.user), nombre: c.user.name,
      linea: `${c.last.mine ? 'Tú: ' : ''}${c.last.body || 'Foto'}`, hora: c.last.created_at, no: c.unread,
    })),
    ...grupos.map((g) => ({
      href: `#/mensajes/grupo/${g.id}`, avatar: `<span class="gthumb sm">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('comment')}</span>`,
      nombre: g.name, linea: 'Grupo', hora: g.created_at, no: 0, esGrupo: true,
    })),
  ].sort((a, b) => new Date(b.hora) - new Date(a.hora));

  body.innerHTML = `<div class="chat-list">${filas.map((f) => `
    <a class="ch-row${f.no ? ' un' : ''}" href="${f.href}">
      ${f.avatar}
      <div class="tx"><b>${esc(f.nombre)}${f.esGrupo ? ` <small class="ch-tag">${icon('comment')}</small>` : ''}</b>
        <small>${esc(f.linea)}</small></div>
      <div class="mt"><time>${ago(f.hora)}</time>${f.no ? `<span class="badge">${f.no}</span>` : ''}</div>
    </a>`).join('')}</div>`;
}

/* ---------- conversación directa, a pantalla completa ---------- */
export async function renderConversacion(ctx, view, [otroId]) {
  let persona;
  try { persona = await ctx.store.getProfile(otroId); }
  catch (_) { persona = { id: otroId, name: 'Hermano' }; }
  ctx.setTitle(persona.name);

  view.innerHTML = `<div class="msg">
    <header class="msg-top">
      <button class="cx-iconbtn" data-back aria-label="Volver a mensajes">${icon('back')}</button>
      <a class="msg-who" href="#/perfil/${esc(persona.id)}">${avatar(persona)}<b>${esc(persona.name)}</b></a>
      <span class="sp"></span>
    </header>
    <div class="ch-list" id="dmList" aria-live="polite"></div>
    <form class="ch-form" id="dmF">
      <label class="cx-iconbtn" aria-label="Enviar foto" style="cursor:pointer">${icon('image')}
        <input type="file" accept="image/*" hidden id="dmImg"></label>
      <textarea id="dmT" rows="1" maxlength="2000" placeholder="Escribe con gracia…" aria-label="Mensaje"></textarea>
      <button class="cx-iconbtn ch-send" aria-label="Enviar">${icon('send')}</button>
    </form>
  </div>`;
  $('[data-back]', view).onclick = () => ctx.go('#/mensajes');

  const list = $('#dmList', view), ta = $('#dmT', view);
  const vistos = new Set(); let ultimo = null;
  const pegado = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;

  const pinta = (m, bajar = true) => {
    if (!m || vistos.has(m.id)) return; vistos.add(m.id);
    const d = new Date(m.created_at);
    if (!ultimo || new Date(ultimo.created_at).toDateString() !== d.toDateString()) {
      const s = document.createElement('div'); s.className = 'ch-day'; s.textContent = dayLabel(m.created_at); list.appendChild(s); ultimo = null;
    }
    const junto = !ultimo || ultimo.mine !== m.mine || d - new Date(ultimo.created_at) > 5 * 60000;
    const row = document.createElement('div');
    row.className = `ch-msg${m.mine ? ' me' : ''}${junto ? ' grp' : ''}`;
    row.innerHTML = `<div class="bub">${m.image ? `<img src="${esc(m.image)}" alt="Foto">` : ''}${m.body ? richText(m.body) : ''}<time>${clock(m.created_at)}</time></div>`;
    const im = $('img', row); if (im) im.onclick = () => lightbox([m.image]);
    const stick = pegado();
    list.appendChild(row); ultimo = m;
    if (bajar || stick) list.scrollTop = list.scrollHeight;
  };

  try {
    const msgs = await ctx.store.listDirect(persona.id);
    msgs.forEach((m) => pinta(m, false));
    list.scrollTop = list.scrollHeight;
    if (!msgs.length) list.innerHTML = `<div class="chat-vacio"><p>Escríbele a ${esc((persona.name || '').split(' ')[0])}.</p></div>`;
    refrescarBadge(ctx);
  } catch (e) { empty(list, 'info', e.message); }

  const enviar = async (payload) => {
    const v = list.querySelector('.chat-vacio'); if (v) v.remove();
    try { pinta(await ctx.store.sendDirect(persona.id, payload)); } catch (err) { toast(err.message); }
  };
  $('#dmF', view).onsubmit = (e) => {
    e.preventDefault();
    const v = ta.value.trim(); if (!v) return;
    ta.value = ''; ta.style.height = ''; enviar({ body: v });
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#dmF', view).requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  $('#dmImg', view).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const img = await compressImage(f, { maxSide: 1400, quality: 0.78 }); await enviar({ body: ta.value.trim(), image: img }); ta.value = ''; }
    catch (err) { toast(err.message); }
  };

  const unsub = ctx.store.subscribeDirect(persona.id, (m) => { const v = list.querySelector('.chat-vacio'); if (v) v.remove(); pinta(m, false); });
  ta.focus({ preventScroll: true });
  return () => { if (unsub) unsub(); };
}

/* ---------- chat de un grupo, a pantalla completa (misma pinta, varios autores) ---------- */
export async function renderMensajesGrupo(ctx, view, [groupId]) {
  let g;
  try { g = await ctx.store.getGroup(groupId); } catch (e) { empty(view, 'info', e.message); return; }
  ctx.setTitle(g.name);

  view.innerHTML = `<div class="msg">
    <header class="msg-top">
      <button class="cx-iconbtn" data-back aria-label="Volver a mensajes">${icon('back')}</button>
      <a class="msg-who" href="#/grupo/${esc(g.id)}"><span class="gthumb sm">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('comment')}</span><b>${esc(g.name)}</b></a>
      <span class="sp"></span>
    </header>
    <div class="ch-list" id="grList" aria-live="polite"></div>
    <form class="ch-form" id="grF">
      <label class="cx-iconbtn" aria-label="Enviar foto" style="cursor:pointer">${icon('image')}
        <input type="file" accept="image/*" hidden id="grImg"></label>
      <textarea id="grT" rows="1" maxlength="2000" placeholder="Escribe con gracia…" aria-label="Mensaje"></textarea>
      <button class="cx-iconbtn ch-send" aria-label="Enviar">${icon('send')}</button>
    </form>
  </div>`;
  $('[data-back]', view).onclick = () => ctx.go('#/mensajes');

  const list = $('#grList', view), ta = $('#grT', view);
  const vistos = new Set(); let ultimo = null;
  const pegado = () => list.scrollHeight - list.scrollTop - list.clientHeight < 120;

  const pinta = (m, bajar = true) => {
    if (!m || vistos.has(m.id)) return; vistos.add(m.id);
    const d = new Date(m.created_at);
    if (!ultimo || new Date(ultimo.created_at).toDateString() !== d.toDateString()) {
      const s = document.createElement('div'); s.className = 'ch-day'; s.textContent = dayLabel(m.created_at); list.appendChild(s); ultimo = null;
    }
    const junto = !ultimo || ultimo.author.id !== m.author.id || d - new Date(ultimo.created_at) > 5 * 60000;
    const row = document.createElement('div');
    row.className = `ch-msg${m.mine ? ' me' : ''}${junto ? ' grp' : ''}`;
    row.innerHTML = `<a href="#/perfil/${esc(m.author.id)}">${avatar(m.author, 'sm')}</a>
      <div class="bub"><a class="nm" href="#/perfil/${esc(m.author.id)}">${esc(m.author.name)}</a>
        ${m.image ? `<img src="${esc(m.image)}" alt="Foto">` : ''}${m.body ? richText(m.body) : ''}<time>${clock(m.created_at)}</time></div>`;
    const im = $('img', row); if (im) im.onclick = () => lightbox([m.image]);
    const stick = pegado();
    list.appendChild(row); ultimo = m;
    if (bajar || stick) list.scrollTop = list.scrollHeight;
  };

  try {
    const msgs = await ctx.store.listMessages(g.id);
    msgs.forEach((m) => pinta(m, false));
    list.scrollTop = list.scrollHeight;
    if (!msgs.length) list.innerHTML = `<div class="chat-vacio"><p>Sé la primera persona en escribir en ${esc(g.name)}.</p></div>`;
  } catch (e) { empty(list, 'lock', e.message); return; }

  const enviar = async (payload) => {
    const v = list.querySelector('.chat-vacio'); if (v) v.remove();
    try { pinta(await ctx.store.sendMessage(g.id, payload)); } catch (err) { toast(err.message); }
  };
  $('#grF', view).onsubmit = (e) => {
    e.preventDefault();
    const v = ta.value.trim(); if (!v) return;
    ta.value = ''; ta.style.height = ''; enviar({ body: v });
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#grF', view).requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  $('#grImg', view).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const img = await compressImage(f, { maxSide: 1400, quality: 0.78 }); await enviar({ body: ta.value.trim(), image: img }); ta.value = ''; }
    catch (err) { toast(err.message); }
  };

  const unsub = ctx.store.subscribeMessages(g.id, (m) => { const v = list.querySelector('.chat-vacio'); if (v) v.remove(); pinta(m, false); });
  ta.focus({ preventScroll: true });
  return () => { if (unsub) unsub(); };
}
