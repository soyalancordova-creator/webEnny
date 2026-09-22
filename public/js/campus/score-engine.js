/* ============================================================
   SCORE ENGINE · lector de partituras estilo Soundslice
   ------------------------------------------------------------
   Una sola fuente de verdad: el iterador de OSMD. De ahí salen
   el audio, el cursor, los compases y el metrónomo, así nunca se
   desincronizan (el motor anterior tenía un parser propio para el
   audio y otro —OSMD— para el dibujo, y divergían con acordes,
   varias voces, <backup>, ligaduras y repeticiones).

   Verificado contra OSMD 2.1.3:
   - iterator.currentTimeStamp.RealValue vuelve a 0 en cada
     repetición → el tiempo de reproducción se acumula aquí.
   - note.halfTone = MIDI − 12.
   - Posición en px = unidades OSMD × 10 × zoom (centro de la nota).
   - GraphicalMeasure.PositionAndShape da la caja real del compás;
     ParentMusicSystem da el alto que cubre todos los pentagramas.

   El reloj es el de Web Audio (no requestAnimationFrame): las notas
   se programan con lookahead, y el cursor solo lee ese reloj.
============================================================ */

const OSMD_URL = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@2.1.3/build/opensheetmusicdisplay.min.js';
const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const LOOKAHEAD = 0.14;      // s de audio que se programan por adelantado
const TICK_MS = 25;          // cada cuánto corre el programador

let osmdLoading = null;
export function loadOSMD() {
  if (window.opensheetmusicdisplay) return Promise.resolve(window.opensheetmusicdisplay);
  if (osmdLoading) return osmdLoading;
  osmdLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = OSMD_URL; s.async = true;
    s.onload = () => resolve(window.opensheetmusicdisplay);
    s.onerror = () => { osmdLoading = null; reject(new Error('No se pudo cargar el lector de partituras.')); };
    document.head.appendChild(s);
  });
  return osmdLoading;
}

export function noteName(midi) { return NOTE_NAMES[((midi % 12) + 12) % 12]; }

/* ============================================================
   SINTETIZADOR
============================================================ */
class Synth {
  constructor() { this.ctx = null; this.out = null; this.voices = new Set(); this.instrument = 'violin'; this.volume = 0.8; }

  async ensure() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) throw new Error('Este navegador no permite audio.');
      const ctx = new C({ latencyHint: 'interactive' });
      const master = ctx.createGain(); master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      // reverb corta generada, para que no suene "seco" de sintetizador
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      conv.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.14;
      master.connect(comp); master.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(ctx.destination);
      this.ctx = ctx; this.out = master;
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) { this.volume = v; if (this.out) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }

  /** Programa una nota en `at` (tiempo del AudioContext). */
  note(midi, at, dur, vel = 0.7, art = null) {
    const ctx = this.ctx; if (!ctx) return;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const inst = this.instrument;
    if (art === 'staccato') dur *= 0.45;
    if (art === 'tenuto') dur *= 1.05;
    if (art === 'accent') vel *= 1.25;
    dur = Math.max(0.06, dur);
    const g = ctx.createGain(); g.gain.value = 0;
    const nodes = [];
    const end = at + dur;

    if (inst === 'piano') {
      const peak = vel * 0.32;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.006);
      g.gain.setTargetAtTime(peak * 0.35, at + 0.01, 0.35);
      g.gain.setTargetAtTime(0, end, 0.12);
      [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.1]].forEach(([type, mult, lvl]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
        const og = ctx.createGain(); og.gain.value = lvl; o.connect(og).connect(g); o.start(at); o.stop(end + 0.8); nodes.push(o);
      });
    } else if (inst === 'flute') {
      const peak = vel * 0.26;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.05);
      g.gain.setValueAtTime(peak, end - 0.02); g.gain.setTargetAtTime(0, end, 0.06);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      this._vibrato(o, at, dur, 9);
      o.connect(g); o.start(at); o.stop(end + 0.4); nodes.push(o);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.08; o2.connect(g2).connect(g); o2.start(at); o2.stop(end + 0.4); nodes.push(o2);
    } else {
      // cuerdas frotadas: dos dientes de sierra desafinados + filtro + resonancia de caja
      const cello = inst === 'cello', viola = inst === 'viola';
      const peak = vel * (cello ? 0.2 : 0.16);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.045);          // ataque del arco
      g.gain.setTargetAtTime(peak * 0.82, at + 0.05, 0.12);
      g.gain.setValueAtTime(peak * 0.82, Math.max(at + 0.06, end - 0.03));
      g.gain.setTargetAtTime(0, end, 0.07);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cello ? 1900 : viola ? 2600 : 3400; lp.Q.value = 0.6;
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = cello ? 700 : 2600; body.gain.value = 4; body.Q.value = 1.2;
      lp.connect(body).connect(g);
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        if (dur > 0.25) this._vibrato(o, at, dur, 11);
        o.connect(lp); o.start(at); o.stop(end + 0.4); nodes.push(o);
      });
    }
    g.connect(this.out);
    const voice = { g, nodes, end: end + 0.8 };
    this.voices.add(voice);
    nodes[0].onended = () => this.voices.delete(voice);
  }

  /** Vibrato que entra tarde, como lo hace un violinista, no desde el ataque. */
  _vibrato(osc, at, dur, cents) {
    const ctx = this.ctx;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.4;
    const depth = ctx.createGain(); depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(0, at + 0.18);
    depth.gain.linearRampToValueAtTime(cents, at + Math.min(dur, 0.5));
    lfo.connect(depth).connect(osc.detune); lfo.start(at); lfo.stop(at + dur + 0.4);
  }

  click(at, strong) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = strong ? 1580 : 1050;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(strong ? 0.5 : 0.32, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g).connect(this.out); o.start(at); o.stop(at + 0.06);
  }

  /** Corta todo lo que suena o está programado (pausa, salto, loop). */
  hush() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.voices.forEach((v) => {
      try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.015); v.nodes.forEach((n) => n.stop(t + 0.08)); } catch (_) {}
    });
    this.voices.clear();
  }
}

