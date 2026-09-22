-- ============================================================
-- CAMPUS · red social + biblioteca de partituras + suscripciones
-- Ejecutar DESPUÉS de schema.sql (usa profiles e is_admin()).
-- Idempotente: se puede volver a correr.
--
-- Principios:
--  · Toda la seguridad vive aquí (RLS). El front puede mentir; la base no.
--  · Nadie crea notificaciones personales desde el navegador: solo triggers.
--  · Nadie escribe su propia suscripción: solo el servidor (service_role)
--    después de verificar el pago con PayPal.
--  · Los archivos de partituras y grabaciones son privados; se sirven con
--    URL firmada solo a quien tiene suscripción activa.
--  · La edad del alumno nunca se expone a otros usuarios.
-- ============================================================

-- dueño de un archivo según la convención de rutas "<uid>/..."
create or replace function public.storage_path_owner(p text) returns uuid
language sql immutable as $$
  select case when split_part(p, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p, '/', 1)::uuid end;
$$;

-- ------------------------------------------------------------
-- 0. PERFIL AMPLIADO + VISTA PÚBLICA
-- ------------------------------------------------------------
alter table public.profiles add column if not exists service   text check (service is null or char_length(service) <= 120);
alter table public.profiles add column if not exists church    text check (church is null or char_length(church) <= 120);
alter table public.profiles add column if not exists city      text check (city is null or char_length(city) <= 120);
alter table public.profiles add column if not exists social    text check (social is null or char_length(social) <= 160);
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists privacy   text not null default 'public' check (privacy in ('public','private'));
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 400);

-- Lo que los demás pueden ver de un perfil. Sin edad, sin correo.
-- Vista con privilegios del dueño (a propósito): expone solo estas columnas
-- y respeta la privacidad elegida por el alumno.
drop view if exists public.public_profiles;
create view public.public_profiles as
  select p.id, p.full_name, p.avatar_url, p.cover_url, p.service, p.role, p.privacy, p.created_at,
         case when p.privacy = 'public' or p.id = auth.uid() then p.bio    end as bio,
         case when p.privacy = 'public' or p.id = auth.uid() then p.church end as church,
         case when p.privacy = 'public' or p.id = auth.uid() then p.city   end as city,
         case when p.privacy = 'public' or p.id = auth.uid() then p.social end as social
  from public.profiles p;
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ------------------------------------------------------------
-- 1. COMUNIDADES
-- ------------------------------------------------------------
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 400),
  rules       text not null default '' check (char_length(rules) <= 800),
  privacy     text not null default 'public' check (privacy in ('public','private')),
  cover_url   text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  status       text not null default 'active' check (status in ('active','pending')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists cm_user_idx on public.community_members (user_id, status);

create table if not exists public.community_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references auth.users(id) on delete cascade,
  body         text not null default '' check (char_length(body) <= 2000),
  image_path   text,
  created_at   timestamptz not null default now(),
  check (char_length(body) > 0 or image_path is not null)
);
create index if not exists msg_comm_idx on public.community_messages (community_id, created_at desc);

-- helpers con SECURITY DEFINER: evitan recursión de RLS entre tablas que se consultan entre sí
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members
                 where community_id = cid and user_id = auth.uid() and status = 'active');
$$;
create or replace function public.is_community_manager(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.community_members
         where community_id = cid and user_id = auth.uid() and status = 'active' and role in ('owner','admin'));
$$;
create or replace function public.community_is_public(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = cid and privacy = 'public');
$$;
revoke execute on function public.is_member(uuid), public.is_community_manager(uuid), public.community_is_public(uuid) from anon;
grant  execute on function public.is_member(uuid), public.is_community_manager(uuid), public.community_is_public(uuid) to authenticated;

-- quien crea la comunidad queda como dueña (no depende del navegador)
create or replace function public.community_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active') on conflict do nothing;
  return new;
