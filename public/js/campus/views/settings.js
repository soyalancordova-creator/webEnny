/* ============================================================
   AJUSTES · cuenta, suscripción, app y ayuda
   ------------------------------------------------------------
   Todo lo que no es contenido vive aquí: el plan, la instalación
   como app, las preguntas frecuentes y el soporte.
============================================================ */
import { icon } from '../icons.js';
import { $, $$, esc, toast, confirmBox } from '../ui.js';
import { installer } from '../pwa.js';

const TABS = [
  { id: 'cuenta', label: 'Cuenta', ic: 'user' },
  { id: 'suscripcion', label: 'Suscripción', ic: 'crown' },
  { id: 'app', label: 'App en tu celular', ic: 'mobile' },
  { id: 'ayuda', label: 'Ayuda', ic: 'help' },
];

const FAQ = [
  ['¿Qué incluye la suscripción?', 'Toda la biblioteca de partituras con el reproductor: velocidad sin cambiar el tono, repetición de compases, metrónomo, transposición y las grabaciones sincronizadas. La comunidad es gratis para todos.'],
  ['¿Puedo cancelar cuando quiera?', 'Sí. Cancelas desde aquí mismo en un toque y conservas el acceso hasta el último día del periodo que ya pagaste. No hay permanencia.'],
  ['¿Cómo se paga?', 'Con PayPal, que acepta tarjeta de crédito o débito aunque no tengas cuenta de PayPal. Hosannia nunca ve ni guarda los datos de tu tarjeta.'],
  ['¿Sirve en el celular?', 'Sí. Puedes instalarla como aplicación desde la pestaña “App en tu celular” y usarla a pantalla completa, incluso con la pantalla en vertical sobre el atril.'],
  ['¿Puedo imprimir las partituras?', 'Sí, cada obra tiene su PDF para imprimir. Son para tu estudio y tu servicio, no para redistribuir.'],
  ['¿Quién ve lo que publico?', 'Tus publicaciones del inicio las ven las personas de Hosannia. Lo que escribes dentro de una comunidad privada solo lo ven sus integrantes. Tu edad y tu correo nunca se muestran.'],
  ['¿Cómo creo una comunidad para mi iglesia?', 'Entra a Comunidades y toca “Crear comunidad”. Tú decides si es pública o privada y qué datos de contacto se muestran.'],
  ['Olvidé mi contraseña', 'En la pantalla de acceso usa “¿Olvidaste tu contraseña?” y te llega un correo para cambiarla.'],
];

export async function renderSettings(ctx, view, [tab]) {
  const cur = TABS.find((t) => t.id === tab) ? tab : 'cuenta';
  ctx.setTitle('Ajustes');
  const me = ctx.me;
  view.innerHTML = `<div style="max-width:960px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Ajustes</span><h1>Tu cuenta en Hosannia</h1>
      <p>Tu plan, la app en el celular y las respuestas a lo que más nos preguntan.</p></div></div>
    <div class="cx-row set-tabs">${TABS.map((t) => `<a class="cx-chip${t.id === cur ? ' on' : ''}" href="#/ajustes/${t.id}">${icon(t.ic)}${t.label}</a>`).join('')}</div>
    <div id="setBody"></div></div>`;
  const body = $('#setBody', view);

  if (cur === 'cuenta') paintAccount(ctx, body, me);
  if (cur === 'app') paintApp(ctx, body);
  if (cur === 'ayuda') paintHelp(ctx, body);
  if (cur === 'suscripcion') {
    body.innerHTML = '<div class="cx-empty"><span class="spin"></span></div>';
    const { renderPlans } = await import('./plans.js');
    await renderPlans(ctx, body);
    ctx.setTitle('Suscripción');
  }
}

