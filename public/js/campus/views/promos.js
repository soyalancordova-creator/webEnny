/* ============================================================
   ANUNCIOS/PROMOS · editables desde Panel de Hosannia → Promos
   ------------------------------------------------------------
   Se guardan en site_content bajo la llave "library_promos" (un
   arreglo). Cada uno tiene un "placement" (dónde aparece: 'top' es
   el banner grande de arriba de la Biblioteca, 'middle' el que va
   entre Álbumes y Artistas, 'explorar' el de la pantalla Explorar).
   Si hay varios para el mismo lugar, en cada visita se muestra uno
   al azar entre los que no se han cerrado en esta sesión del
   navegador. Solo se ven mientras la cuenta no tiene suscripción.
============================================================ */
import { icon } from '../icons.js';
import { $, esc } from '../ui.js';

const DEFAULT_PROMO = { id: 'default', title: 'Tu adoración, sin límites.', subtitle: 'Desbloquea toda la biblioteca y lleva tu inspiración más lejos.', cta: 'Ver planes', link: '#/ajustes/suscripcion', placement: 'top' };
const SEEN_KEY = 'hosannia-promos-vistos';
function seenSet() { try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')); } catch (_) { return new Set(); } }
function markSeen(id) { const s = seenSet(); s.add(id); try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch (_) {} }

const STAFF_SVG = `<svg class="pb-staff" viewBox="0 0 400 150" fill="none" aria-hidden="true"><g stroke="currentColor" opacity=".45"><path d="M0 50Q180-45 400 45M0 65Q180-30 400 60M0 80Q180-15 400 75M0 95Q180 0 400 90M0 110Q180 15 400 105"/></g><g stroke="currentColor" stroke-width="2"><path d="M174 86V20l53-5v65"/><ellipse cx="164" cy="88" rx="12" ry="8" transform="rotate(-22 164 88)"/><ellipse cx="217" cy="82" rx="12" ry="8" transform="rotate(-22 217 82)"/></g></svg>`;

/** Pinta (o limpia) el anuncio de un lugar concreto dentro de `host`. No hace nada si la cuenta ya tiene acceso. */
export async function renderPromo(ctx, host, placement = 'top') {
  if (!host) return;
  host.innerHTML = '';
  if (ctx.me.hasAccess) return;
  let list = [];
  try { list = await ctx.store.getContent('library_promos'); } catch (_) {}
  if (!Array.isArray(list)) list = [];
  if (!list.length && placement === 'top') list = [DEFAULT_PROMO];
  const seen = seenSet();
  const avail = list.filter((p) => p && p.id && !seen.has(p.id) && (p.placement || 'top') === placement);
  if (!avail.length) return;
  const p = avail[Math.floor(Math.random() * avail.length)];
  host.innerHTML = `<aside class="promo-banner${p.image ? ' has-img' : ''}">
    ${p.image ? `<img class="pb-img" src="${esc(p.image)}" alt="">` : STAFF_SVG}
    <div class="pb-crown">${icon('crown')}</div>
    <div class="pb-copy"><span>HOSANNIA</span><h2>${esc(p.title)}</h2><p>${esc(p.subtitle || '')}</p></div>
    <a class="btn pb-cta btn-sm" href="${esc(p.link || '#/ajustes/suscripcion')}"><span>${esc(p.cta || 'Ver planes')}</span></a>
    <button class="pb-x" data-x aria-label="Cerrar anuncio">${icon('x')}</button></aside>`;
  $('[data-x]', host).onclick = () => { markSeen(p.id); host.innerHTML = ''; };
}