end $$;
drop trigger if exists community_owner on public.communities;
create trigger community_owner after insert on public.communities
  for each row execute function public.community_add_owner();

alter table public.communities        enable row level security;
alter table public.community_members  enable row level security;
alter table public.community_messages enable row level security;

drop policy if exists "com: ver"      on public.communities;
drop policy if exists "com: crear"    on public.communities;
drop policy if exists "com: editar"   on public.communities;
drop policy if exists "com: borrar"   on public.communities;
create policy "com: ver"    on public.communities for select to authenticated using (true);
create policy "com: crear"  on public.communities for insert to authenticated with check (owner_id = auth.uid());
create policy "com: editar" on public.communities for update to authenticated
  using (public.is_community_manager(id)) with check (public.is_community_manager(id));
create policy "com: borrar" on public.communities for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "mem: ver"       on public.community_members;
drop policy if exists "mem: unirse"    on public.community_members;
drop policy if exists "mem: gestionar" on public.community_members;
drop policy if exists "mem: salir"     on public.community_members;
create policy "mem: ver" on public.community_members for select to authenticated using (
  user_id = auth.uid()
  or (status = 'active' and (public.community_is_public(community_id) or public.is_member(community_id)))
  or public.is_community_manager(community_id));
-- uno solo puede inscribirse a sí mismo, como miembro, y en privadas entra "pendiente"
create policy "mem: unirse" on public.community_members for insert to authenticated with check (
  user_id = auth.uid() and role = 'member'
  and status = case when public.community_is_public(community_id) then 'active' else 'pending' end);
create policy "mem: gestionar" on public.community_members for update to authenticated
  using (public.is_community_manager(community_id)
         and user_id <> (select owner_id from public.communities c where c.id = community_id))
  with check (role in ('admin','member'));
create policy "mem: salir" on public.community_members for delete to authenticated using (
  (user_id = auth.uid() and role <> 'owner')
  or (public.is_community_manager(community_id) and role <> 'owner'));

-- conteos visibles para todos (sin exponer QUIÉNES son los miembros de una privada)
create or replace view public.community_stats as
  select community_id,
         count(*) filter (where status = 'active')  as members,
         count(*) filter (where status = 'pending') as pending
  from public.community_members group by community_id;
revoke all on public.community_stats from anon;
grant select on public.community_stats to authenticated;

drop policy if exists "msg: leer"    on public.community_messages;
drop policy if exists "msg: escribir" on public.community_messages;
drop policy if exists "msg: borrar"  on public.community_messages;
create policy "msg: leer"     on public.community_messages for select to authenticated
  using (public.is_member(community_id) or public.is_admin());
create policy "msg: escribir" on public.community_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_member(community_id));
create policy "msg: borrar"   on public.community_messages for delete to authenticated
  using (author_id = auth.uid() or public.is_community_manager(community_id));

