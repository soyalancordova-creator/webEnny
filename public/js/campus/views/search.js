/* ============================================================
   BUSCAR · partituras, comunidades, grupos y personas
   ------------------------------------------------------------
   Pantalla propia: el buscador vive aquí, no en la barra superior.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, avatar, toast, empty } from '../ui.js';
import { scoreCard, wireCards } from './library.js';

const FILTROS = [
  ['todo', 'Todo', 'search'],
  ['partituras', 'Partituras', 'music'],
  ['personas', 'Personas', 'user'],
  ['comunidades', 'Comunidades', 'users'],
];

const SUGERENCIAS = ['Sublime gracia', 'Himnos', 'Violín inicial', 'Piano', 'Adoración', 'Escalas'];

export async function renderSearch(ctx, view, [raw]) {
  const q0 = decodeURIComponent(raw || '').trim();
  ctx.setTitle('Buscar');
  let filtro = 'todo';

  view.innerHTML = `<div class="srch">
    <div class="srch-bar">
      <div class="cx-search">${icon('search')}
        <input id="sq" placeholder="Partituras, personas, comunidades…" value="${esc(q0)}" autocomplete="off" enterkeyhint="search">
        <button class="cx-iconbtn sm" id="sx" aria-label="Limpiar"${q0 ? '' : ' hidden'}>${icon('x')}</button>
      </div>
    </div>
    <div class="cx-row srch-f">${FILTROS.map(([k, l, ic]) => `<button class="cx-chip${k === 'todo' ? ' on' : ''}" data-f="${k}">${icon(ic)}${l}</button>`).join('')}</div>
    <div id="res"></div>
  </div>`;

  const input = $('#sq', view), res = $('#res', view), limpiar = $('#sx', view);

  const vacio = () => {
    res.innerHTML = `<div class="srch-empty">
      <p class="muted">Busca una obra, una persona o una comunidad.</p>
      <div class="cx-row" style="flex-wrap:wrap;justify-content:center;margin-top:.8rem">
        ${SUGERENCIAS.map((s) => `<button class="cx-chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    $$('[data-s]', res).forEach((b) => { b.onclick = () => { input.value = b.dataset.s; buscar(); }; });
  };

  let token = 0;
  const buscar = async () => {
    const q = input.value.trim();
    limpiar.hidden = !q;
    if (!q) { vacio(); return; }
    const mio = ++token;
    res.innerHTML = '<div class="cx-empty"><span class="spin"></span></div>';

    const quiere = (k) => filtro === 'todo' || filtro === k;
    const [scores, people, groups] = await Promise.all([
      quiere('partituras') ? ctx.store.listScores({ q }).catch(() => []) : [],
      quiere('personas') ? ctx.store.searchPeople(q).catch(() => []) : [],
      quiere('comunidades') ? ctx.store.listGroups({ q }).catch(() => []) : [],
    ]);
    if (mio !== token) return;

    if (!scores.length && !people.length && !groups.length) {
      empty(res, 'search', `Nada coincide con “${q}”.`);
      return;
    }

    const bloque = (titulo, cuerpo) => `<section class="srch-sec"><h3>${titulo}</h3>${cuerpo}</section>`;
    let html = '';
    if (people.length) html += bloque('Personas', `<div class="cx-card cx-pad"><div class="mini-list">${people.map((p) => `
      <a href="#/perfil/${esc(p.id)}">${avatar(p, 'sm')}<div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.service || p.church || '')}</small></div>
      ${p.isMe ? '' : `<button class="btn btn-ghost btn-sm" data-fw="${esc(p.id)}"><span>${p.iFollow ? 'Conectados' : 'Conectar'}</span></button>`}</a>`).join('')}</div></div>`);
    if (scores.length) html += bloque('Partituras', `<div class="lib-grid" id="rs">${scores.map(scoreCard).join('')}</div>`);
    if (groups.length) html += bloque('Comunidades', `<div class="cx-card cx-pad"><div class="mini-list">${groups.map((g) => `
      <a href="#/comunidad/${esc(g.id)}"><span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('users')}</span>
      <div style="min-width:0"><b>${esc(g.name)}</b><small>${g.members} ${g.members === 1 ? 'seguidor' : 'seguidores'}</small></div></a>`).join('')}</div></div>`);
    res.innerHTML = html;

    const rs = $('#rs', res);
    if (rs) wireCards(rs, scores, ctx);
    $$('[data-fw]', res).forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault(); e.stopPropagation();
        try { const on = await ctx.store.follow(b.dataset.fw); $('span', b).textContent = on ? 'Conectados' : 'Conectar'; }
        catch (err) { toast(err.message); }
      };
    });
  };

  let t = 0;
  input.oninput = () => { clearTimeout(t); t = setTimeout(buscar, 260); };
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); buscar(); } };
  limpiar.onclick = () => { input.value = ''; input.focus(); buscar(); };
  $$('[data-f]', view).forEach((b) => {
    b.onclick = () => { filtro = b.dataset.f; $$('[data-f]', view).forEach((x) => x.classList.toggle('on', x === b)); buscar(); };
  });

  if (q0) buscar(); else { vacio(); setTimeout(() => input.focus(), 80); }
}
