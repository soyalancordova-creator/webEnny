/* ============================================================
   PLANES · suscripción con PayPal (o simulada en modo demo)
   ------------------------------------------------------------
   El navegador NUNCA marca a nadie como suscrito. En producción:
   1. PayPal aprueba la suscripción en su ventana.
   2. El front manda el subscriptionID a /api/paypal/activate.
   3. El servidor lo verifica contra la API de PayPal y recién
      entonces escribe en Supabase (con service_role).
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, toast, confirmBox } from '../ui.js';

export const PLANS = [
  { id: 'mensual', name: 'Mensual', price: 5.99, per: '/mes', months: 1, note: 'Flexibilidad total', save: '' },
  { id: 'trimestral', name: 'Trimestral', price: 15.99, per: '/3 meses', months: 3, note: '≈ $5.33 al mes', save: 'Ahorras 11%' },
  { id: 'anual', name: 'Anual', price: 59.99, per: '/año', months: 12, note: '≈ $5.00 al mes', save: 'Ahorras 17% · 2 meses gratis', best: true },
];
const FEATURES = [
  'Toda la biblioteca de partituras',
  'Reproductor: velocidad sin cambiar el tono, loop y metrónomo',
  'Grabaciones de Enny sincronizadas compás a compás',
  'Transposición, nombres de notas y mapa del violín',
  'PDF para imprimir y llevar al atril',
  'Obras nuevas cada mes',
];

let sdkLoading = null;
function loadPayPal(clientId) {
  if (window.paypal && window.paypal.Buttons) return Promise.resolve(window.paypal);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&currency=USD&locale=es_EC&components=buttons`;
    s.onload = () => res(window.paypal); s.onerror = () => { sdkLoading = null; rej(new Error('No se pudo cargar PayPal.')); };
    document.head.appendChild(s);
  });
  return sdkLoading;
}

export async function renderPlans(ctx, view) {
  ctx.setTitle('Planes');
  const me = await ctx.refreshMe();
  const sub = me.subscription;
  const cfg = ctx.CFG, demo = ctx.store.mode === 'demo';
  const planIds = cfg.PAYPAL_PLANS || {};
  const paypalReady = !demo && cfg.PAYPAL_CLIENT_ID && planIds.mensual && planIds.trimestral && planIds.anual;

  const current = sub ? `<section class="cx-card cx-pad" style="max-width:720px;margin:0 auto 1.8rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
      <span class="gthumb" style="width:52px;height:52px">${icon('crown')}</span>
      <div style="flex:1;min-width:220px"><b style="font-family:var(--serif);font-weight:400;font-size:1.25rem">Plan ${esc((PLANS.find((p) => p.id === sub.plan) || {}).name || sub.plan)} ${sub.status === 'cancelled' ? '· cancelado' : '· activo'}</b>
        <p class="muted" style="font-size:.88rem">${sub.status === 'cancelled' ? 'Conservas el acceso hasta' : 'Se renueva el'} ${new Date(sub.current_period_end).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}.</p></div>
      ${sub.status === 'active' ? '<button class="btn btn-ghost btn-sm" id="cancel"><span>Cancelar suscripción</span></button>' : ''}
    </section>` : '';

  view.innerHTML = `<div style="max-width:1100px;margin:0 auto">
    <div class="cx-h" style="justify-content:center;text-align:center"><div><span class="eyebrow">La academia</span><h1>Aprende con toda la biblioteca</h1>
      <p style="max-width:52ch;margin-inline:auto">La comunidad es gratis para siempre. La suscripción abre las partituras, el reproductor y las grabaciones.</p></div></div>
    ${current}
    ${me.isAdmin ? '<p class="center muted" style="margin-bottom:1.4rem">Eres administradora: ya tienes acceso completo.</p>' : ''}
    <div class="plans">${PLANS.map((p) => `<article class="plan${p.best ? ' best' : ''}" data-p="${p.id}">
      ${p.best ? '<span class="tag-best">Mejor precio</span>' : ''}
      <h3>${p.name}</h3><span class="muted" style="font-size:.84rem">${p.note}</span>
      <div class="price"><b>$${p.price.toFixed(2)}</b><span>${p.per}</span></div>
      <div class="save">${p.save}</div>
      <ul>${FEATURES.map((f) => `<li>${icon('check')}<span>${f}</span></li>`).join('')}</ul>
      <div class="pp" id="pp-${p.id}">${sub && sub.plan === p.id && sub.status === 'active' ? '<button class="btn btn-ghost" disabled style="width:100%"><span>Tu plan actual</span></button>'
        : demo ? `<button class="btn btn-fill" data-demo="${p.id}" style="width:100%"><span>Suscribirme · pago simulado</span></button>`
        : paypalReady ? '<div class="spin"></div>' : '<p class="muted" style="font-size:.84rem;text-align:center">Los pagos se están configurando. Escríbenos por WhatsApp para suscribirte.</p>'}</div>
    </article>`).join('')}</div>
    ${!sub && !me.isAdmin ? '<p class="center" style="margin-top:1.4rem"><a href="#/comunidad" class="cx-chip">Por ahora, seguir con la cuenta gratuita →</a></p>' : ''}
    <div class="trust"><span>${icon('shield')}Pago seguro con PayPal · tarjeta de crédito o débito</span><span>${icon('check')}Cancela cuando quieras</span><span>${icon('card')}Precios en USD</span></div>
    ${demo ? '<p class="center muted" style="margin-top:1rem;font-size:.8rem">Modo demostración: no se cobra nada. En producción el pago lo procesa PayPal y lo verifica nuestro servidor.</p>' : ''}
  </div>`;

  $$('[data-demo]', view).forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try { await ctx.store.subscribe(b.dataset.demo); await ctx.refreshMe(); toast('¡Listo! Tu suscripción está activa. 🙌'); renderPlans(ctx, view); }
      catch (e) { toast(e.message); b.disabled = false; }
    };
  });

  const cb = $('#cancel', view);
  if (cb) cb.onclick = async () => {
    if (!(await confirmBox('¿Cancelar tu suscripción? Conservas el acceso hasta el fin del periodo que ya pagaste.', 'Cancelar suscripción'))) return;
    try { await ctx.store.cancelSubscription(); await ctx.refreshMe(); toast('Suscripción cancelada.'); renderPlans(ctx, view); } catch (e) { toast(e.message); }
  };

  if (paypalReady && !me.isAdmin) {
    try {
      const paypal = await loadPayPal(cfg.PAYPAL_CLIENT_ID);
      PLANS.forEach((p) => {
        const host = $(`#pp-${p.id}`, view);
        if (!host || (sub && sub.plan === p.id && sub.status === 'active')) return;
        host.innerHTML = '';
        paypal.Buttons({
          style: { layout: 'vertical', shape: 'pill', color: p.best ? 'gold' : 'black', label: 'subscribe', height: 45 },
          // custom_id liga la suscripción de PayPal con este usuario; el servidor lo vuelve a comprobar
          createSubscription: (data, actions) => actions.subscription.create({ plan_id: planIds[p.id], custom_id: me.id }),
          onApprove: async (data) => {
            toast('Confirmando tu pago…');
            try { await ctx.store.activatePayPal(data.subscriptionID); await ctx.refreshMe(); toast('¡Bienvenida a la academia! Tu suscripción está activa. 🙌'); renderPlans(ctx, view); }
            catch (e) { toast(e.message); }
          },
          onError: () => toast('PayPal no pudo completar el pago. No se hizo ningún cobro.'),
        }).render(host);
      });
    } catch (e) { toast(e.message); }
  }
}
