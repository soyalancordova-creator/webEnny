/* POST /api/paypal/webhook
   PayPal avisa renovaciones, cancelaciones, suspensiones y vencimientos.
   1. Se verifica la FIRMA con la API de PayPal (si no, cualquiera podría
      "activarse" una suscripción mandando un JSON falso).
   2. Idempotencia: cada evento se guarda por id; si llega dos veces, se ignora.
   3. Siempre se vuelve a consultar la suscripción a PayPal: el estado que
      manda el evento no se usa directo. */
'use strict';
const { env, send, fail, bad, readRaw, db, paypal, planById, saveSubscription } = require('../_lib');

const HANDLED = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.RE-ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
]);

async function verify(req, raw) {
  const h = (k) => req.headers[k] || '';
  if (!h('paypal-transmission-id') || !h('paypal-transmission-sig')) return false;
  // el evento va tal cual llegó (texto crudo): re-serializarlo puede romper la firma
  const payload = `{"auth_algo":${JSON.stringify(h('paypal-auth-algo'))},"cert_url":${JSON.stringify(h('paypal-cert-url'))},` +
    `"transmission_id":${JSON.stringify(h('paypal-transmission-id'))},"transmission_sig":${JSON.stringify(h('paypal-transmission-sig'))},` +
    `"transmission_time":${JSON.stringify(h('paypal-transmission-time'))},"webhook_id":${JSON.stringify(env('PAYPAL_WEBHOOK_ID'))},"webhook_event":${raw}}`;
  const r = await paypal('/v1/notifications/verify-webhook-signature', { method: 'POST', rawBody: payload });
  return r && r.verification_status === 'SUCCESS';
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') throw bad(405, 'Método no permitido.');
    const raw = await readRaw(req, 256 * 1024);
    let evt; try { evt = JSON.parse(raw); } catch (_) { throw bad(400, 'JSON inválido.'); }
    if (!(await verify(req, raw))) throw bad(401, 'Firma inválida.');
    if (!HANDLED.has(evt.event_type)) return send(res, 200, { ignored: true });

    // idempotencia
    try { await db('payment_events', { method: 'POST', body: { id: evt.id, type: evt.event_type, payload: evt }, prefer: 'return=minimal' }); }
    catch (e) { if (e.status === 409) return send(res, 200, { duplicate: true }); throw e; }

    const r = evt.resource || {};
    const subId = evt.event_type.startsWith('PAYMENT.SALE') ? r.billing_agreement_id : r.id;
    if (!subId) return send(res, 200, { ok: true, note: 'sin suscripción asociada' });

    const sub = await paypal(`/v1/billing/subscriptions/${encodeURIComponent(subId)}`);
    if (!planById(sub.plan_id)) return send(res, 200, { ignored: 'plan ajeno' });

    // dueño: primero por el vínculo ya guardado; si no existe, por custom_id (creado por nuestro front)
    const known = await db(`subscriptions?provider_sub_id=eq.${encodeURIComponent(subId)}&select=user_id`);
    let userId = known.length ? known[0].user_id : sub.custom_id;
    if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) return send(res, 200, { ignored: 'sin usuario' });
    const exists = await db(`profiles?id=eq.${userId}&select=id`);
    if (!exists.length) return send(res, 200, { ignored: 'usuario inexistente' });

    if (evt.event_type === 'PAYMENT.SALE.REFUNDED' || evt.event_type === 'PAYMENT.SALE.REVERSED') {
      // reembolso o contracargo: se corta el acceso ya
      await db(`subscriptions?user_id=eq.${userId}`, { method: 'PATCH', body: { status: 'expired', current_period_end: new Date().toISOString(), updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
    } else {
      await saveSubscription(userId, sub);
    }
    send(res, 200, { ok: true });
  } catch (e) { fail(res, e); }
};
