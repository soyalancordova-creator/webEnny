/* ============================================================
   HISTORIAS · duran 24 horas
   ------------------------------------------------------------
   Las ven quienes te acompañan. El carrusel vive arriba del inicio
   y el visor abre a pantalla completa, con barras de progreso.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, avatar, ago, toast, modal, confirmBox } from '../ui.js';
import { compressImage, kb } from '../media.js';

/* ---------- carrusel del inicio ---------- */
export async function mountStoryRail(ctx, host) {
  const paint = async () => {
    let groups = [];
    try { groups = await ctx.store.listStories(); } catch (_) { return; }
    const mine = groups.find((g) => g.mine);
    host.innerHTML = `<div class="st-rail">
      <button class="st-item st-new" data-new>
        <span class="st-ring new">${avatar(ctx.me)}<span class="plus">${icon('plus')}</span></span>
        <small>Tu historia</small></button>
      ${groups.filter((g) => !g.mine).map((g) => `<button class="st-item" data-a="${esc(g.author.id)}">
        <span class="st-ring${g.allSeen ? ' seen' : ''}">${avatar(g.author)}</span>
        <small>${esc(g.author.name.split(' ')[0])}</small></button>`).join('')}
    </div>`;
    if (mine) {
      const btn = $('[data-new]', host);
      btn.dataset.a = mine.author.id;
      $('.st-ring', btn).classList.add(mine.allSeen ? 'seen' : 'on');
      $('small', btn).textContent = 'Tu historia';
    }
    $$('.st-item', host).forEach((b) => {
      b.onclick = () => {
        if (b.dataset.new !== undefined && !mine) return openComposer(ctx, paint);
        if (b.dataset.new !== undefined && mine) return openViewer(ctx, groups, groups.indexOf(mine), paint);
        const i = groups.findIndex((g) => g.author.id === b.dataset.a);
        openViewer(ctx, groups, i, paint);
      };
    });
  };
  await paint();
  return paint;
}

/* ---------- publicar ---------- */
export function openComposer(ctx, done) {
  const m = modal({ title: 'Nueva historia', body: `
    <label class="st-drop" id="drop">
      <input type="file" accept="image/*" hidden id="file">
      <div class="ph">${icon('camera')}<b>Elige una foto</b><small>Se comprime sola antes de subir</small></div>
      <img id="prev" hidden alt="">
    </label>
    <textarea id="txt" class="fld" rows="2" maxlength="200" placeholder="Escribe algo (opcional)"></textarea>
    <div class="cx-row" style="justify-content:space-between;align-items:center;margin-top:1rem">
      <small class="muted">Dura 24 horas. La ven quienes te acompañan.</small>
      <button class="btn btn-fill btn-sm" id="pub"><span>Publicar</span></button></div>` });
  let img = null;
  const file = $('#file', m.body);
  $('#drop', m.body).onclick = (e) => { if (e.target !== file) file.click(); };
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      img = await compressImage(f, { maxSide: 1280, quality: 0.82 });
      const p = $('#prev', m.body); p.src = URL.createObjectURL(img.blob); p.hidden = false; $('.ph', m.body).hidden = true;
      toast(`Foto lista (${kb(img.blob.size)}).`);
    } catch (e) { toast(e.message); }
  };
  $('#pub', m.body).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try { await ctx.store.createStory({ image: img, text: $('#txt', m.body).value }); m.close(); toast('Historia publicada.'); if (done) done(); }
    catch (err) { toast(err.message); e.currentTarget.disabled = false; }
  };
}

/* ---------- visor ---------- */
export function openViewer(ctx, groups, start, done) {
  let gi = Math.max(0, start), ii = 0, timer = 0, paused = false;
  const el = document.createElement('div');
  el.className = 'st-viewer';
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';

  const close = () => { clearTimeout(timer); el.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); if (done) done(); };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
  document.addEventListener('keydown', key);

  const next = () => { const g = groups[gi]; if (ii + 1 < g.items.length) { ii++; draw(); } else if (gi + 1 < groups.length) { gi++; ii = 0; draw(); } else close(); };
  const prev = () => { if (ii > 0) { ii--; draw(); } else if (gi > 0) { gi--; ii = groups[gi].items.length - 1; draw(); } };

  const draw = () => {
    const g = groups[gi], it = g.items[ii];
    el.innerHTML = `
      <div class="st-card">
        <div class="st-bars">${g.items.map((_, k) => `<i class="${k < ii ? 'done' : ''}"><b style="${k === ii ? '' : 'width:0'}"></b></i>`).join('')}</div>
        <header>${avatar(g.author, 'sm')}<div><b>${esc(g.author.name)}</b><small>${ago(it.created_at)}</small></div>
          ${it.mine ? `<button class="cx-iconbtn" data-del aria-label="Borrar historia">${icon('trash')}</button>` : ''}
          <button class="cx-iconbtn" data-x aria-label="Cerrar">${icon('x')}</button></header>
        ${it.image ? `<img src="${esc(it.image)}" alt="">` : '<div class="st-plain"></div>'}
        ${it.text ? `<p class="st-text">${esc(it.text)}</p>` : ''}
        ${it.mine ? `<footer>${icon('eye')} ${it.views} ${it.views === 1 ? 'persona la vio' : 'personas la vieron'}</footer>` : ''}
        <button class="st-nav pv" aria-label="Anterior"></button><button class="st-nav nx" aria-label="Siguiente"></button>
      </div>`;
    ctx.store.seeStory(it.id).catch(() => {});
    it.seen = true;
    clearTimeout(timer);
    const bar = $('.st-bars i:nth-child(' + (ii + 1) + ') b', el);
    if (bar) { requestAnimationFrame(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; }); }
    timer = setTimeout(() => { if (!paused) next(); }, 5000);

    $('[data-x]', el).onclick = close;
    const del = $('[data-del]', el);
    if (del) del.onclick = async () => {
      paused = true; clearTimeout(timer);
      if (await confirmBox('¿Borrar esta historia?', 'Borrar')) {
        try { await ctx.store.deleteStory(it.id); toast('Historia borrada.'); close(); } catch (e) { toast(e.message); }
      } else { paused = false; draw(); }
    };
    $('.pv', el).onclick = prev;
    $('.nx', el).onclick = next;
  };
  draw();
}

/* ---------- ruta #/historias ---------- */
export async function renderStories(ctx, view, [authorId]) {
  ctx.setTitle('Historias');
  const groups = await ctx.store.listStories();
  if (!groups.length) {
    view.innerHTML = `<div class="cx-empty">${icon('camera')}<p>Todavía no hay historias. Publica la tuya desde el inicio.</p>
      <a class="btn btn-fill btn-sm" href="#/comunidad" style="margin-top:1rem"><span>Ir al inicio</span></a></div>`;
    return;
  }
  const i = Math.max(0, groups.findIndex((g) => g.author.id === authorId));
  openViewer(ctx, groups, i, () => ctx.go('#/comunidad'));
}
