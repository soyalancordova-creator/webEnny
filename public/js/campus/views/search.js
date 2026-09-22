/* BÚSQUEDA · personas, comunidades y partituras */
import { icon } from '../icons.js';
import { $, esc, avatar, empty } from '../ui.js';
import { scoreCard, wireCards } from './library.js';

export async function renderSearch(ctx, view, [raw]) {
  const q = decodeURIComponent(raw || '').trim();
  ctx.setTitle(`Buscar "${q}"`);
  view.innerHTML = `<div style="max-width:1100px;margin:0 auto"><div class="cx-h"><div><span class="eyebrow">Búsqueda</span><h1>“${esc(q)}”</h1></div></div>
    <section style="margin-bottom:1.6rem"><h3 style="font-size:1.15rem;margin-bottom:.7rem">Partituras</h3><div class="lib-grid" id="rs"></div></section>
    <section style="margin-bottom:1.6rem"><h3 style="font-size:1.15rem;margin-bottom:.7rem">Comunidades</h3><div class="cx-card cx-pad"><div class="mini-list" id="rg"></div></div></section>
    <section><h3 style="font-size:1.15rem;margin-bottom:.7rem">Personas</h3><div class="cx-card cx-pad"><div class="mini-list" id="rp"></div></div></section></div>`;
  const [ss, gs, ps] = await Promise.all([ctx.store.listScores({ q }).catch(() => []), ctx.store.listGroups({ q }).catch(() => []), ctx.store.searchPeople(q).catch(() => [])]);
  const rs = $('#rs', view);
  if (ss.length) { rs.innerHTML = ss.map(scoreCard).join(''); wireCards(rs, ss, ctx); } else empty(rs, 'music', 'Ninguna obra coincide.');
  $('#rg', view).innerHTML = gs.length ? gs.map((g) => `<a href="#/comunidad/${esc(g.id)}"><span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon('users')}</span><div style="min-width:0"><b>${esc(g.name)}</b><small>${g.members} integrantes · ${g.privacy === 'private' ? 'privada' : 'pública'}</small></div></a>`).join('') : '<p class="muted" style="font-size:.88rem">Ninguna comunidad coincide.</p>';
  $('#rp', view).innerHTML = ps.length ? ps.map((p) => `<a href="#/perfil/${esc(p.id)}">${avatar(p, 'sm')}<div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.service || '')}</small></div></a>`).join('') : '<p class="muted" style="font-size:.88rem">Nadie con ese nombre.</p>';
}
