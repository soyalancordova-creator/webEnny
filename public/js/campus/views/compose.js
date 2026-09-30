/* ============================================================
   CREAR PUBLICACIÓN · pantalla completa (botón central)
   ------------------------------------------------------------
   Texto, tipo, fotos comprimidas, emojis y ubicación opcional.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, avatar, toast } from '../ui.js';
import { compressImage, kb } from '../media.js';
import { TYPES } from './feed.js';

/* Emojis pensados para esta comunidad, sin buscador que estorbe. */
const EMOJIS = {
  'Fe': ['🙏', '🕊️', '✝️', '🙌', '❤️', '🔥', '✨', '👐', '🤍', '😇', '📖', '⛪'],
  'Música': ['🎻', '🎹', '🎸', '🥁', '🎺', '🎷', '🎤', '🎶', '🎵', '🎼', '🪕', '🔔'],
  'Ánimo': ['😊', '🥹', '😭', '🤗', '💪', '👏', '🌅', '🌻', '⭐', '💫', '🫶', '🤝'],
};

export async function renderCompose(ctx, view, [], opts = {}) {
  ctx.setTitle('Crear publicación');
  const me = ctx.me;
  const volver = () => history.length > 1 ? history.back() : ctx.go('#/comunidad');
  let imgs = [];
  let lugar = '';

  view.innerHTML = `<div class="cmp">
    <header class="cmp-top">
      <button class="cx-iconbtn" id="cx" aria-label="Cerrar">${icon('x')}</button>
      <b>Nueva publicación</b>
      <button class="btn btn-fill btn-sm" id="go" disabled><span>Publicar</span></button>
    </header>

    <div class="cmp-body">
      <div class="cmp-who">${avatar(me)}<div><b>${esc(me.name)}</b><small>${esc(me.service || 'Integrante')}</small></div></div>

      <textarea id="tx" class="cmp-tx" maxlength="3000" placeholder="¿Qué está inspirando tu música hoy?"></textarea>

      <div class="cmp-place" id="placeRow" hidden>${icon('map')}<span id="placeTx"></span>
        <button class="cx-iconbtn sm" id="placeX" aria-label="Quitar ubicación">${icon('x')}</button></div>

      <div class="cmp-prev" id="prev"></div>

      <div class="cmp-emo" id="emo" hidden>
        ${Object.entries(EMOJIS).map(([g, list]) => `<div class="eg"><b>${g}</b><div>${list.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div></div>`).join('')}
      </div>
    </div>

    <footer class="cmp-foot">
      <div class="cmp-tools">
        <label class="cx-iconbtn" title="Fotos" aria-label="Agregar fotos">${icon('image')}
          <input type="file" accept="image/*" multiple hidden id="file"></label>
        <button class="cx-iconbtn" id="emoBtn" title="Emojis" aria-label="Emojis">😊</button>
        <button class="cx-iconbtn" id="placeBtn" title="Ubicación" aria-label="Agregar ubicación">${icon('map')}</button>
        <span class="sp"></span>
        <select id="ty" class="cmp-ty" aria-label="Tipo de publicación">
          ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}
        </select>
      </div>
      <small class="cmp-cnt"><span id="cnt">0</span>/3000</small>
    </footer>
  </div>`;

  const tx = $('#tx', view), go = $('#go', view), prev = $('#prev', view);
  const refresca = () => {
    $('#cnt', view).textContent = tx.value.length;
    go.disabled = !tx.value.trim() && !imgs.length;
  };
  tx.oninput = refresca;
  setTimeout(() => tx.focus(), 60);

  $('#cx', view).onclick = volver;

  /* fotos */
  $('#file', view).onchange = async (e) => {
    const files = [...e.target.files].slice(0, 6 - imgs.length);
    e.target.value = '';
    for (const f of files) {
      try { imgs.push(await compressImage(f, { maxSide: 1600, quality: 0.8 })); }
      catch (err) { toast(err.message); }
    }
    pintaFotos();
  };
  const pintaFotos = () => {
    prev.innerHTML = imgs.map((im, i) => `<div class="pv"><img src="${URL.createObjectURL(im.blob)}" alt="">
      <button class="cx-iconbtn sm" data-rm="${i}" aria-label="Quitar foto">${icon('x')}</button>
      <small>${kb(im.blob.size)}</small></div>`).join('');
    $$('[data-rm]', prev).forEach((b) => { b.onclick = () => { imgs.splice(+b.dataset.rm, 1); pintaFotos(); refresca(); }; });
    refresca();
  };

  /* emojis: se insertan donde está el cursor */
  const emo = $('#emo', view);
  $('#emoBtn', view).onclick = () => { emo.hidden = !emo.hidden; };
  $$('[data-e]', emo).forEach((b) => {
    b.onclick = () => {
      const i = tx.selectionStart ?? tx.value.length;
      tx.value = tx.value.slice(0, i) + b.dataset.e + tx.value.slice(tx.selectionEnd ?? i);
      tx.focus(); tx.selectionStart = tx.selectionEnd = i + b.dataset.e.length;
      refresca();
    };
  });

  /* ubicación: primero intenta el GPS del navegador, si no, se escribe a mano */
  const placeRow = $('#placeRow', view), placeTx = $('#placeTx', view);
  const ponLugar = (v) => { lugar = v || ''; placeTx.textContent = lugar; placeRow.hidden = !lugar; };
  $('#placeX', view).onclick = () => ponLugar('');
  $('#placeBtn', view).onclick = () => {
    const escribe = () => { const v = prompt('¿Dónde estás?', lugar || ''); if (v !== null) ponLugar(v.trim().slice(0, 80)); };
    if (!navigator.geolocation) return escribe();
    toast('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: la, longitude: lo } = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${lo}&zoom=12`, { headers: { 'Accept-Language': 'es' } });
        const d = await r.json();
        const a = d.address || {};
        const nombre = [a.city || a.town || a.village || a.county, a.country].filter(Boolean).join(', ');
        ponLugar(nombre || `${la.toFixed(2)}, ${lo.toFixed(2)}`);
      } catch (_) { escribe(); }
    }, escribe, { timeout: 8000 });
  };

  /* publicar */
  go.onclick = async () => {
    go.disabled = true;
    const cuerpo = lugar ? `${tx.value.trim()}\n\n${icon ? '' : ''}📍 ${lugar}`.trim() : tx.value.trim();
    try {
      const p = await ctx.store.createPost({ body: cuerpo, type: $('#ty', view).value, images: imgs, groupId: opts.groupId || null });
      toast('Publicado. 🙌');
      if (opts.onPosted) opts.onPosted(p);
      ctx.go('#/comunidad');
    } catch (e) { toast(e.message); go.disabled = false; }
  };

  refresca();
}