-- ------------------------------------------------------------
-- 2. FEED (publicaciones, fotos, reacciones, comentarios, guardados)
-- ------------------------------------------------------------
create table if not exists public.feed_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  type         text not null default 'reflexion' check (type in ('reflexion','pregunta','recomendacion','oracion','testimonio')),
  body         text not null default '' check (char_length(body) <= 3000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists fp_feed_idx on public.feed_posts (community_id, created_at desc);
create index if not exists fp_author_idx on public.feed_posts (author_id, created_at desc);

create table if not exists public.feed_media (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.feed_posts(id) on delete cascade,
  path     text not null unique,
  width    int, height int,
  position int not null default 0
);

create table if not exists public.feed_reactions (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('amen','orando','aleluya')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.feed_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  parent_id  uuid references public.feed_comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index if not exists fc_post_idx on public.feed_comments (post_id, created_at);

create table if not exists public.feed_saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create or replace function public.can_see_post(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feed_posts p where p.id = pid and (
    p.community_id is null or public.community_is_public(p.community_id)
    or public.is_member(p.community_id) or public.is_admin()));
$$;
revoke execute on function public.can_see_post(uuid) from anon;
grant  execute on function public.can_see_post(uuid) to authenticated;

alter table public.feed_posts     enable row level security;
alter table public.feed_media     enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feed_comments  enable row level security;
alter table public.feed_saves     enable row level security;

drop policy if exists "fp: ver"      on public.feed_posts;
drop policy if exists "fp: publicar" on public.feed_posts;
drop policy if exists "fp: editar"   on public.feed_posts;
drop policy if exists "fp: borrar"   on public.feed_posts;
create policy "fp: ver" on public.feed_posts for select to authenticated using (
  community_id is null or public.community_is_public(community_id) or public.is_member(community_id) or public.is_admin());
create policy "fp: publicar" on public.feed_posts for insert to authenticated with check (
  author_id = auth.uid() and (community_id is null or public.is_member(community_id)));
create policy "fp: editar" on public.feed_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "fp: borrar" on public.feed_posts for delete to authenticated using (
  author_id = auth.uid() or public.is_admin()
  or (community_id is not null and public.is_community_manager(community_id)));

drop policy if exists "fm: ver"   on public.feed_media;
drop policy if exists "fm: subir" on public.feed_media;
drop policy if exists "fm: borrar" on public.feed_media;
create policy "fm: ver"   on public.feed_media for select to authenticated using (public.can_see_post(post_id));
create policy "fm: subir" on public.feed_media for insert to authenticated with check (
  exists (select 1 from public.feed_posts p where p.id = post_id and p.author_id = auth.uid())
  and (storage_path_owner(path) = auth.uid()));
create policy "fm: borrar" on public.feed_media for delete to authenticated using (
  exists (select 1 from public.feed_posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_admin())));

drop policy if exists "fr: ver"      on public.feed_reactions;
drop policy if exists "fr: poner"    on public.feed_reactions;
drop policy if exists "fr: cambiar"  on public.feed_reactions;
drop policy if exists "fr: quitar"   on public.feed_reactions;
create policy "fr: ver"     on public.feed_reactions for select to authenticated using (public.can_see_post(post_id));
create policy "fr: poner"   on public.feed_reactions for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));
create policy "fr: cambiar" on public.feed_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fr: quitar"  on public.feed_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "fc: ver"      on public.feed_comments;
drop policy if exists "fc: comentar" on public.feed_comments;
drop policy if exists "fc: borrar"   on public.feed_comments;
create policy "fc: ver"      on public.feed_comments for select to authenticated using (public.can_see_post(post_id));
create policy "fc: comentar" on public.feed_comments for insert to authenticated with check (author_id = auth.uid() and public.can_see_post(post_id));
-- el autor del comentario, el autor de la publicación (modera su hilo) o un admin
create policy "fc: borrar"   on public.feed_comments for delete to authenticated using (
  author_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.feed_posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "fs: propios" on public.feed_saves;
create policy "fs: propios" on public.feed_saves for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_post(post_id));

-- ------------------------------------------------------------
-- 3. REPORTES (moderación)
-- ------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('post','comment','message','profile')),
  target_id   uuid not null,
  reason      text not null default '' check (char_length(reason) <= 500),
  status      text not null default 'open' check (status in ('open','removed','dismissed')),
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "rep: crear" on public.reports;
drop policy if exists "rep: admin" on public.reports;
create policy "rep: crear" on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "rep: admin" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 4. NOTIFICACIONES
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,   -- null = aviso para todos
  kind       text not null check (kind in ('broadcast','reaction','comment','group','system')),
  title      text not null check (char_length(title) <= 160),
  body       text not null default '' check (char_length(body) <= 600),
  link       text not null default '' check (char_length(link) <= 200 and (link = '' or link like '#/%')),
  actor_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx on public.notifications (user_id, created_at desc);
