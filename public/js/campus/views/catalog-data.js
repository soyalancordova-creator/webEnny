/* ============================================================
   CATÁLOGO DE ARTISTAS · biblioteca
   ------------------------------------------------------------
   Artistas, álbumes y partituras de música cristiana contemporánea,
   para poblar la Biblioteca mientras se suben los arreglos reales.
   Los títulos y artistas vienen del catálogo público de
   https://itemfunes.com/explore; se muestran como si fueran gratis
   para dejar el catálogo listo y que luego se les agregue el arreglo
   real (PDF/OSMD) uno por uno. No reemplazan las obras reales de la
   biblioteca (esas siguen viniendo del store, con su propio id).
============================================================ */

/* Las fotos de artistas y álbumes están descargadas y guardadas localmente en
   public/img/catalogo/ (ya no se piden al CDN de Deezer en cada visita: ese
   hotlink fallaba para quien nos visitaba). Cada hash es el mismo identificador
   que usa Deezer en su URL original; aquí solo apunta al archivo local. */
const ARTIST_FILES = {
  '1704c946d12640372d7066334ac823e8': 'burbujas-y-biblioteca-marcos-witt.png',
  '05b4dad5c940fefd8ea2f17e3e1c18eb': 'burbujas-y-biblioteca-christine-dclario.png',
  f9dfb04c040e8710647ebec8974cb8df: 'burbujas-y-biblioteca-jesus-adrian-romero.png',
  '0263d5df41a4cca3409e807144dd11f3': 'burbujas-y-biblioteca-miel-san-marcos.png',
  '31add829574547edffea89111511d8a4': 'burbujas-y-biblioteca-un-corazon.png',
  '07cf97750fd43e0a98ba461d360e56bc': 'burbujas-y-biblioteca-marcos-brunet.png',
  '4b2fcde4c32527d82ae725f913d333b1': 'burbujas-y-biblioteca-majo-y-dan.png',
  c110ca0115037181ff4e47503a3d0d50: 'burbujas-y-biblioteca-barak.png',
  '7aed01a4551f6bdad12fd81c714dfae4': 'burbujas-y-biblioteca-marcela-gandara.png',
  '01b253231de2ba0c70a5dbd1816d50d3': 'burbujas-y-biblioteca-elevation-worship.png',
  e9d6a7afb9046143103a9973bd6291a1: 'burbujas-y-biblioteca-hillsong-worship.png',
  c8efc84bfc6c5e6c2faa8a6125ef78a5: 'burbujas-y-biblioteca-marco-barrientos.png',
  f6fdc08f9ec1c353bf83056192ffbbab: 'burbujas-y-biblioteca-montesanto.png',
  '3cb9d606f13d0db4189f7262ab24c5a9': 'burbujas-y-biblioteca-lilly-goodman.png',
  '1dc12896f74b1d03f6293598028844da': 'burbujas-y-perfil-oasis-ministry.png',
  '13ec7b0cde8164f3ae49e5dbf6ae147b': 'burbujas-y-biblioteca-danilo-montero.png',
  '1ff9c2b0ca7e809671ab987f3149fc00': 'biblioteca-y-perfil-new-wine.png',
};
const ALBUM_FILES = {
  adbdedcd8c65b4cb9fafa8d532185576: 'album-recomendado-christine-dclario-emanuel.png',
  f6b5ed5ac48a8c14c04b3dcfda03ccc1: 'album-y-biblioteca-un-corazon-kintsugi.png',
  afa9a5cab82a58906de586865b92562f: 'album-recomendado-marcela-gandara-live.png',
  '57ee4b1583dcfb9510a0cd4b6f12f4bd': 'album-recomendado-marcos-witt-legado.png',
  d6693ba660bb3b5480bb7014c1e61b3b: 'album-recomendado-elevation-worship-old-church-basement.png',
  '517d934f92a2ae7cfbc588e22f38c993': 'portada-partitura-jesucristo-basta-un-corazon-x-siempre.png',
  '3a1412297619e3c8fdb1e99421e1470b': 'portada-partitura-transparente-un-corazon-en-vivo.png',
};
export const FALLBACK_IMG = 'public/img/artist-placeholder.svg';
export const artistImage = (hash) => (ARTIST_FILES[hash] ? `public/img/catalogo/artistas/${ARTIST_FILES[hash]}` : FALLBACK_IMG);
export const albumImage = (hash) => (ALBUM_FILES[hash] ? `public/img/catalogo/albumes/${ALBUM_FILES[hash]}` : FALLBACK_IMG);

