/* ============================================================
   BIBLIOTECA · catálogo de partituras
   ------------------------------------------------------------
   Las obras reales de la biblioteca (store) y el catálogo de
   artistas cristianos (catalog-data.js, títulos de itemfunes.com/
   explore) son, desde aquí, la MISMA cosa: ambas viven como filas
   de "scores" (en demo, sembradas en store-demo.js; en producción,
   supabase/catalog-seed.sql). Las que no tienen arreglo propio
   todavía abren con un arreglo de muestra (el motor genera el de
   "Estrellita") hasta que un administrador sube el MusicXML real
   desde Panel de Hosannia → Partituras — ahí mismo se decide, obra
   por obra, si es gratis o de suscripción. Nada de esto redirige a
   una página externa: todo abre dentro del reproductor de Hosannia.
============================================================ */
import { icon, markSvg } from '../icons.js';
import { $, $$, esc, ago, toast, modal, loading, empty } from '../ui.js';
import {
  ARTISTS, artistById, ALBUMS, CATALOG_INSTRUMENTS, CATALOG_CATEGORIES, CATALOG_LEVELS,
  HERO_COMPOSITION, POPULAR_TITLES, normalize, catalogSheetImage, pickFallbackImage, metaByTitle,
} from './catalog-data.js';
import { PLANS } from './plans.js';
import { renderPromo } from './promos.js';

export function coverImg(src) { return `<img class="cv-img" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='public/img/artist-placeholder.svg'">`; }
function coverFor(s) { const meta = metaByTitle.get(s.title); return meta ? catalogSheetImage(meta) : (s.image || pickFallbackImage(s.id)); }

/* ---------- buscador redondo con destello animado (Biblioteca y Explorar) ---------- */
export function searchShellHTML(id, placeholder, value = '') {
  return `<form class="search-shell" id="${id}Form" role="search" aria-label="${esc(placeholder)}">
    <div class="search-inner">${icon('search', 'search-leading')}
      <label class="sr-only" for="${id}">${esc(placeholder)}</label>
      <input class="search-input" id="${id}" type="text" placeholder="${esc(placeholder)}" autocomplete="off" maxlength="160" value="${esc(value)}">
      <kbd class="search-hint" id="${id}Hint" aria-hidden="true">/</kbd>
      <button class="search-clear" id="${id}Clear" type="button" aria-label="Limpiar búsqueda" hidden>${icon('x')}</button>
      <button class="search-submit" id="${id}Go" type="submit" aria-label="Buscar">${icon('arrowGo')}</button>
    </div></form>`;
}

/** onChange(valor, fueEnvio) — fueEnvio es true al pulsar Enter o el botón, para poder hacer scroll a los resultados. */
export function bindSearchShell(view, id, onChange) {
  const form = $(`#${id}Form`, view);
  const input = $(`#${id}`, view);
  const clearBtn = $(`#${id}Clear`, view);
  const hint = $(`#${id}Hint`, view);
  const submitBtn = $(`#${id}Go`, view);
  const update = () => { clearBtn.hidden = input.value.length === 0; hint.hidden = input.value.length > 0; };
  let t = 0;
  input.oninput = () => { update(); clearTimeout(t); t = setTimeout(() => onChange(input.value.trim(), false), 250); };
  clearBtn.onclick = () => { input.value = ''; update(); input.focus(); onChange('', false); };
  form.onsubmit = (e) => {
    e.preventDefault();
    const arrow = submitBtn.querySelector('svg');
    if (arrow && arrow.animate) arrow.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 350, easing: 'ease-out' });
    onChange(input.value.trim(), true);
  };
  const shortcut = (e) => {
    const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (e.key === '/' && !editing) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape' && document.activeElement === input) { input.value = ''; update(); onChange('', false); }
  };
  document.addEventListener('keydown', shortcut);
  update();
  return () => document.removeEventListener('keydown', shortcut);
}

