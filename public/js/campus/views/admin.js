/* ============================================================
   ADMINISTRACIÓN DE LA ACADEMIA
   Partituras · Sincronización · Colecciones · Avisos · Moderación · Alumnos
   La interfaz se oculta a quien no es admin, pero lo que protege es RLS:
   cada escritura aquí la rechaza la base si el rol no es admin.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, ago, avatar, toast, modal, confirmBox, loading, empty, fmtTime } from '../ui.js';
import { ScoreEngine, youtubeId } from '../score-engine.js';

const TABS = [['', 'Resumen', 'feed'], ['partituras', 'Partituras', 'music'], ['colecciones', 'Colecciones', 'book'], ['avisos', 'Avisos', 'megaphone'], ['moderacion', 'Moderación', 'flag'], ['alumnos', 'Alumnos', 'users']];

export async function renderAdmin(ctx, view, [tab = '', sub]) {
  ctx.setTitle('Panel de la academia');
  view.innerHTML = `<div style="max-width:1180px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Administración</span><h1>Panel de la academia</h1><p>Contenido de la biblioteca, avisos y comunidad. ${ctx.store.mode === 'demo' ? '<b>Modo demo:</b> los cambios quedan en este navegador.' : ''}</p></div>
      <a class="btn btn-ghost btn-sm" href="admin.html"><span>${icon('settings')} Contenido del sitio web</span></a></div>
    <nav class="gp-tabs">${TABS.map(([k, l, ic]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}">${icon(ic)}${l}</button>`).join('')}</nav>
    <div id="ab"></div></div>`;
  $$('[data-t]', view).forEach((b) => { b.onclick = () => ctx.go(`#/admin${b.dataset.t ? '/' + b.dataset.t : ''}`); });
  const el = $('#ab', view);
  if (tab === 'partituras') return sub ? scoreEditor(ctx, el, sub) : scoresTab(ctx, el);
  if (tab === 'colecciones') return collectionsTab(ctx, el);
  if (tab === 'avisos') return broadcastTab(ctx, el);
  if (tab === 'moderacion') return moderationTab(ctx, el);
  if (tab === 'alumnos') return usersTab(ctx, el);
  return overview(ctx, el);
}

async function overview(ctx, el) {
  loading(el);
  const s = await ctx.store.adminStats();
  const k = (ic, n, l) => `<div class="cx-card cx-pad" style="display:flex;gap:.9rem;align-items:center"><span class="gthumb" style="width:44px;height:44px">${icon(ic)}</span><div><b style="font-family:var(--serif);font-weight:400;font-size:1.7rem;line-height:1">${n}</b><div class="muted" style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase">${l}</div></div></div>`;
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.9rem">
    ${k('users', s.users, 'Alumnos')}${k('plus', s.newUsers7d, 'Nuevos · 7 días')}${k('crown', s.activeSubs, 'Suscripciones activas')}
    ${k('music', s.scores, 'Partituras')}${k('feed', s.posts, 'Publicaciones')}${k('users', s.groups, 'Comunidades')}${k('flag', s.reports, 'Reportes abiertos')}</div>
    <div class="cx-card cx-pad" style="margin-top:1rem"><h3 style="font-size:1.1rem;margin-bottom:.5rem">Ingreso estimado del mes</h3>
      <p class="muted" style="font-size:.9rem">Con ${s.activeSubs} suscripci${s.activeSubs === 1 ? 'ón activa' : 'ones activas'} a un promedio de ~$5.20 netos al mes después de comisiones de PayPal: <b style="color:var(--ink)">≈ $${(s.activeSubs * 5.2).toFixed(2)}</b>.</p></div>`;
}

/* ---------- partituras ---------- */
async function scoresTab(ctx, el) {
  loading(el);
  const [list, cols] = await Promise.all([ctx.store.adminAllScores(), ctx.store.listCollections()]);
  el.innerHTML = `<div class="cx-row" style="justify-content:space-between;margin-bottom:1rem"><p class="muted">${list.length} obras · las no publicadas solo las ves tú.</p>
    <a class="btn btn-fill btn-sm" href="#/admin/partituras/nueva"><span>${icon('plus')} Nueva partitura</span></a></div>
    <div class="cx-card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
    <thead><tr style="text-align:left;color:var(--ink-3);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase">${['Obra', 'Instrumento', 'Nivel', 'Colección', 'Estado', ''].map((h) => `<th style="padding:.8rem 1rem;border-bottom:1px solid var(--hair);font-weight:400">${h}</th>`).join('')}</tr></thead>
    <tbody>${list.map((s) => `<tr style="border-bottom:1px solid var(--hair)"><td style="padding:.75rem 1rem"><b style="font-weight:400">${esc(s.title)}</b><br><small class="muted">${esc(s.composer)}</small></td>
      <td style="padding:.75rem 1rem">${esc(s.instrument)}</td><td style="padding:.75rem 1rem">${esc(s.level)}</td>
      <td style="padding:.75rem 1rem">${esc((cols.find((c) => c.id === s.collection) || {}).title || '—')}</td>
      <td style="padding:.75rem 1rem">${s.published ? '<span class="pill gold">Publicada</span>' : '<span class="pill">Borrador</span>'} ${s.free ? '<span class="pill">Gratis</span>' : ''} ${s.media_url ? `<span class="pill wine">${s.sync ? 'Sincronizada' : 'Video sin sincronizar'}</span>` : ''}</td>
      <td style="padding:.75rem 1rem;white-space:nowrap"><a class="cx-chip" href="#/admin/partituras/${esc(s.id)}">Editar</a> <a class="cx-chip" href="#/obra/${esc(s.id)}">Ver</a></td></tr>`).join('')}</tbody></table></div>`;
}