export const ARTISTS = [
  { id: 'marcos-witt', name: 'Marcos Witt', image: artistImage('1704c946d12640372d7066334ac823e8'), country: 'México',
    bio: 'Una voz que ha acompañado a generaciones a acercarse a Dios. Descubre canciones que ya forman parte de nuestra historia de adoración.' },
  { id: 'christine', name: "Christine D'Clario", image: artistImage('05b4dad5c940fefd8ea2f17e3e1c18eb'), country: 'Puerto Rico',
    bio: 'Una adoración honesta, profunda y llena de esperanza. Encuentra melodías para conectar tu corazón con el de Dios.' },
  { id: 'jesus-romero', name: 'Jesús Adrián Romero', image: artistImage('f9dfb04c040e8710647ebec8974cb8df'), country: 'México',
    bio: 'Canciones que convierten lo cotidiano en un encuentro con la fe. Letras cercanas y melodías que invitan a detenerse y adorar.' },
  { id: 'miel', name: 'Miel San Marcos', image: artistImage('0263d5df41a4cca3409e807144dd11f3'), country: 'Guatemala',
    bio: 'Alabanza con pasión, unidad y propósito. Lleva a tu instrumento las canciones de una comunidad que adora a una sola voz.' },
  { id: 'un-corazon', name: 'Un Corazón', image: artistImage('31add829574547edffea89111511d8a4'), country: 'México',
    bio: 'Sonidos contemporáneos y un mensaje eterno. Una nueva generación de canciones que nos recuerda que Jesucristo basta.' },
  { id: 'brunet', name: 'Marcos Brunet', image: artistImage('07cf97750fd43e0a98ba461d360e56bc'), country: 'Argentina',
    bio: 'La intimidad con Dios hecha canción. Explora un repertorio que invita a buscar su presencia y tomar nuestro lugar como adoradores.' },
  { id: 'majo', name: 'Majo y Dan', image: artistImage('4b2fcde4c32527d82ae725f913d333b1'), country: 'México',
    bio: 'Melodías cálidas, sencillas y llenas de verdad. Canciones para acompañar tu camino de fe, a solas o en comunidad.' },
  { id: 'barak', name: 'Barak', image: artistImage('c110ca0115037181ff4e47503a3d0d50'), country: 'República Dominicana',
    bio: 'Una alabanza que une energía y entrega. Descubre canciones para celebrar, orar y levantar una nueva voz de adoración.' },
  { id: 'marcela', name: 'Marcela Gándara', image: artistImage('7aed01a4551f6bdad12fd81c714dfae4'), country: 'México',
    bio: 'Una voz serena y letras que abrazan el alma. Encuentra canciones para expresar un anhelo sincero por la presencia de Dios.' },
  { id: 'elevation', name: 'Elevation Worship', image: artistImage('01b253231de2ba0c70a5dbd1816d50d3'), country: 'Estados Unidos',
    bio: 'Canciones de fe para la iglesia de hoy. Descubre un repertorio que proclama esperanza y nos anima a confiar en sus promesas.' },
  { id: 'hillsong', name: 'Hillsong Worship', image: artistImage('e9d6a7afb9046143103a9973bd6291a1'), country: 'Australia',
    bio: 'Melodías que han unido a iglesias alrededor del mundo. Aprende canciones que trascienden idiomas y generaciones.' },
  { id: 'barrientos', name: 'Marco Barrientos', image: artistImage('c8efc84bfc6c5e6c2faa8a6125ef78a5'), country: 'México',
    bio: 'Alabanza y adoración que inspiran a buscar a Dios. Descubre un repertorio lleno de gratitud, fe y entrega.' },
  { id: 'montesanto', name: 'Montesanto', image: artistImage('f6fdc08f9ec1c353bf83056192ffbbab'), country: 'Venezuela',
    bio: 'Una generación que adora con libertad. Sonidos frescos y canciones que invitan a vivir la fe con todo el corazón.' },
  { id: 'lilly', name: 'Lilly Goodman', image: artistImage('3cb9d606f13d0db4189f7262ab24c5a9'), country: 'República Dominicana',
    bio: 'Historias de esperanza y melodías que nos recuerdan que nunca estamos solos. Encuentra una canción para cada etapa del camino.' },
  { id: 'oasis', name: 'Oasis Ministry', image: artistImage('1dc12896f74b1d03f6293598028844da'), country: 'República Dominicana',
    bio: 'Adoración nacida de la oración. Un espacio de encuentro a través de canciones que buscan la presencia de Dios.' },
  { id: 'danilo', name: 'Danilo Montero', image: artistImage('13ec7b0cde8164f3ae49e5dbf6ae147b'), country: 'Costa Rica',
    bio: 'Una vida dedicada a guiar a otros en adoración. Vuelve a canciones que invitan a confiar, agradecer y acercarse a Dios.' },
  { id: 'new-wine', name: 'New Wine', image: artistImage('1ff9c2b0ca7e809671ab987f3149fc00'), country: 'Estados Unidos',
    bio: 'Un ministerio de alabanza y adoración con una expresión vibrante de fe. Descubre canciones para tu tiempo de encuentro con Dios.' },
];