/* ---------- tarjeta de obra (también la usa #/buscar) ---------- */
export function scoreCard(s) {
  return `<article class="sc" data-id="${esc(s.id)}" tabindex="0" role="link" aria-label="${esc(s.title)}">
    <div class="cv">${coverImg(coverFor(s))}<span class="pill gold inst">${esc(s.instrument)}</span>
      <button class="fav${s.favorite ? ' on' : ''}" data-fav aria-label="${s.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${icon('heart')}</button>
      ${s.locked ? `<span class="pill lock lk">${icon('lock')}Suscripción</span>` : s.free ? '<span class="pill gold lk" style="background:var(--bg)">Gratis</span>' : ''}</div>
    <div class="bd"><h3>${esc(s.title)}</h3><div class="by">${esc(s.composer)}</div>
      <div class="mt"><span class="pill">${esc(s.level)}</span>${s.key_label ? `<span class="pill">${esc(s.key_label)}</span>` : ''}${s.hasMedia ? `<span class="pill wine">${icon('video')}Video</span>` : ''}</div></div></article>`;
}

export function wireCards(root, list, ctx, reload) {
  $$('.sc', root).forEach((el) => {
    const s = list.find((x) => x.id === el.dataset.id);
    const open = () => { if (s.locked) { toast('Esta obra es parte de la suscripción.'); ctx.go('#/ajustes/suscripcion'); } else ctx.go(`#/obra/${s.id}`); };
    el.onclick = (e) => { if (e.target.closest('[data-fav]')) return; open(); };
    el.onkeydown = (e) => { if (e.key === 'Enter') open(); };
    $('[data-fav]', el).onclick = async (e) => {
      e.stopPropagation();
      try { const on = await ctx.store.toggleFavorite(s.id); s.favorite = on; e.currentTarget.classList.toggle('on', on); toast(on ? 'Agregada a favoritos.' : 'Quitada de favoritos.'); if (reload) reload(); } catch (err) { toast(err.message); }
    };
  });
}

/* ---------- catálogo combinado: siempre obras reales de ctx.store ---------- */
function rank(title) { const i = POPULAR_TITLES.indexOf(title); return i === -1 ? 100 : i; }

export async function buildCombined(ctx) {
  let real = [];
  try { real = await ctx.store.listScores({}); } catch (_) {}
  return real.map((s) => {
    const meta = metaByTitle.get(s.title);
    return {
      id: s.id, title: s.title, artistName: s.composer, artistId: meta ? meta.artistId : null,
      instrument: s.instrument, level: s.level, tone: s.key_label, category: meta ? meta.category : undefined,
      free: s.free, locked: s.locked, favorite: s.favorite, hasMedia: s.hasMedia, image: coverFor(s),
    };
  });
}

export function matchesQuery(e, q) {
  if (!q.trim()) return true;
  const text = normalize(`${e.title} ${e.artistName} ${e.instrument} ${e.level} ${e.tone || ''} ${e.category || ''} ${e.free ? 'gratis gratuitas' : 'premium suscripcion'}`);
  return normalize(q).split(/\s+/).filter(Boolean).every((w) => text.includes(w));
}

function applyFilters(combined, st) {
  let result = combined.filter((e) => matchesQuery(e, st.q)
    && (st.tab !== 'free' || e.free)
    && (!st.instrument || e.instrument === st.instrument)
    && (!st.category || e.category === st.category)
    && (!st.level || e.level === st.level));
  if (st.tab === 'new') result = result.slice().reverse();
  if (st.tab === 'popular') result = result.slice().sort((a, b) => rank(a.title) - rank(b.title));
  return result;
}

export function entryCard(e) {
  return `<article class="sheet-card" data-id="${esc(e.id)}" tabindex="0" role="link" aria-label="${esc(e.title)}">
    <div class="sheet-cover"><button data-open tabindex="-1">${coverImg(e.image)}</button><span class="sheet-arrow">${icon('arrowUp')}</span>
      <button class="sheet-fav${e.favorite ? ' on' : ''}" data-fav aria-label="${e.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${icon('heart')}</button>
      ${e.locked ? `<span class="sheet-lock">${icon('lock')}Suscripción</span>` : ''}</div>
    <span class="sheet-title2">${esc(e.title)}</span><span class="sheet-artist2">${esc(e.artistName)}</span>
    <div class="sheet-meta2"><span class="inst">${icon('music')}${esc(e.instrument)}</span>
      <span class="${e.free ? 'free' : 'prem'}">${e.free ? 'Gratis' : (e.locked ? icon('crown') + ' Premium' : 'Premium')}</span></div></article>`;
}