async function readMusicFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.mxl')) {
    if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    let root = '';
    const cont = zip.file('META-INF/container.xml');
    if (cont) root = new DOMParser().parseFromString(await cont.async('string'), 'application/xml').querySelector('rootfile')?.getAttribute('full-path') || '';
    const f = zip.file(root) || Object.values(zip.files).find((x) => /\.(musicxml|xml)$/i.test(x.name) && !x.name.startsWith('META-INF/'));
    if (!f) throw new Error('No se encontró MusicXML dentro del .mxl');
    return f.async('string');
  }
  const txt = await file.text();
  if (!/<score-(partwise|timewise)/.test(txt)) throw new Error('El archivo no parece MusicXML.');
  if (/<!ENTITY/i.test(txt)) throw new Error('El archivo contiene entidades XML no permitidas.');
  return txt;
}

async function scoreEditor(ctx, el, id) {
  loading(el);
  const isNew = id === 'nueva';
  const [all, cols] = await Promise.all([ctx.store.adminAllScores(), ctx.store.listCollections()]);
  const s = isNew ? { title: '', composer: '', instrument: 'Violín', level: 'Inicial', key_label: '', bpm: 80, collection: '', tags: [], free: false, published: false, media_url: '' } : all.find((x) => x.id === id);
  if (!s) { empty(el, 'info', 'Obra no encontrada.'); return; }
  let xml = isNew ? null : await ctx.store.adminScoreXml(id);
  let pdfFile = null, mediaFile = null, xmlChanged = false;
  el.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:1.2rem;align-items:start" class="ad-ed">
    <div style="display:grid;gap:1rem">
      <section class="sheet" style="display:grid;gap:.9rem">
        <h3 style="font-size:1.2rem">${isNew ? 'Nueva partitura' : 'Editar partitura'}</h3>
        <div class="two"><div class="fld"><label>Título</label><input id="fT" maxlength="160" value="${esc(s.title)}"></div><div class="fld"><label>Autor / compositor</label><input id="fC" maxlength="160" value="${esc(s.composer)}"></div></div>
        <div class="two"><div class="fld"><label>Instrumento</label><select id="fI">${['Violín', 'Viola', 'Violonchelo', 'Piano', 'Flauta'].map((i) => `<option${i === s.instrument ? ' selected' : ''}>${i}</option>`).join('')}</select></div>
          <div class="fld"><label>Nivel</label><select id="fL">${['Inicial', 'Intermedio', 'Avanzado'].map((i) => `<option${i === s.level ? ' selected' : ''}>${i}</option>`).join('')}</select></div></div>
        <div class="two"><div class="fld"><label>Tonalidad</label><input id="fK" maxlength="30" value="${esc(s.key_label)}" placeholder="Ej. Re mayor"></div><div class="fld"><label>Tempo (bpm)</label><input id="fB" type="number" min="20" max="300" value="${s.bpm}"></div></div>
        <div class="two"><div class="fld"><label>Colección</label><select id="fCol"><option value="">— Sin colección —</option>${cols.map((c) => `<option value="${esc(c.id)}"${c.id === s.collection ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
          <div class="fld"><label>Etiquetas (coma)</label><input id="fTg" value="${esc((s.tags || []).join(', '))}" placeholder="himno, 3/4, primera posición"></div></div>
        <div class="cx-row"><label class="cx-chip"><input type="checkbox" id="fPub"${s.published ? ' checked' : ''}> Publicada</label><label class="cx-chip"><input type="checkbox" id="fFree"${s.free ? ' checked' : ''}> Gratis (muestra sin suscripción)</label></div>
      </section>
      <section class="sheet" style="display:grid;gap:.9rem">
        <h3 style="font-size:1.1rem">Archivos</h3>
        <label class="cx-card cx-pad" style="cursor:pointer;display:flex;gap:.8rem;align-items:center">${icon('music')}<div><b style="font-weight:400">MusicXML o MXL</b><br><small class="muted" id="xmlL">${xml ? 'Archivo cargado ✓ — elige otro para reemplazarlo' : 'Exporta desde MuseScore, Sibelius, Finale o Dorico'}</small></div><input type="file" id="fX" accept=".musicxml,.xml,.mxl" hidden></label>
        <label class="cx-card cx-pad" style="cursor:pointer;display:flex;gap:.8rem;align-items:center">${icon('pdf')}<div><b style="font-weight:400">PDF original (opcional)</b><br><small class="muted" id="pdfL">${s.hasPdf ? 'PDF cargado ✓' : 'Si no subes uno, se exporta desde la vista'}</small></div><input type="file" id="fP" accept="application/pdf" hidden></label>
        <div class="fld"><label>Grabación de Enny (video o audio)</label>
          <div class="cx-row"><input id="fYt" placeholder="Enlace de YouTube" value="${esc(youtubeId(s.media_url) && /^https?:/.test(s.media_url) ? s.media_url : '')}" style="flex:1;padding:.8rem 1rem;border-radius:14px;border:1px solid var(--hair);background:var(--bg);color:var(--ink);font:inherit">
          <label class="btn btn-ghost btn-sm"><span>o subir archivo</span><input type="file" id="fM" accept="video/mp4,video/webm,audio/mpeg,audio/mp4" hidden></label></div>
          <span class="hint" id="mL">${s.media_url ? (s.sync ? 'Grabación sincronizada ✓' : 'Grabación cargada · falta sincronizar') : 'Un enlace de YouTube "no listado" queda visible para quien tenga el enlace; para contenido exclusivo sube el archivo.'}</span></div>
      </section>
      <div class="cx-row" style="justify-content:space-between">
        ${isNew ? '<span></span>' : '<button class="btn btn-ghost btn-sm" id="del" style="color:var(--err)"><span>Eliminar obra</span></button>'}
        <div class="cx-row"><a class="btn btn-ghost btn-sm" href="#/admin/partituras"><span>Cancelar</span></a><button class="btn btn-fill btn-sm" id="save"><span>Guardar</span></button></div></div>
    </div>
    <aside style="display:grid;gap:1rem;position:sticky;top:84px">
      <section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.6rem">Vista previa</h3><div id="prev" style="height:320px;position:relative;border-radius:12px;overflow:hidden;background:var(--bg-deep)"><div class="cx-empty" style="padding:5rem 1rem">Sube un MusicXML para verlo.</div></div><p class="muted" id="prevInfo" style="font-size:.8rem;margin-top:.5rem"></p></section>
      ${isNew ? '' : `<section class="cx-card cx-pad"><h3 style="font-size:1.05rem;margin-bottom:.4rem">Sincronizar grabación</h3><p class="muted" style="font-size:.84rem;margin-bottom:.8rem">Cada compás de la partitura se enlaza con el segundo exacto de la grabación.</p><button class="btn btn-fill btn-sm" id="syncB" ${s.media_url && xml ? '' : 'disabled'} style="width:100%"><span>${icon('video')} Abrir sincronizador</span></button></section>`}
    </aside></div>`;

  let preview = null;
  const showPreview = async () => {
    if (!xml) return;
    if (preview) preview.destroy();
    preview = new ScoreEngine({ host: $('#prev', el) });
    preview.opt.zoom = 0.62;
    try { const info = await preview.load(xml); $('#prevInfo', el).textContent = `${info.measures} compases · ${fmtTime(info.total)} a ${info.tempo} bpm · ${info.timeSig.join('/')}${info.parts.length > 1 ? ` · ${info.parts.join(', ')}` : ''}`; if (isNew && info.title && !$('#fT', el).value) $('#fT', el).value = info.title; if (isNew && info.composer && !$('#fC', el).value) $('#fC', el).value = info.composer; if (isNew && info.tempo) $('#fB', el).value = info.tempo; }
    catch (e) { $('#prev', el).innerHTML = `<div class="cx-empty">${esc(e.message || 'OSMD no pudo leer este archivo.')}</div>`; xml = null; }
  };
  showPreview();

  $('#fX', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { xml = await readMusicFile(f); xmlChanged = true; $('#xmlL', el).textContent = `${f.name} ✓`; showPreview(); } catch (err) { toast(err.message); } };
  $('#fP', el).onchange = (e) => { pdfFile = e.target.files[0] || null; if (pdfFile) $('#pdfL', el).textContent = `${pdfFile.name} ✓`; };
  $('#fM', el).onchange = (e) => { mediaFile = e.target.files[0] || null; if (mediaFile) { $('#mL', el).textContent = `${mediaFile.name} ✓ — guarda y luego sincroniza`; $('#fYt', el).value = ''; } };

  $('#save', el).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    const title = $('#fT', el).value.trim(); if (!title) { toast('Falta el título.'); b.disabled = false; return; }
    if (isNew && !xml) { toast('Sube el archivo MusicXML.'); b.disabled = false; return; }
    const yt = $('#fYt', el).value.trim();
    if (yt && !youtubeId(yt)) { toast('Ese enlace de YouTube no es válido.'); b.disabled = false; return; }
    const meta = { id: isNew ? undefined : s.id, title, composer: $('#fC', el).value.trim(), instrument: $('#fI', el).value, level: $('#fL', el).value,
      key_label: $('#fK', el).value.trim(), bpm: Math.max(20, Math.min(300, +$('#fB', el).value || 80)), collection: $('#fCol', el).value,
      tags: $('#fTg', el).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12), published: $('#fPub', el).checked, free: $('#fFree', el).checked };
    if (!mediaFile) meta.media_url = yt || (s.media_url && !/^https?:/.test(s.media_url) ? s.media_url : '');
    try {
      let files = {};
      if (ctx.store.mode === 'demo') {
        // en demo los archivos grandes no caben en localStorage: se usan solo en esta sesión
        if (pdfFile) meta.pdf_url = URL.createObjectURL(pdfFile);
        if (mediaFile) { meta.media_url = URL.createObjectURL(mediaFile); toast('Demo: el video se usa solo mientras esta pestaña esté abierta.'); }
      } else files = { pdf: pdfFile, media: mediaFile };
      const saved = await ctx.store.adminSaveScore(meta, isNew || xmlChanged ? xml : null, files);
      toast('Obra guardada.'); ctx.go(`#/admin/partituras/${saved.id}`);
    } catch (err) { toast(err.message); b.disabled = false; }
  };
  const del = $('#del', el);
  if (del) del.onclick = async () => { if (!(await confirmBox(`¿Eliminar "${s.title}" y sus archivos?`, 'Eliminar'))) return; try { await ctx.store.adminDeleteScore(s.id); toast('Obra eliminada.'); ctx.go('#/admin/partituras'); } catch (e) { toast(e.message); } };
  const syncB = $('#syncB', el);
  if (syncB) syncB.onclick = () => syncEditor(ctx, s, xml);
  return () => { if (preview) preview.destroy(); };
}