export const artistById = Object.fromEntries(ARTISTS.map((a) => [a.id, a]));

export const ALBUMS = [
  { id: 'emanuel', title: 'Emanuel', artistId: 'christine', image: albumImage('adbdedcd8c65b4cb9fafa8d532185576'), year: '2018' },
  { id: 'kintsugi', title: 'KINTSUGI', artistId: 'un-corazon', image: albumImage('f6b5ed5ac48a8c14c04b3dcfda03ccc1'), year: '2024' },
  { id: 'marcela-live', title: 'Marcela Gándara (Live)', artistId: 'marcela', image: albumImage('afa9a5cab82a58906de586865b92562f'), year: '2012' },
  { id: 'legado', title: 'Legado', artistId: 'marcos-witt', image: albumImage('57ee4b1583dcfb9510a0cd4b6f12f4bd'), year: '2025' },
  { id: 'old-church', title: 'Old Church Basement', artistId: 'elevation', image: albumImage('d6693ba660bb3b5480bb7014c1e61b3b'), year: '2021' },
];

const source = 'https://itemfunes.com/explore';
const mk = (id, title, artistId, free = true, instrument = 'Piano', category = 'Adoración', tone = 'Sol mayor', level = 'Intermedio', image, sourceUrl = source) =>
  ({ id, title, artistId, instrument, category, tone, level, free, image, sourceUrl, catalog: true });

