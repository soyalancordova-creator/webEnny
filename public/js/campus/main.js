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
  { re: /^#\/perfil(?:\/([\w-]+))?$/, view: 'profile', nav: 'perfil' },
  { re: /^#\/editar-perfil$/, view: 'profileEdit', nav: 'perfil' },
  { re: /^#\/guardados$/, view: 'saved', nav: 'guardados' },
  { re: /^#\/notificaciones$/, view: 'notifications', nav: 'notificaciones' },
  { re: /^#\/ajustes(?:\/(suscripcion|ayuda|cuenta|app))?$/, view: 'settings', nav: 'ajustes' },
  { re: /^#\/planes$/, view: 'plans', nav: 'ajustes' },
  { re: /^#\/buscar\?q=(.*)$/, view: 'search', nav: '' },
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
  group: () => import('./views/groups.js').then((m) => m.renderGroup),
  profile: () => import('./views/profile.js').then((m) => m.renderProfile),
  profileEdit: () => import('./views/profile.js').then((m) => m.renderProfileEdit),
  saved: () => import('./views/feed.js').then((m) => m.renderSaved),
  notifications: () => import('./views/notifications.js').then((m) => m.renderNotifications),
  settings: () => import('./views/settings.js').then((m) => m.renderSettings),
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
    view.innerHTML = `<div class="cx-empty">${icon('info')}<p>${esc(e.message || 'No se pudo abrir esta sección.')}</p><a class="btn btn-ghost btn-sm" href="#/" style="margin-top:1rem"><span>Ir a la biblioteca</span></a></div>`;
  }
}

/* ---------- shell ---------- */
function navLinks() {
  const L = (href, nav, ic, label, badge = '') => `<a href="${href}" data-nav="${nav}">${icon(ic)}<span>${label}</span>${badge}</a>`;
  return `
    <span class="grp">Herramienta</span>
    ${L('#/biblioteca', 'biblioteca', 'book', 'Biblioteca')}
    ${L('#/favoritos', 'favoritos', 'heart', 'Mis partituras')}
    <span class="grp">Comunidad</span>
    ${L('#/comunidad', 'comunidad', 'feed', 'Inicio')}
    ${L('#/comunidades', 'comunidades', 'users', 'Comunidades')}
    ${L('#/guardados', 'guardados', 'bookmark', 'Guardados')}
    ${L('#/notificaciones', 'notificaciones', 'bell', 'Notificaciones', '<span class="badge" data-unread hidden></span>')}
    <span class="grp">Mi cuenta</span>
    ${L(`#/perfil/${me.id}`, 'perfil', 'user', 'Mi perfil')}
    ${L('#/ajustes', 'ajustes', 'settings', 'Ajustes')}
    ${me.isAdmin ? `<span class="grp">Administración</span>${L('#/admin', 'admin', 'shield', 'Panel de Hosannia')}<a href="admin.html">${icon('home')}<span>Sitio de Enny</span></a>` : ''}`;
}

function paintShell() {
  $('#side').innerHTML = `
    <a class="cx-brand hs-logo" href="#/" aria-label="${esc(APP)}">${markSvg('hs-mark', true)}<span class="hs-word">${esc(APP.toUpperCase())}</span></a>
    <nav class="cx-nav" aria-label="Principal">${navLinks()}</nav>
    ${demoCard()}
    ${me.hasAccess ? '' : `<div class="cx-plan"><b>Biblioteca completa</b>Partituras que suenan, con loop y metrónomo, desde $5 al mes.<a href="#/ajustes/suscripcion">Ver planes →</a></div>`}`;
  $('#meBtn').innerHTML = avatar(me);
  $('#tabs').innerHTML = `
    <a href="#/biblioteca" data-nav="biblioteca">${icon('book')}<span>Partituras</span></a>
    <a href="#/comunidad" data-nav="comunidad">${icon('feed')}<span>Inicio</span></a>
    <a href="#/comunidades" data-nav="comunidades">${icon('users')}<span>Grupos</span></a>
    <a href="#/notificaciones" data-nav="notificaciones">${icon('bell')}<span>Avisos</span><span class="badge" data-unread hidden></span></a>
    <a href="#/ajustes" data-nav="ajustes">${icon('settings')}<span>Ajustes</span></a>`;
  $('#meBtn').onclick = (e) => popMenu(e.currentTarget, [
    { label: me.name, icon: 'user', run: () => ctx.go(`#/perfil/${me.id}`) },
    { label: 'Editar perfil', icon: 'edit', run: () => ctx.go('#/editar-perfil') },
    { label: 'Ajustes', icon: 'settings', run: () => ctx.go('#/ajustes') },
    { label: me.hasAccess ? 'Mi suscripción' : 'Ver planes', icon: 'crown', run: () => ctx.go('#/ajustes/suscripcion') },
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

/* ---------- barra superior: buscador con sugerencias ---------- */
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

  const f = $('#searchForm'), input = $('#searchInput'), box = $('#searchSugg');
  const close = () => { box.hidden = true; box.innerHTML = ''; };
  const submit = () => { const v = input.value.trim(); if (v) { close(); input.blur(); ctx.go(`#/buscar?q=${encodeURIComponent(v)}`); } };
  f.onsubmit = (e) => { e.preventDefault(); submit(); };

  let t = 0, token = 0;
  input.oninput = () => {
    const q = input.value.trim();
    clearTimeout(t);
    if (q.length < 2) { close(); return; }
    t = setTimeout(async () => {
      const mine = ++token;
      const [scores, people, groups] = await Promise.all([
        store.listScores({ q }).catch(() => []), store.searchPeople(q).catch(() => []), store.listGroups({ q }).catch(() => []),
      ]);
      if (mine !== token) return;
      const row = (href, ic, title, sub) => `<a href="${href}" data-sugg>${ic}<div><b>${esc(title)}</b><small>${esc(sub)}</small></div></a>`;
      const html = [
        ...scores.slice(0, 4).map((s) => row(`#/obra/${s.id}`, icon('music'), s.title, `${s.composer} · ${s.instrument}`)),
        ...people.slice(0, 3).map((p) => row(`#/perfil/${p.id}`, avatar(p, 'xs'), p.name, p.service || 'Integrante')),
        ...groups.slice(0, 3).map((g) => row(`#/comunidad/${g.id}`, icon('users'), g.name, `${g.members} integrantes`)),
      ].join('');
      box.innerHTML = html ? html + `<a href="#/buscar?q=${encodeURIComponent(q)}" data-sugg class="all">${icon('search')}<div><b>Ver todos los resultados de “${esc(q)}”</b></div></a>`
        : `<p class="none">Nada coincide con “${esc(q)}”.</p>`;
      box.hidden = false;
      $$('[data-sugg]', box).forEach((a) => { a.onclick = () => { close(); input.value = ''; }; });
    }, 220);
  };
  input.onkeydown = (e) => { if (e.key === 'Escape') { close(); input.blur(); } };
  document.addEventListener('click', (e) => { if (!e.target.closest('#searchForm')) close(); });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); }
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
  if (store.onNotify) unsubNotif = store.onNotify(() => refreshBadges());
  unreadTimer = setInterval(refreshBadges, 60000);
  window.addEventListener('hashchange', route);
  route();
}

boot();