/* ---------- sincronizador (tap a cada compás, como Soundslice) ---------- */
async function syncEditor(ctx, s, xml) {
  const m = modal({ title: `Sincronizar · ${s.title}`, wide: true, body: `<div style="display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:1rem" class="ad-sync">
    <div><div id="sMedia" style="background:#000;border-radius:14px;overflow:hidden;min-height:60px"></div>
      <div id="sHost" style="height:260px;position:relative;margin-top:.8rem;border-radius:12px;overflow:hidden;background:var(--bg-deep)"></div></div>
    <div style="display:grid;gap:.7rem;align-content:start">
      <p class="muted" style="font-size:.84rem;line-height:1.55"><b style="color:var(--ink)">Cómo sincronizar:</b> dale Play y toca <kbd>Espacio</kbd> (o el botón TAP) justo al empezar cada compás. Los repetidos cuentan de nuevo.</p>
      <div class="cx-row"><button class="btn btn-ghost btn-sm" id="sPlay"><span>${icon('play')} Play</span></button><button class="btn btn-fill btn-sm" id="sTap" style="flex:1"><span>TAP · <b id="sK">1</b></span></button></div>
      <div class="cx-row"><button class="cx-chip" id="sUndo">Deshacer tap</button><button class="cx-chip" id="sReset">Empezar de nuevo</button></div>
      <details><summary class="muted" style="font-size:.8rem;cursor:pointer">O estimar por tempo</summary>
        <div class="two" style="margin-top:.6rem"><div class="fld"><label>1er compás (s)</label><input id="sT0" type="number" step="0.01" value="0"></div><div class="fld"><label>BPM grabación</label><input id="sBpm" type="number" value="${s.bpm}"></div></div>
        <button class="cx-chip" id="sEst" style="margin-top:.5rem">Calcular</button></details>
      <div id="sList" style="max-height:220px;overflow:auto;border:1px solid var(--hair);border-radius:12px;font-size:.8rem"></div>
      <button class="btn btn-fill btn-sm" id="sSave"><span>Guardar sincronización</span></button>
      <p class="muted" id="sInfo" style="font-size:.76rem"></p>
    </div></div>` });
  const eng = new ScoreEngine({ host: $('#sHost', m.body), mediaHost: $('#sMedia', m.body) });
  eng.opt.zoom = 0.62;
  await eng.load(xml);
  const passes = eng.passList();
  let sync = Array.isArray(s.sync) ? s.sync.slice(0, passes.length) : [];
  try { await eng.setMedia({ url: s.media_url, sync: null }); } catch (e) { toast('No se pudo cargar la grabación.'); return; }
  const media = eng.media;
  const draw = () => {
    $('#sK', m.body).textContent = Math.min(sync.length + 1, passes.length);
    $('#sInfo', m.body).textContent = `${sync.length} de ${passes.length} compases marcados.`;
    $('#sList', m.body).innerHTML = passes.map((p, k) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:.35rem .7rem;${k === sync.length ? 'background:var(--hl)' : ''}"><span>Compás ${p.measure}</span><span style="display:flex;gap:.3rem;align-items:center">${sync[k] != null ? `<button class="cx-chip" data-adj="${k}" data-d="-0.05" style="padding:.1rem .4rem">−</button><b style="font-weight:400;font-variant-numeric:tabular-nums">${sync[k].toFixed(2)}s</b><button class="cx-chip" data-adj="${k}" data-d="0.05" style="padding:.1rem .4rem">+</button>` : '<span class="muted">—</span>'}</span></div>`).join('');
    $$('[data-adj]', m.body).forEach((b) => { b.onclick = () => { const k = +b.dataset.adj; sync[k] = Math.max(0, +(sync[k] + +b.dataset.d).toFixed(3)); draw(); media.time = sync[k]; }; });
    const row = $('#sList', m.body).children[sync.length]; if (row) row.scrollIntoView({ block: 'nearest' });
    if (sync.length >= 1 && sync.length <= passes.length) eng.seek(passes[Math.max(0, sync.length - 1)].t);
  };
  const tap = () => { if (sync.length >= passes.length) { toast('Ya marcaste todos los compases.'); return; } sync.push(+media.time.toFixed(3)); draw(); };
  $('#sPlay', m.body).onclick = () => { if (media.playing) media.pause(); else media.play(); };
  $('#sTap', m.body).onclick = tap;
  $('#sUndo', m.body).onclick = () => { sync.pop(); draw(); };
  $('#sReset', m.body).onclick = () => { sync = []; media.time = 0; draw(); };
  $('#sEst', m.body).onclick = () => {
    const t0 = +$('#sT0', m.body).value || 0, bpm = +$('#sBpm', m.body).value || s.bpm;
    const k = (eng.measures[0] ? eng.measures[0].tempo : s.bpm) / bpm;
    sync = passes.map((p) => +(t0 + p.t * k).toFixed(3)); draw(); toast('Sincronización estimada. Ajusta los compases que se desvíen.');
  };
  const key = (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); tap(); } };
  document.addEventListener('keydown', key);
  $('#sSave', m.body).onclick = async () => {
    if (sync.length < 2) { toast('Marca al menos dos compases.'); return; }
    for (let i = 1; i < sync.length; i++) if (sync[i] <= sync[i - 1]) { toast(`El compás ${passes[i].measure} está antes que el anterior. Ajústalo.`); return; }
    try { await ctx.store.adminSaveSync(s.id, sync); s.sync = sync; toast('Sincronización guardada.'); m.close(); } catch (e) { toast(e.message); }
  };
  const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { document.removeEventListener('keydown', key); eng.destroy(); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
  draw();
}