/* ---------- cuenta ---------- */
function paintAccount(ctx, body, me) {
  body.innerHTML = `<section class="cx-card cx-pad set-card">
      <h3>${icon('user')} Perfil</h3>
      <p class="muted">Tu nombre, foto, iglesia y cómo sirves. Es lo que ven las demás personas.</p>
      <div class="cx-row"><a class="btn btn-fill btn-sm" href="#/editar-perfil"><span>Editar mi perfil</span></a>
        <a class="btn btn-ghost btn-sm" href="#/perfil/${esc(me.id)}"><span>Ver mi perfil</span></a></div>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('eye')} Privacidad</h3>
      <div class="set-row"><div><b>Perfil ${me.privacy === 'private' ? 'reservado' : 'público'}</b>
        <small>${me.privacy === 'private' ? 'Solo se ve tu nombre y tu foto; tu iglesia, ciudad y biografía quedan ocultas.' : 'Tu iglesia, ciudad y biografía se ven en tu perfil.'}</small></div>
        <button class="sw${me.privacy === 'private' ? '' : ' on'}" id="privSw" role="switch" aria-checked="${me.privacy !== 'private'}" aria-label="Perfil público"></button></div>
      <p class="muted" style="font-size:.82rem;margin-top:.8rem">Tu edad y tu correo nunca se muestran a nadie.</p>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('settings')} Sesión</h3>
      <div class="set-row"><div><b>${esc(me.email || '')}</b><small>Sesión iniciada en este dispositivo.</small></div>
        <button class="btn btn-ghost btn-sm" id="out"><span>Cerrar sesión</span></button></div>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('doc')} Documentos</h3>
      <div class="set-links"><a href="terminos.html" target="_blank" rel="noopener">${icon('doc')}<span>Términos de uso</span></a>
        <a href="privacidad.html" target="_blank" rel="noopener">${icon('shield')}<span>Política de privacidad</span></a>
        <a href="index.html" target="_blank" rel="noopener">${icon('home')}<span>Sitio de Enny Toro</span></a></div>
    </section>`;

  $('#privSw', body).onclick = async (e) => {
    const on = !e.currentTarget.classList.contains('on');
    try {
      await ctx.store.updateMe({ privacy: on ? 'public' : 'private' });
      await ctx.refreshMe();
      toast(on ? 'Tu perfil ahora es público.' : 'Tu perfil quedó reservado.');
      renderSettings(ctx, $('#view'), ['cuenta']);
    } catch (err) { toast(err.message); }
  };
  $('#out', body).onclick = async () => {
    if (!(await confirmBox('¿Cerrar sesión en este dispositivo?', 'Cerrar sesión'))) return;
    await ctx.store.signOut(); location.href = 'academia.html';
  };
}

/* ---------- app ---------- */
function paintApp(ctx, body) {
  const done = installer.standalone;
  body.innerHTML = `<section class="cx-card cx-pad set-card set-app">
      <div class="app-art">${icon('mobile')}</div>
      <div>
        <h3>Hosannia en tu celular</h3>
        <p class="muted">Instálala y se abre como una aplicación: pantalla completa, icono propio y sin buscar el enlace cada vez. Ocupa menos de 1 MB.</p>
        ${done ? `<p class="ok-line">${icon('check')} Ya la estás usando como aplicación.</p>`
          : `<div class="cx-row"><button class="btn btn-fill btn-sm" id="inst"><span>${icon('download')} Instalar aplicación</span></button></div>
             <p class="muted" style="font-size:.84rem;margin-top:.7rem" id="instHelp">${esc(installer.help())}</p>`}
      </div>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('info')} Para usarla en el atril</h3>
      <ul class="set-list">
        <li>${icon('check')}<span>Gira el celular: la partitura se reacomoda sola.</span></li>
        <li>${icon('check')}<span>Marca tus obras con el corazón para tenerlas en “Mis partituras”.</span></li>
        <li>${icon('check')}<span>Toca dos compases arrastrando para repetir ese pasaje en bucle.</span></li>
      </ul>
    </section>`;
  const b = $('#inst', body);
  if (b) b.onclick = async () => {
    const r = await installer.prompt();
    if (r === 'installed') { toast('¡Listo! Hosannia quedó instalada.'); renderSettings(ctx, $('#view'), ['app']); }
    else if (r === 'dismissed') toast('Puedes instalarla más tarde desde aquí.');
    else toast(installer.help());
  };
}

/* ---------- ayuda ---------- */
function paintHelp(ctx, body) {
  const wa = (ctx.CFG.WHATSAPP || '').replace(/\D/g, '');
  const mail = ctx.CFG.SOPORTE_EMAIL || '';
  body.innerHTML = `<section class="cx-card cx-pad set-card">
      <h3>${icon('help')} Preguntas frecuentes</h3>
      <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}${icon('chevD')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('comment')} ¿Necesitas ayuda?</h3>
      <p class="muted">Escríbenos y te respondemos en el día. Si es un problema con un pago, cuéntanos el correo con el que pagaste.</p>
      <div class="set-links">
        ${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${icon('phone')}<span>WhatsApp</span></a>` : ''}
        ${mail ? `<a href="mailto:${esc(mail)}">${icon('mail')}<span>${esc(mail)}</span></a>` : ''}
        <a href="#/ajustes/suscripcion">${icon('crown')}<span>Mi suscripción</span></a>
      </div>
    </section>
    <section class="cx-card cx-pad set-card">
      <h3>${icon('flag')} Reportar algo</h3>
      <p class="muted">En cada publicación y comentario hay un botón para reportar. Lo revisamos y respondemos. Si alguien está en peligro, avísanos de inmediato.</p>
    </section>`;
}
