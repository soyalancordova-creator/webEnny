/* ============================================================
   PRUEBAS DE SEGURIDAD (RLS) contra Postgres real
   ------------------------------------------------------------
   npm run test:rls
   Corre schema.sql + campus.sql sobre PGlite (Postgres compilado a
   WebAssembly) con un "Supabase mínimo" simulado: roles anon /
   authenticated / service_role, auth.uid() y el esquema storage.
   Cada prueba es un intento de ataque que la base DEBE bloquear, o
   una operación legítima que DEBE permitir.
============================================================ */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sql = (f) => readFileSync(join(here, '..', f), 'utf8');

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text not null, owner uuid default auth.uid());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
`;

const U = {
  enny: '00000000-0000-4000-8000-000000000001',
  ana: '00000000-0000-4000-8000-000000000002',   // alumna con suscripción
  beto: '00000000-0000-4000-8000-000000000003',  // alumno gratis
  caro: '00000000-0000-4000-8000-000000000004',  // alumna gratis, miembro de la privada
};

const db = new PGlite();
let pass = 0, failed = 0;
const results = [];

async function as(user, fn) {
  await db.exec('begin');
  try {
    if (user) { await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`); }
    else await db.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    const out = await fn();
    await db.exec('commit');
    return out;
  } catch (e) { await db.exec('rollback'); throw e; }
}
const q = async (text) => (await db.query(text)).rows;

async function allow(name, user, fn) {
  try { await as(user, fn); pass++; results.push(['✓', name]); }
  catch (e) { failed++; results.push(['✗', `${name}  →  debió permitirse: ${e.message}`]); }
}
// Solo cuenta como "bloqueado" un rechazo de seguridad. Un error de sintaxis o de
// columna inexistente también lanzaría excepción y daría un falso ✓.
const SECURITY_ERR = /row-level security|permission denied|violates|0 filas|Vas muy rápido|check constraint|vacío/i;
async function deny(name, user, fn) {
  try { await as(user, fn); failed++; results.push(['✗', `${name}  →  debió BLOQUEARSE y se permitió`]); }
  catch (e) {
    if (SECURITY_ERR.test(e.message)) { pass++; results.push(['✓', name]); }
    else { failed++; results.push(['✗', `${name}  →  falló por otra razón (¿prueba mal escrita?): ${e.message}`]); }
  }
}
async function expect(name, user, fn, check) {
  try { const v = await as(user, fn); if (check(v)) { pass++; results.push(['✓', name]); } else { failed++; results.push(['✗', `${name}  →  resultado inesperado: ${JSON.stringify(v).slice(0, 200)}`]); } }
  catch (e) { failed++; results.push(['✗', `${name}  →  error: ${e.message}`]); }
}
const rowsOrThrow = async (text) => { const r = await q(text); return r; };
const mustAffect = async (text) => { const r = await db.query(text); if (!r.affectedRows) throw new Error('0 filas afectadas (RLS lo filtró)'); return r; };

/* ---------------- montaje ---------------- */
await db.exec(SUPABASE_STUB);
await db.exec(sql('schema.sql'));
// CAMPUS_SQL permite correr la batería contra una versión mutada (prueba de las pruebas)
await db.exec(process.env.CAMPUS_SQL ? readFileSync(process.env.CAMPUS_SQL, 'utf8') : sql('campus.sql'));