/* ============================================================
   FUENTES DE MEDIOS (grabación real sincronizada)
============================================================ */
class FileMedia {
  constructor(url, host) {
    const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
    this.el = document.createElement(isVideo ? 'video' : 'audio');
    this.el.src = url; this.el.preload = 'auto'; this.el.playsInline = true; this.el.controls = false;
    this.el.preservesPitch = true; this.el.mozPreservesPitch = true; this.el.webkitPreservesPitch = true;
    this.isVideo = isVideo;
    if (host && isVideo) host.appendChild(this.el);
  }
  ready() { return new Promise((res) => { if (this.el.readyState >= 1) res(); else this.el.addEventListener('loadedmetadata', () => res(), { once: true }); }); }
  play() { return this.el.play(); }
  pause() { this.el.pause(); }
  get time() { return this.el.currentTime; }
  set time(t) { this.el.currentTime = Math.max(0, t); }
  get duration() { return this.el.duration || 0; }
  get playing() { return !this.el.paused; }
  setRate(r) { this.el.playbackRate = r; }
  setVolume(v) { this.el.volume = v; }
  destroy() { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el.remove(); }
}

let ytApi = null;
function loadYouTube() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return ytApi;
}
export function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : null);
}

class YouTubeMedia {
  constructor(url, host) {
    this.id = youtubeId(url); this.host = host; this.player = null;
    this._t = 0; this._at = performance.now(); this._rate = 1; this._playing = false;
    this.isVideo = true;
  }
  async ready() {
    const YT = await loadYouTube();
    const div = document.createElement('div'); this.host.appendChild(div);
    await new Promise((res) => {
      this.player = new YT.Player(div, {
        videoId: this.id, host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1 },
        events: {
          onReady: () => res(),
          onStateChange: (e) => { this._playing = e.data === 1; this._sync(); },
          onPlaybackRateChange: (e) => { this._rate = e.data; this._sync(); },
        },
      });
    });
  }
  /** getCurrentTime() de YouTube se actualiza a saltos: se interpola con el reloj local. */
  _sync() { if (this.player && this.player.getCurrentTime) { this._t = this.player.getCurrentTime(); this._at = performance.now(); } }
  play() { this.player.playVideo(); }
  pause() { this.player.pauseVideo(); this._sync(); }
  get time() {
    if (!this.player || !this.player.getCurrentTime) return 0;
    const real = this.player.getCurrentTime();
    if (real !== this._t) { this._t = real; this._at = performance.now(); }
    return this._playing ? this._t + (performance.now() - this._at) / 1000 * this._rate : this._t;
  }
  set time(t) { this.player.seekTo(Math.max(0, t), true); this._t = t; this._at = performance.now(); }
  get duration() { return this.player && this.player.getDuration ? this.player.getDuration() : 0; }
  get playing() { return this._playing; }
  setRate(r) { this.player.setPlaybackRate(r); this._rate = r; }
  setVolume(v) { this.player.setVolume(Math.round(v * 100)); }
  destroy() { try { this.player.destroy(); } catch (_) {} }
}

/* ============================================================
   MOTOR
============================================================ */
export class ScoreEngine {
  /**
   * @param {object} o
   * @param {HTMLElement} o.host          contenedor donde se monta el área de partitura
   * @param {HTMLElement} [o.mediaHost]   contenedor para el video sincronizado
   * @param {(s:object)=>void} [o.onState]
   */
  constructor({ host, mediaHost, onState }) {
    this.host = host; this.mediaHost = mediaHost; this.onState = onState || (() => {});
    this.synth = new Synth();
    this.osmd = null; this.OS = null;
    this.steps = []; this.measures = []; this.passes = []; this.beats = []; this.systems = [];
    this.total = 0;
    this.opt = { zoom: 1, transpose: 0, speed: 1, metronome: false, countIn: false, follow: true,
      highlight: true, noteNames: false, fingerings: true, allNumbers: false, instrument: 'violin', volume: 0.8 };
    this.loop = null;            // { a, b, from, to } en índices de compás y segundos
    this.playing = false; this.pausedAt = 0;
    this.anchorCtx = 0; this.anchorSong = 0; this.scheduledTo = 0; this.nextStep = 0; this.nextBeat = 0;
    this.timer = 0; this.raf = 0; this.countingIn = 0;
    this.source = 'synth'; this.media = null; this.sync = null; // sync: [{t}] por pase de compás
    this._build();
  }

