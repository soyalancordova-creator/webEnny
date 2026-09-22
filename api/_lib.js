/* ============================================================
   Utilidades de servidor (Vercel Functions). No es una ruta: los
   archivos que empiezan con "_" en /api no se publican como función.
   ------------------------------------------------------------
   Variables de entorno (Vercel → Settings → Environment Variables):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
     PAYPAL_ENV (sandbox | live), PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
     PAYPAL_WEBHOOK_ID
     PAYPAL_PLAN_MENSUAL, PAYPAL_PLAN_TRIMESTRAL, PAYPAL_PLAN_ANUAL
   La service_role SOLO existe aquí. Jamás en el navegador.
============================================================ */
'use strict';

function env(name) {
  const v = process.env[name];
  if (!v) throw Object.assign(new Error(`Falta la variable de entorno ${name}`), { status: 500, expose: false });
  return v;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Errores: al cliente solo le llega un mensaje genérico salvo que sea "expose". */
function fail(res, e) {
  const status = e.status || 500;
  if (status >= 500) console.error('[api]', e.message);
  send(res, status, { error: e.expose ? e.message : 'No pudimos procesar la solicitud.' });
}
const bad = (status, message) => Object.assign(new Error(message), { status, expose: true });

async function readRaw(req, limit = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw bad(413, 'Solicitud demasiado grande.'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

/* ---------- Supabase ---------- */
async function supaUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token || token.length > 4096) throw bad(401, 'Inicia sesión de nuevo.');
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw bad(401, 'Tu sesión terminó. Vuelve a entrar.');
  const u = await r.json();
  if (!u || !u.id) throw bad(401, 'Tu sesión terminó. Vuelve a entrar.');
  return u;
}

async function db(path, { method = 'GET', body, prefer } = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error(`Supabase ${r.status}: ${text.slice(0, 300)}`); e.status = r.status === 409 ? 409 : 500; e.body = text; throw e;
  }
  return text ? JSON.parse(text) : null;
}

/* ---------- PayPal ---------- */
const PP_BASE = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
let ppToken = null;
async function paypalToken() {
  if (ppToken && ppToken.exp > Date.now() + 60000) return ppToken.value;
  const basic = Buffer.from(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`).toString('base64');
  const r = await fetch(`${PP_BASE()}/v1/oauth2/token`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`PayPal auth ${r.status}`);
  const j = await r.json();
  ppToken = { value: j.access_token, exp: Date.now() + (j.expires_in || 300) * 1000 };
  return ppToken.value;
}

async function paypal(path, { method = 'GET', body, rawBody } = {}) {
  const r = await fetch(`${PP_BASE()}${path}`, {
    method, headers: { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok && r.status !== 204) throw new Error(`PayPal ${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function planById(planId) {
  const map = { [process.env.PAYPAL_PLAN_MENSUAL]: 'mensual', [process.env.PAYPAL_PLAN_TRIMESTRAL]: 'trimestral', [process.env.PAYPAL_PLAN_ANUAL]: 'anual' };
  delete map.undefined;
  return map[planId] || null;
}
const MONTHS = { mensual: 1, trimestral: 3, anual: 12 };

function mapStatus(s) {
  return { APPROVAL_PENDING: 'pending', APPROVED: 'active', ACTIVE: 'active', SUSPENDED: 'suspended', CANCELLED: 'cancelled', EXPIRED: 'expired' }[s] || 'pending';
}

/** Fin del periodo pagado: próxima fecha de cobro de PayPal, o calculado si aún no la hay. */
function periodEnd(sub, plan) {
  const next = sub.billing_info && sub.billing_info.next_billing_time;
  if (next) return new Date(next).toISOString();
  const d = new Date(sub.start_time || Date.now());
  d.setMonth(d.getMonth() + (MONTHS[plan] || 1));
  return d.toISOString();
}

async function saveSubscription(userId, sub) {
  const plan = planById(sub.plan_id);
  if (!plan) throw bad(400, 'Ese plan no pertenece a la academia.');
  const row = { user_id: userId, provider: 'paypal', provider_sub_id: sub.id, plan, status: mapStatus(sub.status), current_period_end: periodEnd(sub, plan), updated_at: new Date().toISOString() };
  await db('subscriptions?on_conflict=user_id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });
  return row;
}

module.exports = { env, send, fail, bad, readRaw, supaUser, db, paypal, planById, mapStatus, periodEnd, saveSubscription };
