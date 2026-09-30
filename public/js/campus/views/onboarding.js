/* ============================================================
   PRIMEROS PASOS · lo que ve alguien recién registrado
   ------------------------------------------------------------
   Seis pantallas, todas salteables menos la primera:
   1. Quién eres        2. Tu foto y portada
   3. Qué te interesa   4. Hermanos sugeridos
   5. Comunidades y grupos   6. El plan
   Nadie queda fuera por no pagar: al final puede seguir gratis.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, avatar, toast } from '../ui.js';
import { compressImage } from '../media.js';

const INTERESES = [
  ['violin', 'Violín', 'music'], ['piano', 'Piano', 'music'], ['guitarra', 'Guitarra', 'music'],
  ['canto', 'Canto', 'megaphone'], ['coro', 'Coro', 'users'], ['bateria', 'Batería', 'music'],
  ['alabanza', 'Equipo de alabanza', 'church'], ['himnos', 'Himnos clásicos', 'book'],
  ['adoracion', 'Adoración contemporánea', 'sparkle'], ['ensenanza', 'Enseñar música', 'book'],
  ['oracion', 'Grupos de oración', 'hands'], ['composicion', 'Componer', 'edit'],
];

const PASOS = ['quien', 'foto', 'intereses', 'hermanos', 'grupos', 'plan'];

export async function renderOnboarding(ctx, view, [paso]) {
  const i = Math.max(0, PASOS.indexOf(paso));
  ctx.setTitle('Primeros pasos');
  const ir = (n) => (n >= PASOS.length ? terminar(ctx) : ctx.go(`#/primeros-pasos/${PASOS[n]}`));

  view.innerHTML = `<div class="ob">
    <div class="ob-barra"><i style="width:${((i + 1) / PASOS.length) * 100}%"></i></div>
    <div class="ob-cuerpo" id="obc"></div>
  </div>`;
  const el = $('#obc', view);
  const pintar = { quien, foto, intereses, hermanos, grupos, plan }[PASOS[i]];
  await pintar(ctx, el, ir, i);
}

function terminar(ctx) {
  try { localStorage.setItem('hosannia-onboarding', '1'); } catch (_) {}
  ctx.go('#/comunidad');
}

function cabecera(titulo, sub) {
  return `<header class="ob-head"><h1>${titulo}</h1><p>${sub}</p></header>`;
}
function pies(ir, i, { saltar = true, texto = 'Continuar' } = {}) {
  return `<footer class="ob-pies">
    ${saltar ? `<button class="btn btn-ghost btn-sm" data-skip><span>Ahora no</span></button>` : '<span></span>'}
    <button class="btn btn-fill" data-next><span>${texto}</span></button></footer>`;
}
function atar(el, ir, i) {
  const s = $('[data-skip]', el); if (s) s.onclick = () => ir(i + 1);
  const n = $('[data-next]', el); if (n) n.onclick = () => ir(i + 1);
}

/* ---------- 1. quién eres ---------- */
async function quien(ctx, el, ir, i) {
  const me = ctx.me;
  el.innerHTML = `${cabecera('¿Cómo te llamamos?', 'Así te verán los demás hermanos.')}
    <form class="ob-form" id="f">
      <div class="fld"><label>Tu nombre</label><input name="name" maxlength="60" value="${esc(me.name || '')}" required autocomplete="name"></div>
      <div class="fld"><label>Cómo te saludamos</label>
        <div class="ob-gen">
          <button type="button" class="ob-pick${me.gender === 'm' ? ' on' : ''}" data-g="m">${icon('user')}Hermano</button>
          <button type="button" class="ob-pick${me.gender === 'f' ? ' on' : ''}" data-g="f">${icon('user')}Hermana</button>
        </div></div>
      <div class="fld"><label>¿Cómo sirves?</label><input name="service" maxlength="80" value="${esc(me.service || '')}" placeholder="Ej. Violinista · Equipo de alabanza"></div>
      <div class="two"><div class="fld"><label>Tu iglesia</label><input name="church" maxlength="80" value="${esc(me.church || '')}"></div>
        <div class="fld"><label>Ciudad</label><input name="city" maxlength="80" value="${esc(me.city || '')}"></div></div>
    </form>
    ${pies(ir, i, { saltar: false })}`;
  let gender = me.gender || '';
  $$('[data-g]', el).forEach((b) => {
    b.onclick = () => { gender = b.dataset.g; $$('[data-g]', el).forEach((x) => x.classList.toggle('on', x === b)); };
  });
  $('[data-next]', el).onclick = async () => {
    const d = Object.fromEntries(new FormData($('#f', el)));
    if (!d.name.trim()) { toast('Escribe tu nombre.'); return; }
    try { await ctx.store.updateMe({ ...d, gender }); await ctx.refreshMe(); ir(i + 1); }
    catch (e) { toast(e.message); }
  };
}