  /* ---------- DOM ---------- */
  _build() {
    this.host.innerHTML = '';
    this.scroll = document.createElement('div'); this.scroll.className = 'se-scroll';
    this.paper = document.createElement('div'); this.paper.className = 'se-paper';
    this.osmdDiv = document.createElement('div'); this.osmdDiv.className = 'se-osmd';
    this.layer = document.createElement('div'); this.layer.className = 'se-layer';
    this.hl = document.createElement('div'); this.hl.className = 'se-measure';
    this.loopBand = document.createElement('div'); this.loopBand.className = 'se-loop';
    this.cursor = document.createElement('div'); this.cursor.className = 'se-cursor';
    this.names = document.createElement('div'); this.names.className = 'se-names';
    this.hover = document.createElement('div'); this.hover.className = 'se-hover';
    this.layer.append(this.loopBand, this.hl, this.hover, this.names, this.cursor);
    this.paper.append(this.osmdDiv, this.layer);
    this.scroll.append(this.paper);
    this.host.append(this.scroll);
    this._bindPointer();
    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(this.scroll);
  }

  _onResize() {
    if (!this.osmd || !this.scroll.clientWidth) return;
    const w = this.scroll.clientWidth;
    if (Math.abs(w - (this._lastW || 0)) < 24) return;   // ignora cambios mínimos (barras de scroll)
    this._lastW = w;
    clearTimeout(this._rt);
    this._rt = setTimeout(() => this._rerender(), 140);
  }

  /* ---------- carga ---------- */
  async load(xml) {
    this.stop();
    const OS = this.OS = await loadOSMD();
    this.osmdDiv.innerHTML = '';
    this.osmd = new OS.OpenSheetMusicDisplay(this.osmdDiv, {
      backend: 'svg', autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: false,
      drawLyricist: false, drawPartNames: true, drawCredits: false, drawingParameters: 'default',
      drawFingerings: this.opt.fingerings, drawMeasureNumbers: true,
      // el cursor de OSMD queda oculto; solo se usa su iterador (con disableCursor no existe)
      followCursor: false, disableCursor: false, autoBeam: true,
    });
    await this.osmd.load(xml);
    this.osmd.TransposeCalculator = new OS.TransposeCalculator();
    this.osmd.Sheet.Transpose = this.opt.transpose;
    this._lastW = this.scroll.clientWidth;
    this._render();
    this._buildTimeline();
    this._layout();
    this.pausedAt = 0; this._paint(0);
    this._emit({ loaded: true });
    return this.info();
  }

  info() {
    const sheet = this.osmd && this.osmd.Sheet;
    const firstTempo = this.measures[0] ? this.measures[0].tempo : 90;
    const ts = this.measures[0] ? this.measures[0].sig : [4, 4];
    return { measures: this.measures.length, total: this.total, tempo: firstTempo, timeSig: ts,
      title: sheet && sheet.TitleString, composer: sheet && sheet.ComposerString,
      parts: sheet ? sheet.Instruments.map((i) => i.Name) : [] };
  }

  /** Compases por línea según el ancho real: lectura espaciada y predecible, como un atril. */
  _perLine() {
    const w = (this.scroll.clientWidth || 1000) / this.opt.zoom;
    return w >= 1040 ? 4 : w >= 700 ? 3 : 2;
  }

  _render() {
    const r = this.osmd.EngravingRules;
    // números solo al inicio de cada línea: en cada compás se confunden con las digitaciones
    r.RenderMeasureNumbersOnlyAtSystemStart = !this.opt.allNumbers;
    r.RenderXMeasuresPerLineAkaSystem = this._perLine();
    this.osmd.zoom = this.opt.zoom;
    this.osmd.render();
  }

  async _rerender() {
    if (!this.osmd) return;
    const t = this.time();
    this.osmd.setOptions({ drawFingerings: this.opt.fingerings });
    this._render();
    this._layout();
    this._paint(t);
  }

