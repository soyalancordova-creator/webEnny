-- ============================================================
-- CATÁLOGO DE ARTISTAS · siembra opcional para producción
-- ------------------------------------------------------------
-- Las mismas 40 obras que ya ves en modo demo (catalog-data.js,
-- títulos de itemfunes.com/explore). No tienen archivo propio
-- todavía: al abrirlas, getScore() en store-supa.js sirve un
-- arreglo de muestra (el mismo motor del modo demo) hasta que
-- subas el MusicXML real desde Panel de Hosannia → Partituras.
-- Ahí mismo decides, obra por obra, si es gratis o de suscripción
-- (columna "free") y si se publica (columna "published").
--
-- Es idempotente: se puede correr varias veces sin duplicar filas
-- (compara por título + compositor, que no tiene restricción única
-- propia en el esquema).
-- ============================================================

insert into public.scores (title, composer, instrument, level, key_label, bpm, tags, free, published)
select v.title, v.composer, v.instrument, v.level, v.key_label, v.bpm, v.tags, v.free, v.published
from (values
  ('Al estar aquí', 'Marcos Witt', 'Piano', 'Inicial', 'Re mayor', 80, array['Marcos Witt','Adoración'], true, true),
  ('Dios de maravillas', 'Christine D''Clario', 'Piano', 'Intermedio', 'Sol mayor', 80, array['Christine D''Clario','Adoración'], true, true),
  ('Dame tus ojos', 'Marcela Gándara', 'Guitarra', 'Inicial', 'Do mayor', 80, array['Marcela Gándara','Adoración'], true, true),
  ('Hosanna', 'Hillsong Worship', 'Piano', 'Intermedio', 'Mi mayor', 80, array['Hillsong Worship','Alabanza'], true, true),
  ('Jesucristo basta', 'Un Corazón', 'Guitarra', 'Inicial', 'Re mayor', 80, array['Un Corazón','Adoración'], true, true),
  ('No hay lugar más alto', 'Miel San Marcos', 'Piano', 'Intermedio', 'La mayor', 80, array['Miel San Marcos','Adoración'], true, true),
  ('Hermoso nombre', 'Hillsong Worship', 'Violín', 'Inicial', 'Re mayor', 80, array['Hillsong Worship','Adoración'], true, true),
  ('Esperar en ti', 'Jesús Adrián Romero', 'Piano', 'Inicial', 'Do mayor', 80, array['Jesús Adrián Romero','Adoración'], true, true),
  ('Te deseo', 'Majo y Dan', 'Guitarra', 'Intermedio', 'Sol mayor', 80, array['Majo y Dan','Adoración'], true, true),
  ('La Sunamita', 'Montesanto', 'Piano', 'Avanzado', 'Si menor', 80, array['Montesanto','Adoración'], true, true),
  ('Cómo te amo (Papá)', 'Marcos Brunet', 'Piano', 'Inicial', 'Re mayor', 80, array['Marcos Brunet','Adoración'], true, true),
  ('A danzar', 'Barak', 'Guitarra', 'Intermedio', 'Mi menor', 80, array['Barak','Alabanza'], true, true),
  ('Somos iglesia', 'Un Corazón', 'Piano', 'Intermedio', 'La mayor', 80, array['Un Corazón','Alabanza'], true, true),
  ('Hay libertad', 'Miel San Marcos', 'Guitarra', 'Intermedio', 'Re mayor', 80, array['Miel San Marcos','Alabanza'], true, true),
  ('No soy esclavo', 'Christine D''Clario', 'Piano', 'Inicial', 'Si bemol mayor', 80, array['Christine D''Clario','Adoración'], true, true),
  ('Ven Espíritu Santo', 'Barak', 'Piano', 'Intermedio', 'Sol mayor', 80, array['Barak','Adoración'], true, true),
  ('Al que está sentado en el trono', 'Marcos Brunet', 'Violín', 'Avanzado', 'Re mayor', 80, array['Marcos Brunet','Adoración'], true, true),
  ('Ver la victoria', 'Elevation Worship', 'Guitarra', 'Intermedio', 'Si bemol mayor', 80, array['Elevation Worship','Alabanza'], true, true),
  ('Sublime gracia', 'Majo y Dan', 'Violín', 'Inicial', 'Sol mayor', 80, array['Majo y Dan','Himnos'], true, true),
  ('Fuego y poder', 'Barak', 'Piano', 'Avanzado', 'Mi menor', 80, array['Barak','Alabanza'], true, true),
  ('De gloria en gloria', 'Marco Barrientos', 'Guitarra', 'Intermedio', 'La mayor', 80, array['Marco Barrientos','Alabanza'], true, true),
  ('Dios ha sido fiel', 'Marcos Witt', 'Piano', 'Intermedio', 'Re mayor', 80, array['Marcos Witt','Adoración'], true, true),
  ('Fidelidad', 'Christine D''Clario', 'Violín', 'Inicial', 'Do mayor', 80, array['Christine D''Clario','Himnos'], true, true),
  ('A quién iré', 'Danilo Montero', 'Piano', 'Intermedio', 'Sol mayor', 80, array['Danilo Montero','Adoración'], true, true),
  ('Sin dolor', 'Lilly Goodman', 'Piano', 'Intermedio', 'Fa mayor', 80, array['Lilly Goodman','Adoración'], true, true),
  ('Transparente', 'Un Corazón', 'Guitarra', 'Inicial', 'Do mayor', 80, array['Un Corazón','Adoración'], true, true),
  ('Bendita oración', 'Majo y Dan', 'Violín', 'Inicial', 'Re mayor', 80, array['Majo y Dan','Himnos'], true, true),
  ('Agradecido', 'Miel San Marcos', 'Guitarra', 'Intermedio', 'Re mayor', 80, array['Miel San Marcos','Alabanza'], true, true),
  ('Yo soy la ofrenda', 'Montesanto', 'Piano', 'Avanzado', 'Mi mayor', 80, array['Montesanto','Adoración'], true, true),
  ('Bautizados en fuego', 'Montesanto', 'Guitarra', 'Avanzado', 'Mi menor', 80, array['Montesanto','Alabanza'], true, true),
  ('Eres mi paz (Jehová Shalom)', 'New Wine', 'Piano', 'Intermedio', 'Re mayor', 80, array['New Wine','Adoración'], true, true),
  ('Remolino', 'New Wine', 'Guitarra', 'Avanzado', 'Mi menor', 80, array['New Wine','Alabanza'], true, true),
  ('Lluvia', 'New Wine', 'Piano', 'Intermedio', 'Sol mayor', 80, array['New Wine','Adoración'], true, true),
  ('Al que es tres veces santo', 'New Wine', 'Violín', 'Intermedio', 'La mayor', 80, array['New Wine','Adoración'], true, true),
  ('Dios de los ejércitos', 'Marco Barrientos', 'Piano', 'Avanzado', 'Re menor', 80, array['Marco Barrientos','Alabanza'], true, true),
  ('Ven Espíritu, ven', 'Marco Barrientos', 'Violín', 'Inicial', 'Sol mayor', 80, array['Marco Barrientos','Adoración'], true, true),
  ('Alabanzas al Rey', 'Marcela Gándara', 'Piano', 'Intermedio', 'Re mayor', 80, array['Marcela Gándara','Alabanza'], true, true),
  ('Es Navidad', 'Marcos Witt', 'Violín', 'Inicial', 'Do mayor', 80, array['Marcos Witt','Himnos'], true, true),
  ('Ayer te vi', 'Jesús Adrián Romero', 'Guitarra', 'Intermedio', 'Sol mayor', 80, array['Jesús Adrián Romero','Adoración'], true, true),
  ('Amor sin condición', 'Marco Barrientos', 'Piano', 'Inicial', 'Re mayor', 80, array['Marco Barrientos','Adoración'], true, true)
) as v(title, composer, instrument, level, key_label, bpm, tags, free, published)
where not exists (
  select 1 from public.scores s where s.title = v.title and s.composer = v.composer
);
