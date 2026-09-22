/* ============================================================
   PERFILES · ver (propio y ajeno) y editar
============================================================ */
import { icon } from '../icons.js';
import { $, esc, richText, avatar, toast, empty } from '../ui.js';
import { compressImage } from '../media.js';
import { mountList } from './feed.js';

export async function renderProfile(ctx, view, [id]) {
  id = id || ctx.me.id;
  let p;
  try { p = await ctx.store.getProfile(id); } catch (e) { empty(view, 'user', e.message); return; }
  ctx.setTitle(p.name);
  const since = new Date(p.created_at).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  const social = p.social ? (/^https?:\/\//.test(p.social) ? p.social : `https://${p.social}`) : '';
  view.innerHTML = `<div style="max-width:1080px;margin:0 auto">
    <div class="pf-cover">${p.cover ? `<img src="${esc(p.cover)}" alt="">` : ''}</div>
    <div class="pf-head">${avatar(p, 'xl')}
      <div class="who"><h1>${esc(p.name)}</h1><div class="role">${esc(p.service || '')}</div></div>
      ${p.isMe ? `<a class="btn btn-ghost btn-sm" href="#/editar-perfil"><span>${icon('edit')} Editar perfil</span></a>` : ''}
    </div>
    <div class="pf-grid">
      <aside style="display:grid;gap:1rem">
        <section class="cx-card cx-pad">
          ${p.hidden ? `<p class="muted" style="font-size:.9rem">${icon('lock')} Este perfil es privado.</p>` : `
          ${p.bio ? `<p style="line-height:1.65;margin-bottom:1rem">${richText(p.bio)}</p>` : ''}
          <div class="pf-facts">
            ${p.church ? `<div>${icon('church')}${esc(p.church)}</div>` : ''}
            ${p.city ? `<div>${icon('map')}${esc(p.city)}</div>` : ''}
            ${social ? `<div>${icon('link')}<a href="${esc(social)}" target="_blank" rel="noopener nofollow" style="color:var(--wine)">${esc(p.social)}</a></div>` : ''}
            <div>${icon('calendar')}En la academia desde ${esc(since)}</div>
          </div>`}
          <div class="pf-stats"><div><b>${p.stats.posts}</b><small>Publicaciones</small></div><div><b>${p.stats.groups}</b><small>Comunidades</small></div><div><b>${p.role === 'admin' ? '✦' : '♪'}</b><small>${p.role === 'admin' ? 'Docente' : 'Alumno'}</small></div></div>
        </section>
      </aside>
      <div class="fd-col" id="pList"></div>
    </div></div>`;
  if (p.hidden) { empty($('#pList', view), 'lock', 'Las publicaciones de este perfil son privadas.'); return; }
  await mountList($('#pList', view), ctx, { authorId: id }, p.isMe ? 'Aún no publicas nada. Comparte tu primera reflexión en Inicio.' : 'Todavía no hay publicaciones.');
}

export async function renderProfileEdit(ctx, view) {
  ctx.setTitle('Editar perfil');
  const me = ctx.me;
  view.innerHTML = `<div style="max-width:880px;margin:0 auto">
    <div class="cx-h"><div><span class="eyebrow">Tu espacio</span><h1>Editar perfil</h1><p>Cómo te ve la comunidad. La edad y el correo nunca se muestran.</p></div>
      <a class="btn btn-ghost btn-sm" href="#/perfil/${esc(me.id)}"><span>Ver mi perfil</span></a></div>
    <div class="pf-cover" id="cv">${me.cover ? `<img src="${esc(me.cover)}" alt="">` : ''}<label class="btn btn-ghost btn-sm upl" style="background:rgba(255,255,255,.85);color:#1a1210"><span>${icon('image')} Cambiar portada</span><input type="file" accept="image/*" hidden id="cvIn"></label></div>
    <div class="pf-head"><span id="avBox">${avatar(me, 'xl')}</span><label class="btn btn-ghost btn-sm"><span>${icon('image')} Cambiar foto</span><input type="file" accept="image/*" hidden id="avIn"></label></div>
    <form class="sheet" id="pf" style="display:grid;gap:1rem">
      <div class="two"><div class="fld"><label>Nombre visible</label><input name="name" maxlength="60" value="${esc(me.name)}" required></div>
        <div class="fld"><label>Servicio / instrumento</label><input name="service" maxlength="80" value="${esc(me.service || '')}" placeholder="Ej. Violinista · Equipo de alabanza"></div></div>
      <div class="two"><div class="fld"><label>Iglesia</label><input name="church" maxlength="80" value="${esc(me.church || '')}"></div>
        <div class="fld"><label>Ciudad</label><input name="city" maxlength="80" value="${esc(me.city || '')}"></div></div>
      <div class="fld"><label>Sobre mí</label><textarea name="bio" maxlength="400">${esc(me.bio || '')}</textarea><span class="hint">Hasta 400 caracteres.</span></div>
      <div class="two"><div class="fld"><label>Red social / enlace</label><input name="social" maxlength="140" value="${esc(me.social || '')}" placeholder="instagram.com/usuario"></div>
        <div class="fld"><label>Privacidad</label><select name="privacy"><option value="public"${me.privacy !== 'private' ? ' selected' : ''}>Público · la comunidad ve tu perfil</option><option value="private"${me.privacy === 'private' ? ' selected' : ''}>Privado · solo nombre y foto</option></select></div></div>
      <div class="cx-row" style="justify-content:flex-end"><button class="btn btn-fill btn-sm"><span>Guardar cambios</span></button></div>
    </form></div>`;
  const up = async (input, kind) => {
    const f = input.files[0]; input.value = ''; if (!f) return;
    try {
      const img = await compressImage(f, kind === 'avatar' ? { maxSide: 512, quality: 0.85 } : { maxSide: 1800, quality: 0.8 });
      toast('Subiendo…');
      const url = kind === 'avatar' ? await ctx.store.uploadAvatar(img) : await ctx.store.uploadCover(img);
      await ctx.refreshMe();
      if (kind === 'avatar') $('#avBox', view).innerHTML = avatar(ctx.me, 'xl');
      else $('#cv', view).querySelector('img') ? ($('#cv img', view).src = url) : $('#cv', view).insertAdjacentHTML('afterbegin', `<img src="${esc(url)}" alt="">`);
      toast(kind === 'avatar' ? 'Foto actualizada.' : 'Portada actualizada.');
    } catch (e) { toast(e.message); }
  };
  $('#avIn', view).onchange = (e) => up(e.target, 'avatar');
  $('#cvIn', view).onchange = (e) => up(e.target, 'cover');
  $('#pf', view).onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.name.trim()) { toast('Escribe tu nombre.'); return; }
    try { await ctx.store.updateMe(d); await ctx.refreshMe(); toast('Perfil guardado.'); ctx.go(`#/perfil/${ctx.me.id}`); } catch (err) { toast(err.message); }
  };
}