/** Títulos y artistas del catálogo de itemfunes.com/explore. Metadatos de arreglo (tono, nivel) orientativos. */
export const CATALOG_SHEETS = [
  mk('al-estar-aqui', 'Al estar aquí', 'marcos-witt', true, 'Piano', 'Adoración', 'Re mayor', 'Inicial'),
  mk('dios-de-maravillas', 'Dios de maravillas', 'christine', true, 'Piano', 'Adoración', 'Sol mayor', 'Intermedio', undefined, 'https://itemfunes.com/product/dios-de-maravillas-christine-d-clario/'),
  mk('dame-tus-ojos', 'Dame tus ojos', 'marcela', true, 'Guitarra', 'Adoración', 'Do mayor', 'Inicial'),
  mk('hosanna', 'Hosanna', 'hillsong', true, 'Piano', 'Alabanza', 'Mi mayor', 'Intermedio', undefined, 'https://itemfunes.com/product/hosanna-hillsong/'),
  mk('jesucristo-basta', 'Jesucristo basta', 'un-corazon', true, 'Guitarra', 'Adoración', 'Re mayor', 'Inicial', albumImage('517d934f92a2ae7cfbc588e22f38c993')),
  mk('no-hay-lugar', 'No hay lugar más alto', 'miel', true, 'Piano', 'Adoración', 'La mayor', 'Intermedio'),
  mk('hermoso-nombre', 'Hermoso nombre', 'hillsong', true, 'Violín', 'Adoración', 'Re mayor', 'Inicial'),
  mk('esperar-en-ti', 'Esperar en ti', 'jesus-romero', true, 'Piano', 'Adoración', 'Do mayor', 'Inicial'),
  mk('te-deseo', 'Te deseo', 'majo', true, 'Guitarra', 'Adoración', 'Sol mayor', 'Intermedio'),
  mk('la-sunamita', 'La Sunamita', 'montesanto', true, 'Piano', 'Adoración', 'Si menor', 'Avanzado'),
  mk('como-te-amo', 'Cómo te amo (Papá)', 'brunet', true, 'Piano', 'Adoración', 'Re mayor', 'Inicial'),
  mk('a-danzar', 'A danzar', 'barak', true, 'Guitarra', 'Alabanza', 'Mi menor', 'Intermedio'),
  mk('somos-iglesia', 'Somos iglesia', 'un-corazon', true, 'Piano', 'Alabanza', 'La mayor', 'Intermedio', albumImage('f6b5ed5ac48a8c14c04b3dcfda03ccc1')),
  mk('hay-libertad', 'Hay libertad', 'miel', true, 'Guitarra', 'Alabanza', 'Re mayor', 'Intermedio'),
  mk('no-soy-esclavo', 'No soy esclavo', 'christine', true, 'Piano', 'Adoración', 'Si bemol mayor', 'Inicial'),
  mk('ven-espiritu', 'Ven Espíritu Santo', 'barak', true, 'Piano', 'Adoración', 'Sol mayor', 'Intermedio'),
  mk('al-que-esta', 'Al que está sentado en el trono', 'brunet', true, 'Violín', 'Adoración', 'Re mayor', 'Avanzado'),
  mk('ver-la-victoria', 'Ver la victoria', 'elevation', true, 'Guitarra', 'Alabanza', 'Si bemol mayor', 'Intermedio'),
  mk('sublime-gracia-cat', 'Sublime gracia', 'majo', true, 'Violín', 'Himnos', 'Sol mayor', 'Inicial'),
  mk('fuego-y-poder', 'Fuego y poder', 'barak', true, 'Piano', 'Alabanza', 'Mi menor', 'Avanzado'),
  mk('de-gloria', 'De gloria en gloria', 'barrientos', true, 'Guitarra', 'Alabanza', 'La mayor', 'Intermedio'),
  mk('dios-ha-sido-fiel', 'Dios ha sido fiel', 'marcos-witt', true, 'Piano', 'Adoración', 'Re mayor', 'Intermedio'),
  mk('fidelidad', 'Fidelidad', 'christine', true, 'Violín', 'Himnos', 'Do mayor', 'Inicial'),
  mk('a-quien-ire', 'A quién iré', 'danilo', true, 'Piano', 'Adoración', 'Sol mayor', 'Intermedio'),
  mk('sin-dolor', 'Sin dolor', 'lilly', true, 'Piano', 'Adoración', 'Fa mayor', 'Intermedio'),
  mk('transparente', 'Transparente', 'un-corazon', true, 'Guitarra', 'Adoración', 'Do mayor', 'Inicial', albumImage('3a1412297619e3c8fdb1e99421e1470b')),
  mk('bendita-oracion', 'Bendita oración', 'majo', true, 'Violín', 'Himnos', 'Re mayor', 'Inicial'),
  mk('agradecido', 'Agradecido', 'miel', true, 'Guitarra', 'Alabanza', 'Re mayor', 'Intermedio'),
  mk('yo-soy-la-ofrenda', 'Yo soy la ofrenda', 'montesanto', true, 'Piano', 'Adoración', 'Mi mayor', 'Avanzado'),
  mk('bautizados', 'Bautizados en fuego', 'montesanto', true, 'Guitarra', 'Alabanza', 'Mi menor', 'Avanzado'),
  mk('eres-mi-paz', 'Eres mi paz (Jehová Shalom)', 'new-wine', true, 'Piano', 'Adoración', 'Re mayor', 'Intermedio'),
  mk('remolino', 'Remolino', 'new-wine', true, 'Guitarra', 'Alabanza', 'Mi menor', 'Avanzado'),
  mk('lluvia', 'Lluvia', 'new-wine', true, 'Piano', 'Adoración', 'Sol mayor', 'Intermedio'),
  mk('tres-veces-santo', 'Al que es tres veces santo', 'new-wine', true, 'Violín', 'Adoración', 'La mayor', 'Intermedio'),
  mk('dios-ejercitos', 'Dios de los ejércitos', 'barrientos', true, 'Piano', 'Alabanza', 'Re menor', 'Avanzado'),
  mk('ven-espiritu-ven', 'Ven Espíritu, ven', 'barrientos', true, 'Violín', 'Adoración', 'Sol mayor', 'Inicial'),
  mk('alabanzas-rey', 'Alabanzas al Rey', 'marcela', true, 'Piano', 'Alabanza', 'Re mayor', 'Intermedio'),
  mk('es-navidad', 'Es Navidad', 'marcos-witt', true, 'Violín', 'Himnos', 'Do mayor', 'Inicial'),
  mk('ayer-te-vi', 'Ayer te vi', 'jesus-romero', true, 'Guitarra', 'Adoración', 'Sol mayor', 'Intermedio'),
  mk('amor-sin-condicion', 'Amor sin condición', 'barrientos', true, 'Piano', 'Adoración', 'Re mayor', 'Inicial'),
];