export function entryRow(e, rankNo) {
  return `<div class="sh-row" data-id="${esc(e.id)}">
    ${rankNo != null ? `<span class="sh-rank">${String(rankNo).padStart(2, '0')}</span>` : ''}
    <button class="sh-open" data-open>${coverImg(e.image)}<span><strong>${esc(e.title)}</strong><small>${esc(e.artistName)}</small></span></button>
    <span class="sh-access ${e.free ? 'free' : (e.locked ? 'prem' : '')}">${e.free ? 'Gratis' : (e.locked ? icon('crown') : '')}</span>
    <button class="sh-heart${e.favorite ? ' on' : ''}" data-fav aria-label="Favorito">${icon('heart')}</button>
  </div>`;
}

function openEntry(e, ctx) {
  if (e.locked) { toast('Esta obra es parte de la suscripción.'); ctx.go('#/ajustes/suscripcion'); return; }
  ctx.go(`#/obra/${e.id}`);
}

export function wireEntries(root, list, ctx) {
  $$('[data-id]', root).forEach((el) => {
    const e = list.find((x) => x.id === el.dataset.id);
    if (!e) return;
    const open = () => openEntry(e, ctx);
    el.onclick = (ev) => { if (ev.target.closest('[data-fav]')) return; open(); };
    el.onkeydown = (ev) => { if (ev.key === 'Enter' && el.matches('.sheet-card')) open(); };
    const favBtn = $('[data-fav]', el);
    if (favBtn) favBtn.onclick = async (ev) => {
      ev.stopPropagation();
      try {
        const on = await ctx.store.toggleFavorite(e.id);
        e.favorite = on; favBtn.classList.toggle('on', on);
        toast(on ? 'Agregada a favoritos.' : 'Quitada de favoritos.');
      } catch (err) { toast(err.message); }
    };
  });
}

export function openArtistDialog(artist, ctx, combined) {
  const mine = (combined || []).filter((x) => x.artistId === artist.id);
  const m = modal({
    title: artist.name, wide: true, body: `
    <div class="art-detail"><img src="${esc(artist.image)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='public/img/artist-placeholder.svg'">
      <div><p class="muted" style="font-size:.78rem">Artista cristiano · ${esc(artist.country)}</p><p style="margin-top:.6rem;line-height:1.7">${esc(artist.bio)}</p></div></div>
    <div class="sh-related"><h4>Sus partituras en Hosannia · ${mine.length}</h4>
      ${mine.length ? mine.slice(0, 6).map((r) => entryRow(r)).join('') : '<p class="muted">Pronto añadiremos partituras de este artista.</p>'}</div>`,
  });
  if (mine.length) wireEntries($('.sh-related', m.body), mine, ctx);
}

export function openAlbumDialog(album, ctx, combined) {
  const artist = artistById[album.artistId];
  const mine = (combined || []).filter((x) => x.artistId === album.artistId);
  const m = modal({
    title: album.title, wide: true, body: `
    <div class="art-detail"><img src="${esc(album.image)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='public/img/artist-placeholder.svg'">
      <div><p class="eyebrow">UN ÁLBUM PARA INSPIRARTE</p><h3 style="margin:.3rem 0 0;font-family:var(--serif);font-weight:400">${esc(artist.name)}</h3>
        <p class="muted" style="font-size:.78rem;margin-top:.3rem">${esc(album.year)} · Música cristiana</p></div></div>
    <div class="sh-related"><h4>Partituras del artista</h4>
      ${mine.length ? mine.slice(0, 5).map((r) => entryRow(r)).join('') : '<p class="muted">Pronto añadiremos partituras.</p>'}</div>`,
  });
  if (mine.length) wireEntries($('.sh-related', m.body), mine, ctx);
}