/* ---------- 2. foto y portada ---------- */
async function foto(ctx, el, ir, i) {
  const me = ctx.me;
  el.innerHTML = `${cabecera('Ponle rostro a tu perfil', 'Una foto ayuda a que te reconozcan. Puedes hacerlo después.')}
    <div class="ob-foto">
      <div class="pf-cover" id="cv">${me.cover ? `<img src="${esc(me.cover)}" alt="">` : ''}
        <label class="btn btn-ghost btn-sm upl"><span>${icon('image')} Portada</span><input type="file" accept="image/*" hidden id="cvIn"></label></div>
      <label class="ob-av" id="avBox">${avatar(me, 'xl')}<span class="cam">${icon('camera')}</span>
        <input type="file" accept="image/*" hidden id="avIn"></label>
    </div>
    <div class="fld"><label>Cuéntanos de ti</label><textarea id="bio" maxlength="400" placeholder="Dos líneas sobre tu caminar con la música y con Dios">${esc(me.bio || '')}</textarea></div>
    ${pies(ir, i)}`;
  const sube = async (input, tipo) => {
    const f = input.files[0]; input.value = ''; if (!f) return;
    try {
      const img = await compressImage(f, tipo === 'avatar' ? { maxSide: 512, quality: 0.85 } : { maxSide: 1800, quality: 0.8 });
      toast('Subiendo…');
      const url = tipo === 'avatar' ? await ctx.store.uploadAvatar(img) : await ctx.store.uploadCover(img);
      await ctx.refreshMe();
      if (tipo === 'avatar') $('#avBox', el).innerHTML = `${avatar(ctx.me, 'xl')}<span class="cam">${icon('camera')}</span><input type="file" accept="image/*" hidden id="avIn">`;
      else $('#cv', el).insertAdjacentHTML('afterbegin', `<img src="${esc(url)}" alt="">`);
      toast('Listo.');
      if (tipo === 'avatar') $('#avIn', el).onchange = (e) => sube(e.target, 'avatar');
    } catch (e) { toast(e.message); }
  };
  $('#avIn', el).onchange = (e) => sube(e.target, 'avatar');
  $('#cvIn', el).onchange = (e) => sube(e.target, 'cover');
  $('[data-next]', el).onclick = async () => {
    const bio = $('#bio', el).value.trim();
    try { if (bio) { await ctx.store.updateMe({ bio }); await ctx.refreshMe(); } } catch (_) {}
    ir(i + 1);
  };
  atar(el, ir, i);
}

/* ---------- 3. intereses ---------- */
async function intereses(ctx, el, ir, i) {
  let elegidos = [];
  try { elegidos = JSON.parse(localStorage.getItem('hosannia-intereses') || '[]'); } catch (_) {}
  el.innerHTML = `${cabecera('¿Qué te mueve?', 'Con esto te sugerimos hermanos, comunidades y partituras.')}
    <div class="ob-chips">${INTERESES.map(([k, l, ic]) => `<button class="ob-pick${elegidos.includes(k) ? ' on' : ''}" data-i="${k}">${icon(ic)}${l}</button>`).join('')}</div>
    ${pies(ir, i)}`;
  $$('[data-i]', el).forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.i;
      elegidos = elegidos.includes(k) ? elegidos.filter((x) => x !== k) : [...elegidos, k];
      b.classList.toggle('on', elegidos.includes(k));
    };
  });
  $('[data-next]', el).onclick = () => {
    try { localStorage.setItem('hosannia-intereses', JSON.stringify(elegidos)); } catch (_) {}
    ir(i + 1);
  };
  atar(el, ir, i);
}

