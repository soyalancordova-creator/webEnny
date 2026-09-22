/* ============================================================
   STORE DEMO · misma interfaz que store-supa.js, sin backend
   ------------------------------------------------------------
   Todo vive en localStorage de ESTE navegador. Sirve para probar
   el flujo completo (login, pago simulado, comunidad, biblioteca,
   panel admin) antes de conectar Supabase y PayPal.
   Nada de esto es seguro ni compartido: es una maqueta funcional.
============================================================ */
import { demoXml } from './scores-demo.js';
import { blobToDataURL } from './media.js';

const KEY = 'enny-campus-demo-v1';
const SESSION = 'enny-campus-demo-session';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

export const DEMO_ACCOUNTS = {
  alumno: { email: 'alumno@demo.academia', password: 'demo1234', user: 'u-demo' },
  admin: { email: 'enny@demo.academia', password: 'admin1234', user: 'u-enny' },
};

function seed() {
  const users = [
    { id: 'u-enny', name: 'Enny Toro', service: 'Violinista · Docente', church: 'Guayaquil', city: 'Guayaquil, Ecuador', bio: 'Enseño violín para que la técnica sirva a la adoración. Aquí comparto lo que trabajamos en clase.', social: 'instagram.com/ennytoro', privacy: 'public', avatar: 'public/img/enny-rostro.jpg', cover: 'public/img/enny-escenario.jpg', role: 'admin', created_at: ago(60 * 24 * 200) },
    { id: 'u-demo', name: 'Alumno de prueba', service: 'Violín · nivel inicial', church: 'Iglesia local', city: 'Guayaquil, Ecuador', bio: 'Empezando mi camino con el violín.', social: '', privacy: 'public', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 12) },
    { id: 'u-sara', name: 'Sara Ríos', service: 'Pianista · Comunidad Gracia', church: 'Comunidad Gracia', city: 'Quito', bio: 'Pianista de alabanza. Me encanta armonizar himnos.', privacy: 'public', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 80) },
    { id: 'u-daniela', name: 'Daniela Cruz', service: 'Violinista · Bogotá', church: 'Iglesia El Camino', city: 'Bogotá', bio: 'Tercer año de violín. Sirvo los domingos.', privacy: 'public', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 60) },
    { id: 'u-mateo', name: 'Mateo León', service: 'Director de alabanza', church: 'Centro Cristiano Vida', city: 'Cuenca', bio: 'Dirijo un equipo de 12 músicos.', privacy: 'public', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 45) },
    { id: 'u-elena', name: 'Elena Vargas', service: 'Voz · coro juvenil', church: 'Iglesia Bautista Central', city: 'Guayaquil', bio: '', privacy: 'public', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 30) },
    { id: 'u-josue', name: 'Josué Mendoza', service: 'Violonchelo', church: 'Iglesia El Camino', city: 'Manta', bio: 'Chelista autodidacta, aprendiendo a leer mejor.', privacy: 'private', avatar: '', cover: '', role: 'student', created_at: ago(60 * 24 * 20) },
  ];
  const groups = [
    { id: 'g-oracion', name: 'Oración & Cuerdas', description: 'Violinistas y chelistas que oran antes de ministrar. Compartimos peticiones, ensayos y ánimo para el domingo.', privacy: 'private', cover: 'public/img/enny-concierto.jpg', owner: 'u-enny', created_at: ago(60 * 24 * 90), rules: 'Hablamos con gracia. Lo que se comparte en oración, se queda en el grupo.' },
    { id: 'g-violin', name: 'Violinistas de adoración', description: 'Técnica, repertorio y preguntas para quienes sirven con el violín en su iglesia.', privacy: 'public', cover: 'public/img/enny-tocando.jpg', owner: 'u-enny', created_at: ago(60 * 24 * 120), rules: 'Preguntas de todo nivel son bienvenidas.' },
    { id: 'g-teclas', name: 'Teclas que adoran', description: 'Armonía, pads y arreglos para acompañar a la congregación desde el piano.', privacy: 'public', cover: '', owner: 'u-sara', created_at: ago(60 * 24 * 70), rules: '' },
    { id: 'g-lectura', name: 'Lectura con propósito', description: 'Reto semanal de lectura a primera vista. Cada lunes una partitura nueva.', privacy: 'public', cover: 'public/img/enny-partituras.jpg', owner: 'u-enny', created_at: ago(60 * 24 * 40), rules: '' },
  ];
  const m = (g, u, role = 'member', status = 'active', d = 30) => ({ group_id: g, user_id: u, role, status, joined_at: ago(60 * 24 * d) });
  const members = [
    m('g-oracion', 'u-enny', 'owner'), m('g-oracion', 'u-daniela'), m('g-oracion', 'u-josue'), m('g-oracion', 'u-demo', 'member', 'active', 10),
    m('g-violin', 'u-enny', 'owner'), m('g-violin', 'u-daniela'), m('g-violin', 'u-demo', 'member', 'active', 11), m('g-violin', 'u-mateo'),
    m('g-teclas', 'u-sara', 'owner'), m('g-teclas', 'u-mateo'),
    m('g-lectura', 'u-enny', 'owner'), m('g-lectura', 'u-elena'), m('g-lectura', 'u-sara'),
  ];
  const posts = [
    { id: 'p1', author: 'u-enny', type: 'reflexion', group: null, created_at: ago(35), body: 'Antes de cada ensayo le pido a mis alumnos lo mismo: no toquen para impresionar, toquen para servir. La técnica es el camino; la adoración es el destino.\n\n¿Qué oran ustedes antes de tocar?', media: [{ url: 'public/img/enny-concierto.jpg', w: 1600, h: 1067 }] },
    { id: 'p2', author: 'u-daniela', type: 'pregunta', group: null, created_at: ago(150), body: '¿Cómo preparan un pasaje rápido cuando tienen poco tiempo antes de ministrar? Estoy trabajando una transición difícil para este domingo y se me escapa la afinación.', media: [] },
    { id: 'p3', author: 'u-mateo', type: 'recomendacion', group: null, created_at: ago(60 * 7), body: 'Práctica que cambió a mi equipo: una pasada con metrónomo y otra en silencio, imaginando la respiración de la congregación. Pruébenlo esta semana.', media: [] },
    { id: 'p4', author: 'u-sara', type: 'oracion', group: null, created_at: ago(60 * 20), body: 'Pido oración por mi mamá, que entra a cirugía mañana temprano. Gracias, familia.', media: [] },
    { id: 'p5', author: 'u-enny', type: 'recomendacion', group: null, created_at: ago(60 * 26), body: 'Subí a la biblioteca "Sublime gracia" con digitaciones de primera posición. Empiecen a 60 bpm con el metrónomo y suban de a 4. Cuando la toquen limpia, compartan su video aquí 🙌', media: [{ url: 'public/img/enny-partituras.jpg', w: 1600, h: 1067 }, { url: 'public/img/enny-estudio.jpg', w: 1600, h: 1067 }] },
    { id: 'p6', author: 'u-elena', type: 'testimonio', group: null, created_at: ago(60 * 50), body: 'Hace un año no sabía leer una partitura. Hoy canté mi primera parte en el coro leyendo. Todo es por gracia. 🕊️', media: [] },
    { id: 'p7', author: 'u-daniela', type: 'reflexion', group: 'g-violin', created_at: ago(60 * 5), body: 'Tip para el vibrato: primero lento y exagerado, después lo hacen chiquito. Me ayudó muchísimo.', media: [] },
    { id: 'p8', author: 'u-enny', type: 'reflexion', group: 'g-oracion', created_at: ago(60 * 30), body: 'Este domingo oremos por los equipos que sirven por primera vez. Que la música no nos distraiga de Aquel a quien cantamos.', media: [] },
  ];
  const r = (p, u, k) => ({ post_id: p, user_id: u, kind: k, created_at: ago(20) });
  const reactions = [
    r('p1', 'u-daniela', 'amen'), r('p1', 'u-sara', 'aleluya'), r('p1', 'u-mateo', 'amen'), r('p1', 'u-elena', 'amen'),
    r('p2', 'u-enny', 'orando'), r('p2', 'u-josue', 'amen'),
    r('p3', 'u-enny', 'amen'), r('p3', 'u-daniela', 'aleluya'),
    r('p4', 'u-enny', 'orando'), r('p4', 'u-daniela', 'orando'), r('p4', 'u-mateo', 'orando'), r('p4', 'u-elena', 'orando'), r('p4', 'u-josue', 'orando'),
    r('p5', 'u-daniela', 'aleluya'), r('p5', 'u-sara', 'amen'),
    r('p6', 'u-enny', 'aleluya'), r('p6', 'u-sara', 'aleluya'), r('p6', 'u-mateo', 'amen'),
  ];
  const c = (id, p, u, body, min, parent = null) => ({ id, post_id: p, author: u, body, parent_id: parent, created_at: ago(min) });
  const comments = [
    c('c1', 'p1', 'u-daniela', 'Que el Señor use mis manos y no mi ego. Esa es mi oración cada domingo.', 30),
    c('c2', 'p1', 'u-enny', 'Amén, Daniela. Esa es la actitud 🙏', 25, 'c1'),
    c('c3', 'p2', 'u-enny', 'Aísla el pasaje en grupos de 4 notas, tócalo lento con metrónomo y súbelo de a 4 bpm. Y descansa la mano entre repeticiones: la tensión desafina.', 120),
    c('c4', 'p2', 'u-mateo', 'Y si no sale al tempo, simplifícalo el domingo. Nadie se va a dar cuenta, y sirves igual.', 100),
    c('c5', 'p4', 'u-enny', 'Estamos orando por ella, Sara.', 60 * 19),
    c('c6', 'p4', 'u-elena', 'Orando 🙏', 60 * 18),
  ];
  const messages = [
    { id: 'm1', group_id: 'g-oracion', author: 'u-enny', body: 'Bienvenidos a Oración & Cuerdas. Aquí oramos antes de cada domingo.', created_at: ago(60 * 24 * 3) },
    { id: 'm2', group_id: 'g-oracion', author: 'u-daniela', body: 'Gracias Enny. Oren por mí, me toca un solo este domingo 😅', created_at: ago(60 * 24 * 3 - 12) },
    { id: 'm3', group_id: 'g-oracion', author: 'u-josue', body: 'Vas a estar bien. Estamos contigo.', created_at: ago(60 * 24 * 3 - 20) },
    { id: 'm4', group_id: 'g-oracion', author: 'u-enny', body: 'Hoy oramos por calma y oído atento antes del ensayo.', created_at: ago(90) },
    { id: 'm5', group_id: 'g-oracion', author: 'u-daniela', body: 'Amén 🙏', created_at: ago(85) },
    { id: 'm6', group_id: 'g-violin', author: 'u-mateo', body: '¿Alguien tiene arreglo de "Santo, Santo, Santo" para dos violines?', created_at: ago(60 * 6) },
    { id: 'm7', group_id: 'g-violin', author: 'u-enny', body: 'Lo preparo para la biblioteca esta semana 👍', created_at: ago(60 * 5) },
    { id: 'm8', group_id: 'g-lectura', author: 'u-enny', body: 'Reto de la semana: "Himno de la alegría" a primera vista. Una sola pasada, sin parar.', created_at: ago(60 * 24) },
  ];
  const collections = [
    { id: 'col-inicio', title: 'Primeros pasos', description: 'Para tus primeras semanas con el violín.', position: 1 },
    { id: 'col-himnos', title: 'Himnos para servir', description: 'Himnos clásicos de dominio público, listos para el domingo.', position: 2 },
    { id: 'col-tecnica', title: 'Técnica diaria', description: 'Escalas y ejercicios para 15 minutos al día.', position: 3 },
  ];
  const s = (id, title, composer, instrument, level, key_label, bpm, collection, free, tags) => ({ id, title, composer, instrument, level, key_label, bpm, collection, free, tags, published: true, pdf_url: '', media_url: '', sync: null, created_at: ago(60 * 24 * 10) });
  const scores = [
    s('estrellita', 'Estrellita, ¿dónde estás?', 'Tradicional', 'Violín', 'Inicial', 'Re mayor', 88, 'col-inicio', true, ['Suzuki', 'primera posición']),
    s('sublime-gracia', 'Sublime gracia', 'John Newton · New Britain', 'Violín', 'Inicial', 'Sol mayor', 76, 'col-himnos', false, ['himno', '3/4']),
    s('himno-alegria', 'Himno de la alegría', 'Ludwig van Beethoven', 'Violín', 'Inicial', 'Re mayor', 96, 'col-himnos', false, ['clásico']),
    s('escala-re', 'Escala y arpegio de Re mayor', 'Ejercicio · dos octavas', 'Violín', 'Intermedio', 'Re mayor', 72, 'col-tecnica', false, ['escalas', 'afinación']),
    s('himno-alegria-piano', 'Himno de la alegría · piano', 'Ludwig van Beethoven', 'Piano', 'Inicial', 'Do mayor', 92, 'col-himnos', false, ['piano', 'dos manos']),
  ];
  const notifications = [
    { id: 'n0', user: null, kind: 'broadcast', title: 'Bienvenido a la academia', body: 'Esta semana subimos 5 obras nuevas a la biblioteca. Empieza por "Estrellita" si eres nuevo.', link: '#/biblioteca', actor: 'u-enny', created_at: ago(60 * 24 * 2) },
    { id: 'n1', user: 'u-demo', kind: 'reaction', title: 'Daniela Cruz reaccionó "Amén" a tu comentario', body: '', link: '#/comunidad', actor: 'u-daniela', created_at: ago(60 * 3) },
    { id: 'n2', user: 'u-demo', kind: 'group', title: 'Nuevo mensaje en Oración & Cuerdas', body: 'Enny: Hoy oramos por calma y oído atento…', link: '#/comunidad/g-oracion', actor: 'u-enny', created_at: ago(90) },
  ];
  const subscriptions = [
    { user_id: 'u-demo', provider: 'demo', plan: 'anual', status: 'active', current_period_end: new Date(Date.now() + 300 * 86400000).toISOString() },
  ];
  return { users, groups, members, posts, reactions, comments, saves: [], messages, collections, scores, favorites: [], notifications, reads: [], subscriptions, reports: [] };
}

