/* ============================================================
   EXPLORAR · descubre artistas, álbumes, personas y comunidades
   ------------------------------------------------------------
   Comparte todo el catálogo con la Biblioteca (misma búsqueda,
   mismas tarjetas, mismo carrusel): ver library.js. "Personas que
   inspiran" y "Encuentra tu comunidad" son ejemplos de vitrina,
   igual que en el prototipo — no son las comunidades/perfiles reales
   de Hosannia (esas ya existen en #/comunidad y #/comunidades).
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, toast, loading, empty } from '../ui.js';
import {
  ARTISTS, artistById, ALBUMS, COMMUNITIES, PROFILES,
} from './catalog-data.js';
import {
  coverImg, buildCombined, matchesQuery, entryCard, wireEntries, heroGroupHTML, openArtistDialog, openAlbumDialog,
  searchShellHTML, bindSearchShell,
} from './library.js';
import { renderPromo } from './promos.js';

const FOLLOW_KEY = 'hosannia-explorar-sigue';
function followState() { try { return JSON.parse(localStorage.getItem(FOLLOW_KEY) || '{}'); } catch (_) { return {}; } }
function saveFollowState(s) { try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(s)); } catch (_) {} }
function toggleFollow(bucket, id) {
  const s = followState(); s[bucket] = s[bucket] || [];
  const on = !s[bucket].includes(id);
  s[bucket] = on ? [...s[bucket], id] : s[bucket].filter((x) => x !== id);
  saveFollowState(s); return on;
}
function isFollowed(bucket, id) { return (followState()[bucket] || []).includes(id); }

export async function renderExplore(ctx, view, [query]) {
  ctx.setTitle('Explorar');
  const qs = new URLSearchParams(query || '');
  let q = qs.get('q') || '';

  view.innerHTML = `<div class="lib-wrap">
    <section class="lib-hero">
      <div class="lh-copy"><p class="eyebrow">EL UNIVERSO HOSANNIA</p><h1>Explorar<span class="dot">.</span></h1>
        <p class="lh-sub">Nuevas canciones. Nuevas conexiones. Una misma fe.</p></div>
      <div class="lh-window"><div class="lh-track"><div class="lh-group">${heroGroupHTML()}</div><div class="lh-group" aria-hidden="true">${heroGroupHTML()}</div></div></div>
      <div class="lh-search">${searchShellHTML('eq', 'Busca por título, artista o categoría', q)}</div>
    </section>
    <div id="promoExplore"></div>
    <section class="catalog-sec" id="results" hidden>
      <div class="section-heading"><div><h2>Resultados de búsqueda</h2><p id="resSub"></p></div></div>
      <div class="sheet-grid" id="resGrid"></div>
    </section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Álbumes recomendados para ti</h2><p>Una colección de canciones. Un mismo propósito.</p></div></div>
      <div class="alb-grid" id="albGrid"></div></section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Artistas para descubrir</h2><p>Encuentra nuevas voces que acompañen tu fe.</p></div></div>
      <div class="art-grid" id="artGrid"></div></section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Personas que inspiran</h2><p>La música es aún mejor cuando la compartes.</p></div></div>
      <div class="prof-grid" id="profGrid"></div>
      <p class="muted" style="font-size:.76rem;margin-top:.8rem">Perfiles de ejemplo para descubrir la experiencia de comunidad.</p></section>
    <section class="discovery-sec"><div class="section-heading"><div><h2>Encuentra tu comunidad</h2><p>Diferentes instrumentos. Una misma pasión.</p></div></div>
      <div class="comm-grid" id="commGrid"></div></section>
  </div>`;

  let combined = [];
  const resultsSec = $('#results', view);
  const resGrid = $('#resGrid', view);

  async function runSearch() {
    if (!q.trim()) { resultsSec.hidden = true; return; }
    resultsSec.hidden = false;
    loading(resGrid);
    if (!combined.length) combined = await buildCombined(ctx);
    const found = combined.filter((e) => matchesQuery(e, q));
    $('#resSub', view).textContent = `${found.length} ${found.length === 1 ? 'partitura encontrada' : 'partituras encontradas'} para "${q.trim()}".`;
    if (!found.length) { empty(resGrid, 'music', 'No encontramos esa partitura. Prueba otro título o artista.'); return; }
    resGrid.innerHTML = found.slice(0, 20).map(entryCard).join('');
    wireEntries(resGrid, found, ctx);
  }

  const stopSearchShell = bindSearchShell(view, 'eq', (value, fueEnvio) => {
    q = value; runSearch();
    if (fueEnvio) $('#results', view)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $$('[data-hero]', view).forEach((b) => { b.onclick = async () => { if (!combined.length) combined = await buildCombined(ctx); openArtistDialog(artistById[b.dataset.hero], ctx, combined); }; });

  $('#albGrid', view).innerHTML = ALBUMS.map((a) => `<button class="alb-item" data-album="${esc(a.id)}">
    <div class="alb-cov">${coverImg(a.image)}<span class="cov-arrow">${icon('arrowUp')}</span></div>
    <strong>${esc(a.title)}</strong><span>${esc(artistById[a.artistId].name)}</span></button>`).join('');
  $$('[data-album]', view).forEach((b) => { b.onclick = async () => { if (!combined.length) combined = await buildCombined(ctx); openAlbumDialog(ALBUMS.find((a) => a.id === b.dataset.album), ctx, combined); }; });

  $('#artGrid', view).innerHTML = ARTISTS.map((a) => `<button class="art-item" data-discover="${esc(a.id)}">
    <div class="art-photo">${coverImg(a.image)}${isFollowed('artists', a.id) ? `<span class="followed-check">${icon('check')}</span>` : ''}</div>
    <strong>${esc(a.name)}</strong><span>${esc(a.country)}</span></button>`).join('');
  $$('[data-discover]', view).forEach((b) => { b.onclick = async () => { if (!combined.length) combined = await buildCombined(ctx); openArtistDialog(artistById[b.dataset.discover], ctx, combined); }; });

  $('#profGrid', view).innerHTML = PROFILES.map((p) => `<div class="prof-item">
    <button class="prof-info" data-prof="${esc(p.id)}"><span class="profile-avatar" style="background:${esc(p.color)}">${esc(p.initials)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></span></button>
    <button class="follow-btn${isFollowed('profiles', p.id) ? ' on' : ''}" data-follow="${esc(p.id)}">${icon(isFollowed('profiles', p.id) ? 'check' : 'plus')}<span>${isFollowed('profiles', p.id) ? 'Siguiendo' : 'Seguir'}</span></button></div>`).join('');
  $$('[data-follow]', view).forEach((b) => {
    b.onclick = () => {
      const on = toggleFollow('profiles', b.dataset.follow);
      b.classList.toggle('on', on); b.innerHTML = `${icon(on ? 'check' : 'plus')}<span>${on ? 'Siguiendo' : 'Seguir'}</span>`;
      toast(on ? 'Perfil añadido a tus seguidos' : 'Perfil retirado de tus seguidos');
    };
  });
  $$('[data-prof]', view).forEach((b) => {
    b.onclick = () => {
      const p = PROFILES.find((x) => x.id === b.dataset.prof);
      toast(`${p.name} · ${p.role} (perfil de ejemplo)`);
    };
  });

  $('#commGrid', view).innerHTML = COMMUNITIES.map((c) => `<button class="comm-item" data-comm="${esc(c.id)}">
    <div class="comm-photo">${coverImg(c.image)}<span class="cov-arrow">${icon('arrowUp')}</span></div>
    <div class="comm-info"><strong>${esc(c.name)}</strong><span>${isFollowed('communities', c.id) ? `${icon('check')} Ya eres parte` : `${icon('users')} Comunidad de ejemplo`}</span></div>
    <p>${esc(c.subtitle)}</p></button>`).join('');
  $$('[data-comm]', view).forEach((b) => {
    b.onclick = () => {
      const c = COMMUNITIES.find((x) => x.id === b.dataset.comm);
      toast(`${c.name}: ${c.description}`);
    };
  });

  renderPromo(ctx, $('#promoExplore', view), 'explorar');
  runSearch();
  return stopSearchShell;
}
