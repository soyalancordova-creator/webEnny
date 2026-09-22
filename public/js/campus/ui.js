/* Utilidades de interfaz del campus. */
import { icon } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escapa y convierte URLs http(s) en enlaces. Nada de HTML del usuario llega al DOM sin escapar. */
export function richText(v) {
  return esc(v).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)"']/g, (u) => `<a href="${u}" target="_blank" rel="noopener nofollow ugc">${u}</a>`);
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function avatar(p, cls = '') {
  const name = (p && p.name) || 'Alumno';
  const img = p && p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy">` : esc(initials(name));
  return `<span class="av ${cls}" title="${esc(name)}">${img}</span>`;
}

export function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 50) return 'ahora';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

export function clock(iso) { return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }); }

export function dayLabel(iso) {
  const d = new Date(iso), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (same(d, t)) return 'Hoy';
  if (same(d, y)) return 'Ayer';
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

let toastT;
export function toast(msg) {
  let t = $('#cxToast');
  if (!t) { t = document.createElement('div'); t.id = 'cxToast'; t.className = 'cx-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800);
}

/** Modal genérico. Devuelve { el, close }. */
export function modal({ title, body, wide = false, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'mdl on';
  wrap.innerHTML = `<div class="mdl-in${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mdl-h"><h3>${esc(title)}</h3><button class="cx-iconbtn" data-x aria-label="Cerrar">${icon('x')}</button></div>
    <div class="mdl-b"></div></div>`;
  const b = $('.mdl-b', wrap);
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  const f = $('input,textarea,select,button:not([data-x])', b); if (f) setTimeout(() => f.focus(), 30);
  return { el: wrap, body: b, close };
}

export function confirmBox(text, okLabel = 'Confirmar') {
  return new Promise((res) => {
    const m = modal({ title: 'Confirmar', body: `<p class="muted" style="margin-bottom:1.4rem">${esc(text)}</p>
      <div class="cx-row" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-no><span>Cancelar</span></button>
      <button class="btn btn-fill btn-sm" data-ok><span>${esc(okLabel)}</span></button></div>`, onClose: () => res(false) });
    $('[data-no]', m.body).onclick = () => { m.close(); };
    $('[data-ok]', m.body).onclick = () => { res(true); m.el.remove(); };
  });
}

export function lightbox(urls, start = 0) {
  let i = start;
  const el = document.createElement('div'); el.className = 'lb on';
  const draw = () => { el.innerHTML = `<img src="${esc(urls[i])}" alt=""><button class="x" aria-label="Cerrar">${icon('x')}</button>${urls.length > 1 ? `<button class="pv" aria-label="Anterior">${icon('chevL')}</button><button class="nx" aria-label="Siguiente">${icon('chevR')}</button>` : ''}`; };
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { i = (i + 1) % urls.length; draw(); } if (e.key === 'ArrowLeft') { i = (i - 1 + urls.length) % urls.length; draw(); } };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.pv')) { i = (i - 1 + urls.length) % urls.length; draw(); return; }
    if (e.target.closest('.nx')) { i = (i + 1) % urls.length; draw(); return; }
    if (e.target.tagName !== 'IMG') close();
  });
  document.addEventListener('keydown', key);
  draw(); document.body.appendChild(el);
}

/** Menú contextual anclado a un botón. items: [{label, icon, danger, run}] */
export function popMenu(anchor, items) {
  document.querySelectorAll('.menu-pop').forEach((m) => m.remove());
  const m = document.createElement('div'); m.className = 'menu-pop';
  m.innerHTML = items.map((it, k) => `<button data-k="${k}" class="${it.danger ? 'danger' : ''}">${icon(it.icon || 'info')}${esc(it.label)}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const left = Math.min(innerWidth - m.offsetWidth - 10, Math.max(10, r.right - m.offsetWidth));
  m.style.left = `${left + scrollX}px`; m.style.top = `${r.bottom + 6 + scrollY}px`;
  const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; m.remove(); items[+b.dataset.k].run(); });
}

export function loading(el, text = 'Cargando…') { el.innerHTML = `<div class="cx-empty"><span class="spin"></span><p style="margin-top:.8rem">${esc(text)}</p></div>`; }

export function empty(el, ic, text, extra = '') { el.innerHTML = `<div class="cx-empty">${icon(ic)}<p>${esc(text)}</p>${extra}</div>`; }