create table if not exists public.notification_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  primary key (user_id, notification_id)
);
alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;
drop policy if exists "nt: ver"     on public.notifications;
drop policy if exists "nt: avisar"  on public.notifications;
drop policy if exists "nt: borrar"  on public.notifications;
create policy "nt: ver"    on public.notifications for select to authenticated using (user_id = auth.uid() or user_id is null);
-- desde el navegador solo un admin puede crear avisos generales; los personales los crean triggers
create policy "nt: avisar" on public.notifications for insert to authenticated with check (public.is_admin() and user_id is null and kind = 'broadcast');
create policy "nt: borrar" on public.notifications for delete to authenticated using (public.is_admin());
drop policy if exists "nr: propias" on public.notification_reads;
create policy "nr: propias" on public.notification_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify(target uuid, k text, t text, b text, l text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if target is null or target = auth.uid() then return; end if;
  insert into public.notifications (user_id, kind, title, body, link, actor_id)
  values (target, k, left(t, 160), left(coalesce(b, ''), 600), left(coalesce(l, ''), 200), auth.uid());
end $$;
revoke execute on function public.notify(uuid, text, text, text, text) from anon, authenticated;

create or replace function public.display_name(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), 'Alguien') from public.profiles where id = uid;
$$;

create or replace function public.on_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  select author_id into a from public.feed_posts where id = new.post_id;
  perform public.notify(a, 'reaction', public.display_name(auth.uid()) || ' reaccionó a tu publicación', '', '#/publicacion/' || new.post_id);
  return new;
end $$;
drop trigger if exists feed_reaction_notify on public.feed_reactions;
create trigger feed_reaction_notify after insert on public.feed_reactions for each row execute function public.on_reaction();

