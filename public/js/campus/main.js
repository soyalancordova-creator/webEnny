/* ============================================================
   CAMPUS · arranque, shell y enrutador
============================================================ */
import { createDemoStore } from './store-demo.js';
import { createSupaStore } from './store-supa.js';
import { icon } from './icons.js';
import { $, $$, esc, avatar, toast, popMenu } from './ui.js';

const CFG = window.ENNY || {};
const APP = CFG.APP_NAME || 'Academia Enny Toro';

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
  { re: /^#\/?$/, view: 'feed', nav: 'comunidad' },
  { re: /^#\/comunidad$/, view: 'feed', nav: 'comunidad' },
  { re: /^#\/publicacion\/([\w-]+)$/, view: 'post', nav: 'comunidad' },
  { re: /^#\/comunidades$/, view: 'groups', nav: 'comunidades' },
  { re: /^#\/comunidad\/([\w-]+)(?:\/(chat|publicaciones|integrantes|info))?$/, view: 'group', nav: 'comunidades' },
  { re: /^#\/perfil(?:\/([\w-]+))?$/, view: 'profile', nav: 'perfil' },
  { re: /^#\/editar-perfil$/, view: 'profileEdit', nav: 'perfil' },
  { re: /^#\/biblioteca(?:\?(.*))?$/, view: 'library', nav: 'biblioteca', paid: false },
  { re: /^#\/obra\/([\w-]+)$/, view: 'player', nav: 'biblioteca', full: true },
  { re: /^#\/guardados$/, view: 'saved', nav: 'guardados' },
  { re: /^#\/notificaciones$/, view: 'notifications', nav: 'notificaciones' },
  { re: /^#\/planes$/, view: 'plans', nav: 'planes' },
  { re: /^#\/buscar\?q=(.*)$/, view: 'search', nav: '' },
  { re: /^#\/admin(?:\/(partituras|colecciones|avisos|moderacion|alumnos))?(?:\/([\w-]+))?$/, view: 'admin', nav: 'admin', admin: true },
];

const LOADERS = {
  feed: () => import('./views/feed.js').then((m) => m.renderFeed),
  post: () => import('./views/feed.js').then((m) => m.renderPost),
  groups: () => import('./views/groups.js').then((m) => m.renderGroups),
  group: () => import('./views/groups.js').then((m) => m.renderGroup),
  profile: () => import('./views/profile.js').then((m) => m.renderProfile),
  profileEdit: () => import('./views/profile.js').then((m) => m.renderProfileEdit),
  library: () => import('./views/library.js').then((m) => m.renderLibrary),
  player: () => import('./views/player.js').then((m) => m.renderPlayer),
  saved: () => import('./views/feed.js').then((m) => m.renderSaved),
  notifications: () => import('./views/notifications.js').then((m) => m.renderNotifications),
  plans: () => import('./views/plans.js').then((m) => m.renderPlans),
  search: () => import('./views/search.js').then((m) => m.renderSearch),
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
    view.innerHTML = `<div class="cx-empty">${icon('info')}<p>${esc(e.message || 'No se pudo abrir esta sección.')}</p><a class="btn btn-ghost btn-sm" href="#/" style="margin-top:1rem"><span>Volver al inicio</span></a></div>`;
  }
}

/* ---------- shell ---------- */
function navLinks() {
  const L = (href, nav, ic, label, badge = '') => `<a href="${href}" data-nav="${nav}">${icon(ic)}<span>${label}</span>${badge}</a>`;
  return `
    <span class="grp">Comunidad</span>
    ${L('#/comunidad', 'comunidad', 'feed', 'Inicio')}
    ${L('#/comunidades', 'comunidades', 'users', 'Comunidades')}
    ${L('#/guardados', 'guardados', 'bookmark', 'Guardados')}
    ${L('#/notificaciones', 'notificaciones', 'bell', 'Notificaciones', '<span class="badge" data-unread hidden></span>')}
    <span class="grp">Academia</span>
    ${L('#/biblioteca', 'biblioteca', 'book', 'Biblioteca')}
    ${L('#/planes', 'planes', 'crown', me.hasAccess ? 'Mi suscripción' : 'Planes')}
    ${L(`#/perfil/${me.id}`, 'perfil', 'user', 'Mi perfil')}
    ${me.isAdmin ? `<span class="grp">Administración</span>${L('#/admin', 'admin', 'shield', 'Panel de la academia')}<a href="admin.html">${icon('settings')}<span>Contenido del sitio</span></a>` : ''}`;
}

function paintShell() {
  $('#side').innerHTML = `
    <a class="cx-brand" href="#/"><span>${esc(APP.split(' ').slice(0, 1).join(' '))}</span> <i>${esc(APP.split(' ').slice(1).join(' '))}</i><small>Plataforma</small></a>
    <nav class="cx-nav" aria-label="Principal">${navLinks()}</nav>
    ${demoCard()}
    ${me.hasAccess ? '' : `<div class="cx-plan"><b>Biblioteca completa</b>Partituras con reproducción, loop y metrónomo desde $5 al mes.<a href="#/planes">Ver planes →</a></div>`}
    <div class="cx-me" id="meBtn" role="button" tabindex="0">${avatar(me)}<div style="min-width:0"><b>${esc(me.name)}</b><span>${me.isAdmin ? 'Administradora' : me.hasAccess ? 'Suscripción activa' : 'Cuenta gratuita'}</span></div></div>`;
  $('#tabs').innerHTML = `
    <a href="#/comunidad" data-nav="comunidad">${icon('feed')}<span>Inicio</span></a>
    <a href="#/comunidades" data-nav="comunidades">${icon('users')}<span>Grupos</span></a>
    <a href="#/biblioteca" data-nav="biblioteca">${icon('book')}<span>Biblioteca</span></a>
    <a href="#/notificaciones" data-nav="notificaciones">${icon('bell')}<span>Avisos</span><span class="badge" data-unread hidden></span></a>
    <a href="#/perfil/${me.id}" data-nav="perfil">${icon('user')}<span>Perfil</span></a>`;
  $('#meBtn').onclick = (e) => popMenu(e.currentTarget, [
    { label: 'Mi perfil', icon: 'user', run: () => ctx.go(`#/perfil/${me.id}`) },
    { label: 'Editar perfil', icon: 'edit', run: () => ctx.go('#/editar-perfil') },
    { label: me.hasAccess ? 'Mi suscripción' : 'Ver planes', icon: 'crown', run: () => ctx.go('#/planes') },
    { label: 'Volver al sitio', icon: 'home', run: () => { location.href = 'index.html'; } },
    { label: 'Cerrar sesión', icon: 'logout', danger: true, run: signOut },
  ]);
  const cur = ROUTES.find((x) => x.re.test(location.hash || '#/'));
  if (cur) $$('.cx-nav a, .cx-tabs a').forEach((a) => a.classList.toggle('on', a.dataset.nav === cur.nav));
  bindDemo();
  refreshBadges();
}

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

function bindTop() {
  $('#hamb').onclick = () => document.body.classList.toggle('nav-open');
  $('#bell').onclick = () => ctx.go('#/notificaciones');
  const root = document.documentElement;
  const paintTheme = () => { $('#themeBtn').innerHTML = icon(root.dataset.theme === 'dark' ? 'sun' : 'moon'); };
  $('#themeBtn').onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('enny-theme', root.dataset.theme); } catch (_) {}
    paintTheme();
  };
  paintTheme();
  const f = $('#searchForm');
  f.onsubmit = (e) => { e.preventDefault(); const v = $('#searchInput').value.trim(); if (v) ctx.go(`#/buscar?q=${encodeURIComponent(v)}`); };
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#searchInput').focus(); }
  });
  document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#side') && !e.target.closest('#hamb')) document.body.classList.remove('nav-open'); });
}

function demoCard() {
  if (store.mode !== 'demo') return '';
  return `<div class="cx-plan" style="border-style:dashed"><b>Modo demostración</b>Los datos viven solo en este navegador.<br><a href="#" id="demoReset">Reiniciar demo →</a></div>`;
}

function bindDemo() {
  const r = $('#demoReset'); if (!r) return;
  r.onclick = (e) => { e.preventDefault(); if (confirm('¿Borrar los datos de demostración de este navegador y empezar de cero?')) { store.resetDemo(); location.href = 'academia.html'; } };
}

async function boot() {
  try { me = await store.me(); } catch (e) { console.error(e); me = null; }
  if (!me) { location.replace('academia.html?next=campus.html'); return; }
  document.title = APP;
  paintShell(); bindTop();
  if (store.onNotify) unsubNotif = store.onNotify(() => refreshBadges());
  unreadTimer = setInterval(refreshBadges, 60000);
  window.addEventListener('hashchange', route);
  route();
}

boot();