/* ---------- carrusel animado de artistas (hero) ---------- */
export function heroGroupHTML() {
  const bubble = (id, small) => `<button class="lh-bubble ${small ? 'sm' : 'lg'}" data-hero="${id}" title="${esc(artistById[id].name)}" aria-label="Ver artista: ${esc(artistById[id].name)}">
    <img src="${esc(artistById[id].image)}" alt="${esc(artistById[id].name)}" loading="eager" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='public/img/artist-placeholder.svg'"></button>`;
  return HERO_COMPOSITION.map((item) => Array.isArray(item)
    ? `<div class="lh-cluster">${item.map((id) => bubble(id, true)).join('')}</div>`
    : bubble(item, false)).join('');
}

/* ---------- diálogo "Hazte Premium": mismos planes y precios reales de Ajustes → Suscripción ---------- */
export function openPremiumDialog(ctx) {
  const monthly = PLANS.find((p) => p.id === 'mensual');
  const yearly = PLANS.find((p) => p.id === 'anual');
  let annual = true;
  const body = () => `
    <div class="pd-brand">${markSvg('hs-mark')}<b>HOSANNIA PREMIUM</b></div>
    <p class="pd-intro">Más espacio para descubrir, aprender y adorar.</p>
    <div class="pd-benefits">${['Toda la biblioteca de partituras', 'Reproductor con loop, metrónomo y velocidad ajustable', 'Grabaciones de Enny sincronizadas compás a compás', 'PDF para imprimir y llevar al atril'].map((b) => `<p>${icon('check')}<span>${esc(b)}</span></p>`).join('')}</div>
    <div class="pd-switch"><button data-per="m" class="${!annual ? 'on' : ''}">Mensual</button><button data-per="a" class="${annual ? 'on' : ''}">Anual<span>${esc(yearly.save)}</span></button></div>
    <div class="pd-price"><span>$</span><strong>${(annual ? yearly.price / 12 : monthly.price).toFixed(2)}</strong><span>/ mes</span></div>
    <p class="pd-caption">${annual ? `$${yearly.price.toFixed(2)} al año, un solo cobro.` : 'Facturación mensual.'}</p>
    <button class="btn btn-fill" id="pdGo" style="width:100%;justify-content:center"><span>Ver planes y suscribirme</span></button>
    <p class="pd-disclaimer">${icon('shield')}<span>Pago seguro con PayPal · tarjeta de crédito o débito. Cancela cuando quieras.</span></p>`;
  const m = modal({ title: 'Tu adoración, sin límites', body: body() });
  const wire = () => {
    $$('.pd-switch button', m.body).forEach((b) => { b.onclick = () => { annual = b.dataset.per === 'a'; m.body.innerHTML = body(); wire(); }; });
    $('#pdGo', m.body).onclick = () => { m.close(); ctx.go('#/ajustes/suscripcion'); };
  };
  wire();
}

/* ---------- #/favoritos — la biblioteca abierta en "Mis partituras" ---------- */
export function renderFavorites(ctx, view) { return renderLibrary(ctx, view, ['fav=1']); }