export const CATALOG_INSTRUMENTS = ['Piano', 'Guitarra', 'Violín'];
export const CATALOG_CATEGORIES = ['Adoración', 'Alabanza', 'Himnos'];
export const CATALOG_LEVELS = ['Inicial', 'Intermedio', 'Avanzado'];

/** Portadas destacadas, en el orden en que aparecen en el carrusel de artistas. */
export const HERO_COMPOSITION = [
  'miel',
  ['marcela', 'barak', 'lilly', 'un-corazon'],
  'jesus-romero',
  'christine',
  ['marcos-witt', 'majo', 'barrientos', 'brunet'],
  'montesanto',
  ['oasis', 'danilo', 'elevation', 'hillsong'],
  'brunet',
];

/** Ids destacados para la pestaña "Más populares" y la fila "Para tu próxima adoración". */
const POPULAR_IDS = ['jesucristo-basta', 'no-hay-lugar', 'hosanna', 'dios-de-maravillas', 'dame-tus-ojos', 'no-soy-esclavo', 'al-estar-aqui', 'esperar-en-ti'];
/** Igual que POPULAR_IDS pero por título: las obras reales (demo o Supabase) no
    comparten el id del catálogo, pero sí el título exacto con el que se sembraron. */
export const POPULAR_TITLES = POPULAR_IDS.map((id) => CATALOG_SHEETS.find((s) => s.id === id).title);

export function normalize(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

export function catalogSheetImage(sheet) { return sheet.image || (artistById[sheet.artistId] && artistById[sheet.artistId].image) || FALLBACK_IMG; }

/** Une una obra real (de la biblioteca) con su ficha del catálogo de artistas,
    comparando por título — así funciona tanto en modo demo (ids tipo slug) como
    en Supabase (ids uuid), sin importar cómo se haya sembrado la obra. */
export const metaByTitle = new Map(CATALOG_SHEETS.map((c) => [c.title, c]));

/** Elige una imagen estable (artista/álbum) para portadas que todavía no tienen una propia, como las obras reales de la biblioteca. */
export function pickFallbackImage(seed) {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = ARTISTS;
  return pool[h % pool.length].image;
}

/* ---------- Explorar: comunidades y perfiles de ejemplo, igual que el prototipo ---------- */
export const COMMUNITIES = [
  { id: 'pianistas', name: 'Pianistas de fe', subtitle: 'Cada tecla, una oración.',
    description: 'Un espacio para compartir consejos, descubrir nuevos arreglos y crecer juntos como pianistas. Desde tus primeros acordes hasta acompañar a tu iglesia.',
    image: 'public/img/catalogo/comunidades/comunidad-pianistas-de-fe.png', topic: 'Nuestra selección de partituras sencillas para empezar' },
  { id: 'adoracion', name: 'Adoración en comunidad', subtitle: 'Una misma fe. Muchas voces.',
    description: 'Conecta con quienes sirven en equipos de adoración. Comparte repertorios, encuentra inspiración y prepara tu próximo encuentro con propósito.',
    image: 'public/img/catalogo/comunidades/comunidad-adoracion-en-comunidad.png', topic: 'Canciones para preparar tu próxima reunión' },
  { id: 'cuerdas', name: 'Cuerdas para su gloria', subtitle: 'La fe también se expresa en cuerdas.',
    description: 'Guitarristas y violinistas aprendiendo juntos. Descubre técnicas, explora melodías y encuentra tu próximo reto musical.',
    image: 'public/img/catalogo/comunidades/comunidad-cuerdas-para-su-gloria.png', topic: 'Melodías de adoración para guitarra y violín' },
];

export const PROFILES = [
  { id: 'sofia', name: 'Sofía Mendoza', role: 'Pianista de corazón', initials: 'SM', color: '#e7d8d1', instrument: 'Piano' },
  { id: 'daniel', name: 'Daniel Ríos', role: 'Guitarrista y arreglista', initials: 'DR', color: '#dce2d8', instrument: 'Guitarra' },
  { id: 'valentina', name: 'Valentina Cruz', role: 'Violinista para su gloria', initials: 'VC', color: '#e5dceb', instrument: 'Violín' },
];
