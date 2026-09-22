/* POST /api/paypal/cancel — el alumno cancela su propia suscripción.
   Conserva el acceso hasta el fin del periodo pagado (has_access() en SQL). */
'use strict';
const { send, fail, bad, supaUser, db, paypal } = require('../_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') throw bad(405, 'Método no permitido.');
    const user = await supaUser(req);
    const rows = await db(`subscriptions?user_id=eq.${user.id}&select=provider_sub_id,status`);
    if (!rows.length || !rows[0].provider_sub_id) throw bad(404, 'No encontramos una suscripción activa.');
    if (rows[0].status === 'cancelled') return send(res, 200, { ok: true, already: true });
    await paypal(`/v1/billing/subscriptions/${encodeURIComponent(rows[0].provider_sub_id)}/cancel`, { method: 'POST', body: { reason: 'Cancelada por el alumno desde la plataforma' } });
    await db(`subscriptions?user_id=eq.${user.id}`, { method: 'PATCH', body: { status: 'cancelled', updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
    send(res, 200, { ok: true });
  } catch (e) { fail(res, e); }
};