  /* ---------- línea de tiempo desde el iterador de OSMD ---------- */
  _buildTimeline() {
    const OS = this.OS, sheet = this.osmd.Sheet;
    const A = OS.ArticulationEnum || {};
    const artName = (a) => { const e = a && (a.articulationEnum ?? a); return A[e] || ''; };

    this.measures = sheet.SourceMeasures.map((m, i) => ({
      index: i, number: m.MeasureNumber, tempo: m.TempoInBPM || 90,
      sig: m.ActiveTimeSignature ? [m.ActiveTimeSignature.Numerator, m.ActiveTimeSignature.Denominator] : [4, 4],
      start: m.AbsoluteTimestamp.RealValue, len: m.Duration.RealValue, implicit: !!m.ImplicitMeasure,
      firstPass: -1, geom: null,
    }));

    const it = this.osmd.cursor.Iterator;
    const raw = [];
    let guard = 0;
    while (!it.EndReached && guard++ < 200000) {
      const mi = it.CurrentMeasureIndex;
      const ts = it.currentTimeStamp.RealValue;
      const notes = []; let ref = null; let art = null;
      (it.CurrentVoiceEntries || []).forEach((ve) => {
        if (ve.isGrace) return;
        (ve.articulations || []).forEach((a) => { const n = artName(a); if (/staccat|spiccato/.test(n)) art = 'staccato'; else if (/accent|marcato/.test(n)) art = art || 'accent'; else if (n === 'tenuto') art = art || 'tenuto'; });
        ve.Notes.forEach((n) => {
          if (!ref) ref = n;
          if (n.isRest()) return;
          const tie = n.NoteTie;
          if (tie && tie.StartNote !== n) return;          // continuación de ligadura: no se vuelve a atacar
          const len = tie && tie.Duration ? tie.Duration.RealValue : n.Length.RealValue;
          notes.push({ midi: n.halfTone + 12, len });
        });
      });
      raw.push({ mi, ts, notes, ref, art });
      it.moveToNext();
    }

    // duración de cada paso y tiempo acumulado (las repeticiones reinician el timestamp)
    const steps = []; let clock = 0;
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i], m = this.measures[s.mi], n = raw[i + 1];
      const mEnd = m.start + m.len;
      let whole = n && n.ts > s.ts && n.ts <= mEnd + 1e-9 ? n.ts - s.ts : mEnd - s.ts;
      if (n && n.ts > s.ts && n.mi !== s.mi && n.ts > mEnd) whole = mEnd - s.ts;
      if (whole <= 0) whole = 1 / 16;
      const secPerWhole = 240 / m.tempo;                     // TempoInBPM es en negras
      steps.push({ i, m: s.mi, ts: s.ts, t: clock, d: whole * secPerWhole, ref: s.ref, art: s.art,
        notes: s.notes.map((x) => ({ midi: x.midi, d: x.len * secPerWhole })), x: 0, sys: 0, pass: 0 });
      clock += whole * secPerWhole;
    }
    this.steps = steps;
    this.total = clock;

    // pases de compás (un compás repetido aparece dos veces en la reproducción)
    this.passes = [];
    steps.forEach((s, i) => {
      const prev = steps[i - 1];
      if (!prev || prev.m !== s.m || s.ts < prev.ts) {
        const m = this.measures[s.m];
        this.passes.push({ m: s.m, t: s.t - (s.ts - m.start) * 240 / m.tempo, first: i });
      }
      s.pass = this.passes.length - 1;
    });
    this.passes.forEach((p, k) => {
      const next = this.passes[k + 1];
      p.end = next ? next.t : this.total;
      if (this.measures[p.m].firstPass < 0) this.measures[p.m].firstPass = k;
    });

    // pulsos del metrónomo, por pase
    this.beats = [];
    this.passes.forEach((p) => {
      const m = this.measures[p.m];
      const beatWhole = 1 / m.sig[1];
      const beatSec = beatWhole * 240 / m.tempo;
      const count = Math.max(1, Math.round((p.end - p.t) / beatSec));
      const offset = m.implicit ? m.sig[0] - count : 0;        // anacrusa: los pulsos que faltan van al inicio
      for (let b = 0; b < count; b++) this.beats.push({ t: p.t + b * beatSec, strong: (b + offset) % m.sig[0] === 0 });
    });
  }

  /* ---------- geometría (después de cada render) ---------- */
  /** Origen del SVG dentro del papel. Los <svg> no tienen offsetLeft/Top: se mide con rects. */
  _origin() {
    const svg = this.osmdDiv.querySelector('svg');
    if (!svg) return { ox: 0, oy: 0 };
    const p = this.paper.getBoundingClientRect(), s = svg.getBoundingClientRect();
    return { ox: s.left - p.left, oy: s.top - p.top };
  }

  _layout() {
    const osmd = this.osmd; if (!osmd || !osmd.GraphicSheet) return;
    const u = 10 * osmd.zoom;
    const { ox, oy } = this._origin();
    const sysIndex = new Map();
    this.systems = [];
    osmd.GraphicSheet.MeasureList.forEach((row, i) => {
      const gms = (row || []).filter(Boolean);
      if (!gms.length || !this.measures[i]) return;
      const gm = gms[0];
      const sys = gm.ParentMusicSystem;
      if (!sysIndex.has(sys)) {
        const sp = sys.PositionAndShape;
        sysIndex.set(sys, this.systems.length);
        this.systems.push({ y: oy + sp.AbsolutePosition.y * u - 18, h: sp.Size.height * u + 36, first: i, last: i });
      }
      const si = sysIndex.get(sys);
      this.systems[si].last = i;
      const p = gm.PositionAndShape;
      this.measures[i].geom = { x: ox + p.AbsolutePosition.x * u, w: p.Size.width * u, sys: si };
    });
    const rules = osmd.EngravingRules;
    this.steps.forEach((s) => {
      const g = this.measures[s.m].geom;
      s.sys = g ? g.sys : 0;
      let x = g ? g.x + 8 : 0;
      if (s.ref) {
        const gn = rules.GNote(s.ref);
        const se = gn && gn.parentVoiceEntry && gn.parentVoiceEntry.parentStaffEntry;
        if (se) x = ox + se.PositionAndShape.AbsolutePosition.x * u;
      }
      s.x = x;
    });
    this._drawNames();
    this._drawLoop();
  }

  _drawNames() {
    this.names.innerHTML = '';
    if (!this.opt.noteNames || !this.osmd) return;
    const u = 10 * this.osmd.zoom, rules = this.osmd.EngravingRules;
    const { oy } = this._origin();
    const seen = new Set(); const frag = document.createDocumentFragment();
    this.steps.forEach((s) => {
      if (seen.has(s.ref) || !s.ref || !s.notes.length) return; seen.add(s.ref);
      const gn = rules.GNote(s.ref); if (!gn) return;
      const staffLine = gn.parentVoiceEntry.parentStaffEntry.parentMeasure;
      const bottom = staffLine && staffLine.PositionAndShape ? staffLine.PositionAndShape.AbsolutePosition.y + 4 : null;
      const el = document.createElement('span');
      el.textContent = noteName(s.notes[0].midi + this.opt.transpose);
      el.style.left = `${s.x}px`;
      el.style.top = `${oy + (bottom !== null ? bottom + 2.2 : gn.PositionAndShape.AbsolutePosition.y + 3) * u}px`;
      frag.appendChild(el);
    });
    this.names.appendChild(frag);
  }

  /* ---------- transporte ---------- */
  time() {
    if (this.source === 'media' && this.media) return this._mediaToScore(this.media.time);
    if (!this.playing) return this.pausedAt;
    const ctx = this.synth.ctx;
    return Math.max(0, this.anchorSong + (ctx.currentTime - this.anchorCtx) * this.opt.speed);
  }

  _songToCtx(t) { return this.anchorCtx + (t - this.anchorSong) / this.opt.speed; }

  async play() {
    if (!this.steps.length || this.playing) return;
    let from = this.pausedAt >= this.total - 0.01 ? (this.loop ? this.loop.from : 0) : this.pausedAt;
    if (this.loop && (from < this.loop.from || from >= this.loop.to)) from = this.loop.from;

    if (this.source === 'media' && this.media) {
      this.media.time = this._scoreToMedia(from);
      this.media.setRate(this.opt.speed);
      await this.media.play();
      this.playing = true;
      this._startRaf(); this._emit();
      return;
    }

    const ctx = await this.synth.ensure();
    this.synth.hush();
    let lead = 0.06;
    if (this.opt.countIn) {
      const m = this.measures[this._stepAt(from).m] || this.measures[0];
      const beatSec = (240 / m.tempo) / m.sig[1] / this.opt.speed;
      const n = m.sig[0];
      for (let b = 0; b < n; b++) this.synth.click(ctx.currentTime + lead + b * beatSec, b === 0);
      this.countingIn = n; this._countStart = ctx.currentTime + lead; this._countBeat = beatSec;
      lead += n * beatSec;
    }
    this.anchorCtx = ctx.currentTime + lead;
    this.anchorSong = from;
    this.scheduledTo = from;
    this.nextStep = this._firstStepFrom(from);
    this.nextBeat = this.beats.findIndex((b) => b.t >= from - 1e-6);
    if (this.nextBeat < 0) this.nextBeat = this.beats.length;
    this.playing = true;
    this._tick();
    this.timer = setInterval(() => this._tick(), TICK_MS);
    this._startRaf(); this._emit();
  }

  pause() {
    if (!this.playing) return;
    const t = this.time();
    this.playing = false; this.countingIn = 0;
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    if (this.source === 'media' && this.media) this.media.pause(); else this.synth.hush();
    this.pausedAt = Math.min(t, this.total);
    this._paint(this.pausedAt); this._emit();
  }

  toggle() { return this.playing ? this.pause() : this.play(); }

  stop() {
    const was = this.playing;
    this.playing = false; this.countingIn = 0;
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    if (this.media) this.media.pause();
    this.synth.hush();
    this.pausedAt = this.loop ? this.loop.from : 0;
    if (this.steps.length) this._paint(this.pausedAt);
    if (was) this._emit();
  }

  seek(t) {
    t = Math.max(0, Math.min(this.total, t));
    if (this.source === 'media' && this.media) { this.media.time = this._scoreToMedia(t); this.pausedAt = t; this._paint(t); this._emit(); return; }
    if (this.playing) {
      this.synth.hush();
      const ctx = this.synth.ctx;
      this.anchorCtx = ctx.currentTime + 0.04; this.anchorSong = t; this.scheduledTo = t;
      this.nextStep = this._firstStepFrom(t);
      this.nextBeat = this.beats.findIndex((b) => b.t >= t - 1e-6); if (this.nextBeat < 0) this.nextBeat = this.beats.length;
    } else this.pausedAt = t;
    this._paint(t); this._emit();
  }

  seekMeasure(mi, pass) {
    const m = this.measures[mi]; if (!m) return;
    let k = pass;
    if (k === undefined) {
      // el pase de ese compás más cercano hacia adelante desde donde estamos
      const now = this.time();
      const cand = this.passes.map((p, i) => ({ p, i })).filter((x) => x.p.m === mi);
      const fwd = cand.find((x) => x.p.t >= now - 0.05);
      k = (fwd || cand[0]).i;
    }
    this.seek(this.passes[k].t);
  }

  setSpeed(r) {
    r = Math.max(0.25, Math.min(1.5, r));
    if (this.playing && this.source === 'synth') {
      // re-anclar para que cambiar la velocidad no haga saltar el cursor
      const t = this.time(); this.opt.speed = r;
      const ctx = this.synth.ctx; this.anchorCtx = ctx.currentTime; this.anchorSong = t;
    } else this.opt.speed = r;
    if (this.media) this.media.setRate(r);
    this._emit();
  }

  setLoop(a, b) {
    if (a === null || a === undefined) { this.loop = null; this._drawLoop(); this._emit(); return; }
    if (b < a) [a, b] = [b, a];
    const pa = this.measures[a].firstPass;
    let pb = this.passes.findIndex((p, k) => k >= pa && p.m === b);
    if (pb < 0) pb = this.measures[b].firstPass;
    this.loop = { a, b, from: this.passes[pa].t, to: this.passes[pb].end };
    this._drawLoop();
    const t = this.time();
    if (t < this.loop.from || t >= this.loop.to) this.seek(this.loop.from);
    this._emit();
  }

  async setOption(k, v) {
    this.opt[k] = v;
    if (k === 'instrument') this.synth.instrument = v;
    if (k === 'volume') { this.synth.setVolume(v); if (this.media) this.media.setVolume(v); }
    if (k === 'noteNames') this._drawNames();
    if (k === 'fingerings' || k === 'allNumbers') await this._rerender();
    if (k === 'highlight') this._paint(this.time());
    this._emit();
  }

  async setZoom(z) {
    this.opt.zoom = Math.max(0.55, Math.min(1.8, Math.round(z * 100) / 100));
    await this._rerender();
    this._emit();
  }

  async setTranspose(semis) {
    this.opt.transpose = semis;
    if (!this.osmd) return;
    const was = this.playing; if (was) this.pause();
    this.osmd.Sheet.Transpose = semis;
    this.osmd.updateGraphic();
    await this._rerender();
    this._emit();
    if (was) this.play();
  }

  /* ---------- programador de audio ---------- */
  _tick() {
    if (!this.playing) return;
    const ctx = this.synth.ctx;
    const horizon = this.anchorSong + (ctx.currentTime + LOOKAHEAD - this.anchorCtx) * this.opt.speed;
    const end = this.loop ? this.loop.to : this.total;
    const until = Math.min(horizon, end);
    const vol = 0.72;

    while (this.nextStep < this.steps.length && this.steps[this.nextStep].t < until - 1e-6) {
      const s = this.steps[this.nextStep];
      if (s.t >= this.scheduledTo - 1e-6) {
        const at = this._songToCtx(s.t);
        s.notes.forEach((n) => this.synth.note(n.midi + this.opt.transpose, at, n.d / this.opt.speed, vol, s.art));
      }
      this.nextStep++;
    }
    if (this.opt.metronome) {
      while (this.nextBeat < this.beats.length && this.beats[this.nextBeat].t < until - 1e-6) {
        const b = this.beats[this.nextBeat];
        if (b.t >= this.scheduledTo - 1e-6) this.synth.click(this._songToCtx(b.t), b.strong);
        this.nextBeat++;
      }
    } else {
      while (this.nextBeat < this.beats.length && this.beats[this.nextBeat].t < until - 1e-6) this.nextBeat++;
    }
    this.scheduledTo = until;

    if (horizon >= end) {
      if (this.loop) {
        // cerrar el loop en el tiempo exacto de audio, sin hueco
        const ctxEnd = this._songToCtx(end);
        this.anchorCtx = ctxEnd; this.anchorSong = this.loop.from; this.scheduledTo = this.loop.from;
        this.nextStep = this._firstStepFrom(this.loop.from);
        this.nextBeat = this.beats.findIndex((b) => b.t >= this.loop.from - 1e-6);
        this._tick();
      } else if (ctx.currentTime >= this._songToCtx(end)) {
        this.playing = false; clearInterval(this.timer); cancelAnimationFrame(this.raf);
        this.pausedAt = this.total; this._paint(this.total); this._emit({ ended: true });
      }
    }
  }

  _startRaf() {
    cancelAnimationFrame(this.raf);
    const frame = () => {
      if (!this.playing) return;
      let t = this.time();
      if (this.source === 'media' && this.media) {
        if (this.loop && t >= this.loop.to) { this.media.time = this._scoreToMedia(this.loop.from); t = this.loop.from; }
        if (!this.media.playing && this.media.duration && this.media.time >= this.media.duration - 0.05) { this.pause(); return; }
      }
      if (this.countingIn && this.synth.ctx) {
        const left = Math.ceil((this.anchorCtx - this.synth.ctx.currentTime) / this._countBeat);
        this.countingIn = left > 0 ? left : 0;
      }
      this._paint(t); this._emit();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  _firstStepFrom(t) {
    let lo = 0, hi = this.steps.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.steps[mid].t < t - 1e-6) lo = mid + 1; else hi = mid; }
    return lo;
  }

  _stepIndexAt(t) {
    let lo = 0, hi = this.steps.length - 1, r = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.steps[mid].t <= t + 1e-6) { r = mid; lo = mid + 1; } else hi = mid - 1; }
    return r;
  }
  _stepAt(t) { return this.steps[this._stepIndexAt(t)] || this.steps[0]; }

  /* ---------- dibujo del cursor ---------- */
  _paint(t) {
    if (!this.steps.length) return;
    const i = this._stepIndexAt(t), s = this.steps[i], n = this.steps[i + 1];
    const m = this.measures[s.m], g = m.geom, sys = this.systems[s.sys];
    if (!g || !sys) return;
    const f = s.d > 0 ? Math.max(0, Math.min(1, (t - s.t) / s.d)) : 0;
    const targetX = n && n.sys === s.sys && n.pass === s.pass ? n.x : (n && n.sys === s.sys && n.m === s.m + 1 ? n.x : g.x + g.w - 6);
    const x = s.x + (targetX - s.x) * f;
    this.cursor.style.transform = `translate(${x}px, ${sys.y}px)`;
    this.cursor.style.height = `${sys.h}px`;
    this.cursor.classList.toggle('on', true);
    if (this.opt.highlight) {
      this.hl.style.transform = `translate(${g.x}px, ${sys.y}px)`;
      this.hl.style.width = `${g.w}px`; this.hl.style.height = `${sys.h}px`;
      this.hl.classList.add('on');
    } else this.hl.classList.remove('on');
    this._current = { step: i, m: s.m, pass: s.pass, notes: s.notes };
    if (this.opt.follow && this.playing) this._follow(sys);
  }

  _follow(sys) {
    const sc = this.scroll, top = sc.scrollTop, h = sc.clientHeight;
    if (sys.y < top + 8 || sys.y + sys.h > top + h - 8) {
      const target = Math.max(0, sys.y - Math.min(80, h * 0.18));
      if (Math.abs(target - (this._followTo ?? -1)) > 2) { this._followTo = target; sc.scrollTo({ top: target, behavior: 'smooth' }); }
    }
  }

  _drawLoop() {
    const band = this.loopBand;
    band.innerHTML = '';
    if (!this.loop) { band.classList.remove('on'); return; }
    band.classList.add('on');
    const { a, b } = this.loop;
    // un rectángulo por sistema que toca el rango
    const bySys = new Map();
    for (let i = a; i <= b; i++) {
      const g = this.measures[i] && this.measures[i].geom; if (!g) continue;
      const r = bySys.get(g.sys) || { x1: g.x, x2: g.x + g.w };
      r.x1 = Math.min(r.x1, g.x); r.x2 = Math.max(r.x2, g.x + g.w); bySys.set(g.sys, r);
    }
    bySys.forEach((r, si) => {
      const sys = this.systems[si];
      const d = document.createElement('i');
      d.style.transform = `translate(${r.x1}px, ${sys.y}px)`; d.style.width = `${r.x2 - r.x1}px`; d.style.height = `${sys.h}px`;
      band.appendChild(d);
    });
  }

  /* ---------- puntero: clic = saltar, arrastrar = loop ---------- */
  _hit(e) {
    const r = this.paper.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const si = this.systems.findIndex((s) => y >= s.y && y <= s.y + s.h);
    if (si < 0) return null;
    const sys = this.systems[si];
    for (let i = sys.first; i <= sys.last; i++) {
      const g = this.measures[i] && this.measures[i].geom;
      if (g && x >= g.x && x <= g.x + g.w) return { m: i, x, y, sys: si };
    }
    return null;
  }

  _bindPointer() {
    let down = null;
    this.paper.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const h = this._hit(e); if (!h) return;
      down = { h, x: e.clientX, y: e.clientY, drag: false };
      this.paper.setPointerCapture(e.pointerId);
    });
    this.paper.addEventListener('pointermove', (e) => {
      const h = this._hit(e);
      if (h && !down) {
        const g = this.measures[h.m].geom, sys = this.systems[g.sys];
        this.hover.style.transform = `translate(${g.x}px, ${sys.y}px)`; this.hover.style.width = `${g.w}px`; this.hover.style.height = `${sys.h}px`;
        this.hover.classList.add('on'); this.paper.style.cursor = 'pointer';
      } else if (!h) { this.hover.classList.remove('on'); this.paper.style.cursor = ''; }
      if (!down) return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.drag = true;
      if (down.drag && h) {
        this.loop = null;
        const a = Math.min(down.h.m, h.m), b = Math.max(down.h.m, h.m);
        this._previewLoop = [a, b];
        this.loop = { a, b, from: 0, to: 0 }; this._drawLoop(); this.loop = null;
      }
    });
    this.paper.addEventListener('pointerleave', () => { this.hover.classList.remove('on'); });
    this.paper.addEventListener('pointerup', (e) => {
      if (!down) return;
      const d = down; down = null;
      try { this.paper.releasePointerCapture(e.pointerId); } catch (_) {}
      if (d.drag && this._previewLoop) {
        const [a, b] = this._previewLoop; this._previewLoop = null;
        this.setLoop(a, b);
        this.onState(Object.assign(this.state(), { event: 'loop' }));
        return;
      }
      // clic: nota más cercana dentro del compás
      const mi = d.h.m;
      const cand = this.steps.filter((s) => s.m === mi && s.notes.length);
      const passes = [...new Set(cand.map((s) => s.pass))];
      const now = this.time();
      const pass = passes.find((p) => this.passes[p].end > now + 0.01 && this.passes[p].t <= now + 0.01) ?? passes.find((p) => this.passes[p].t >= now - 0.05) ?? passes[0];
      const inPass = cand.filter((s) => s.pass === pass);
      if (!inPass.length) { this.seekMeasure(mi); return; }
      let best = inPass[0];
      inPass.forEach((s) => { if (Math.abs(s.x - d.h.x) < Math.abs(best.x - d.h.x)) best = s; });
      if (this.loop && (best.t < this.loop.from || best.t >= this.loop.to)) this.setLoop(null);
      this.seek(best.t);
    });
  }

  /* ---------- grabación sincronizada ---------- */
  /**
   * @param {{url:string, sync:number[]}} m  sync[k] = segundo del medio donde empieza el pase k
   */
  async setMedia(m) {
    if (this.media) { this.media.destroy(); this.media = null; }
    this.sync = null;
    if (!m || !m.url) { this.source = 'synth'; this._emit(); return false; }
    const yt = youtubeId(m.url) && !/\.(mp4|webm|mov|m4v|mp3|m4a|ogg|wav)(\?|$)/i.test(m.url);
    this.media = yt ? new YouTubeMedia(m.url, this.mediaHost) : new FileMedia(m.url, this.mediaHost);
    await this.media.ready();
    this.media.setVolume(this.opt.volume);
    this.sync = Array.isArray(m.sync) && m.sync.length >= 2 ? m.sync.slice(0, this.passes.length) : null;
    this._emit();
    return true;
  }

  get hasSync() { return !!(this.media && this.sync); }

  async useSource(src) {
    const t = this.time();
    const was = this.playing; if (was) this.pause();
    this.source = src === 'media' && this.hasSync ? 'media' : 'synth';
    this.pausedAt = t;
    if (this.source === 'media') this.media.time = this._scoreToMedia(t);
    this._emit();
    if (was) this.play();
  }

  /** medio → tiempo de partitura, interpolando dentro del pase */
  _mediaToScore(mt) {
    const s = this.sync; if (!s) return 0;
    let k = 0; while (k < s.length - 1 && s[k + 1] <= mt) k++;
    const p = this.passes[k]; if (!p) return this.total;
    const mEnd = k + 1 < s.length ? s[k + 1] : s[k] + (p.end - p.t) * (s[k] - s[Math.max(0, k - 1)] || 1) / ((this.passes[Math.max(0, k - 1)].end - this.passes[Math.max(0, k - 1)].t) || 1);
    const f = Math.max(0, Math.min(1, (mt - s[k]) / Math.max(0.001, mEnd - s[k])));
    return Math.max(0, p.t + f * (p.end - p.t));
  }

  _scoreToMedia(t) {
    const s = this.sync; if (!s) return t;
    let k = this.passes.findIndex((p) => t >= p.t - 1e-6 && t < p.end);
    if (k < 0) k = this.passes.length - 1;
    k = Math.min(k, s.length - 1);
    const p = this.passes[k];
    const next = k + 1 < s.length ? s[k + 1] : s[k] + (p.end - p.t);
    const f = (t - p.t) / Math.max(0.001, p.end - p.t);
    return s[k] + f * (next - s[k]);
  }

  /* ---------- estado para la UI ---------- */
  state() {
    const t = this.time();
    const cur = this._current || {};
    const m = this.measures[cur.m ?? 0];
    return { time: t, total: this.total, playing: this.playing, measure: m ? m.number : 1, measureIndex: cur.m ?? 0,
      measures: this.measures.length, notes: (cur.notes || []).map((n) => n.midi + this.opt.transpose),
      speed: this.opt.speed, loop: this.loop ? { a: this.measures[this.loop.a].number, b: this.measures[this.loop.b].number } : null,
      countIn: this.countingIn, source: this.source, hasMedia: !!this.media, hasSync: this.hasSync, opt: { ...this.opt } };
  }

  _emit(extra) {
    const now = performance.now();
    if (!extra && this.playing && now - (this._lastEmit || 0) < 60) return;   // ~16 fps para la UI
    this._lastEmit = now;
    this.onState(Object.assign(this.state(), extra || {}));
  }

  /* ---------- herramientas para el editor de sincronización ---------- */
  passList() { return this.passes.map((p, k) => ({ k, measure: this.measures[p.m].number, t: p.t, d: p.end - p.t })); }

  /* ---------- PDF de la vista (paginado) ---------- */
  async exportPdf(title, format = 'a4') {
    if (!window.jspdf) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const svg = this.osmdDiv.querySelector('svg'); if (!svg) throw new Error('No hay partitura.');
    const clone = svg.cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const w = svg.clientWidth, h = svg.clientHeight;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const scale = 2, canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); c.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format, compress: true });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), margin = 12;
    const k = (pw - margin * 2) / canvas.width;                 // mm por px de lienzo
    const pageHpx = Math.floor((ph - margin * 2) / k);
    // cortar por sistemas para no partir un pentagrama entre páginas
    const cuts = [0]; let acc = 0;
    this.systems.forEach((s) => { const bottom = (s.y + s.h) * scale; if (bottom - acc > pageHpx) { acc = Math.max(acc + 1, s.y * scale - 10); cuts.push(acc); } });
    cuts.push(canvas.height);
    for (let i = 0; i < cuts.length - 1; i++) {
      const sh = cuts[i + 1] - cuts[i]; if (sh <= 4) continue;
      const part = document.createElement('canvas'); part.width = canvas.width; part.height = sh;
      part.getContext('2d').drawImage(canvas, 0, cuts[i], canvas.width, sh, 0, 0, canvas.width, sh);
      if (i) pdf.addPage();
      if (i === 0 && title) { pdf.setFontSize(15); pdf.text(title, margin, margin - 3); }
      pdf.addImage(part.toDataURL('image/png'), 'PNG', margin, margin, canvas.width * k, sh * k, undefined, 'FAST');
    }
    pdf.save(`${(title || 'partitura').toLowerCase().replace(/[^\p{L}\d]+/gu, '-')}.pdf`);
  }

  destroy() {
    this.stop();
    clearInterval(this.timer); cancelAnimationFrame(this.raf);
    if (this._ro) this._ro.disconnect();
    if (this.media) this.media.destroy();
    if (this.synth.ctx) this.synth.ctx.close();
    this.host.innerHTML = '';
  }
}
