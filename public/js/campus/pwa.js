/* ============================================================
   INSTALAR COMO APP
   ------------------------------------------------------------
   Chrome y Edge avisan con "beforeinstallprompt" cuando la app se
   puede instalar; iOS no lo hace, así que ahí se explican los dos
   toques de Safari. El mismo módulo sirve en la pantalla de acceso
   y en Ajustes.
============================================================ */
let deferred = null;
const subs = new Set();

export const installer = {
  watch() {
    if (this._on) return; this._on = true;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
    window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()); });
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  get standalone() {
    return matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },
  get ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent); },
  get canPrompt() { return !!deferred; },
  /** Devuelve 'installed' | 'dismissed' | 'ios' | 'no' */
  async prompt() {
    if (deferred) {
      deferred.prompt();
      const r = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (r.outcome === 'accepted') deferred = null;
      return r.outcome === 'accepted' ? 'installed' : 'dismissed';
    }
    return this.ios ? 'ios' : 'no';
  },
  /** Texto de ayuda cuando el navegador no ofrece el botón. */
  help() {
    if (this.ios) return 'En iPhone: toca el botón Compartir de Safari y elige “Agregar a pantalla de inicio”.';
    return 'En Android abre el menú del navegador (⋮) y elige “Instalar aplicación”. En computadora, el icono de instalar aparece al final de la barra de direcciones.';
  },
};