async function renderFavoritesPage(ctx, view) {
  ctx.setTitle('Mis partituras');
  const st = { q: '', instrument: '', level: '', collection: '' };
  view.innerHTML = `<div class="lib-wrap">
    <div class="pg-head"><h1>Mis partituras</h1></div>
    <div class="lib-top">
      <div class="cx-search lib-q">${icon('search')}<input id="lq" placeholder="Título, autor o etiqueta" value=""></div>
      <button class="cx-iconbtn" id="fBtn" aria-label="Filtros">${icon('sliders')}<span class="fdot" hidden></span></button>
    </div>
    <div class="lib-grid" id="grid"></div></div>`;

  const grid = $('#grid', view);
  const load = async () => {
    loading(grid);
    try {
      const list = await ctx.store.listScores({ ...st, favorites: true });
      if (!list.length) { empty(grid, 'music', 'Aún no marcas favoritos. Toca el corazón en cualquier obra.'); return; }
      grid.innerHTML = list.map(scoreCard).join('');
      wireCards(grid, list, ctx, load);
    } catch (e) { empty(grid, 'info', e.message); }
  };
  const marcaFiltros = () => {
    const activos = !!(st.instrument || st.level || st.collection);
    $('#fBtn .fdot', view).hidden = !activos;
    $('#fBtn', view).classList.toggle('on', activos);
  };
  $('#fBtn', view).onclick = async () => {
    let cols = []; try { cols = await ctx.store.listCollections(); } catch (_) {}
    const fila = (titulo, key, opciones) => `<div class="flt-row"><b>${titulo}</b><div class="cx-row">${opciones.map(([v, l]) =>
      `<button class="cx-chip${st[key] === v ? ' on' : ''}" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`;
    const m = modal({ title: 'Filtrar partituras', body: `<div class="flt">
      ${fila('Instrumento', 'instrument', [['', 'Todos'], ['Violín', 'Violín'], ['Piano', 'Piano'], ['Violonchelo', 'Chelo']])}
      ${fila('Nivel', 'level', [['', 'Todo nivel'], ['Inicial', 'Inicial'], ['Intermedio', 'Intermedio'], ['Avanzado', 'Avanzado']])}
      ${cols.length ? fila('Colección', 'collection', [['', 'Todas'], ...cols.map((c) => [c.id, c.title])]) : ''}
      <div class="cx-row" style="justify-content:space-between;margin-top:1.2rem">
        <button class="btn btn-ghost btn-sm" id="flClear"><span>Limpiar</span></button>
        <button class="btn btn-fill btn-sm" id="flGo"><span>Ver resultados</span></button></div></div>` });
    $$('[data-k]', m.body).forEach((b) => { b.onclick = () => { st[b.dataset.k] = b.dataset.v; $$(`[data-k="${b.dataset.k}"]`, m.body).forEach((x) => x.classList.toggle('on', x === b)); }; });
    $('#flClear', m.body).onclick = () => { st.instrument = ''; st.level = ''; st.collection = ''; m.close(); marcaFiltros(); load(); };
    $('#flGo', m.body).onclick = () => { m.close(); marcaFiltros(); load(); };
  };
  let t = 0; $('#lq', view).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 250); };
  marcaFiltros(); load();
}

/* ---------- #/biblioteca ---------- */
export async function renderLibrary(ctx, view, [query]) {
  const qs = new URLSearchParams(query || '');
  if (qs.get('fav') === '1') return renderFavoritesPage(ctx, view);
  ctx.setTitle('Biblioteca');

  let mode = 'grid'; try { mode = localStorage.getItem('hosannia-lib-mode') || 'grid'; } catch (_) {}
  const st = { q: '', tab: 'recommended', instrument: '', category: '', level: '', mode };
  let limit = 10;
  let combined = [];
  let staticDone = false;

  const tabs = [['recommended', 'Para ti'], ['free', 'Gratuitas'], ['popular', 'Más populares'], ['new', 'Novedades']];

  view.innerHTML = `<div class="lib-wrap">
    <section class="lib-hero">
      <div class="lh-copy"><p class="eyebrow">EL UNIVERSO HOSANNIA</p><h1>Artistas<span class="dot">.</span></h1>
        <p class="lh-sub">Voces que inspiran. Partituras que acercan a Dios.</p></div>
      <div class="lh-window"><div class="lh-track"><div class="lh-group">${heroGroupHTML()}</div><div class="lh-group" aria-hidden="true">${heroGroupHTML()}</div></div></div>
      <div class="lh-search">${searchShellHTML('lq', 'Busca por título, artista o categoría')}</div>
    </section>
    <div id="banner"></div>
    <div id="promo"></div>
    <section class="catalog-sec" id="libResults">
      <div class="section-heading"><div><h2 id="catTitle">Biblioteca</h2><p id="catSub">Encuentra una partitura. Dale vida con tu instrumento.</p></div>
        ${ctx.me.hasAccess ? '' : `<button class="btn btn-fill btn-sm" id="libUnlock"><span>${icon('crown')} Desbloquear</span></button>`}</div>
      <div class="cat-toolbar">
        <div class="cat-tabs" id="catTabs">${tabs.map(([id, l]) => `<button class="${st.tab === id ? 'on' : ''}" data-tab="${id}">${esc(l)}</button>`).join('')}</div>
        <div class="cat-controls">
          <div class="inst-select">${icon('chevD')}<select id="instSel" aria-label="Filtrar por instrumento"><option value="">Todos los instrumentos</option>${CATALOG_INSTRUMENTS.concat(['Violonchelo']).map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('')}</select></div>
          <span class="cat-divider"></span>
          <button class="cx-iconbtn sm" id="fBtn" aria-label="Filtros">${icon('sliders')}<span class="fdot" hidden></span></button>
          <div class="lib-toggle" id="libToggle"><button class="${mode === 'grid' ? 'on' : ''}" data-mode="grid" aria-label="Vista en cuadrícula">${icon('grid')}</button><button class="${mode === 'list' ? 'on' : ''}" data-mode="list" aria-label="Vista en lista">${icon('list')}</button></div>
        </div>
      </div>
      <div class="${mode === 'list' ? 'sh-list' : 'sheet-grid'}" id="grid"></div>
      <div class="cat-bottom" id="catBottom" hidden><span id="catCount"></span><button class="btn btn-ghost btn-sm" id="catMore"><span>Cargar más partituras</span></button></div>
    </section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Para tu próxima adoración</h2><p>Canciones que querrás llevar a tu instrumento.</p></div></div>
      <div class="insp-list" id="inspList"></div></section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Álbumes para adorar</h2><p>Una colección de canciones. Un mismo propósito.</p></div></div>
      <div class="alb-grid" id="albGrid"></div></section>
    <div id="promoMid"></div>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Artistas para descubrir</h2><p>Encuentra nuevas voces que acompañen tu fe.</p></div></div>
      <div class="art-grid" id="artGrid"></div></section>
  </div>`;

  const grid = $('#grid', view);
  const unlockBtn = $('#libUnlock', view);
  if (unlockBtn) unlockBtn.onclick = () => openPremiumDialog(ctx);

  function renderStatic() {
    if (staticDone) return; staticDone = true;
    const insp = POPULAR_TITLES.map((title) => combined.find((x) => x.title === title)).filter(Boolean);
    $('#inspList', view).innerHTML = insp.map((e, i) => entryRow(e, i + 1)).join('');
    wireEntries($('#inspList', view), insp, ctx);

    $('#albGrid', view).innerHTML = ALBUMS.map((a) => `<button class="alb-item" data-album="${esc(a.id)}">
      <div class="alb-cov">${coverImg(a.image)}<span class="cov-arrow">${icon('arrowUp')}</span></div>
      <strong>${esc(a.title)}</strong><span>${esc(artistById[a.artistId].name)}</span></button>`).join('');
    $$('[data-album]', view).forEach((b) => { b.onclick = () => openAlbumDialog(ALBUMS.find((a) => a.id === b.dataset.album), ctx, combined); });

    $('#artGrid', view).innerHTML = ARTISTS.slice(0, 7).map((a) => `<button class="art-item" data-discover="${esc(a.id)}">
      <div class="art-photo">${coverImg(a.image)}</div><strong>${esc(a.name)}</strong><span>${esc(a.country)}</span></button>`).join('');
    $$('[data-discover]', view).forEach((b) => { b.onclick = () => openArtistDialog(artistById[b.dataset.discover], ctx, combined); });

    $$('[data-hero]', view).forEach((b) => { b.onclick = () => openArtistDialog(artistById[b.dataset.hero], ctx, combined); });

    renderPromo(ctx, $('#promoMid', view), 'middle');
  }

  async function load() {
    loading(grid);
    try {
      if (!combined.length) combined = await buildCombined(ctx);
      const filtered = applyFilters(combined, st);
      $('#catSub', view).textContent = st.q.trim() ? `${filtered.length} ${filtered.length === 1 ? 'partitura encontrada' : 'partituras encontradas'} para "${st.q.trim()}".` : 'Encuentra una partitura. Dale vida con tu instrumento.';
      if (!filtered.length) { empty(grid, 'music', 'No encontramos esa partitura. Prueba otro título, artista o instrumento.'); $('#catBottom', view).hidden = true; renderStatic(); return; }
      grid.className = st.mode === 'list' ? 'sh-list' : 'sheet-grid';
      const shown = filtered.slice(0, limit);
      grid.innerHTML = st.mode === 'grid' ? shown.map(entryCard).join('') : shown.map((e) => entryRow(e)).join('');
      wireEntries(grid, shown, ctx);
      $('#catBottom', view).hidden = false;
      $('#catCount', view).textContent = `Mostrando ${shown.length} de ${filtered.length} partituras`;
      $('#catMore', view).hidden = limit >= filtered.length;
      renderStatic();
    } catch (e) { empty(grid, 'info', e.message); }
  }

  /* buscador del encabezado: única fuente de la búsqueda de toda la página */
  const stopSearchShell = bindSearchShell(view, 'lq', (value, fueEnvio) => {
    st.q = value; limit = 10; load();
    if (fueEnvio) $('#libResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* pestañas de colección */
  $$('[data-tab]', view).forEach((b) => {
    b.onclick = () => { st.tab = b.dataset.tab; limit = 10; $$('[data-tab]', view).forEach((x) => x.classList.toggle('on', x === b)); load(); };
  });

  /* cuadrícula / lista */
  $$('#libToggle button', view).forEach((b) => {
    b.onclick = () => {
      st.mode = b.dataset.mode; try { localStorage.setItem('hosannia-lib-mode', st.mode); } catch (_) {}
      $$('#libToggle button', view).forEach((x) => x.classList.toggle('on', x === b)); load();
    };
  });

  /* instrumento: selector propio, separado de categoría/nivel */
  $('#instSel', view).onchange = (e) => { st.instrument = e.target.value; limit = 10; load(); };

  /* filtros: categoría y nivel */
  const marcaFiltros = () => {
    const activos = !!(st.category || st.level);
    $('#fBtn .fdot', view).hidden = !activos;
    $('#fBtn', view).classList.toggle('on', activos);
  };
  $('#fBtn', view).onclick = () => {
    const fila = (titulo, key, opciones) => `<div class="flt-row"><b>${titulo}</b><div class="cx-row">${opciones.map(([v, l]) =>
      `<button class="cx-chip${st[key] === v ? ' on' : ''}" data-k="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`;
    const m = modal({ title: 'Filtrar partituras', body: `<div class="flt">
      ${fila('Categoría', 'category', [['', 'Todas'], ...CATALOG_CATEGORIES.map((c) => [c, c])])}
      ${fila('Nivel', 'level', [['', 'Todo nivel'], ...CATALOG_LEVELS.map((l) => [l, l])])}
      <div class="cx-row" style="justify-content:space-between;margin-top:1.2rem">
        <button class="btn btn-ghost btn-sm" id="flClear"><span>Limpiar</span></button>
        <button class="btn btn-fill btn-sm" id="flGo"><span>Ver resultados</span></button></div></div>` });
    $$('[data-k]', m.body).forEach((b) => { b.onclick = () => { st[b.dataset.k] = b.dataset.v; $$(`[data-k="${b.dataset.k}"]`, m.body).forEach((x) => x.classList.toggle('on', x === b)); }; });
    $('#flClear', m.body).onclick = () => { st.category = ''; st.level = ''; m.close(); marcaFiltros(); limit = 10; load(); };
    $('#flGo', m.body).onclick = () => { m.close(); marcaFiltros(); limit = 10; load(); };
  };

  /* banner editable desde el panel administrativo */
  ctx.store.getContent('library_banner').then((b) => {
    const host = $('#banner', view); if (!host || !b || !b.image) return;
    host.innerHTML = `<${b.link ? 'a' : 'div'} class="lib-banner"${b.link ? ` href="${esc(b.link)}"` : ''}>
      <img src="${esc(b.image)}" alt="${esc(b.alt || '')}">
      ${b.title ? `<div class="bn-tx"><b>${esc(b.title)}</b>${b.subtitle ? `<span>${esc(b.subtitle)}</span>` : ''}</div>` : ''}
    </${b.link ? 'a' : 'div'}>`;
  }).catch(() => {});

  /* anuncio/promoción: lo que haya cargado el panel admin (Biblioteca → Promos) rota en cada visita */
  renderPromo(ctx, $('#promo', view), 'top');

  marcaFiltros();
  load();
  return stopSearchShell;
}
