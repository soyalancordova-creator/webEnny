/* ============================================================
   REPRODUCTOR · lectura interactiva estilo Soundslice
   ------------------------------------------------------------
   Toda la lógica musical vive en score-engine.js. Aquí solo hay
   interfaz: barra de transporte, panel de opciones, atajos y el
   mapa del violín. Cada control del panel hace algo real.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, fmtTime, toast, empty } from '../ui.js';
import { ScoreEngine, noteName } from '../score-engine.js';

const ROOTS = { Do: 0, 'Do♯': 1, Reb: 1, 'Re♭': 1, Re: 2, 'Mi♭': 3, Mib: 3, Mi: 4, Fa: 5, 'Fa♯': 6, Sol: 7, 'La♭': 8, La: 9, 'Si♭': 10, Sib: 10, Si: 11 };
const KEYS = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
function transposedKey(label, semis) {
  if (!label || !semis) return label;
  const m = label.match(/^(Do|Re|Mi|Fa|Sol|La|Si)([♯♭#b]?)\s*(.*)$/); if (!m) return label;
  const root = ROOTS[m[1] + (m[2] === '#' ? '♯' : m[2] === 'b' ? '♭' : m[2])] ?? ROOTS[m[1]];
  return `${KEYS[(root + semis + 120) % 12]} ${m[3]}`.trim();
}

/* Violín: cuerdas Sol3 Re4 La4 Mi5. Se elige la cuerda más grave donde la nota
   cabe en primera posición (hasta 4º dedo = +7 semitonos). */
const STRINGS = [['Sol', 55], ['Re', 62], ['La', 69], ['Mi', 76]];
const FINGER = { 0: '0', 1: '1', 2: '1', 3: '2', 4: '2', 5: '3', 6: '4', 7: '4' };
function violinPos(midi) {
  for (let i = 0; i < STRINGS.length; i++) {
    const d = midi - STRINGS[i][1];
    if (d >= 0 && d <= 7) return { s: i, d, finger: FINGER[d], first: true };
  }
  const top = midi - 76; if (top > 7) return { s: 3, d: top, finger: '—', first: false };
  return null;
}

const INSTR = [['violin', 'Violín'], ['viola', 'Viola'], ['cello', 'Chelo'], ['piano', 'Piano'], ['flute', 'Flauta']];
const INSTR_OF = { 'Violín': 'violin', 'Viola': 'viola', 'Violonchelo': 'cello', 'Piano': 'piano', 'Flauta': 'flute' };