/* ---------- colecciones ---------- */
async function collectionsTab(ctx, el) {
  loading(el);
  const cols = await ctx.store.listCollections();
  el.innerHTML = `<div class="cx-row" style="justify-content:flex-end;margin-bottom:1rem"><button class="btn btn-fill btn-sm" id="nc"><span>${icon('plus')} Nueva colección</span></button></div>
    <div class="gl">${cols.map((c) => `<article class="cx-card cx-pad" data-id="${esc(c.id)}"><h3 style="font-size:1.15rem">${esc(c.title)}</h3><p class="muted" style="font-size:.86rem;margin:.4rem 0 .9rem">${esc(c.description)}</p><small class="muted">${c.count} obras</small>
      <div class="cx-row" style="margin-top:.8rem"><button class="cx-chip" data-e>Editar</button><button class="cx-chip" data-d>Eliminar</button></div></article>`).join('') || '<div class="cx-empty">Aún no hay colecciones.</div>'}</div>`;
  const edit = (c = {}) => {
    const m = modal({ title: c.id ? 'Editar colección' : 'Nueva colección', body: `<div style="display:grid;gap:.8rem"><div class="fld"><label>Título</label><input id="cT" maxlength="80" value="${esc(c.title || '')}"></div><div class="fld"><label>Descripción</label><textarea id="cD" maxlength="300">${esc(c.description || '')}</textarea></div><div class="cx-row" style="justify-content:flex-end"><button class="btn btn-fill btn-sm" id="cS"><span>Guardar</span></button></div></div>` });
    $('#cS', m.body).onclick = async () => { try { await ctx.store.adminSaveCollection({ id: c.id, title: $('#cT', m.body).value, description: $('#cD', m.body).value }); m.close(); toast('Guardada.'); collectionsTab(ctx, el); } catch (e) { toast(e.message); } };
  };
  $('#nc', el).onclick = () => edit();
  $$('[data-id]', el).forEach((a) => {
    const c = cols.find((x) => x.id === a.dataset.id);
    $('[data-e]', a).onclick = () => edit(c);
    $('[data-d]', a).onclick = async () => { if (!(await confirmBox(`¿Eliminar la colección "${c.title}"? Las obras no se borran.`, 'Eliminar'))) return; await ctx.store.adminDeleteCollection(c.id); collectionsTab(ctx, el); };
  });
}

