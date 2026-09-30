/* ============================================================
   HOSANNIA · arranque, shell y enrutador
   ------------------------------------------------------------
   La herramienta (biblioteca de partituras) es la puerta de
   entrada: #/ abre la biblioteca. La comunidad va después.
============================================================ */
import { createDemoStore } from './store-demo.js';
import { createSupaStore } from './store-supa.js';
import { icon, markSvg } from './icons.js';
import { $, $$, esc, avatar, toast, popMenu } from './ui.js';
import { installer } from './pwa.js';

const CFG = window.ENNY || {};
const APP = CFG.APP_NAME || 'Hosannia';

function pickStore() {
  const A = window.EnnyApp;
  const forceDemo = CFG.DEMO_MODE === true;
  if (!forceDemo && A && A.listo) return createSupaStore(A.sb, CFG);
  return createDemoStore();
}

const store = pickStore();
const view = $('#view');
let me = null, cleanup = null, unreadTimer = null, unsubNotif = null;

/* ---------- rutas ---------- */
const ROUTES = [
  { re: /^#\/?$/, view: 'library', nav: 'biblioteca' },
  { re: /^#\/biblioteca(?:\?(.*))?$/, view: 'library', nav: 'biblioteca' },
  { re: /^#\/obra\/([\w-]+)$/, view: 'player', nav: 'biblioteca', full: true },
  { re: /^#\/favoritos$/, view: 'favorites', nav: 'favoritos' },
  { re: /^#\/comunidad$/, view: 'feed', nav: 'comunidad' },
  { re: /^#\/publicacion\/([\w-]+)$/, view: 'post', nav: 'comunidad' },
  { re: /^#\/historias(?:\/([\w-]+))?$/, view: 'stories', nav: 'comunidad', full: true },
  { re: /^#\/comunidades$/, view: 'groups', nav: 'comunidades' },
  { re: /^#\/comunidad\/([\w-]+)(?:\/(chat|publicaciones|integrantes|info|ajustes))?$/, view: 'group', nav: 'comunidades' },
  { re: /^#\/grupo\/([\w-]+)(?:\/(chat|publicaciones|integrantes|info|ajustes))?$/, view: 'group', nav: 'grupos' },
  { re: /^#\/perfil(?:\/([\w-]+))?$/, view: 'profile', nav: 'perfil' },
  { re: /^#\/editar-perfil$/, view: 'profileEdit', nav: 'perfil' },
  { re: /^#\/guardados$/, view: 'saved', nav: 'guardados' },
  { re: /^#\/notificaciones$/, view: 'notifications', nav: 'notificaciones' },
  { re: /^#\/ajustes(?:\/(suscripcion|ayuda|cuenta|app))?$/, view: 'settings', nav: 'ajustes' },
  { re: /^#\/planes$/, view: 'plans', nav: 'ajustes' },
  { re: /^#\/buscar(?:\?q=(.*))?$/, view: 'search', nav: 'buscar' },
  { re: /^#\/crear$/, view: 'compose', nav: 'crear', full: true },
  { re: /^#\/grupos$/, view: 'grupos', nav: 'grupos' },
  { re: /^#\/admin(?:\/(partituras|colecciones|avisos|moderacion|alumnos))?(?:\/([\w-]+))?$/, view: 'admin', nav: 'admin', admin: true },
];

const LOADERS = {
  library: () => import('./views/library.js').then((m) => m.renderLibrary),
  favorites: () => import('./views/library.js').then((m) => m.renderFavorites),
  player: () => import('./views/player.js').then((m) => m.renderPlayer),
  feed: () => import('./views/feed.js').then((m) => m.renderFeed),
  post: () => import('./views/feed.js').then((m) => m.renderPost),
  stories: () => import('./views/stories.js').then((m) => m.renderStories),
  groups: () => import('./views/groups.js').then((m) => m.renderGroups),
  grupos: () => import('./views/groups.js').then((m) => m.renderGrupos),
  group: () => import('./views/groups.js').then((m) => m.renderGroup),
  profile: () => import('./views/profile.js').then((m) => m.renderProfile),
  profileEdit: () => import('./views/profile.js').then((m) => m.renderProfileEdit),
  saved: () => import('./views/feed.js').then((m) => m.renderSaved),
  notifications: () => import('./views/notifications.js').then((m) => m.renderNotifications),
  settings: () => import('./views/settings.js').then((m) => m.renderSettings),
  plans: () => import('./views/plans.js').then((m) => m.renderPlans),
  search: () => import('./views/search.js').then((m) => m.renderSearch),
  compose: () => import('./views/compose.js').then((m) => m.renderCompose),
  admin: () => import('./views/admin.js').then((m) => m.renderAdmin),
};

export const ctx = {
  store, APP, CFG,
  get me() { return me; },
  go(h) { if (location.hash === h) route(); else location.hash = h; },
  async refreshMe() { me = await store.me(true); paintShell(); return me; },
  setTitle(t) { document.title = t ? `${t} · ${APP}` : APP; },
  refreshBadges,
};

async function route() {
  const h = location.hash || '#/';
  const r = ROUTES.find((x) => x.re.test(h)) || ROUTES[0];
  const params = (h.match(r.re) || []).slice(1).map((v) => (v ? decodeURIComponent(v) : v));
  if (cleanup) { try { cleanup(); } catch (_) {} cleanup = null; }
  document.body.classList.remove('nav-open');
  $$('.cx-nav a, .cx-tabs a').forEach((a) => a.classList.toggle('on', a.dataset.nav === r.nav));
  if (r.admin && !me.isAdmin) { ctx.go('#/'); return; }
  view.className = 'cx-view' + (r.full ? ' full' : '');
  view.innerHTML = '<div class="cx-empty"><span class="spin"></span></div>';
  window.scrollTo(0, 0);
  try {
    const fn = await LOADERS[r.view]();
    cleanup = (await fn(ctx, view, params)) || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="cx-empty">${icon('info')}<p>${esc(e.message || 'No se pudo abrir esta sección.')}</p><a class="btn btn-ghost btn-sm" href="#/" style="margin-top:1rem"><span>Ir a la biblioteca</span></a></div>`;
  }
}

/* ---------- shell ---------- */
/* Riel de iconos (escritorio) + panel con etiquetas, al estilo de la referencia. */
const MENU = [
  { grp: 'Herramienta' },
  { href: '#/biblioteca', nav: 'biblioteca', ic: 'book', label: 'Biblioteca', rail: true },
  { href: '#/favoritos', nav: 'favoritos', ic: 'heart', label: 'Mis partituras', rail: true },
  { grp: 'Comunidad' },
  { href: '#/comunidad', nav: 'comunidad', ic: 'feed', label: 'Inicio', rail: true },
  { href: '#/comunidades', nav: 'comunidades', ic: 'users', label: 'Comunidades', rail: true },
  { href: '#/grupos', nav: 'grupos', ic: 'comment', label: 'Grupos', rail: true },
  { href: '#/guardados', nav: 'guardados', ic: 'bookmark', label: 'Guardados' },
  { href: '#/notificaciones', nav: 'notificaciones', ic: 'bell', label: 'Notificaciones', badge: true },
  { sep: true },
  { href: '#/ajustes', nav: 'ajustes', ic: 'settings', label: 'Ajustes', rail: true, foot: true },
];

function menuHTML() {
  const admin = me.isAdmin
    ? `<span class="grp">Administración</span>
       <a href="#/admin" data-nav="admin">${icon('shield')}<span>Panel de Hosannia</span><i class="nv-ch">${icon('chevR')}</i></a>
       <a href="admin.html">${icon('home')}<span>Sitio de Enny</span><i class="nv-ch">${icon('chevR')}</i></a>` : '';
  return MENU.map((m) => {
    if (m.grp) return `<span class="grp">${m.grp}</span>`;
    if (m.sep) return '<hr class="sep">';
    const badge = m.badge ? '<span class="badge" data-unread hidden></span>' : '';
    return `<a href="${m.href}" data-nav="${m.nav}">${icon(m.ic)}<span>${m.label}</span>${badge}<i class="nv-ch">${icon('chevR')}</i></a>`;
  }).join('') + admin;
}

function railHTML() {
  const top = MENU.filter((m) => m.rail && !m.foot);
  const foot = MENU.filter((m) => m.rail && m.foot);
  const btn = (m) => `<a href="${m.href}" data-nav="${m.nav}" title="${m.label}" aria-label="${m.label}">${icon(m.ic)}</a>`;
  return `<a class="rl-logo" href="#/" aria-label="${esc(APP)}">${markSvg('hs-mark', true)}</a>
    <nav class="rl-nav">${top.map(btn).join('')}</nav>
    <div class="rl-foot"><nav class="rl-nav">${foot.map(btn).join('')}</nav>
      <button class="rl-av" id="railAv" aria-label="Tu perfil">${avatar(me)}</button></div>`;
}

function paintShell() {
  $('#rail').innerHTML = railHTML();
  $('#side').innerHTML = `
    <div class="sd-head">
      <a class="cx-brand hs-logo" href="#/" aria-label="${esc(APP)}">${markSvg('hs-mark', true)}<span class="hs-word">${esc(APP.toUpperCase())}</span></a>
      <button class="cx-iconbtn sm sd-x" id="sideX" aria-label="Cerrar menú">${icon('x')}</button>
    </div>
    <nav class="cx-nav" aria-label="Principal">${menuHTML()}</nav>
    ${demoCard()}
    ${me.hasAccess ? '' : `<div class="cx-plan"><b>Biblioteca completa</b>Partituras que suenan, con loop y metrónomo, desde $5 al mes.<a href="#/ajustes/suscripcion">Ver planes →</a></div>`}
    <a class="sd-me" href="#/perfil/${esc(me.id)}">${avatar(me)}<div style="min-width:0"><b>${esc(me.name)}</b><span>${me.isAdmin ? 'Administradora' : me.hasAccess ? 'Suscripción activa' : 'Cuenta gratuita'}</span></div><i class="nv-ch">${icon('chevR')}</i></a>`;

  /* barra inferior: partituras · inicio · crear · buscar · perfil */
  $('#tabs').innerHTML = `
    <a href="#/biblioteca" data-nav="biblioteca"><i>${icon('book')}</i><span>Partituras</span></a>
    <a href="#/comunidad" data-nav="comunidad"><i>${icon('feed')}</i><span>Inicio</span></a>
    <a href="#/crear" data-nav="crear" class="mk" aria-label="Crear publicación"><i>${icon('plus')}</i><span>Crear</span></a>
    <a href="#/buscar" data-nav="buscar"><i>${icon('search')}</i><span>Buscar</span></a>
    <a href="#/perfil/${esc(me.id)}" data-nav="perfil"><i>${avatar(me, 'tab')}</i><span>Perfil</span></a>`;

  $('#railAv').onclick = (e) => popMenu(e.currentTarget, [
    { label: me.name, icon: 'user', run: () => ctx.go(`#/perfil/${me.id}`) },
    { label: 'Editar perfil', icon: 'edit', run: () => ctx.go('#/editar-perfil') },
    { label: 'Ajustes', icon: 'settings', run: () => ctx.go('#/ajustes') },
    { label: me.hasAccess ? 'Mi suscripción' : 'Ver planes', icon: 'crown', run: () => ctx.go('#/ajustes/suscripcion') },
    { label: 'Cerrar sesión', icon: 'logout', danger: true, run: signOut },
  ]);
  $('#sideX').onclick = closeNav;
  $$('.cx-nav a, .rl-nav a', $('#side').parentElement).forEach((a) => { a.addEventListener('click', closeNav); });

  const cur = ROUTES.find((x) => x.re.test(location.hash || '#/'));
  if (cur) $$('.cx-nav a, .cx-tabs a, .rl-nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === cur.nav));
  bindDemo();
  refreshBadges();
}

function openNav() { document.body.classList.add('nav-open'); $('#scrim').hidden = false; }
function closeNav() { document.body.classList.remove('nav-open'); $('#scrim').hidden = true; }

async function refreshBadges() {
  try {
    const n = await store.unreadCount();
    $$('[data-unread]').forEach((b) => { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; });
    $('#bellDot').hidden = !n;
  } catch (_) {}
}

async function signOut() {
  await store.signOut();
  location.href = 'academia.html';
}

/* ---------- barra superior: menú, logotipo y avisos ---------- */
function bindTop() {
  $('#hamb').onclick = () => (document.body.classList.contains('nav-open') ? closeNav() : openNav());
  $('#scrim').onclick = closeNav;
  $('#bell').onclick = () => ctx.go('#/notificaciones');
  // el tema ahora vive en Ajustes; aquí solo se respeta lo guardado
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ctx.go('#/buscar'); }
    if (e.key === 'Escape') closeNav();
  });
}

function demoCard() {
  if (store.mode !== 'demo') return '';
  return `<div class="cx-plan" style="border-style:dashed"><b>Modo demostración</b>Los datos viven solo en este navegador.<br><a href="#" id="demoReset">Reiniciar demo →</a></div>`;
}

function bindDemo() {
  const r = $('#demoReset'); if (!r) return;
  r.onclick = (e) => { e.preventDefault(); if (confirm('¿Borrar los datos de demostración de este navegador y empezar de cero?')) { store.resetDemo(); location.href = 'academia.html'; } };
}

/* Al bajar se esconden las barras para dar aire a la lectura; al subir vuelven. */
function bindScrollBars() {
  let last = window.scrollY, ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY, dy = y - last;
      if (y < 80) document.body.classList.remove('hide-bars');
      else if (dy > 6) document.body.classList.add('hide-bars');
      else if (dy < -6) document.body.classList.remove('hide-bars');
      last = y; ticking = false;
    });
  }, { passive: true });
}

async function boot() {
  try { me = await store.me(); } catch (e) { console.error(e); me = null; }
  if (!me) { location.replace('academia.html?next=campus.html'); return; }
  document.title = APP;
  paintShell(); bindTop(); installer.watch(); bindScrollBars();
  import('./views/chat.js').then((m) => m.montarBurbuja(ctx)).catch(() => {});
  if (store.onNotify) unsubNotif = store.onNotify(() => refreshBadges());
  unreadTimer = setInterval(refreshBadges, 60000);
  window.addEventListener('hashchange', route);
  route();
}

boot();