export async function renderPlayer(ctx, view, [id]) {
  let s;
  view.innerHTML = '<div class="pl"><div class="pl-loading"><span><span class="spin"></span>Abriendo partitura…</span></div></div>';
  try { s = await ctx.store.getScore(id); }
  catch (e) {
    if (e.code === 'PAYWALL') {
      view.className = 'cx-view';
      view.innerHTML = `<div class="cx-card cx-pad" style="max-width:560px;margin:3rem auto;text-align:center">${icon('lock')}
        <h2 style="margin:.7rem 0 .5rem;font-size:1.7rem">Esta obra es parte de la suscripción</h2>
        <p class="muted" style="margin-bottom:1.4rem">Con un plan tienes toda la biblioteca: reproducción, loop, velocidad, metrónomo y grabaciones de Enny sincronizadas.</p>
        <div class="cx-row" style="justify-content:center"><a class="btn btn-fill" href="#/planes"><span>Ver planes</span></a><a class="btn btn-ghost" href="#/biblioteca"><span>Volver</span></a></div></div>`;
      return;
    }
    view.className = 'cx-view'; empty(view, 'info', e.message); return;
  }
  ctx.setTitle(s.title);
  const pref = (() => { try { return JSON.parse(localStorage.getItem('enny-player') || '{}'); } catch (_) { return {}; } })();
  const savePref = (k, v) => { pref[k] = v; try { localStorage.setItem('enny-player', JSON.stringify(pref)); } catch (_) {} };

  view.innerHTML = `<div class="pl">
    <header class="pl-head">
      <a class="cx-iconbtn" href="#/biblioteca" aria-label="Volver a la biblioteca">${icon('back')}</a>
      <div class="t"><h1>${esc(s.title)}</h1><p><span>${esc(s.composer)}</span><span>${esc(s.instrument)}</span><span id="kLbl">${esc(s.key_label || '')}</span><span id="bpmLbl">${s.bpm} bpm</span><span>${esc(s.level)}</span></p></div>
      <button class="cx-iconbtn${s.favorite ? ' on' : ''}" id="fav" aria-label="Favorito" style="${s.favorite ? 'color:var(--wine)' : ''}">${icon('heart')}</button>
      <button class="cx-iconbtn" id="pdf" aria-label="Descargar PDF" title="${s.pdf_url ? 'PDF original' : 'Exportar PDF de la vista'}">${icon('pdf')}</button>
      <button class="cx-iconbtn" id="vidT" aria-label="Mostrar video" hidden>${icon('video')}</button>
      <button class="cx-iconbtn" id="setT" aria-label="Opciones de lectura">${icon('sliders')}</button>
    </header>
    <div class="pl-body">
      <div class="pl-stage"><div class="se-host" id="host"></div><div class="pl-count" id="count" hidden><b></b></div><div class="pl-loading" id="ld"><span><span class="spin"></span>Preparando partitura…</span></div></div>
      <div class="pl-media" id="media" hidden><div id="mediaHost"></div><div class="note" id="mediaNote"></div></div>
      <aside class="pl-side" id="side" hidden>
        <div><h4>Vista</h4>
          <div class="opt"><span>Tamaño</span><div class="stepper"><button id="zOut" aria-label="Reducir">${icon('zoomOut')}</button><span id="zLbl">100%</span><button id="zIn" aria-label="Ampliar">${icon('zoomIn')}</button></div></div>
          <div class="opt"><div>Seguir el cursor<small>La partitura se desplaza sola</small></div><span class="sw" data-o="follow" role="switch"></span></div>
          <div class="opt"><div>Resaltar compás<small>Fondo dorado en el compás que suena</small></div><span class="sw" data-o="highlight" role="switch"></span></div>
          <div class="opt"><div>Nombres de notas<small>Do, Re, Mi… bajo cada nota</small></div><span class="sw" data-o="noteNames" role="switch"></span></div>
          <div class="opt"><div>Digitaciones<small>Las que trae la partitura</small></div><span class="sw" data-o="fingerings" role="switch"></span></div>
          <div class="opt"><div>Número en cada compás<small>Si no, solo al inicio de línea</small></div><span class="sw" data-o="allNumbers" role="switch"></span></div>
        </div>
        <div><h4>Práctica</h4>
          <div class="opt"><div>Conteo previo<small>Un compás de clics antes de empezar</small></div><span class="sw" data-o="countIn" role="switch"></span></div>
          <div class="opt"><div>Entrenador de velocidad<small>En loop: +5% en cada vuelta hasta 100%</small></div><span class="sw" data-o="trainer" role="switch"></span></div>
        </div>
        <div><h4>Sonido</h4>
          <div class="seg" id="inst">${INSTR.map(([k, l]) => `<button data-i="${k}">${l}</button>`).join('')}</div>
          <div class="opt"><span>${icon('volume')}</span><input type="range" id="vol" min="0" max="1" step="0.05" style="flex:1;accent-color:var(--wine)"></div>
        </div>
        <div><h4>Transposición</h4>
          <div class="opt"><span id="trLbl">Original</span><div class="stepper"><button id="trD" aria-label="Bajar medio tono">−</button><span id="trN">0</span><button id="trU" aria-label="Subir medio tono">+</button></div></div>
        </div>
        <div><h4>Mapa del violín</h4><div class="vmap" id="vmap"></div></div>
        <div><h4>Atajos</h4><p class="muted" style="font-size:.8rem;line-height:1.8">Espacio: tocar/pausar · ← →: compás anterior/siguiente · L: repetir compás · M: metrónomo · + −: velocidad · Inicio: volver al principio</p></div>
      </aside>
    </div>
    <div class="tp">
      <button class="tp-play" id="play" aria-label="Reproducir">${icon('play')}</button>
      <button class="tp-b" id="rst" aria-label="Volver al inicio">${icon('restart')}</button>
      <div class="tp-time"><b id="tNow">0:00</b> / <span id="tTot">0:00</span><br><small id="mLbl" style="font-size:.7rem;color:var(--ink-3)">Compás 1</small></div>
      <div class="tp-bar" id="bar"><div class="rail"></div><div class="lp" id="barLoop" hidden></div><div class="fill" id="barFill"></div><div class="knob" id="knob"></div></div>
      <button class="tp-b" id="loopB" title="Repetir: arrastra sobre los compases, o pulsa para repetir el compás actual">${icon('loop')}<span class="opt-hide" id="loopL">Repetir</span></button>
      <button class="tp-b" id="metB" title="Metrónomo">${icon('metronome')}<span class="opt-hide">Metrónomo</span></button>
      <div class="sep opt-hide"></div>
      <div class="tp-speed" title="Velocidad (no cambia el tono)">${icon('gauge')}<input type="range" id="spd" min="25" max="150" step="5" value="100" aria-label="Velocidad"><b id="spdL">100%</b></div>
      <div class="seg opt-hide" id="src" hidden style="min-width:190px"><button data-s="synth" class="on">Sintetizador</button><button data-s="media">Grabación</button></div>
    </div>
  </div>`;

  const eng = new ScoreEngine({ host: $('#host', view), mediaHost: $('#mediaHost', view), onState: paint });
  window.__eng = eng;  // útil para depurar desde la consola
  const opt = { follow: pref.follow ?? true, highlight: pref.highlight ?? true, noteNames: pref.noteNames ?? false, fingerings: pref.fingerings ?? true, allNumbers: false, countIn: pref.countIn ?? false, trainer: false };
  Object.assign(eng.opt, { follow: opt.follow, highlight: opt.highlight, noteNames: opt.noteNames, fingerings: opt.fingerings, countIn: opt.countIn, volume: pref.volume ?? 0.8 });
  eng.opt.instrument = INSTR_OF[s.instrument] || 'violin'; eng.synth.instrument = eng.opt.instrument; eng.synth.volume = eng.opt.volume;
  if (innerWidth < 700) eng.opt.zoom = 0.85;

  let lastT = 0;
  function paint(st) {
    $('#play', view).innerHTML = icon(st.playing ? 'pause' : 'play');
    $('#play', view).setAttribute('aria-label', st.playing ? 'Pausar' : 'Reproducir');
    $('#tNow', view).textContent = fmtTime(st.time); $('#tTot', view).textContent = fmtTime(st.total);
    $('#mLbl', view).textContent = `${st.measure === 0 ? `Anacrusa · ${st.measures - 1} compases` : `Compás ${st.measure} de ${st.measures}`}${st.loop ? ` · repitiendo ${st.loop.a}–${st.loop.b}` : ''}`;
    const pct = st.total ? (st.time / st.total) * 100 : 0;
    $('#barFill', view).style.width = `${pct}%`; $('#knob', view).style.left = `${pct}%`;
    const lp = $('#barLoop', view);
    if (eng.loop && st.total) { lp.hidden = false; lp.style.left = `${(eng.loop.from / st.total) * 100}%`; lp.style.width = `${((eng.loop.to - eng.loop.from) / st.total) * 100}%`; } else lp.hidden = true;
    $('#loopB', view).classList.toggle('on', !!eng.loop);
    $('#loopL', view).textContent = eng.loop ? `${st.loop.a}–${st.loop.b}` : 'Repetir';
    $('#metB', view).classList.toggle('on', eng.opt.metronome);
    $('#spd', view).value = Math.round(st.speed * 100); $('#spdL', view).textContent = `${Math.round(st.speed * 100)}%`;
    const c = $('#count', view); c.hidden = !st.countIn; if (st.countIn) $('b', c).textContent = st.countIn;
    // entrenador: al dar la vuelta el loop, sube la velocidad
    if (opt.trainer && eng.loop && st.playing && st.time < lastT - 0.3 && st.speed < 1) { eng.setSpeed(Math.min(1, +(st.speed + 0.05).toFixed(2))); toast(`Vuelta completa · velocidad ${Math.round(Math.min(1, st.speed + 0.05) * 100)}%`); }
    lastT = st.time;
    paintViolin(st.notes);
    if (st.ended) toast('¡Terminaste la obra! 🙌');
  }

  function paintViolin(notes) {
    const box = $('#vmap', view);
    const midi = notes && notes.length ? Math.max(...notes) : null;
    const pos = midi != null ? violinPos(midi) : null;
    const x = pos ? Math.min(96, 6 + ((1 - Math.pow(2, -pos.d / 12)) / (1 - Math.pow(2, -12 / 12))) * 88) : 0;
    box.innerHTML = STRINGS.map(([n], i) => `<div class="str" data-n="${n}">${pos && pos.s === i ? `<span class="pt" style="left:${x}%">${pos.finger}</span>` : ''}</div>`).reverse().join('') +
      `<div class="lbl"><span>${midi != null ? `Nota <b>${noteName(midi)}</b>` : 'Toca para ver la posición'}</span><span>${pos ? `Cuerda ${STRINGS[pos.s][0]} · ${pos.first ? `dedo ${pos.finger}` : 'posición alta'}` : ''}</span></div>`;
  }

  // ---------- carga ----------
  try {
    const info = await eng.load(s.xml);
    $('#ld', view).remove();
    if (!s.bpm && info.tempo) $('#bpmLbl', view).textContent = `${info.tempo} bpm`;
  } catch (e) { $('#ld', view).innerHTML = `<span>${esc(e.message || 'No se pudo abrir la partitura.')}</span>`; return; }
  paintViolin([]);

  if (s.media_url) {
    $('#vidT', view).hidden = false;
    const mediaEl = $('#media', view); mediaEl.hidden = false;
    try {
      await eng.setMedia({ url: s.media_url, sync: s.sync });
      $('#mediaNote', view).textContent = eng.hasSync ? 'Grabación sincronizada con la partitura. Elige "Grabación" abajo para seguirla.' : 'Esta grabación aún no está sincronizada con los compases.';
      if (eng.hasSync) { $('#src', view).hidden = false; }
    } catch (e) { $('#mediaNote', view).textContent = 'No se pudo cargar la grabación.'; }
    $('#vidT', view).onclick = () => { mediaEl.hidden = !mediaEl.hidden; };
  }

  // ---------- controles ----------
  $('#play', view).onclick = () => eng.toggle();
  $('#rst', view).onclick = () => { eng.stop(); eng.seek(eng.loop ? eng.loop.from : 0); };
  $('#metB', view).onclick = () => { eng.setOption('metronome', !eng.opt.metronome); };
  $('#loopB', view).onclick = () => {
    if (eng.loop) { eng.setLoop(null); toast('Repetición desactivada.'); return; }
    const m = eng.state().measureIndex; eng.setLoop(m, m);
    toast('Repitiendo este compás. Arrastra sobre la partitura para elegir un tramo.');
  };
  $('#spd', view).oninput = (e) => eng.setSpeed(+e.target.value / 100);
  const bar = $('#bar', view);
  const seekBar = (e) => { const r = bar.getBoundingClientRect(); eng.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * eng.total); };
  bar.addEventListener('pointerdown', (e) => { bar.setPointerCapture(e.pointerId); seekBar(e); const mv = (ev) => seekBar(ev); bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', () => bar.removeEventListener('pointermove', mv), { once: true }); });

  $$('#src [data-s]', view).forEach((b) => { b.onclick = async () => { await eng.useSource(b.dataset.s); $$('#src [data-s]', view).forEach((x) => x.classList.toggle('on', x.dataset.s === eng.source)); toast(eng.source === 'media' ? 'Siguiendo la grabación de Enny.' : 'Usando el sintetizador.'); }; });

  // panel
  const side = $('#side', view);
  $('#setT', view).onclick = () => { side.hidden = !side.hidden; savePref('side', !side.hidden); };
  side.hidden = pref.side === false ? true : innerWidth < 1180 ? true : !(pref.side ?? true);
  $$('.sw[data-o]', side).forEach((sw) => {
    const k = sw.dataset.o; sw.classList.toggle('on', !!opt[k]); sw.setAttribute('aria-checked', !!opt[k]);
    sw.onclick = async () => {
      opt[k] = !opt[k]; sw.classList.toggle('on', opt[k]); sw.setAttribute('aria-checked', opt[k]);
      if (k !== 'trainer') await eng.setOption(k, opt[k]);
      if (['follow', 'highlight', 'noteNames', 'fingerings', 'countIn'].includes(k)) savePref(k, opt[k]);
      if (k === 'trainer' && opt[k]) { if (!eng.loop) toast('Primero arrastra sobre los compases que quieres repetir.'); if (eng.opt.speed >= 1) eng.setSpeed(0.6); }
    };
  });
  const paintInst = () => $$('#inst [data-i]', side).forEach((b) => b.classList.toggle('on', b.dataset.i === eng.opt.instrument));
  $$('#inst [data-i]', side).forEach((b) => { b.onclick = () => { eng.setOption('instrument', b.dataset.i); paintInst(); }; });
  paintInst();
  $('#vol', side).value = eng.opt.volume; $('#vol', side).oninput = (e) => { eng.setOption('volume', +e.target.value); savePref('volume', +e.target.value); };
  const zl = () => { $('#zLbl', side).textContent = `${Math.round(eng.opt.zoom * 100)}%`; };
  $('#zIn', side).onclick = async () => { await eng.setZoom(eng.opt.zoom + 0.1); zl(); };
  $('#zOut', side).onclick = async () => { await eng.setZoom(eng.opt.zoom - 0.1); zl(); };
  zl();
  let tr = 0;
  const trPaint = () => { $('#trN', side).textContent = tr > 0 ? `+${tr}` : tr; $('#trLbl', side).textContent = tr ? transposedKey(s.key_label, tr) || `${tr > 0 ? '+' : ''}${tr} semitonos` : 'Original'; $('#kLbl', view).textContent = transposedKey(s.key_label, tr) || ''; };
  const trSet = async (v) => { tr = Math.max(-6, Math.min(6, v)); trPaint(); await eng.setTranspose(tr); };
  $('#trU', side).onclick = () => trSet(tr + 1); $('#trD', side).onclick = () => trSet(tr - 1);
  trPaint();

  $('#fav', view).onclick = async (e) => { try { const on = await ctx.store.toggleFavorite(s.id); e.currentTarget.style.color = on ? 'var(--wine)' : ''; toast(on ? 'Agregada a favoritos.' : 'Quitada de favoritos.'); } catch (err) { toast(err.message); } };
  $('#pdf', view).onclick = async () => {
    if (s.pdf_url) { const a = document.createElement('a'); a.href = s.pdf_url; a.target = '_blank'; a.rel = 'noopener'; a.click(); return; }
    toast('Generando PDF…'); try { await eng.exportPdf(s.title); } catch (e) { toast('No se pudo generar el PDF.'); }
  };

  // atajos de teclado
  const onKey = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const st = eng.state();
    if (e.code === 'Space') { e.preventDefault(); eng.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); eng.seekMeasure(Math.min(st.measures - 1, st.measureIndex + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); eng.seekMeasure(Math.max(0, st.measureIndex - (eng.time() - (eng.passes[eng._stepAt(eng.time()).pass] || {}).t > 0.4 ? 0 : 1))); }
    else if (e.key.toLowerCase() === 'l') $('#loopB', view).click();
    else if (e.key.toLowerCase() === 'm') $('#metB', view).click();
    else if (e.key === '+' || e.key === '=') eng.setSpeed(eng.opt.speed + 0.05);
    else if (e.key === '-') eng.setSpeed(eng.opt.speed - 0.05);
    else if (e.key === 'Home') { eng.stop(); }
  };
  document.addEventListener('keydown', onKey);

  return () => { document.removeEventListener('keydown', onKey); eng.destroy(); delete window.__eng; };
}