/* ---------- avisos a todos ---------- */
async function broadcastTab(ctx, el) {
  el.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.2rem;align-items:start" class="ad-ed">
    <section class="sheet" style="display:grid;gap:.9rem"><h3 style="font-size:1.15rem">Enviar aviso a todos</h3>
      <p class="muted" style="font-size:.86rem">Llega a la campana de cada alumno. Úsalo para obras nuevas, clases en vivo o recordatorios.</p>
      <div class="fld"><label>Título</label><input id="bT" maxlength="120" placeholder="Ej. Nueva obra: Sublime gracia"></div>
      <div class="fld"><label>Mensaje</label><textarea id="bB" maxlength="600"></textarea></div>
      <div class="fld"><label>Enlace dentro de la plataforma (opcional)</label><select id="bL"><option value="">Sin enlace</option><option value="#/biblioteca">Biblioteca</option><option value="#/comunidad">Comunidad</option><option value="#/comunidades">Comunidades</option><option value="#/planes">Planes</option></select></div>
      <div class="cx-row" style="justify-content:flex-end"><button class="btn btn-fill btn-sm" id="bS"><span>${icon('send')} Enviar a todos</span></button></div></section>
    <section class="cx-card cx-pad"><h3 style="font-size:1.1rem;margin-bottom:.6rem">Enviados</h3><div class="nt" id="bH"></div></section></div>`;
  const hist = async () => { const l = await ctx.store.adminBroadcasts(); $('#bH', el).innerHTML = l.length ? l.map((n) => `<div class="nt-item adm"><span class="ico">${icon('megaphone')}</span><div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<time>${ago(n.created_at)}</time></div></div>`).join('') : '<p class="muted">Aún no envías avisos.</p>'; };
  $('#bS', el).onclick = async () => {
    if (!(await confirmBox('¿Enviar este aviso a todos los alumnos?', 'Enviar'))) return;
    try { await ctx.store.adminBroadcast({ title: $('#bT', el).value, body: $('#bB', el).value, link: $('#bL', el).value }); toast('Aviso enviado.'); $('#bT', el).value = ''; $('#bB', el).value = ''; hist(); ctx.refreshBadges(); } catch (e) { toast(e.message); }
  };
  hist();
}

/* ---------- moderación ---------- */
async function moderationTab(ctx, el) {
  loading(el);
  const rs = await ctx.store.adminReports();
  if (!rs.length) { empty(el, 'shield', 'No hay reportes. La comunidad está en paz. 🕊️'); return; }
  el.innerHTML = `<div class="nt" style="max-width:none">${rs.map((r) => `<div class="nt-item${r.status === 'open' ? ' un' : ''}" data-id="${esc(r.id)}">${r.target ? avatar(r.target.author) : `<span class="ico">${icon('flag')}</span>`}
    <div style="flex:1;min-width:0"><b>${r.target ? `${esc(r.target.author.name)} · ${r.target_kind === 'post' ? 'publicación' : 'comentario'}` : 'Contenido ya eliminado'}</b>
      ${r.target ? `<p style="white-space:pre-wrap">${esc(r.target.body.slice(0, 400))}</p>` : ''}
      <p><b style="font-size:.8rem">Motivo:</b> ${esc(r.reason)} · reportado por ${esc(r.reporter ? r.reporter.name : '')}</p><time>${ago(r.created_at)} · ${r.status === 'open' ? 'Abierto' : r.status === 'removed' ? 'Eliminado' : 'Descartado'}</time></div>
    ${r.status === 'open' ? '<div style="display:grid;gap:.4rem"><button class="btn btn-fill btn-sm" data-rm><span>Eliminar</span></button><button class="cx-chip" data-ok>Descartar</button></div>' : ''}</div>`).join('')}</div>`;
  $$('[data-id]', el).forEach((it) => {
    const b1 = $('[data-rm]', it), b2 = $('[data-ok]', it);
    if (b1) b1.onclick = async () => { await ctx.store.adminResolveReport(it.dataset.id, true); toast('Contenido eliminado.'); moderationTab(ctx, el); };
    if (b2) b2.onclick = async () => { await ctx.store.adminResolveReport(it.dataset.id, false); toast('Reporte descartado.'); moderationTab(ctx, el); };
  });
}

/* ---------- alumnos ---------- */
async function usersTab(ctx, el) {
  loading(el);
  const us = await ctx.store.adminUsers();
  const plan = (s) => !s ? '<span class="pill">Gratis</span>' : `<span class="pill ${s.status === 'active' ? 'gold' : ''}">${esc(s.plan)} · ${esc(s.status)}</span>`;
  el.innerHTML = `<p class="muted" style="margin-bottom:.8rem">${us.length} cuentas · ${us.filter((u) => u.subscription && u.subscription.status === 'active').length} con suscripción activa</p>
    <div class="cx-card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">
    <thead><tr style="text-align:left;color:var(--ink-3);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase">${['Alumno', 'Ciudad', 'Se registró', 'Suscripción', 'Vence'].map((h) => `<th style="padding:.8rem 1rem;border-bottom:1px solid var(--hair);font-weight:400">${h}</th>`).join('')}</tr></thead>
    <tbody>${us.map((u) => `<tr style="border-bottom:1px solid var(--hair)"><td style="padding:.65rem 1rem"><a href="#/perfil/${esc(u.id)}" style="display:flex;gap:.6rem;align-items:center">${avatar(u, 'sm')}${esc(u.name)}${u.role === 'admin' ? ' <span class="pill wine">admin</span>' : ''}</a></td>
      <td style="padding:.65rem 1rem">${esc(u.city || '—')}</td><td style="padding:.65rem 1rem">${new Date(u.created_at).toLocaleDateString('es-EC')}</td>
      <td style="padding:.65rem 1rem">${plan(u.subscription)}</td><td style="padding:.65rem 1rem">${u.subscription && u.subscription.current_period_end ? new Date(u.subscription.current_period_end).toLocaleDateString('es-EC') : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}