// usuarios (el trigger crea los perfiles)
for (const [k, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now())`,
    [id, `${k}@test.ec`, JSON.stringify({ full_name: k[0].toUpperCase() + k.slice(1), age: k === 'beto' ? 14 : 30 })]);
}
await db.exec(`update public.profiles set role = 'admin' where id = '${U.enny}'`);
await db.exec(`update public.profiles set privacy = 'private', bio = 'bio secreta' where id = '${U.caro}'`);
// suscripción de Ana (la escribe el "servidor" = superusuario, como haría service_role)
await db.exec(`insert into public.subscriptions (user_id, provider, provider_sub_id, plan, status, current_period_end)
  values ('${U.ana}', 'paypal', 'I-ANA000001', 'anual', 'active', now() + interval '300 days')`);
// biblioteca
await db.exec(`insert into public.scores (id, title, free, published) values
  ('10000000-0000-4000-8000-000000000001', 'Obra paga', false, true),
  ('10000000-0000-4000-8000-000000000002', 'Obra gratis', true, true),
  ('10000000-0000-4000-8000-000000000003', 'Borrador', false, false);
  insert into public.score_assets (score_id, xml_path, media_url) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/score.musicxml', 'https://youtu.be/xxxxxxxxxxx'),
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002/score.musicxml', null);
  insert into storage.objects (bucket_id, name) values
  ('scores', '10000000-0000-4000-8000-000000000001/score.musicxml'),
  ('scores', '10000000-0000-4000-8000-000000000002/score.musicxml');`);

/* ---------------- 1. perfiles y roles ---------------- */
await deny('Alumno no puede auto-ascenderse a admin', U.beto, () => mustAffect(`update public.profiles set role = 'admin' where id = '${U.beto}'`));
await allow('Alumno sí puede editar su propio perfil', U.beto, () => mustAffect(`update public.profiles set bio = 'hola' where id = '${U.beto}'`));
await deny('Alumno no puede editar el perfil de otra persona', U.beto, () => mustAffect(`update public.profiles set bio = 'hackeado' where id = '${U.ana}'`));
await expect('La vista pública nunca expone la edad', U.beto, () => q(`select * from public.public_profiles limit 1`), (r) => r.length && !('age' in r[0]));
await expect('Perfil privado: la bio no se ve para otros', U.beto, () => q(`select bio, full_name from public.public_profiles where id = '${U.caro}'`), (r) => r.length === 1 && r[0].bio === null && r[0].full_name === 'Caro');
await expect('Perfil privado: la dueña sí ve su bio', U.caro, () => q(`select bio from public.public_profiles where id = '${U.caro}'`), (r) => r[0].bio === 'bio secreta');
await deny('Visitante sin sesión no puede listar perfiles', null, () => q(`select * from public.public_profiles`));
await expect('Alumno no ve la tabla profiles completa de otros (edad incluida)', U.beto, () => q(`select age from public.profiles where id = '${U.ana}'`), (r) => r.length === 0);

/* ---------------- 2. suscripciones ---------------- */
await deny('Alumno no puede regalarse una suscripción', U.beto, () => q(`insert into public.subscriptions (user_id, plan, status, current_period_end) values ('${U.beto}', 'anual', 'active', now() + interval '1 year')`));
await deny('Alumna no puede extender su propia suscripción', U.ana, () => mustAffect(`update public.subscriptions set current_period_end = now() + interval '10 years' where user_id = '${U.ana}'`));
await expect('Alumno no ve la suscripción de otra persona', U.beto, () => q(`select * from public.subscriptions`), (r) => r.length === 0);
await expect('Alumna ve su propia suscripción', U.ana, () => q(`select plan from public.subscriptions`), (r) => r.length === 1 && r[0].plan === 'anual');
await expect('Admin ve todas las suscripciones', U.enny, () => q(`select * from public.subscriptions`), (r) => r.length === 1);
await db.exec(`insert into public.payment_events (id, type, payload) values ('WH-1', 'PAYMENT.SALE.COMPLETED', '{}')`);
await expect('Ni siquiera la admin ve el registro de pagos desde el navegador', U.enny, () => q(`select * from public.payment_events`), (r) => r.length === 0);

/* ---------------- 3. biblioteca y muro de pago ---------------- */
await expect('Alumno gratis ve los metadatos de la obra paga (para saber qué desbloquea)', U.beto, () => q(`select title from public.scores where free = false and published`), (r) => r.length === 1);
await expect('Alumno gratis NO obtiene el archivo de la obra paga', U.beto, () => q(`select * from public.score_assets where score_id = '10000000-0000-4000-8000-000000000001'`), (r) => r.length === 0);
await expect('Alumno gratis NO ve el enlace de video de la obra paga', U.beto, () => q(`select media_url from public.score_assets`), (r) => !r.some((x) => x.media_url));
await expect('Alumno gratis SÍ obtiene la obra gratuita', U.beto, () => q(`select * from public.score_assets where score_id = '10000000-0000-4000-8000-000000000002'`), (r) => r.length === 1);
await expect('Alumna suscrita obtiene la obra paga', U.ana, () => q(`select * from public.score_assets where score_id = '10000000-0000-4000-8000-000000000001'`), (r) => r.length === 1);
await expect('Storage: alumno gratis no descarga el MusicXML pago', U.beto, () => q(`select name from storage.objects where bucket_id = 'scores'`), (r) => r.length === 1 && r[0].name.startsWith('10000000-0000-4000-8000-000000000002'));
await expect('Storage: alumna suscrita descarga ambos', U.ana, () => q(`select name from storage.objects where bucket_id = 'scores'`), (r) => r.length === 2);
await expect('Borradores ocultos para alumnos', U.ana, () => q(`select * from public.scores where published = false`), (r) => r.length === 0);
await expect('Borradores visibles para admin', U.enny, () => q(`select * from public.scores where published = false`), (r) => r.length === 1);
await deny('Alumna suscrita no puede subir ni editar obras', U.ana, () => q(`insert into public.scores (title) values ('pirata')`));
await deny('Alumno no puede publicar un borrador', U.beto, () => mustAffect(`update public.scores set published = true where title = 'Borrador'`));
await allow('Admin crea obras', U.enny, () => q(`insert into public.scores (title, published) values ('Nueva', true) returning id`));
// cancelada dentro del periodo → conserva acceso; vencida → lo pierde
await db.exec(`update public.subscriptions set status = 'cancelled' where user_id = '${U.ana}'`);
await expect('Cancelada pero en periodo pagado: conserva acceso', U.ana, () => q(`select * from public.score_assets where score_id = '10000000-0000-4000-8000-000000000001'`), (r) => r.length === 1);
await db.exec(`update public.subscriptions set current_period_end = now() - interval '1 day' where user_id = '${U.ana}'`);
await expect('Vencida: pierde el acceso', U.ana, () => q(`select * from public.score_assets where score_id = '10000000-0000-4000-8000-000000000001'`), (r) => r.length === 0);
await db.exec(`update public.subscriptions set status = 'active', current_period_end = now() + interval '300 days' where user_id = '${U.ana}'`);

/* ---------------- 4. comunidades ---------------- */
let priv, pub;
await allow('Admin crea comunidad privada (queda como dueña por trigger)', U.enny, async () => { priv = (await q(`insert into public.communities (name, privacy, owner_id) values ('Oración', 'private', '${U.enny}') returning id`))[0].id; });
await allow('Alumno crea comunidad pública', U.beto, async () => { pub = (await q(`insert into public.communities (name, privacy, owner_id) values ('Violines', 'public', '${U.beto}') returning id`))[0].id; });
await deny('No se puede crear una comunidad a nombre de otra persona', U.beto, () => q(`insert into public.communities (name, owner_id) values ('Falsa', '${U.enny}')`));
await deny('Unirse a una privada como "activo" directamente: bloqueado', U.caro, () => q(`insert into public.community_members (community_id, user_id, status) values ('${priv}', '${U.caro}', 'active')`));
await deny('Unirse con rol de moderador: bloqueado', U.caro, () => q(`insert into public.community_members (community_id, user_id, role, status) values ('${priv}', '${U.caro}', 'admin', 'pending')`));
await allow('Solicitar acceso a la privada (pendiente)', U.caro, () => q(`insert into public.community_members (community_id, user_id, status) values ('${priv}', '${U.caro}', 'pending')`));
await expect('Solicitud genera notificación a la dueña', U.enny, () => q(`select title from public.notifications where kind = 'group'`), (r) => r.length === 1 && /pidió unirse/.test(r[0].title));
await deny('Pendiente no puede auto-aprobarse', U.caro, () => mustAffect(`update public.community_members set status = 'active' where community_id = '${priv}' and user_id = '${U.caro}'`));
await deny('Otro alumno no puede aprobar solicitudes ajenas', U.beto, () => mustAffect(`update public.community_members set status = 'active' where community_id = '${priv}' and user_id = '${U.caro}'`));
await allow('Chat privado: mensaje de la dueña', U.enny, () => q(`insert into public.community_messages (community_id, author_id, body) values ('${priv}', '${U.enny}', 'bienvenidos')`));
await expect('No miembro no lee el chat privado', U.beto, () => q(`select * from public.community_messages where community_id = '${priv}'`), (r) => r.length === 0);
await expect('Pendiente tampoco lee el chat privado', U.caro, () => q(`select * from public.community_messages where community_id = '${priv}'`), (r) => r.length === 0);
await deny('No miembro no escribe en el chat privado', U.beto, () => q(`insert into public.community_messages (community_id, author_id, body) values ('${priv}', '${U.beto}', 'spam')`));
await deny('Nadie escribe mensajes a nombre de otra persona', U.enny, () => q(`insert into public.community_messages (community_id, author_id, body) values ('${priv}', '${U.caro}', 'suplantación')`));
await allow('La dueña aprueba la solicitud', U.enny, () => mustAffect(`update public.community_members set status = 'active' where community_id = '${priv}' and user_id = '${U.caro}'`));
await expect('Aprobación notifica a la alumna', U.caro, () => q(`select title from public.notifications where kind = 'group'`), (r) => r.some((x) => /Te aceptaron/.test(x.title)));
await expect('Ya aprobada: lee el chat', U.caro, () => q(`select * from public.community_messages where community_id = '${priv}'`), (r) => r.length === 1);
await deny('Miembro no puede ascenderse a moderadora', U.caro, () => mustAffect(`update public.community_members set role = 'admin' where community_id = '${priv}' and user_id = '${U.caro}'`));
await deny('Nadie puede expulsar a la dueña', U.enny, () => mustAffect(`delete from public.community_members where community_id = '${priv}' and user_id = '${U.enny}'`));
await expect('Conteo de integrantes visible sin exponer quiénes son', U.beto, () => q(`select members from public.community_stats where community_id = '${priv}'`), (r) => r.length === 1 && Number(r[0].members) === 2);
await allow('Unirse a una pública queda activo', U.ana, () => q(`insert into public.community_members (community_id, user_id, status) values ('${pub}', '${U.ana}', 'active')`));

/* ---------------- 5. feed ---------------- */
let postPriv, postFeed;
await allow('Publicar en el feed general', U.beto, async () => { postFeed = (await q(`insert into public.feed_posts (author_id, body) values ('${U.beto}', 'hola') returning id`))[0].id; });
await deny('Publicar a nombre de otra persona', U.beto, () => q(`insert into public.feed_posts (author_id, body) values ('${U.ana}', 'suplantación')`));
await deny('Publicar en comunidad privada sin ser miembro', U.beto, () => q(`insert into public.feed_posts (author_id, community_id, body) values ('${U.beto}', '${priv}', 'x')`));
await allow('Miembro publica en la privada', U.caro, async () => { postPriv = (await q(`insert into public.feed_posts (author_id, community_id, body) values ('${U.caro}', '${priv}', 'petición privada') returning id`))[0].id; });
await expect('Publicación privada invisible para no miembros', U.beto, () => q(`select * from public.feed_posts where id = '${postPriv}'`), (r) => r.length === 0);
await deny('No miembro no reacciona a una publicación privada', U.beto, () => q(`insert into public.feed_reactions (post_id, user_id, kind) values ('${postPriv}', '${U.beto}', 'amen')`));
await deny('No miembro no comenta una publicación privada', U.beto, () => q(`insert into public.feed_comments (post_id, author_id, body) values ('${postPriv}', '${U.beto}', 'x')`));
await deny('Reaccionar a nombre de otra persona', U.ana, () => q(`insert into public.feed_reactions (post_id, user_id, kind) values ('${postFeed}', '${U.caro}', 'amen')`));
await deny('Reacción inventada ("like") rechazada', U.ana, () => q(`insert into public.feed_reactions (post_id, user_id, kind) values ('${postFeed}', '${U.ana}', 'like')`));
await allow('Reaccionar "Orando"', U.ana, () => q(`insert into public.feed_reactions (post_id, user_id, kind) values ('${postFeed}', '${U.ana}', 'orando')`));
await expect('La reacción notifica al autor', U.beto, () => q(`select title from public.notifications where kind = 'reaction'`), (r) => r.length === 1);
await deny('Editar publicación ajena', U.ana, () => mustAffect(`update public.feed_posts set body = 'editado' where id = '${postFeed}'`));
let cm;
await allow('Comentar', U.ana, async () => { cm = (await q(`insert into public.feed_comments (post_id, author_id, body) values ('${postFeed}', '${U.ana}', 'amén') returning id`))[0].id; });
await deny('Borrar comentario ajeno sin ser autor del post', U.caro, () => mustAffect(`delete from public.feed_comments where id = '${cm}'`));
await allow('El autor de la publicación modera comentarios de su hilo', U.beto, () => mustAffect(`delete from public.feed_comments where id = '${cm}'`));
await deny('Borrar publicación ajena', U.ana, () => mustAffect(`delete from public.feed_posts where id = '${postFeed}'`));
await deny('Guardar a nombre de otra persona', U.ana, () => q(`insert into public.feed_saves (user_id, post_id) values ('${U.beto}', '${postFeed}')`));
await deny('Visitante sin sesión no lee el feed', null, () => q(`select * from public.feed_posts`).then((r) => { if (!r.length) throw new Error('vacío'); }));

/* ---------------- 6. notificaciones ---------------- */
await deny('Alumno no puede crear notificaciones personales (spam/phishing)', U.beto, () => q(`insert into public.notifications (user_id, kind, title) values ('${U.ana}', 'system', 'Tu cuenta será cerrada, entra aquí')`));
await deny('Alumno no puede enviar avisos a todos', U.beto, () => q(`insert into public.notifications (user_id, kind, title) values (null, 'broadcast', 'falso')`));
await deny('Admin tampoco puede poner un enlace externo en un aviso', U.enny, () => q(`insert into public.notifications (user_id, kind, title, link) values (null, 'broadcast', 'x', 'https://phishing.example')`));
await allow('Admin envía aviso general', U.enny, () => q(`insert into public.notifications (user_id, kind, title, link) values (null, 'broadcast', 'Nueva obra', '#/biblioteca')`));
await expect('Todos ven el aviso general', U.beto, () => q(`select * from public.notifications where kind = 'broadcast'`), (r) => r.length === 1);
await expect('Nadie ve las notificaciones personales de otros', U.caro, () => q(`select * from public.notifications where user_id = '${U.beto}'`), (r) => r.length === 0);

/* ---------------- 7. moderación ---------------- */
await deny('Reportar a nombre de otra persona', U.beto, () => q(`insert into public.reports (reporter_id, target_kind, target_id) values ('${U.ana}', 'post', '${postFeed}')`));
await allow('Reportar contenido', U.caro, () => q(`insert into public.reports (reporter_id, target_kind, target_id, reason) values ('${U.caro}', 'post', '${postFeed}', 'spam')`));
await expect('El alumno no ve los reportes (anonimato de quien reporta)', U.beto, () => q(`select * from public.reports`), (r) => r.length === 0);
await expect('Admin ve los reportes', U.enny, () => q(`select * from public.reports`), (r) => r.length === 1);

/* ---------------- 8. storage de fotos ---------------- */
await allow('Subir foto bajo su propia carpeta', U.ana, () => q(`insert into storage.objects (bucket_id, name) values ('feed', '${U.ana}/p/0.webp')`));
await deny('Subir foto en la carpeta de otra persona', U.ana, () => q(`insert into storage.objects (bucket_id, name) values ('feed', '${U.beto}/p/0.webp')`));
await deny('Subir al chat de una comunidad donde no es miembro', U.beto, () => q(`insert into storage.objects (bucket_id, name) values ('chat', '${priv}/${U.beto}/x.webp')`));
await deny('Alumno no puede subir partituras al bucket privado', U.ana, () => q(`insert into storage.objects (bucket_id, name) values ('scores', 'x/score.musicxml')`));

/* ---------------- 9. anti-spam ---------------- */
await deny('Límite: la 6ª publicación en un minuto se rechaza', U.caro, async () => { for (let i = 0; i < 6; i++) await q(`insert into public.feed_posts (author_id, body) values ('${U.caro}', 'spam ${i}')`); });

/* ---------------- resultado ---------------- */
results.forEach(([s, n]) => console.log(`${s} ${n}`));
console.log(`\n${pass} pruebas pasaron · ${failed} fallaron`);
process.exit(failed ? 1 : 0);