create or replace function public.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid; pa uuid;
begin
  select author_id into a from public.feed_posts where id = new.post_id;
  perform public.notify(a, 'comment', public.display_name(auth.uid()) || ' comentó tu publicación', left(new.body, 120), '#/publicacion/' || new.post_id);
  if new.parent_id is not null then
    select author_id into pa from public.feed_comments where id = new.parent_id;
    if pa is distinct from a then
      perform public.notify(pa, 'comment', public.display_name(auth.uid()) || ' respondió tu comentario', left(new.body, 120), '#/publicacion/' || new.post_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists feed_comment_notify on public.feed_comments;
create trigger feed_comment_notify after insert on public.feed_comments for each row execute function public.on_comment();

create or replace function public.on_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid; n text;
begin
  select owner_id, name into o, n from public.communities where id = new.community_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(o, 'group', public.display_name(new.user_id) || ' pidió unirse a ' || n, '', '#/comunidad/' || new.community_id || '/integrantes');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(new.user_id, 'group', 'Te aceptaron en ' || n, '', '#/comunidad/' || new.community_id);
  end if;
  return new;
end $$;
drop trigger if exists membership_notify on public.community_members;
create trigger membership_notify after insert or update on public.community_members for each row execute function public.on_membership();

-- ------------------------------------------------------------
-- 5. ANTI-SPAM (límite por minuto, en la base, no en el navegador)
-- ------------------------------------------------------------
create or replace function public.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; lim int := tg_argv[0]::int; col text := tg_argv[1];
begin
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - interval ''1 minute''', tg_table_schema, tg_table_name, col)
    into n using auth.uid();
  if n >= lim then raise exception 'Vas muy rápido. Espera un momento antes de volver a publicar.' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists rl_posts on public.feed_posts;
create trigger rl_posts before insert on public.feed_posts for each row execute function public.rate_limit('5', 'author_id');
drop trigger if exists rl_comments on public.feed_comments;
create trigger rl_comments before insert on public.feed_comments for each row execute function public.rate_limit('20', 'author_id');
drop trigger if exists rl_messages on public.community_messages;
create trigger rl_messages before insert on public.community_messages for each row execute function public.rate_limit('30', 'author_id');
drop trigger if exists rl_communities on public.communities;
create trigger rl_communities before insert on public.communities for each row execute function public.rate_limit('3', 'owner_id');

-- ------------------------------------------------------------
-- 6. SUSCRIPCIONES (solo el servidor escribe)
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  provider           text not null default 'paypal' check (provider in ('paypal','manual')),
  provider_sub_id    text unique,
  plan               text not null check (plan in ('mensual','trimestral','anual')),
  status             text not null check (status in ('pending','active','cancelled','suspended','expired')),
  current_period_end timestamptz,
  updated_at         timestamptz not null default now()
);
create table if not exists public.payment_events (
  id         text primary key,             -- id del evento de PayPal (idempotencia)
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.subscriptions  enable row level security;
alter table public.payment_events enable row level security;
drop policy if exists "sub: ver" on public.subscriptions;
create policy "sub: ver" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- sin políticas de insert/update: solo service_role (que salta RLS) puede escribir.
-- payment_events: sin políticas → inaccesible desde el navegador.

create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.subscriptions
    where user_id = auth.uid() and status in ('active','cancelled') and current_period_end > now());
$$;
-- 'cancelled' sigue dando acceso hasta el fin del periodo pagado
revoke execute on function public.has_access() from anon;
grant  execute on function public.has_access() to authenticated;

-- ------------------------------------------------------------
-- 7. BIBLIOTECA DE PARTITURAS
-- ------------------------------------------------------------
create table if not exists public.score_collections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 300),
  position    int not null default 0
);

-- metadatos: los ve cualquier alumno con cuenta (así sabe qué hay y qué está bloqueado)
create table if not exists public.scores (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) <= 160),
  composer      text not null default '' check (char_length(composer) <= 160),
  instrument    text not null default 'Violín',
  level         text not null default 'Inicial' check (level in ('Inicial','Intermedio','Avanzado')),
  key_label     text not null default '',
  bpm           int  not null default 80 check (bpm between 20 and 300),
  collection_id uuid references public.score_collections(id) on delete set null,
  tags          text[] not null default '{}',
  free          boolean not null default false,
  published     boolean not null default false,
  has_media     boolean not null default false,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- archivos y sincronización: SOLO con suscripción (o si la obra es gratuita)
create table if not exists public.score_assets (
  score_id  uuid primary key references public.scores(id) on delete cascade,
  xml_path  text,            -- bucket privado "scores"
  pdf_path  text,            -- bucket privado "scores"
  media_url text,            -- ruta en bucket "score-media" o enlace de YouTube
  sync      jsonb            -- [seg, seg, ...] inicio de cada pase de compás
);

create table if not exists public.score_favorites (
  user_id  uuid not null references auth.users(id) on delete cascade,
  score_id uuid not null references public.scores(id) on delete cascade,
  primary key (user_id, score_id)
);

alter table public.score_collections enable row level security;
alter table public.scores            enable row level security;
alter table public.score_assets      enable row level security;
alter table public.score_favorites   enable row level security;

drop policy if exists "col: ver"   on public.score_collections;
drop policy if exists "col: admin" on public.score_collections;
create policy "col: ver"   on public.score_collections for select to authenticated using (true);
create policy "col: admin" on public.score_collections for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sc: ver"   on public.scores;
drop policy if exists "sc: admin" on public.scores;
create policy "sc: ver"   on public.scores for select to authenticated using (published or public.is_admin());
create policy "sc: admin" on public.scores for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.can_open_score(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.scores s
    where s.id = sid and s.published and (s.free or public.has_access()));
$$;
revoke execute on function public.can_open_score(uuid) from anon;
grant  execute on function public.can_open_score(uuid) to authenticated;

drop policy if exists "sa: ver"   on public.score_assets;
drop policy if exists "sa: admin" on public.score_assets;
create policy "sa: ver"   on public.score_assets for select to authenticated using (public.can_open_score(score_id));
create policy "sa: admin" on public.score_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "fav: propios" on public.score_favorites;
create policy "fav: propios" on public.score_favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- 8. STORAGE
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('feed',        'feed',        false, 5242880,   array['image/webp','image/jpeg','image/png']),
  ('chat',        'chat',        false, 5242880,   array['image/webp','image/jpeg','image/png']),
  ('community',   'community',   true,  5242880,   array['image/webp','image/jpeg','image/png']),
  ('scores',      'scores',      false, 15728640,  array['application/vnd.recordare.musicxml+xml','application/vnd.recordare.musicxml','application/xml','text/xml','application/octet-stream','application/zip','application/pdf']),
  ('score-media', 'score-media', false, 262144000, array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/webp','image/jpeg','image/png'] where id = 'avatars';

drop policy if exists "feed: subir"   on storage.objects;
drop policy if exists "feed: ver"     on storage.objects;
drop policy if exists "feed: borrar"  on storage.objects;
create policy "feed: subir"  on storage.objects for insert to authenticated with check (bucket_id = 'feed' and public.storage_path_owner(name) = auth.uid());
-- solo si la publicación a la que pertenece es visible para quien pide
create policy "feed: ver"    on storage.objects for select to authenticated using (bucket_id = 'feed' and exists (select 1 from public.feed_media m where m.path = name));
create policy "feed: borrar" on storage.objects for delete to authenticated using (bucket_id = 'feed' and (public.storage_path_owner(name) = auth.uid() or public.is_admin()));

drop policy if exists "chat: subir" on storage.objects;
drop policy if exists "chat: ver"   on storage.objects;
-- ruta "<community_id>/<uid>/archivo"
create policy "chat: subir" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat' and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_member(split_part(name, '/', 1)::uuid));
create policy "chat: ver" on storage.objects for select to authenticated using (
  bucket_id = 'chat' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
  and (public.is_member(split_part(name, '/', 1)::uuid) or public.is_admin()));

drop policy if exists "comm: ver"    on storage.objects;
drop policy if exists "comm: gestor" on storage.objects;
create policy "comm: ver"    on storage.objects for select using (bucket_id = 'community');
create policy "comm: gestor" on storage.objects for all to authenticated
  using (bucket_id = 'community' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_community_manager(split_part(name, '/', 1)::uuid))
  with check (bucket_id = 'community' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_community_manager(split_part(name, '/', 1)::uuid));

drop policy if exists "scores: ver"   on storage.objects;
drop policy if exists "scores: admin" on storage.objects;
create policy "scores: ver" on storage.objects for select to authenticated using (
  bucket_id in ('scores','score-media') and exists (
    select 1 from public.score_assets a
    where (a.xml_path = name or a.pdf_path = name or a.media_url = name) and public.can_open_score(a.score_id)));
create policy "scores: admin" on storage.objects for all to authenticated
  using (bucket_id in ('scores','score-media') and public.is_admin())
  with check (bucket_id in ('scores','score-media') and public.is_admin());

-- ------------------------------------------------------------
-- 9. TIEMPO REAL (chat y notificaciones). RLS también filtra lo que llega.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'community_messages') then
      alter publication supabase_realtime add table public.community_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;

-- ------------------------------------------------------------
-- 10. MÉTRICAS DEL PANEL (con RLS del que pregunta → solo admin ve todo)
-- ------------------------------------------------------------
create or replace view public.campus_stats with (security_invoker = true) as
  select
    (select count(*) from public.profiles)                                                as users,
    (select count(*) from public.profiles where created_at > now() - interval '7 days')   as new_users_7d,
    (select count(*) from public.subscriptions where status = 'active' and current_period_end > now()) as active_subs,
    (select count(*) from public.scores)                                                  as scores,
    (select count(*) from public.feed_posts)                                              as posts,
    (select count(*) from public.communities)                                             as groups,
    (select count(*) from public.reports where status = 'open')                           as reports;
revoke all on public.campus_stats from anon;
