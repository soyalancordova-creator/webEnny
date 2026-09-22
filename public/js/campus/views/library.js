/* ============================================================
   BIBLIOTECA · catálogo de partituras
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, toast, loading, empty } from '../ui.js';

/** Portada: un pentagrama con notas pseudo-aleatorias pero estables por obra. */
function staffCover(seed) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  const lines = [0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="400" y1="${46 + i * 9}" y2="${46 + i * 9}" stroke="#b7a58c" stroke-width=".8"/>`).join('');
  let notes = '';
  for (let i = 0; i < 9; i++) {
    const x = 34 + i * 40, y = 46 + Math.round(rnd() * 8) * 4.5;
    notes += `<ellipse cx="${x}" cy="${y}" rx="5.2" ry="3.8" transform="rotate(-20 ${x} ${y})" fill="#3b2a24"/><line x1="${x + 4.8}" x2="${x + 4.8}" y1="${y}" y2="${y - 26}" stroke="#3b2a24" stroke-width="1.1"/>`;
    if (i === 3 || i === 7) notes += `<line x1="${x + 18}" x2="${x + 18}" y1="46" y2="82" stroke="#b7a58c" stroke-width="1"/>`;
  }
  return `<svg class="staff" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="130" fill="#fffdf8"/>${lines}${notes}<path d="M10 40c10-6 16 4 10 14s-4 20 6 22" fill="none" stroke="#6E1423" stroke-width="2"/></svg>`;
}

export function scoreCard(s) {
  return `<article class="sc" data-id="${esc(s.id)}" tabindex="0" role="link" aria-label="${esc(s.title)}">
    <div class="cv">${staffCover(s.id)}<span class="pill gold inst">${esc(s.instrument)}</span>
      <button class="fav${s.favorite ? ' on' : ''}" data-fav aria-label="${s.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${icon('heart')}</button>
      ${s.locked ? `<span class="pill lock lk">${icon('lock')}Suscripción</span>` : s.free ? '<span class="pill gold lk" style="background:var(--bg)">Gratis</span>' : ''}</div>
    <div class="bd"><h3>${esc(s.title)}</h3><div class="by">${esc(s.composer)}</div>
      <div class="mt"><span class="pill">${esc(s.level)}</span>${s.key_label ? `<span class="pill">${esc(s.key_label)}</span>` : ''}${s.hasMedia ? `<span class="pill wine">${icon('video')}Video</span>` : ''}</div></div></article>`;
}

export function wireCards(root, list, ctx, reload) {
  $$('.sc', root).forEach((el) => {
    const s = list.find((x) => x.id === el.dataset.id);
    const open = () => { if (s.locked) { toast('Esta obra es parte de la suscripción.'); ctx.go('#/planes'); } else ctx.go(`#/obra/${s.id}`); };
    el.onclick = (e) => { if (e.target.closest('[data-fav]')) return; open(); };
    el.onkeydown = (e) => { if (e.key === 'Enter') open(); };
    $('[data-fav]', el).onclick = async (e) => {
      e.stopPropagation();
      try { const on = await ctx.store.toggleFavorite(s.id); s.favorite = on; e.currentTarget.classList.toggle('on', on); toast(on ? 'Agregada a favoritos.' : 'Quitada de favoritos.'); if (reload) reload(); } catch (err) { toast(err.message); }
    };
  });
}

export async function renderLibrary(ctx, view, [query]) {
  ctx.setTitle('Biblioteca');
  const qs = new URLSearchParams(query || '');
  const st = { q: qs.get('q') || '', instrument: '', level: '', collection: qs.get('col') || '', favorites: false };
  view.innerHTML = `<div style="max-width:1240px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Biblioteca</span><h1>Partituras para practicar</h1>
      <p>Ábrelas, escúchalas a tu velocidad, repite los compases difíciles y sigue el cursor nota a nota.</p></div>
      ${ctx.me.hasAccess ? '' : `<a class="btn btn-fill btn-sm" href="#/planes"><span>${icon('crown')} Desbloquear todo</span></a>`}</div>
    <div class="col-strip" id="cols"></div>
    <div class="lib-top">
      <div class="cx-search" style="max-width:340px">${icon('search')}<input id="lq" placeholder="Título, autor o etiqueta" value="${esc(st.q)}"></div>
      <div class="cx-row" id="fInst"><button class="cx-chip on" data-v="">Todos</button><button class="cx-chip" data-v="Violín">Violín</button><button class="cx-chip" data-v="Piano">Piano</button><button class="cx-chip" data-v="Violonchelo">Chelo</button></div>
      <div class="cx-row" id="fLvl"><button class="cx-chip on" data-v="">Todo nivel</button><button class="cx-chip" data-v="Inicial">Inicial</button><button class="cx-chip" data-v="Intermedio">Intermedio</button><button class="cx-chip" data-v="Avanzado">Avanzado</button></div>
      <button class="cx-chip" id="fFav">${icon('heart')}Favoritos</button>
    </div>
    <div class="lib-grid" id="grid"></div></div>`;
  const grid = $('#grid', view);
  const load = async () => {
    loading(grid);
    try {
      const list = await ctx.store.listScores(st);
      if (!list.length) { empty(grid, 'music', st.favorites ? 'Aún no marcas favoritos. Toca el corazón en cualquier obra.' : 'No hay obras con esos filtros.'); return; }
      grid.innerHTML = list.map(scoreCard).join('');
      wireCards(grid, list, ctx, st.favorites ? load : null);
    } catch (e) { empty(grid, 'info', e.message); }
  };
  const chips = (sel, key) => $$(`${sel} [data-v]`, view).forEach((b) => { b.onclick = () => { st[key] = b.dataset.v; $$(`${sel} .cx-chip`, view).forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  chips('#fInst', 'instrument'); chips('#fLvl', 'level');
  $('#fFav', view).onclick = (e) => { st.favorites = !st.favorites; e.currentTarget.classList.toggle('on', st.favorites); load(); };
  let t = 0; $('#lq', view).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 250); };

  ctx.store.listCollections().then((cols) => {
    $('#cols', view).innerHTML = `<a href="#/biblioteca" style="background:linear-gradient(135deg,var(--gold),var(--wine))" data-c=""><b>Todas las obras</b><small>Catálogo completo</small></a>` +
      cols.map((c) => `<a href="#/biblioteca?col=${esc(c.id)}" data-c="${esc(c.id)}"${st.collection === c.id ? ' style="outline:2px solid var(--gold);outline-offset:2px"' : ''}><b>${esc(c.title)}</b><small>${c.count} obra${c.count === 1 ? '' : 's'} · ${esc(c.description)}</small></a>`).join('');
  }).catch(() => {});
  load();
}
