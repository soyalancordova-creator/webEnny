/* ============================================================
   CHAT DIRECTO · la burbuja flotante
   ------------------------------------------------------------
   Lista de conversaciones y chat uno a uno con los hermanos
   conectados. Funciona igual en la web y en la app instalada.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, richText, avatar, ago, clock, dayLabel, toast, lightbox, empty } from '../ui.js';
import { compressImage } from '../media.js';

let panel = null;      // el panel abierto, si lo hay
let burbuja = null;    // el botón flotante

/* ---------- botón flotante ---------- */
export function montarBurbuja(ctx) {
  if (burbuja) return;
  burbuja = document.createElement('button');
  burbuja.className = 'chat-fab';
  burbuja.id = 'chatFab';
  burbuja.setAttribute('aria-label', 'Mensajes');
  burbuja.innerHTML = `${icon('comment')}<span class="badge" hidden></span>`;
  burbuja.onclick = () => (panel ? cerrar() : abrirLista(ctx));
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

function cerrar() {
  if (!panel) return;
  if (panel._limpiar) panel._limpiar();
  panel.remove(); panel = null;
  burbuja && burbuja.classList.remove('abierto');
}

function marco(titulo, atras) {
  const el = document.createElement('div');
  el.className = 'chat-panel';
  el.innerHTML = `<header>
      ${atras ? `<button class="cx-iconbtn sm" data-back aria-label="Volver">${icon('back')}</button>` : ''}
      <b>${titulo}</b>
      <button class="cx-iconbtn sm" data-x aria-label="Cerrar">${icon('x')}</button>
    </header><div class="chat-body"></div>`;
  $('[data-x]', el).onclick = cerrar;
  return el;
}

/* ---------- lista de conversaciones ---------- */
export async function abrirLista(ctx) {
  cerrar();
  panel = marco('Mensajes', false);
  document.body.appendChild(panel);
  burbuja && burbuja.classList.add('abierto');
  const body = $('.chat-body', panel);
  body.innerHTML = '<div class="cx-empty"><span class="spin"></span></div>';

  let chats = [];
  try { chats = await ctx.store.listChats(); } catch (e) { empty(body, 'info', e.message); return; }

  if (!chats.length) {
    body.innerHTML = `<div class="chat-vacio">${icon('comment')}
      <p>Todavía no tienes conversaciones.</p>
      <small>Conéctate con un hermano y escríbele desde su perfil.</small></div>`;
    return;
  }

  body.innerHTML = `<div class="chat-list">${chats.map((c) => `
    <button class="ch-row${c.unread ? ' un' : ''}" data-u="${esc(c.user.id)}">
      ${avatar(c.user)}
      <div class="tx"><b>${esc(c.user.name)}</b>
        <small>${c.last.mine ? 'Tú: ' : ''}${esc(c.last.body || 'Foto')}</small></div>
      <div class="mt"><time>${ago(c.last.created_at)}</time>
        ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
    </button>`).join('')}</div>`;
  $$('[data-u]', body).forEach((b) => { b.onclick = () => abrirChat(ctx, chats.find((c) => c.user.id === b.dataset.u).user); });
}

/* ---------- conversación ---------- */
export async function abrirChat(ctx, persona) {
  cerrar();
  panel = marco(esc(persona.name), true);
  document.body.appendChild(panel);
  burbuja && burbuja.classList.add('abierto');
  $('[data-back]', panel).onclick = () => abrirLista(ctx);

  const body = $('.chat-body', panel);
  body.innerHTML = `<div class="ch-list" id="dmList" aria-live="polite"></div>
    <form class="ch-form" id="dmF">
      <label class="cx-iconbtn sm" aria-label="Enviar foto" style="cursor:pointer">${icon('image')}
        <input type="file" accept="image/*" hidden id="dmImg"></label>
      <textarea id="dmT" rows="1" maxlength="2000" placeholder="Escribe con gracia…" aria-label="Mensaje"></textarea>
      <button class="cx-iconbtn sm ch-send" aria-label="Enviar">${icon('send')}</button>
    </form>`;

  const list = $('#dmList', body), ta = $('#dmT', body);
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
    if (!msgs.length) list.innerHTML = `<div class="chat-vacio"><p>Escríbele a ${esc(persona.name.split(' ')[0])}.</p></div>`;
    refrescarBadge(ctx);
  } catch (e) { empty(list, 'info', e.message); }

  const enviar = async (payload) => {
    const v = list.querySelector('.chat-vacio'); if (v) v.remove();
    try { pinta(await ctx.store.sendDirect(persona.id, payload)); } catch (err) { toast(err.message); }
  };
  $('#dmF', body).onsubmit = (e) => {
    e.preventDefault();
    const v = ta.value.trim(); if (!v) return;
    ta.value = ''; ta.style.height = ''; enviar({ body: v });
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#dmF', body).requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  $('#dmImg', body).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const img = await compressImage(f, { maxSide: 1400, quality: 0.78 }); await enviar({ body: ta.value.trim(), image: img }); ta.value = ''; }
    catch (err) { toast(err.message); }
  };

  const unsub = ctx.store.subscribeDirect(persona.id, (m) => { const v = list.querySelector('.chat-vacio'); if (v) v.remove(); pinta(m, false); });
  panel._limpiar = () => { if (unsub) unsub(); };
  ta.focus({ preventScroll: true });
}