/* ---------- persistencia ---------- */
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.users) return d; } catch (_) {}
  const d = seed(); save(d); return d;
}
function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); }
  catch (e) { throw new Error('El almacenamiento del navegador está lleno (modo demo). Borra datos de demo en Ajustes.'); }
}

export function createDemoStore() {
  let db = load();
  const listeners = { msg: new Map(), notif: new Set() };
  const commit = () => save(db);
  const meId = () => localStorage.getItem(SESSION);
  const user = (id) => db.users.find((u) => u.id === id);
  const pub = (u) => u && { id: u.id, name: u.name, avatar: u.avatar, service: u.service, role: u.role };
  const need = () => { const id = meId(); if (!id || !user(id)) throw new Error('Tu sesión terminó. Vuelve a entrar.'); return id; };
  const isAdmin = () => user(meId())?.role === 'admin';
  // igual que has_access() en SQL: cancelada conserva acceso hasta el fin del periodo pagado
  const activeSub = (id) => { const s = db.subscriptions.find((x) => x.user_id === id); return s && ['active', 'cancelled'].includes(s.status) && new Date(s.current_period_end) > new Date() ? s : null; };
  const memberOf = (gid, id) => db.members.find((x) => x.group_id === gid && x.user_id === id);
  const canSeeGroup = (gid, id) => { const g = db.groups.find((x) => x.id === gid); if (!g) return false; if (g.privacy === 'public') return true; const mm = memberOf(gid, id); return !!(mm && mm.status === 'active') || isAdmin(); };
  const notify = (n) => {
    db.notifications.unshift({ id: uid(), created_at: now(), ...n }); commit();
    listeners.notif.forEach((cb) => cb());
  };
  const saveImage = async (img) => (img ? { url: await blobToDataURL(img.blob), w: img.width, h: img.height } : null);

  const decoratePost = (p, me) => {
    const rx = db.reactions.filter((r) => r.post_id === p.id);
    const counts = { amen: 0, orando: 0, aleluya: 0, comments: db.comments.filter((c) => c.post_id === p.id).length };
    rx.forEach((r) => { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    const g = p.group ? db.groups.find((x) => x.id === p.group) : null;
    return { id: p.id, author: pub(user(p.author)), type: p.type, body: p.body, media: p.media || [], created_at: p.created_at,
      group: g ? { id: g.id, name: g.name } : null, counts, mine: rx.find((r) => r.user_id === me)?.kind || null,
      saved: db.saves.some((s) => s.post_id === p.id && s.user_id === me), canEdit: p.author === me || isAdmin() };
  };

  return {
    mode: 'demo',

    /* ---------- sesión ---------- */
    async me() {
      const u = user(meId()); if (!u) return null;
      const sub = activeSub(u.id);
      return { ...u, email: u.id === 'u-enny' ? DEMO_ACCOUNTS.admin.email : u.id === 'u-demo' ? DEMO_ACCOUNTS.alumno.email : `${u.id}@demo`, isAdmin: u.role === 'admin', subscription: sub, hasAccess: !!sub || u.role === 'admin' };
    },
    async signInDemo(key) {
      const acc = DEMO_ACCOUNTS[key]; if (!acc) throw new Error('Cuenta demo desconocida.');
      localStorage.setItem(SESSION, acc.user); return this.me();
    },
    async signInPassword(email, password) {
      const acc = Object.values(DEMO_ACCOUNTS).find((a) => a.email === email.trim().toLowerCase() && a.password === password);
      if (!acc) throw new Error('En modo demo usa una de las cuentas de prueba.');
      localStorage.setItem(SESSION, acc.user); return this.me();
    },
    async signOut() { localStorage.removeItem(SESSION); },
    resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); db = load(); },

    /* ---------- perfiles ---------- */
    async getProfile(id) {
      const u = user(id); if (!u) throw new Error('Perfil no encontrado.');
      const me = meId();
      const hidden = u.privacy === 'private' && id !== me && !isAdmin();
      const groups = db.members.filter((x) => x.user_id === id && x.status === 'active').length;
      const posts = db.posts.filter((p) => p.author === id && !p.group).length;
      return { ...pub(u), cover: u.cover, bio: hidden ? '' : u.bio, church: hidden ? '' : u.church, city: hidden ? '' : u.city,
        social: hidden ? '' : u.social, privacy: u.privacy, created_at: u.created_at, hidden, stats: { posts, groups, amens: db.reactions.filter((r) => db.posts.find((p) => p.id === r.post_id)?.author === id).length }, isMe: id === me };
    },
    async updateMe(patch) {
      const u = user(need());
      ['name', 'service', 'church', 'city', 'bio', 'social', 'privacy'].forEach((k) => { if (k in patch) u[k] = String(patch[k] ?? '').slice(0, k === 'bio' ? 400 : 120); });
      commit(); return this.me();
    },
    async uploadAvatar(img) { const u = user(need()); u.avatar = (await saveImage(img)).url; commit(); return u.avatar; },
    async uploadCover(img) { const u = user(need()); u.cover = (await saveImage(img)).url; commit(); return u.cover; },
    async searchPeople(q) {
      q = (q || '').toLowerCase();
      return db.users.filter((u) => !q || u.name.toLowerCase().includes(q) || (u.service || '').toLowerCase().includes(q)).slice(0, 20).map(pub);
    },

    /* ---------- publicaciones ---------- */
    async listPosts({ groupId = null, type = null, authorId = null, saved = false } = {}) {
      const me = need();
      let list = db.posts.slice();
      if (groupId) { if (!canSeeGroup(groupId, me)) throw new Error('Esta comunidad es privada.'); list = list.filter((p) => p.group === groupId); }
      else if (authorId) list = list.filter((p) => p.author === authorId && (!p.group || canSeeGroup(p.group, me)));
      else if (saved) list = list.filter((p) => db.saves.some((s) => s.post_id === p.id && s.user_id === me) && (!p.group || canSeeGroup(p.group, me)));
      else list = list.filter((p) => !p.group);
      if (type) list = list.filter((p) => p.type === type);
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return list.map((p) => decoratePost(p, me));
    },
    async getPost(id) { const me = need(); const p = db.posts.find((x) => x.id === id); if (!p || (p.group && !canSeeGroup(p.group, me))) throw new Error('Publicación no disponible.'); return decoratePost(p, me); },
    async createPost({ body, type = 'reflexion', groupId = null, images = [] }) {
      const me = need();
      body = String(body || '').trim().slice(0, 3000);
      if (!body && !images.length) throw new Error('Escribe algo o agrega una foto.');
      if (groupId) { const mm = memberOf(groupId, me); if (!(mm && mm.status === 'active') && !isAdmin()) throw new Error('Únete a la comunidad para publicar.'); }
      const media = []; for (const img of images.slice(0, 6)) media.push(await saveImage(img));
      const p = { id: uid(), author: me, type, group: groupId, body, media, created_at: now() };
      db.posts.unshift(p); commit(); return decoratePost(p, me);
    },
    async deletePost(id) {
      const me = need(); const p = db.posts.find((x) => x.id === id);
      if (!p) return; if (p.author !== me && !isAdmin()) throw new Error('No puedes borrar esta publicación.');
      db.posts = db.posts.filter((x) => x.id !== id); db.reactions = db.reactions.filter((x) => x.post_id !== id);
      db.comments = db.comments.filter((x) => x.post_id !== id); db.saves = db.saves.filter((x) => x.post_id !== id); commit();
    },
    async react(postId, kind) {
      const me = need(); const p = db.posts.find((x) => x.id === postId); if (!p) throw new Error('Publicación no disponible.');
      if (!['amen', 'orando', 'aleluya'].includes(kind)) throw new Error('Reacción inválida.');
      const cur = db.reactions.find((r) => r.post_id === postId && r.user_id === me);
      if (cur && cur.kind === kind) db.reactions = db.reactions.filter((r) => r !== cur);
      else if (cur) cur.kind = kind;
      else {
        db.reactions.push({ post_id: postId, user_id: me, kind, created_at: now() });
        if (p.author !== me) notify({ user: p.author, kind: 'reaction', title: `${user(me).name} reaccionó a tu publicación`, body: '', link: `#/publicacion/${postId}`, actor: me });
      }
      commit(); return decoratePost(p, me);
    },
    async reactors(postId) {
      return db.reactions.filter((r) => r.post_id === postId).map((r) => ({ user: pub(user(r.user_id)), kind: r.kind }));
    },
    async toggleSave(postId) {
      const me = need(); const i = db.saves.findIndex((s) => s.post_id === postId && s.user_id === me);
      if (i >= 0) db.saves.splice(i, 1); else db.saves.push({ post_id: postId, user_id: me, created_at: now() });
      commit(); return i < 0;
    },
    async report(kind, id, reason) {
      const me = need(); db.reports.unshift({ id: uid(), reporter: me, target_kind: kind, target_id: id, reason: String(reason || '').slice(0, 500), status: 'open', created_at: now() }); commit();
    },

    /* ---------- comentarios ---------- */
    async listComments(postId) {
      const me = need();
      return db.comments.filter((c) => c.post_id === postId).sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => ({ id: c.id, parent_id: c.parent_id, body: c.body, created_at: c.created_at, author: pub(user(c.author)), canDelete: c.author === me || isAdmin() }));
    },
    async addComment(postId, body, parentId = null) {
      const me = need(); body = String(body || '').trim().slice(0, 1500); if (!body) throw new Error('Escribe un comentario.');
      const p = db.posts.find((x) => x.id === postId); if (!p) throw new Error('Publicación no disponible.');
      const c = { id: uid(), post_id: postId, author: me, body, parent_id: parentId, created_at: now() };
      db.comments.push(c); commit();
      if (p.author !== me) notify({ user: p.author, kind: 'comment', title: `${user(me).name} comentó tu publicación`, body: body.slice(0, 120), link: `#/publicacion/${postId}`, actor: me });
      return c;
    },
    async deleteComment(id) {
      const me = need(); const c = db.comments.find((x) => x.id === id); if (!c) return;
      if (c.author !== me && !isAdmin()) throw new Error('No puedes borrar este comentario.');
      db.comments = db.comments.filter((x) => x.id !== id && x.parent_id !== id); commit();
    },

    /* ---------- comunidades ---------- */
    async listGroups({ q = '', mine = false } = {}) {
      const me = need(); q = q.toLowerCase();
      return db.groups.filter((g) => (!q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)))
        .map((g) => this._group(g, me)).filter((g) => !mine || g.myStatus === 'active');
    },
    _group(g, me) {
      const mm = memberOf(g.id, me);
      return { id: g.id, name: g.name, description: g.description, privacy: g.privacy, cover: g.cover, rules: g.rules, created_at: g.created_at,
        owner: pub(user(g.owner)), members: db.members.filter((x) => x.group_id === g.id && x.status === 'active').length,
        pending: db.members.filter((x) => x.group_id === g.id && x.status === 'pending').length,
        myStatus: mm ? mm.status : null, myRole: mm ? mm.role : null, canManage: (mm && ['owner', 'admin'].includes(mm.role) && mm.status === 'active') || isAdmin() };
    },
    async getGroup(id) { const me = need(); const g = db.groups.find((x) => x.id === id); if (!g) throw new Error('Comunidad no encontrada.'); return this._group(g, me); },
    async createGroup({ name, description, privacy = 'public', cover = null, rules = '' }) {
      const me = need(); name = String(name || '').trim().slice(0, 60); description = String(description || '').trim().slice(0, 400);
      if (name.length < 3) throw new Error('El nombre necesita al menos 3 letras.');
      const g = { id: uid(), name, description, privacy: privacy === 'private' ? 'private' : 'public', cover: cover ? (await saveImage(cover)).url : '', owner: me, created_at: now(), rules: String(rules || '').slice(0, 800) };
      db.groups.unshift(g); db.members.push({ group_id: g.id, user_id: me, role: 'owner', status: 'active', joined_at: now() });
      db.messages.push({ id: uid(), group_id: g.id, author: me, body: 'Bienvenidos. Este es un espacio para crecer y servir juntos.', created_at: now() });
      commit(); return this._group(g, me);
    },
    async joinGroup(id) {
      const me = need(); const g = db.groups.find((x) => x.id === id); if (!g) throw new Error('Comunidad no encontrada.');
      let mm = memberOf(id, me);
      if (!mm) { mm = { group_id: id, user_id: me, role: 'member', status: g.privacy === 'private' ? 'pending' : 'active', joined_at: now() }; db.members.push(mm); }
      if (mm.status === 'pending') notify({ user: g.owner, kind: 'group', title: `${user(me).name} pidió unirse a ${g.name}`, body: '', link: `#/comunidad/${id}/integrantes`, actor: me });
      commit(); return mm.status;
    },
    async leaveGroup(id) {
      const me = need(); const mm = memberOf(id, me); if (!mm) return;
      if (mm.role === 'owner') throw new Error('Eres la dueña de esta comunidad. Transfiérela o elimínala desde el panel.');
      db.members = db.members.filter((x) => x !== mm); commit();
    },
    async listMembers(id) {
      const me = need(); const g = await this.getGroup(id);
      return db.members.filter((x) => x.group_id === id && (x.status === 'active' || g.canManage))
        .map((x) => ({ user: pub(user(x.user_id)), role: x.role, status: x.status, joined_at: x.joined_at, isMe: x.user_id === me }))
        .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.status === 'pending' ? -1 : 0));
    },
    async setMember(groupId, userId, action) {
      const g = await this.getGroup(groupId); if (!g.canManage) throw new Error('Solo quien administra la comunidad puede hacer esto.');
      const mm = memberOf(groupId, userId); if (!mm) return;
      if (action === 'approve') { mm.status = 'active'; notify({ user: userId, kind: 'group', title: `Te aceptaron en ${g.name}`, body: '', link: `#/comunidad/${groupId}`, actor: meId() }); }
      if (action === 'remove') { if (mm.role === 'owner') throw new Error('No se puede quitar a la dueña.'); db.members = db.members.filter((x) => x !== mm); }
      if (action === 'admin') mm.role = mm.role === 'admin' ? 'member' : 'admin';
      commit();
    },
    async listMessages(groupId) {
      const me = need(); if (!canSeeGroup(groupId, me) || (!(memberOf(groupId, me)?.status === 'active') && !isAdmin())) throw new Error('Únete a la comunidad para ver el chat.');
      return db.messages.filter((m) => m.group_id === groupId).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-200)
        .map((m) => ({ id: m.id, body: m.body, image: m.image || null, created_at: m.created_at, author: pub(user(m.author)), mine: m.author === me }));
    },
    async sendMessage(groupId, { body = '', image = null }) {
      const me = need(); const mm = memberOf(groupId, me);
      if (!(mm && mm.status === 'active') && !isAdmin()) throw new Error('Únete a la comunidad para escribir.');
      body = String(body).trim().slice(0, 2000); if (!body && !image) return null;
      const m = { id: uid(), group_id: groupId, author: me, body, image: image ? (await saveImage(image)).url : null, created_at: now() };
      db.messages.push(m); commit();
      const out = { ...m, author: pub(user(me)), mine: true };
      (listeners.msg.get(groupId) || new Set()).forEach((cb) => cb(out));
      this._demoReply(groupId, me);
      return out;
    },
    /** Solo demo: alguien del grupo contesta una vez, para poder ver el tiempo real. */
    _demoReply(groupId, me) {
      const flag = `enny-demo-replied-${groupId}`;
      if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, '1');
      const others = db.members.filter((x) => x.group_id === groupId && x.user_id !== me && x.status === 'active');
      if (!others.length) return;
      const who = others[Math.floor(Math.random() * others.length)].user_id;
      setTimeout(() => {
        const m = { id: uid(), group_id: groupId, author: who, body: 'Amén 🙏 gracias por compartir.', created_at: now() };
        db = load(); db.messages.push(m); commit();
        (listeners.msg.get(groupId) || new Set()).forEach((cb) => cb({ ...m, author: pub(user(who)), mine: false }));
      }, 2600);
    },
    subscribeMessages(groupId, cb) {
      if (!listeners.msg.has(groupId)) listeners.msg.set(groupId, new Set());
      listeners.msg.get(groupId).add(cb);
      return () => listeners.msg.get(groupId).delete(cb);
    },

    /* ---------- notificaciones ---------- */
    async listNotifications() {
      const me = need(); const reads = new Set(db.reads.filter((r) => r.user_id === me).map((r) => r.id));
      return db.notifications.filter((n) => n.user === me || n.user === null).slice(0, 100)
        .map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, created_at: n.created_at, actor: pub(user(n.actor)), read: reads.has(n.id) }));
    },
    async unreadCount() { const l = await this.listNotifications(); return l.filter((n) => !n.read).length; },
    async markRead(id) {
      const me = need(); const ids = id === 'all' ? db.notifications.filter((n) => n.user === me || n.user === null).map((n) => n.id) : [id];
      ids.forEach((i) => { if (!db.reads.some((r) => r.user_id === me && r.id === i)) db.reads.push({ user_id: me, id: i }); }); commit();
      listeners.notif.forEach((cb) => cb());
    },
    onNotify(cb) { listeners.notif.add(cb); return () => listeners.notif.delete(cb); },

    /* ---------- biblioteca ---------- */
    async listCollections() { return db.collections.slice().sort((a, b) => a.position - b.position).map((c) => ({ ...c, count: db.scores.filter((s) => s.collection === c.id && s.published).length })); },
    async listScores({ q = '', instrument = '', level = '', collection = '', favorites = false } = {}) {
      const me = need(); const access = !!activeSub(me) || isAdmin(); q = q.toLowerCase();
      const favs = new Set(db.favorites.filter((f) => f.user_id === me).map((f) => f.score_id));
      return db.scores.filter((s) => (s.published || isAdmin())
        && (!q || `${s.title} ${s.composer} ${(s.tags || []).join(' ')}`.toLowerCase().includes(q))
        && (!instrument || s.instrument === instrument) && (!level || s.level === level)
        && (!collection || s.collection === collection) && (!favorites || favs.has(s.id)))
        .map((s) => ({ ...s, locked: !s.free && !access, favorite: favs.has(s.id), hasMedia: !!s.media_url }));
    },
    async getScore(id) {
      const me = need(); const s = db.scores.find((x) => x.id === id);
      if (!s || (!s.published && !isAdmin())) throw new Error('Obra no disponible.');
      if (!s.free && !activeSub(me) && !isAdmin()) { const e = new Error('Necesitas una suscripción activa para abrir esta obra.'); e.code = 'PAYWALL'; throw e; }
      const xml = s.xml || demoXml(s.id);
      if (!xml) throw new Error('Esta obra aún no tiene archivo MusicXML.');
      return { ...s, xml, favorite: db.favorites.some((f) => f.user_id === me && f.score_id === id) };
    },
    async toggleFavorite(scoreId) {
      const me = need(); const i = db.favorites.findIndex((f) => f.user_id === me && f.score_id === scoreId);
      if (i >= 0) db.favorites.splice(i, 1); else db.favorites.push({ user_id: me, score_id: scoreId }); commit(); return i < 0;
    },

    /* ---------- suscripción ---------- */
    async mySubscription() { return activeSub(need()); },
    async subscribe(plan) {
      // demo: el "pago" se aprueba al instante. En producción lo confirma el servidor tras PayPal.
      const me = need(); const days = { mensual: 31, trimestral: 92, anual: 366 }[plan]; if (!days) throw new Error('Plan inválido.');
      db.subscriptions = db.subscriptions.filter((s) => s.user_id !== me);
      db.subscriptions.push({ user_id: me, provider: 'demo', plan, status: 'active', current_period_end: new Date(Date.now() + days * 86400000).toISOString() });
      commit(); return activeSub(me);
    },
    async cancelSubscription() { const s = db.subscriptions.find((x) => x.user_id === need()); if (s) { s.status = 'cancelled'; commit(); } },

    /* ---------- administración ---------- */
    _admin() { if (!isAdmin()) throw new Error('Solo administradores.'); },
    async adminStats() {
      this._admin();
      const since = Date.now() - 7 * 86400000;
      return { users: db.users.length, newUsers7d: db.users.filter((u) => new Date(u.created_at) > since).length,
        activeSubs: db.subscriptions.filter((s) => s.status === 'active' && new Date(s.current_period_end) > new Date()).length, scores: db.scores.length,
        posts: db.posts.length, groups: db.groups.length, reports: db.reports.filter((r) => r.status === 'open').length };
    },
    async adminUsers() {
      this._admin();
      return db.users.map((u) => ({ ...pub(u), created_at: u.created_at, city: u.city, subscription: db.subscriptions.find((s) => s.user_id === u.id) || null }));
    },
    async adminSaveScore(meta, xmlText) {
      this._admin();
      let s = meta.id && db.scores.find((x) => x.id === meta.id);
      if (!s) { s = { id: meta.id || uid(), created_at: now(), published: false, sync: null }; db.scores.unshift(s); }
      ['title', 'composer', 'instrument', 'level', 'key_label', 'bpm', 'collection', 'free', 'tags', 'published', 'pdf_url', 'media_url'].forEach((k) => { if (k in meta) s[k] = meta[k]; });
      if (xmlText) s.xml = xmlText;
      commit(); return s;
    },
    async adminSaveSync(id, sync) { this._admin(); const s = db.scores.find((x) => x.id === id); if (s) { s.sync = sync; commit(); } },
    async adminDeleteScore(id) { this._admin(); db.scores = db.scores.filter((x) => x.id !== id); commit(); },
    async adminAllScores() { this._admin(); return db.scores.slice(); },
    async adminScoreXml(id) { this._admin(); const s = db.scores.find((x) => x.id === id); return s ? (s.xml || demoXml(s.id)) : null; },
    async adminSaveCollection(c) {
      this._admin(); let x = c.id && db.collections.find((k) => k.id === c.id);
      if (!x) { x = { id: uid(), position: db.collections.length + 1 }; db.collections.push(x); }
      x.title = String(c.title || '').slice(0, 80); x.description = String(c.description || '').slice(0, 300); commit(); return x;
    },
    async adminDeleteCollection(id) { this._admin(); db.collections = db.collections.filter((c) => c.id !== id); db.scores.forEach((s) => { if (s.collection === id) s.collection = ''; }); commit(); },
    async adminBroadcast({ title, body, link }) {
      this._admin(); title = String(title || '').trim().slice(0, 120); if (!title) throw new Error('Escribe un título.');
      notify({ user: null, kind: 'broadcast', title, body: String(body || '').slice(0, 600), link: String(link || '').slice(0, 200), actor: meId() });
    },
    async adminBroadcasts() { this._admin(); return db.notifications.filter((n) => n.user === null); },
    async adminReports() {
      this._admin();
      return db.reports.map((r) => {
        const target = r.target_kind === 'post' ? db.posts.find((p) => p.id === r.target_id) : db.comments.find((c) => c.id === r.target_id);
        return { ...r, reporter: pub(user(r.reporter)), target: target ? { body: target.body, author: pub(user(target.author)) } : null };
      });
    },
    async adminResolveReport(id, remove) {
      this._admin(); const r = db.reports.find((x) => x.id === id); if (!r) return;
      if (remove) { if (r.target_kind === 'post') await this.deletePost(r.target_id); else await this.deleteComment(r.target_id); }
      r.status = remove ? 'removed' : 'dismissed'; commit();
    },
  };
}