/* ---------- 4. hermanos sugeridos ---------- */
async function hermanos(ctx, el, ir, i) {
  el.innerHTML = `${cabecera('Conecta con hermanos', 'Aunque todavía no tengas suscripción, puedes ver lo que comparten.')}
    <div class="ob-lista" id="l"><div class="cx-empty"><span class="spin"></span></div></div>
    ${pies(ir, i, { texto: 'Continuar' })}`;
  atar(el, ir, i);
  let gente = [];
  try { gente = (await ctx.store.searchPeople('')).filter((p) => !p.isMe && !p.iFollow).slice(0, 8); } catch (_) {}
  const box = $('#l', el);
  if (!gente.length) { box.innerHTML = '<p class="muted" style="text-align:center;padding:1.4rem">Todavía no hay a quién sugerir. Pronto habrá más hermanos aquí.</p>'; return; }
  box.innerHTML = gente.map((p) => `<div class="ob-persona" data-u="${esc(p.id)}">
      ${avatar(p)}<div class="tx"><b>${esc(p.name)}</b><small>${esc(p.service || p.church || '')}</small></div>
      <button class="btn btn-ghost btn-sm" data-fw><span>Conectar</span></button></div>`).join('');
  $$('[data-fw]', box).forEach((b) => {
    b.onclick = async () => {
      const id = b.closest('[data-u]').dataset.u;
      try {
        const on = await ctx.store.follow(id);
        $('span', b).textContent = on ? 'Conectados' : 'Conectar';
        b.classList.toggle('btn-fill', false);
      } catch (e) { toast(e.message); }
    };
  });
}

/* ---------- 5. comunidades y grupos ---------- */
async function grupos(ctx, el, ir, i) {
  el.innerHTML = `${cabecera('Sigue comunidades y grupos', 'Los de tu iglesia, tu instrumento o tu ciudad.')}
    <div class="ob-lista" id="l"><div class="cx-empty"><span class="spin"></span></div></div>
    ${pies(ir, i)}`;
  atar(el, ir, i);
  let cs = [], gs = [];
  try {
    [cs, gs] = await Promise.all([
      ctx.store.listGroups({ type: 'community' }).catch(() => []),
      ctx.store.listGroups({ type: 'group' }).catch(() => []),
    ]);
  } catch (_) {}
  const todos = [...cs.slice(0, 4), ...gs.slice(0, 3)].filter((g) => g.myStatus !== 'active');
  const box = $('#l', el);
  if (!todos.length) { box.innerHTML = '<p class="muted" style="text-align:center;padding:1.4rem">Pronto habrá comunidades que sugerirte.</p>'; return; }
  box.innerHTML = todos.map((g) => `<div class="ob-persona" data-g="${esc(g.id)}">
      <span class="gthumb">${g.cover ? `<img src="${esc(g.cover)}" alt="">` : icon(g.isGroup ? 'comment' : 'users')}</span>
      <div class="tx"><b>${esc(g.name)}</b><small>${g.isGroup ? 'Grupo' : 'Comunidad'} · ${g.members} ${g.isGroup ? 'integrantes' : 'seguidores'}</small></div>
      <button class="btn btn-ghost btn-sm" data-join><span>${g.isGroup ? 'Unirme' : 'Seguir'}</span></button></div>`).join('');
  $$('[data-join]', box).forEach((b) => {
    b.onclick = async () => {
      const id = b.closest('[data-g]').dataset.g;
      try { const st = await ctx.store.joinGroup(id); $('span', b).textContent = st === 'active' ? 'Listo' : 'Solicitado'; b.disabled = true; }
      catch (e) { toast(e.message); }
    };
  });
}

/* ---------- 6. el plan ---------- */
async function plan(ctx, el, ir, i) {
  el.innerHTML = `${cabecera('Abre toda la biblioteca', 'La comunidad es gratis para siempre. Las partituras van con suscripción.')}
    <div id="planes"></div>
    <p class="center" style="margin-top:1.2rem"><button class="cx-chip" data-skip>Por ahora seguir gratis →</button></p>`;
  $('[data-skip]', el).onclick = () => terminar(ctx);
  const { renderPlans } = await import('./plans.js');
  await renderPlans(ctx, $('#planes', el), { sinTitulo: true });
}
