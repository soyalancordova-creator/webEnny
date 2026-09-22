/* NOTIFICACIONES · actividad personal + avisos de la academia */
import { icon } from '../icons.js';
import { $, $$, esc, ago, avatar, loading, empty, toast } from '../ui.js';

const ICON = { broadcast: 'megaphone', reaction: 'heart', comment: 'comment', group: 'users', system: 'info' };

export async function renderNotifications(ctx, view) {
  ctx.setTitle('Notificaciones');
  view.innerHTML = `<div style="max-width:760px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Tu actividad</span><h1>Notificaciones</h1><p>Reacciones, comentarios, comunidades y avisos de la academia.</p></div>
      <button class="btn btn-ghost btn-sm" id="all"><span>${icon('check')} Marcar todo como leído</span></button></div>
    <div class="nt" id="nt"></div></div>`;
  const box = $('#nt', view);
  const load = async () => {
    loading(box);
    try {
      const list = await ctx.store.listNotifications();
      if (!list.length) { empty(box, 'bell', 'Todo está al día.'); return; }
      box.innerHTML = list.map((n) => `<a class="nt-item${n.read ? '' : ' un'}${n.kind === 'broadcast' ? ' adm' : ''}" href="${esc(n.link || '#/notificaciones')}" data-id="${esc(n.id)}">
        ${n.actor && n.kind !== 'broadcast' ? avatar(n.actor) : `<span class="ico">${icon(ICON[n.kind] || 'bell')}</span>`}
        <div style="min-width:0;flex:1"><b>${n.kind === 'broadcast' ? '<span class="pill wine" style="margin-right:.4rem">Aviso</span>' : ''}${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<time>${ago(n.created_at)}</time></div></a>`).join('');
      $$('.nt-item', box).forEach((a) => { a.addEventListener('click', () => { ctx.store.markRead(a.dataset.id).then(ctx.refreshBadges); }); });
    } catch (e) { empty(box, 'info', e.message); }
  };
  $('#all', view).onclick = async () => { try { await ctx.store.markRead('all'); await load(); ctx.refreshBadges(); toast('Listo.'); } catch (e) { toast(e.message); } };
  load();
}
