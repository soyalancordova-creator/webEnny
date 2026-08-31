-- ============================================================
-- ENNY TORO · esquema completo
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFILES  (extiende auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  age         int check (age is null or (age >= 5 and age <= 120)),
  avatar_url  text,
  bio         text,
  role        text not null default 'student' check (role in ('student','admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Se crea el perfil solo cuando el usuario se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, age)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'age','')::int
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- is_admin() con SECURITY DEFINER: evita la recursión infinita
-- que ocurre si una policy de profiles vuelve a consultar profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 2. CONTENIDO EDITABLE DEL SITIO
-- ------------------------------------------------------------

-- Bloques sueltos (hero, sobre mí, contacto, ajustes) como JSON.
create table if not exists public.site_content (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Las 5 tarjetas que aparecen sobre el video.
create table if not exists public.video_cards (
  id         uuid primary key default gen_random_uuid(),
  position   int  not null default 0,
  badge      text,
  title      text not null default '',
  body       text default '',
  image_url  text,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Servicios.
create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  position   int  not null default 0,
  eyebrow    text,
  title      text not null default '',
  body       text default '',
  image_url  text,
  cta_text   text default 'Más información',
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Galería.
create table if not exists public.gallery (
  id         uuid primary key default gen_random_uuid(),
  position   int  not null default 0,
  image_url  text not null,
  caption    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Blog.
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text default '',
  cover_url    text,
  category     text default 'General',
  read_min     int  default 5,
  published    boolean not null default false,
  published_at timestamptz default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists posts_pub_idx on public.posts (published, published_at desc);

-- Biblioteca de partituras y recursos (campus).
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  category    text default 'Partituras',
  level       text default 'Todos',
  file_url    text,
  cover_url   text,
  position    int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Proyectos que sube cada alumno.
create table if not exists public.student_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  image_url   text,
  created_at  timestamptz not null default now()
);
create index if not exists sp_user_idx on public.student_projects (user_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS  ·  todo cerrado por defecto, se abre a propósito
-- ------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.site_content     enable row level security;
alter table public.video_cards      enable row level security;
alter table public.services         enable row level security;
alter table public.gallery          enable row level security;
alter table public.posts            enable row level security;
alter table public.resources        enable row level security;
alter table public.student_projects enable row level security;

-- PROFILES ---------------------------------------------------
drop policy if exists "perfil propio: leer"      on public.profiles;
drop policy if exists "perfil propio: editar"    on public.profiles;
drop policy if exists "admin: leer perfiles"     on public.profiles;
drop policy if exists "admin: editar perfiles"   on public.profiles;

create policy "perfil propio: leer"   on public.profiles for select using (auth.uid() = id);
create policy "perfil propio: editar" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
  -- ^ el alumno NO puede auto-ascenderse a admin
create policy "admin: leer perfiles"   on public.profiles for select using (public.is_admin());
create policy "admin: editar perfiles" on public.profiles for update using (public.is_admin());

-- CONTENIDO PÚBLICO: lectura abierta, escritura solo admin ----
do $$
declare t text;
begin
  foreach t in array array['site_content','video_cards','services','gallery','resources']
  loop
    execute format('drop policy if exists "lectura pública" on public.%I', t);
    execute format('drop policy if exists "admin escribe"   on public.%I', t);
    execute format('create policy "lectura pública" on public.%I for select using (true)', t);
    execute format('create policy "admin escribe"   on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- POSTS: público solo ve los publicados -----------------------
drop policy if exists "posts publicados" on public.posts;
drop policy if exists "admin posts"      on public.posts;
create policy "posts publicados" on public.posts for select using (published = true or public.is_admin());
create policy "admin posts"      on public.posts for all
  using (public.is_admin()) with check (public.is_admin());

-- PROYECTOS DEL ALUMNO ---------------------------------------
drop policy if exists "proyectos propios"  on public.student_projects;
drop policy if exists "admin ve proyectos" on public.student_projects;
create policy "proyectos propios"  on public.student_projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin ve proyectos" on public.student_projects for select using (public.is_admin());

-- ------------------------------------------------------------
-- 4. STORAGE
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media','media',true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars',true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('projects','projects',true)
  on conflict (id) do nothing;

drop policy if exists "media lectura"  on storage.objects;
drop policy if exists "media admin"    on storage.objects;
drop policy if exists "avatar lectura" on storage.objects;
drop policy if exists "avatar propio"  on storage.objects;
drop policy if exists "proy lectura"   on storage.objects;
drop policy if exists "proy propio"    on storage.objects;

create policy "media lectura" on storage.objects for select using (bucket_id = 'media');
create policy "media admin"   on storage.objects for all
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- Cada usuario solo puede tocar archivos bajo su propio uid/
create policy "avatar lectura" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar propio"  on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "proy lectura" on storage.objects for select using (bucket_id = 'projects');
create policy "proy propio"  on storage.objects for all
  using (bucket_id = 'projects' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'projects' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- 5. VISTA DE MÉTRICAS PARA EL PANEL
-- ------------------------------------------------------------
create or replace view public.admin_stats
with (security_invoker = true) as
  select
    (select count(*) from public.profiles)                                    as total_alumnos,
    (select count(*) from public.profiles
       where created_at > now() - interval '7 days')                          as nuevos_7d,
    (select count(*) from public.profiles
       where created_at > now() - interval '30 days')                         as nuevos_30d,
    (select count(*) from auth.users where email_confirmed_at is not null)    as verificados,
    (select count(*) from public.posts where published)                       as posts_publicados,
    (select count(*) from public.resources where active)                      as recursos,
    (select count(*) from public.student_projects)                            as proyectos;

-- ------------------------------------------------------------
-- 6. CONTENIDO INICIAL (solo si está vacío)
-- ------------------------------------------------------------
insert into public.site_content (key, data) values
('hero', '{
  "eyebrow":"Violinista · Docente · Guayaquil",
  "title_1":"Enny Toro",
  "title_2":"violín & alma",
  "text":"Más de una década uniendo el rigor del escenario clásico con una pedagogía que respira emoción. Cada nota es una conversación entre el corazón y quien escucha.",
  "image":"public/img/enny-editorial-beige.jpg",
  "cta_1":"Reservar una clase",
  "cta_2":"Ver trayectoria",
  "caption_l":"Guayaquil · Ecuador",
  "caption_r":"2026"
}'::jsonb),
('scene', '{
  "eyebrow":"El violín · capa a capa",
  "title":"Un instrumento se <em>desarma</em> para contar su historia"
}'::jsonb),
('stats', '{
  "items":[
    {"n":10,"suffix":"+","label":"Años de trayectoria"},
    {"n":150,"suffix":"+","label":"Alumnos formados"},
    {"n":40,"suffix":"+","label":"Conciertos y recitales"},
    {"n":1,"suffix":"","label":"Método propio"}
  ]
}'::jsonb),
('about', '{
  "eyebrow":"Sobre mí",
  "title":"Un don <em>transformado</em><br>en propósito",
  "lead":"Descubrí temprano que el violín no era un instrumento: era una voz. Hoy la uso para enseñar, acompañar y sostener momentos que importan.",
  "p1":"Desde niña entendí que cada arcada podía decir algo que las palabras no alcanzaban. Esa certeza me llevó del estudio disciplinado al escenario, y del escenario al aula.",
  "p2":"Trabajo con estudiantes de todos los niveles: desde quien toma el violín por primera vez hasta músicos que buscan pulir sonido, afinación y presencia. No enseño un molde; ordeno la técnica para que aparezca la voz propia de cada alumno.",
  "p3":"En paralelo acompaño bodas, cultos, recitales y eventos privados en Guayaquil y alrededores, donde la música tiene que servir al momento y no robárselo.",
  "tags":["Técnica clásica","Adoración","Repertorio contemporáneo","Lectura a primera vista","Preparación escénica","Arreglos a medida"],
  "image":"public/img/enny-editorial-negro.jpg",
  "note_title":"Enny & Alan Córdova",
  "note_text":"Este sitio nace en casa. Alan, esposo de Enny, es desarrollador de software con años de experiencia en inteligencia artificial, y se encarga de la parte técnica y digital del proyecto.",
  "note_image":"public/img/enny-alan.jpg"
}'::jsonb),
('contact', '{
  "eyebrow":"Contacto",
  "title":"Hablemos de<br>tu <em>música</em>",
  "email":"ennytorov@gmail.com",
  "whatsapp":"593959460818",
  "whatsapp_label":"+593 95 946 0818",
  "instagram":"ennytoro",
  "location":"Guayaquil, Ecuador",
  "calendly":""
}'::jsonb),
('band', '{
  "eyebrow":"¿Empezamos?",
  "title":"Tu primera clase puede ser <em>esta semana</em>",
  "text":"Cuéntame tu nivel y tu objetivo. Te respondo en menos de 24 horas con un plan concreto.",
  "cta":"Agendar ahora"
}'::jsonb),
('community', '{
  "title":"Clases pregrabadas",
  "text":"Todo el contenido en video vive en nuestra comunidad. Entra para ver las clases, hacer preguntas y compartir tu avance.",
  "url":"",
  "button":"Entrar a la comunidad"
}'::jsonb)
on conflict (key) do nothing;

-- Tarjetas del video
insert into public.video_cards (position, badge, title, body, image_url)
select * from (values
  (1,'01','Más de 10 años de trayectoria','Del aula al escenario: una década construyendo oficio, repertorio y una manera propia de sonar.','public/img/enny-escenario.jpg'),
  (2,'02','Pedagogía y docencia avanzada','Más de 150 alumnos formados con un método que ordena la técnica sin apagar la voz de cada persona.','public/img/enny-estudio.jpg'),
  (3,'03','Expresión artística disruptiva','El violín fuera de su caja: clásico, adoración y contemporáneo conviviendo en un mismo lenguaje.','public/img/enny-editorial-negro.jpg'),
  (4,'04','Del escenario clásico al culto','Más de 40 conciertos, recitales y ceremonias donde la música sostiene el momento, no lo interrumpe.','public/img/enny-concierto.jpg'),
  (5,'05','Un método propio, hecho a mano','Material, digitaciones y arreglos escritos clase a clase. Nada genérico: todo pensado para tu mano.','public/img/enny-partituras.jpg')
) as v
where not exists (select 1 from public.video_cards);

-- Servicios
insert into public.services (position, eyebrow, title, body, image_url, cta_text)
select * from (values
  (1,'Formación','Clases particulares','Presenciales u online, para todos los niveles. Técnica, repertorio y expresión adaptados a tu ritmo y a tu objetivo real.','public/img/enny-estudio.jpg','Consultar disponibilidad'),
  (2,'Presentaciones','Conciertos & eventos','Bodas, cultos, cenas, ceremonias y eventos corporativos. Repertorio elegido contigo y ensayado para el momento exacto.','public/img/enny-concierto.jpg','Solicitar presentación'),
  (3,'Avanzado','Masterclass intensiva','Sesiones enfocadas en sonido, afinación, vibrato y presencia escénica para músicos que ya tocan y quieren dar el salto.','public/img/enny-tocando.jpg','Más información')
) as v
where not exists (select 1 from public.services);

-- Galería
insert into public.gallery (position, image_url, caption)
select * from (values
  (1,'public/img/enny-escenario.jpg','En escenario'),
  (2,'public/img/enny-editorial-beige.jpg','Editorial'),
  (3,'public/img/enny-rostro.jpg','Retrato'),
  (4,'public/img/enny-partituras.jpg','Partituras'),
  (5,'public/img/enny-concierto.jpg','Concierto'),
  (6,'public/img/enny-escenario2.jpg','Ensayo'),
  (7,'public/img/enny-tocando.jpg','Interpretando')
) as v
where not exists (select 1 from public.gallery);

-- Artículos del blog
insert into public.posts (slug, title, excerpt, body, category, read_min, published, cover_url)
select * from (values
  ('tecnica-puerta-expresion','La técnica como puerta a la expresión',
   'La técnica no es el fin, es el camino. Cuando el instrumento deja de estorbar, aparece el arte.',
   E'<p>Hay una idea que repito en casi todas mis clases: la técnica no es el objetivo, es el permiso.</p><p>Mientras tu mano izquierda todavía tiene que pensar dónde cae cada dedo, tu cabeza no está disponible para la música. Toda tu atención se va en resolver el instrumento. Por eso el trabajo técnico no es lo contrario de la expresión: es lo que la hace posible.</p><h3>Qué trabajar primero</h3><p>Antes que velocidad, busca estabilidad. Un sonido parejo en arcadas largas dice más de tu nivel que una escala rápida y sucia. Empieza por ahí: cuerdas al aire, arco entero, sin prisa, escuchando de verdad.</p><h3>La señal de que vas bien</h3><p>Sabes que la técnica está haciendo su trabajo cuando puedes decidir algo musical en mitad de una frase y tu cuerpo lo obedece. Ese es el momento en que el violín deja de ser un obstáculo.</p>',
   'Técnica',5,true,'public/img/enny-partituras.jpg'),
  ('practica-consciente','Práctica consciente vs. horas vacías',
   'No importa cuántas horas practicas, sino cómo. Los principios que uso para acelerar el avance real.',
   E'<p>Muchos alumnos llegan frustrados: «practico todos los días y no avanzo». Casi siempre el problema no es la cantidad de horas, es qué pasa dentro de esas horas.</p><h3>Repetir no es practicar</h3><p>Tocar la misma pieza diez veces de principio a fin no es práctica: es ensayo de tus errores. Si un pasaje falla en el compás 14, tocar los trece anteriores otra vez no lo arregla.</p><h3>El bucle corto</h3><p>Aísla el problema hasta que sea diminuto. Dos notas, si hace falta. Tócalas lento, correctas, cinco veces seguidas. Recién ahí súbele velocidad. Si falla, vuelves a bajar.</p><h3>Veinte minutos bien puestos</h3><p>Prefiero un alumno con veinte minutos de atención real que uno con dos horas de piloto automático. La concentración es el recurso escaso, no el tiempo.</p>',
   'Método',7,true,'public/img/enny-estudio.jpg'),
  ('nervios-escenario','Nervios en el escenario',
   'Todos los sentimos. Lo que hago antes de salir a tocar para convertir el nervio en energía y no en bloqueo.',
   E'<p>Después de más de cuarenta conciertos te puedo decir una cosa: los nervios no se van. Cambian de forma, pero no se van. Y está bien.</p><h3>El nervio no es el enemigo</h3><p>Esa activación es tu cuerpo preparándose. El problema aparece cuando la interpretas como una señal de que algo va a salir mal. Entonces se convierte en miedo, y el miedo sí te tensa la mano.</p><h3>Lo que hago antes de salir</h3><p>Respiro largo y lento, más tiempo soltando el aire que tomándolo. Muevo los hombros. Y repaso mentalmente solo el primer compás: no la obra entera, solo cómo empieza. Entrar bien resuelve la mitad del problema.</p><h3>Prepara el escenario, no solo la obra</h3><p>Toca delante de gente antes del concierto. Tu familia, un amigo, quien sea. La primera vez que tocas una pieza frente a alguien nunca debería ser el día del recital.</p>',
   'Escenario',6,true,'public/img/enny-escenario.jpg')
) as v
where not exists (select 1 from public.posts);

-- Recursos de ejemplo para el campus
insert into public.resources (position, title, description, category, level)
select * from (values
  (1,'Escalas mayores · digitaciones','Hoja de escalas en dos octavas con las digitaciones que usamos en clase.','Partituras','Inicial'),
  (2,'Ejercicios de arco','Rutina de calentamiento para sonido parejo y control de arcada.','Ejercicios','Todos'),
  (3,'Repertorio de adoración','Selección de arreglos para culto, con acordes y sugerencias de dinámica.','Partituras','Intermedio')
) as v
where not exists (select 1 from public.resources);

-- ============================================================
-- LISTO.
-- Último paso manual: convertirte en admin. Regístrate en la web y luego:
--   update public.profiles set role = 'admin' where id =
--     (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
-- ============================================================
