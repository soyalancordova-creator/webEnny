/* POST /api/paypal/activate  { subscriptionID }
   El navegador avisa "PayPal aprobó". Aquí NO se le cree: se consulta a PayPal
   directamente y solo si todo cuadra se activa la suscripción en Supabase. */
'use strict';
const { send, fail, bad, readRaw, supaUser, db, paypal, planById, saveSubscription } = require('../_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') throw bad(405, 'Método no permitido.');
    const user = await supaUser(req);
    let body;
    try { body = JSON.parse(await readRaw(req, 4096)); } catch (_) { throw bad(400, 'Solicitud inválida.'); }
    const id = String(body.subscriptionID || '');
    if (!/^I-[A-Z0-9]{8,30}$/.test(id)) throw bad(400, 'Identificador de suscripción inválido.');

    const sub = await paypal(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
    if (!planById(sub.plan_id)) throw bad(400, 'Ese plan no pertenece a la academia.');
    // la suscripción se creó con custom_id = id del usuario: evita que alguien use la de otra persona
    if (sub.custom_id !== user.id) throw bad(403, 'Esta suscripción no corresponde a tu cuenta.');
    if (!['APPROVED', 'ACTIVE'].includes(sub.status)) throw bad(402, 'PayPal todavía no confirma el pago. Intenta en un minuto.');

    const taken = await db(`subscriptions?provider_sub_id=eq.${encodeURIComponent(id)}&select=user_id`);
    if (taken.length && taken[0].user_id !== user.id) throw bad(409, 'Esta suscripción ya está vinculada a otra cuenta.');

    const row = await saveSubscription(user.id, sub);
    send(res, 200, { ok: true, plan: row.plan, status: row.status, current_period_end: row.current_period_end });
  } catch (e) { fail(res, e); }
};
