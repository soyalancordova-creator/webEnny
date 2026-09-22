/* ============================================================
   PARTITURAS DE DEMOSTRACIÓN (dominio público)
   ------------------------------------------------------------
   Se generan como MusicXML real para que el modo demo funcione
   sin backend. Las digitaciones son de primera posición.
   Todas las obras son de dominio público — no agregar aquí himnos
   o canciones de adoración con derechos vigentes.
============================================================ */

const DIV = 4; // divisiones por negra
const DUR = { w: [16, 'whole'], 'h.': [12, 'half', 1], h: [8, 'half'], 'q.': [6, 'quarter', 1], q: [4, 'quarter'], 'e.': [3, 'eighth', 1], e: [2, 'eighth'], s: [1, '16th'] };
const STEP_ALTER = /^([A-G])(#|b)?(\d)$/;

function pitchXml(p) {
  const m = p.match(STEP_ALTER);
  if (!m) throw new Error('Nota inválida ' + p);
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return `<pitch><step>${m[1]}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${m[3]}</octave></pitch>`;
}

/** n = [pitch|'r', dur, finger?, flags?]  · pitch puede ser 'C3+E3+G3' (acorde) */
function noteXml(n, staff, voice) {
  const [p, d, finger, flags = ''] = n;
  const [div, type, dot] = DUR[d];
  const extras = (tieStart, tieStop) => (tieStart ? '<tie type="start"/>' : '') + (tieStop ? '<tie type="stop"/>' : '');
  const tieStart = flags.includes('ts'), tieStop = flags.includes('te');
  const notations = (withFinger) => {
    const parts = [];
    if (tieStart) parts.push('<tied type="start"/>');
    if (tieStop) parts.push('<tied type="stop"/>');
    if (withFinger && finger !== undefined && finger !== null && finger !== '') parts.push(`<technical><fingering>${finger}</fingering></technical>`);
    return parts.length ? `<notations>${parts.join('')}</notations>` : '';
  };
  const tail = `<voice>${voice}</voice><type>${type}</type>${dot ? '<dot/>' : ''}${staff ? `<staff>${staff}</staff>` : ''}`;
  if (p === 'r') return `<note><rest/><duration>${div}</duration>${tail}</note>`;
  return p.split('+').map((q, i) =>
    `<note>${i ? '<chord/>' : ''}${pitchXml(q)}<duration>${div}</duration>${extras(tieStart, tieStop)}${tail}${notations(i === 0)}</note>`
  ).join('');
}

function measureDur(notes) { return notes.reduce((a, n) => a + DUR[n[1]][0], 0); }

/**
 * @param {object} s
 * @param {Array} s.measures   cada compás: array de notas (una voz) o {rh:[..], lh:[..]} (piano)
 */
export function buildScore(s) {
  const piano = !!s.piano;
  const attrs = `<attributes><divisions>${DIV}</divisions><key><fifths>${s.fifths}</fifths></key><time><beats>${s.beats}</beats><beat-type>${s.beatType}</beat-type></time>${piano
    ? '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'
    : '<clef><sign>G</sign><line>2</line></clef>'}</attributes>`;
  const tempo = `<direction placement="above"><direction-type><metronome><beat-unit>${s.beatType === 8 ? 'eighth' : 'quarter'}</beat-unit><per-minute>${s.tempo}</per-minute></metronome></direction-type><sound tempo="${s.tempo}"/></direction>`;
  const full = s.beats * (16 / s.beatType);

  const body = s.measures.map((m, i) => {
    const number = s.pickup ? i : i + 1;
    let inner = '';
    if (piano) {
      inner += m.rh.map((n) => noteXml(n, 1, 1)).join('');
      inner += `<backup><duration>${measureDur(m.rh)}</duration></backup>`;
      inner += m.lh.map((n) => noteXml(n, 2, 5)).join('');
    } else inner = m.map((n) => noteXml(n, 0, 1)).join('');
    const dur = measureDur(piano ? m.rh : m);
    const implicit = dur < full && (i === 0 || i === s.measures.length - 1) ? ' implicit="yes"' : '';
    const last = i === s.measures.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : '';
    return `<measure number="${number}"${implicit}>${i === 0 ? attrs + tempo : ''}${inner}${last}</measure>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
<work><work-title>${s.title}</work-title></work>
<identification><creator type="composer">${s.composer}</creator></identification>
<part-list><score-part id="P1"><part-name>${s.part}</part-name></score-part></part-list>
<part id="P1">
${body}
</part>
</score-partwise>`;
}

/* ---------- Sublime gracia (Amazing Grace · New Britain) ----------
   Sol mayor, 3/4, anacrusa. Violín 1ª posición:
   D4=0 (cuerda Re al aire) · E4=1 · G4=3 · A4=0 (La al aire) · B4=1 · D5=3 */
const sublimeGracia = {
  title: 'Sublime gracia', composer: 'John Newton · melodía New Britain', part: 'Violín',
  fifths: 1, beats: 3, beatType: 4, tempo: 76, pickup: true,
  measures: [
    [['D4', 'q', 0]],
    [['G4', 'h', 3], ['B4', 'e', 1], ['G4', 'e', 3]],
    [['B4', 'h', 1], ['A4', 'q', 0]],
    [['G4', 'h', 3], ['E4', 'q', 1]],
    [['D4', 'h', 0], ['D4', 'q', 0]],
    [['G4', 'h', 3], ['B4', 'e', 1], ['G4', 'e', 3]],
    [['B4', 'h', 1], ['A4', 'q', 0]],
    [['D5', 'h.', 3, 'ts']],
    [['D5', 'h', null, 'te'], ['B4', 'q', 1]],
    [['D5', 'h', 3], ['B4', 'e', 1], ['G4', 'e', 3]],
    [['B4', 'h', 1], ['A4', 'q', 0]],
    [['G4', 'h', 3], ['E4', 'q', 1]],
    [['D4', 'h', 0], ['D4', 'q', 0]],
    [['G4', 'h', 3], ['B4', 'e', 1], ['G4', 'e', 3]],
    [['B4', 'h', 1], ['A4', 'q', 0]],
    [['G4', 'h.', 3, 'ts']],
    [['G4', 'h', null, 'te']],
  ],
};

/* ---------- Himno de la alegría (Beethoven, 9ª sinfonía) ----------
   Re mayor, 4/4. D4=0 · E4=1 · F#4=2 · G4=3 · A4=0 · A3=1 (cuerda Sol) */
const alegria = {
  title: 'Himno de la alegría', composer: 'Ludwig van Beethoven', part: 'Violín',
  fifths: 2, beats: 4, beatType: 4, tempo: 96,
  measures: [
    [['F#4', 'q', 2], ['F#4', 'q'], ['G4', 'q', 3], ['A4', 'q', 0]],
    [['A4', 'q'], ['G4', 'q', 3], ['F#4', 'q', 2], ['E4', 'q', 1]],
    [['D4', 'q', 0], ['D4', 'q'], ['E4', 'q', 1], ['F#4', 'q', 2]],
    [['F#4', 'q.'], ['E4', 'e', 1], ['E4', 'h']],
    [['F#4', 'q', 2], ['F#4', 'q'], ['G4', 'q', 3], ['A4', 'q', 0]],
    [['A4', 'q'], ['G4', 'q', 3], ['F#4', 'q', 2], ['E4', 'q', 1]],
    [['D4', 'q', 0], ['D4', 'q'], ['E4', 'q', 1], ['F#4', 'q', 2]],
    [['E4', 'q.', 1], ['D4', 'e', 0], ['D4', 'h']],
    [['E4', 'q', 1], ['E4', 'q'], ['F#4', 'q', 2], ['D4', 'q', 0]],
    [['E4', 'q', 1], ['F#4', 'e', 2], ['G4', 'e', 3], ['F#4', 'q', 2], ['D4', 'q', 0]],
    [['E4', 'q', 1], ['F#4', 'e', 2], ['G4', 'e', 3], ['F#4', 'q', 2], ['E4', 'q', 1]],
    [['D4', 'q', 0], ['E4', 'q', 1], ['A3', 'h', 1]],
    [['F#4', 'q', 2], ['F#4', 'q'], ['G4', 'q', 3], ['A4', 'q', 0]],
    [['A4', 'q'], ['G4', 'q', 3], ['F#4', 'q', 2], ['E4', 'q', 1]],
    [['D4', 'q', 0], ['D4', 'q'], ['E4', 'q', 1], ['F#4', 'q', 2]],
    [['E4', 'q.', 1], ['D4', 'e', 0], ['D4', 'h']],
  ],
};

/* ---------- Estrellita, ¿dónde estás? (tradicional) ----------
   Re mayor, 4/4. Pieza de inicio del método Suzuki. B4=1 · A4=0 */
const estrellita = {
  title: 'Estrellita, ¿dónde estás?', composer: 'Tradicional', part: 'Violín',
  fifths: 2, beats: 4, beatType: 4, tempo: 88,
  measures: [
    [['D4', 'q', 0], ['D4', 'q'], ['A4', 'q', 0], ['A4', 'q']],
    [['B4', 'q', 1], ['B4', 'q'], ['A4', 'h', 0]],
    [['G4', 'q', 3], ['G4', 'q'], ['F#4', 'q', 2], ['F#4', 'q']],
    [['E4', 'q', 1], ['E4', 'q'], ['D4', 'h', 0]],
    [['A4', 'q', 0], ['A4', 'q'], ['G4', 'q', 3], ['G4', 'q']],
    [['F#4', 'q', 2], ['F#4', 'q'], ['E4', 'h', 1]],
    [['A4', 'q', 0], ['A4', 'q'], ['G4', 'q', 3], ['G4', 'q']],
    [['F#4', 'q', 2], ['F#4', 'q'], ['E4', 'h', 1]],
    [['D4', 'q', 0], ['D4', 'q'], ['A4', 'q', 0], ['A4', 'q']],
    [['B4', 'q', 1], ['B4', 'q'], ['A4', 'h', 0]],
    [['G4', 'q', 3], ['G4', 'q'], ['F#4', 'q', 2], ['F#4', 'q']],
    [['E4', 'q', 1], ['E4', 'q'], ['D4', 'h', 0]],
  ],
};

/* ---------- Escala y arpegio de Re mayor, dos octavas ---------- */
const escala = {
  title: 'Escala y arpegio de Re mayor', composer: 'Ejercicio · dos octavas', part: 'Violín',
  fifths: 2, beats: 4, beatType: 4, tempo: 72,
  measures: [
    [['D4', 'q', 0], ['E4', 'q', 1], ['F#4', 'q', 2], ['G4', 'q', 3]],
    [['A4', 'q', 0], ['B4', 'q', 1], ['C#5', 'q', 2], ['D5', 'q', 3]],
    [['E5', 'q', 0], ['F#5', 'q', 1], ['G5', 'q', 2], ['A5', 'q', 3]],
    [['B5', 'q', 4], ['C#6', 'q'], ['D6', 'q'], ['C#6', 'q']],
    [['B5', 'q', 4], ['A5', 'q', 3], ['G5', 'q', 2], ['F#5', 'q', 1]],
    [['E5', 'q', 0], ['D5', 'q', 3], ['C#5', 'q', 2], ['B4', 'q', 1]],
    [['A4', 'q', 0], ['G4', 'q', 3], ['F#4', 'q', 2], ['E4', 'q', 1]],
    [['D4', 'w', 0]],
    [['D4', 'q', 0], ['F#4', 'q', 2], ['A4', 'q', 0], ['D5', 'q', 3]],
    [['F#5', 'q', 1], ['A5', 'q', 3], ['D6', 'q'], ['A5', 'q', 3]],
    [['F#5', 'q', 1], ['D5', 'q', 3], ['A4', 'q', 0], ['F#4', 'q', 2]],
    [['D4', 'w', 0]],
  ],
};

/* ---------- Himno de la alegría · piano a dos manos ----------
   Ejercita dos pentagramas, acordes y <backup> en el motor. */
const C = 'C3+E3+G3', G = 'G2+B2+D3';
const alegriaPiano = {
  title: 'Himno de la alegría · piano', composer: 'Ludwig van Beethoven', part: 'Piano',
  fifths: 0, beats: 4, beatType: 4, tempo: 92, piano: true,
  measures: [
    { rh: [['E4', 'q', 3], ['E4', 'q', 3], ['F4', 'q', 4], ['G4', 'q', 5]], lh: [[C, 'w']] },
    { rh: [['G4', 'q'], ['F4', 'q'], ['E4', 'q'], ['D4', 'q']], lh: [[G, 'w']] },
    { rh: [['C4', 'q', 1], ['C4', 'q'], ['D4', 'q'], ['E4', 'q']], lh: [[C, 'w']] },
    { rh: [['E4', 'q.'], ['D4', 'e'], ['D4', 'h']], lh: [[G, 'w']] },
    { rh: [['E4', 'q'], ['E4', 'q'], ['F4', 'q'], ['G4', 'q']], lh: [[C, 'w']] },
    { rh: [['G4', 'q'], ['F4', 'q'], ['E4', 'q'], ['D4', 'q']], lh: [[G, 'w']] },
    { rh: [['C4', 'q'], ['C4', 'q'], ['D4', 'q'], ['E4', 'q']], lh: [[C, 'w']] },
    { rh: [['D4', 'q.'], ['C4', 'e'], ['C4', 'h']], lh: [[G, 'h'], [C, 'h']] },
    { rh: [['D4', 'q'], ['D4', 'q'], ['E4', 'q'], ['C4', 'q']], lh: [[G, 'w']] },
    { rh: [['D4', 'q'], ['E4', 'e'], ['F4', 'e'], ['E4', 'q'], ['C4', 'q']], lh: [[G, 'w']] },
    { rh: [['D4', 'q'], ['E4', 'e'], ['F4', 'e'], ['E4', 'q'], ['D4', 'q']], lh: [[G, 'w']] },
    { rh: [['C4', 'q'], ['D4', 'q'], ['G3', 'h']], lh: [[C, 'h'], [G, 'h']] },
    { rh: [['E4', 'q'], ['E4', 'q'], ['F4', 'q'], ['G4', 'q']], lh: [[C, 'w']] },
    { rh: [['G4', 'q'], ['F4', 'q'], ['E4', 'q'], ['D4', 'q']], lh: [[G, 'w']] },
    { rh: [['C4', 'q'], ['C4', 'q'], ['D4', 'q'], ['E4', 'q']], lh: [[C, 'w']] },
    { rh: [['D4', 'q.'], ['C4', 'e'], ['C4', 'h']], lh: [[G, 'h'], [C, 'h']] },
  ],
};

const SPECS = {
  'estrellita': estrellita,
  'sublime-gracia': sublimeGracia,
  'himno-alegria': alegria,
  'escala-re': escala,
  'himno-alegria-piano': alegriaPiano,
};

export function demoXml(id) {
  const s = SPECS[id];
  return s ? buildScore(s) : null;
}
