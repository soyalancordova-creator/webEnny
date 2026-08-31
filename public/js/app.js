/* ============================================================
   ENNY TORO · capa compartida
   Cliente Supabase, sesión, contenido y UI común (nav, tema, cursor).
   Se carga en todas las páginas después de config.js.
============================================================ */
(function (w, d) {
  'use strict';

  var CFG = w.ENNY || {};
  var configurado = CFG.SUPABASE_URL && CFG.SUPABASE_URL.indexOf('PEGA_AQUI') === -1;

  /* ---------- cliente ---------- */
  var sb = null;
  if (configurado && w.supabase && w.supabase.createClient) {
    sb = w.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  var API = {
    sb: sb,
    listo: !!sb,
    cfg: CFG,

    /* ---------- sesión ---------- */
    sesion: function () {
      if (!sb) return Promise.resolve(null);
      return sb.auth.getSession().then(function (r) { return r.data.session; });
    },
    perfil: function () {
      if (!sb) return Promise.resolve(null);
      return API.sesion().then(function (s) {
        if (!s) return null;
        return sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
          .then(function (r) {
            if (!r.data) return null;
            r.data.email = s.user.email;
            return r.data;
          });
      });
    },
    salir: function () {
      if (!sb) return Promise.resolve();
      return sb.auth.signOut();
    },
    /** Redirige si no hay sesión. Devuelve el perfil si la hay. */
    exigirSesion: function (destino) {
      return API.perfil().then(function (p) {
        if (!p) { location.href = (destino || 'academia.html') + '?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
        return p;
      });
    },
    /** Igual, pero además exige rol admin. */
    exigirAdmin: function () {
      return API.perfil().then(function (p) {
        if (!p) { location.href = 'academia.html'; return null; }
        if (p.role !== 'admin') { location.href = 'campus.html'; return null; }
        return p;
      });
    },

    /* ---------- contenido ---------- */
    bloque: function (key) {
      if (!sb) return Promise.resolve(null);
      return sb.from('site_content').select('data').eq('key', key).maybeSingle()
        .then(function (r) { return r.data ? r.data.data : null; })
        .catch(function () { return null; });
    },
    bloques: function () {
      if (!sb) return Promise.resolve({});
      return sb.from('site_content').select('key,data')
        .then(function (r) {
          var out = {};
          (r.data || []).forEach(function (row) { out[row.key] = row.data; });
          return out;
        })
        .catch(function () { return {}; });
    },
    guardarBloque: function (key, data) {
      return sb.from('site_content')
        .upsert({ key: key, data: data, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    },
    lista: function (tabla, soloActivos) {
      if (!sb) return Promise.resolve([]);
      var q = sb.from(tabla).select('*');
      if (soloActivos) q = q.eq('active', true);
      return q.order('position', { ascending: true })
        .then(function (r) { return r.data || []; })
        .catch(function () { return []; });
    },

    /* ---------- archivos ---------- */
    subir: function (bucket, ruta, file) {
      return sb.storage.from(bucket).upload(ruta, file, { upsert: true, cacheControl: '3600' })
        .then(function (r) {
          if (r.error) throw r.error;
          return sb.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
        });
    },

    /* ---------- utilidades ---------- */
    /** Resuelve rutas relativas del repo y URLs absolutas por igual. */
    img: function (v, fallback) {
      if (!v) return fallback || '';
      if (/^(https?:)?\/\//.test(v) || v.indexOf('data:') === 0) return v;
      return v;
    },
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    /** Sanea HTML de confianza limitada: quita scripts, iframes y handlers on*. */
    limpiarHTML: function (html) {
      if (!html) return '';
      var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
      var root = doc.body.firstChild;
      root.querySelectorAll('script,iframe,object,embed,link,style,form').forEach(function (n) { n.remove(); });
      root.querySelectorAll('*').forEach(function (n) {
        [].slice.call(n.attributes).forEach(function (a) {
          var nom = a.name.toLowerCase();
          if (nom.indexOf('on') === 0) n.removeAttribute(a.name);
          if ((nom === 'href' || nom === 'src') && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
        });
      });
      return root.innerHTML;
    },
    fecha: function (iso) {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch (e) { return ''; }
    },
    slug: function (s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    },
    aviso: function (el, texto, tipo) {
      if (!el) return;
      el.textContent = texto;
      el.className = 'msg show ' + (tipo || 'info');
    }
  };

  /* ============================================================
     UI COMPARTIDA
  ============================================================ */

  /* ---------- tema ---------- */
  var root = d.documentElement;
  try { var s = localStorage.getItem('enny-theme'); if (s) root.dataset.theme = s; } catch (e) {}

  API.iniciarTema = function () {
    var b = d.getElementById('theme');
    if (!b) return;
    b.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('enny-theme', next); } catch (e) {}
      var mt = d.querySelector('meta[name=theme-color]');
      if (mt) mt.setAttribute('content', next === 'dark' ? '#0C0A09' : '#F7F4EF');
    });
  };

  /* ---------- cursor ---------- */
  API.iniciarCursor = function () {
    var fine = w.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (!fine) { d.body.classList.add('no-cur'); return; }
    var dot = d.querySelector('.cur'), ring = d.querySelector('.cur-r');
    if (!dot || !ring) return;
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    }, { passive: true });
    (function loop() {
      rx += (mx - rx) * .16; ry += (my - ry) * .16;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();
    var HOT = 'a,button,input,textarea,select,.card,.frame,.stat,.post,.tag,.gcard,.res,.proj';
    d.addEventListener('mouseover', function (e) { if (e.target.closest(HOT)) ring.classList.add('hot'); });
    d.addEventListener('mouseout', function (e) { if (e.target.closest(HOT)) ring.classList.remove('hot'); });
  };

  /* ---------- nav ---------- */
  API.iniciarNav = function () {
    var hd = d.querySelector('header.site');
    if (!hd) return;
    var burger = d.getElementById('burger');
    if (burger) burger.addEventListener('click', function () { hd.classList.toggle('open'); });
    addEventListener('scroll', function () { hd.classList.toggle('tuck', scrollY > 40); }, { passive: true });

    var links = d.getElementById('links'), pill = d.getElementById('pill');
    if (!links || !pill) return;
    var as = [].slice.call(links.querySelectorAll('a'));

    function mover(a) {
      if (innerWidth <= 900 || !a) { pill.style.opacity = 0; return; }
      pill.style.opacity = 1;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    }
    API._pill = mover;
    API.marcarNav = function (id) {
      var hit = null;
      as.forEach(function (a) {
        var on = a.dataset.sec === id;
        a.classList.toggle('on', on);
        if (on) hit = a;
      });
      mover(hit);
    };
    as.forEach(function (a) { a.addEventListener('mouseenter', function () { mover(a); }); });
    links.addEventListener('mouseleave', function () { mover(links.querySelector('a.on')); });
    addEventListener('resize', function () { mover(links.querySelector('a.on')); });

    // marca la página actual cuando el nav no es de anclas
    var aqui = location.pathname.split('/').pop() || 'index.html';
    var actual = as.filter(function (a) { return a.getAttribute('href') === aqui; })[0];
    if (actual) { actual.classList.add('on'); mover(actual); }
  };

  /* ---------- reveal ---------- */
  API.iniciarReveal = function () {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
      });
    }, { threshold: .14, rootMargin: '0px 0px -8% 0px' });
    d.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
    API._rvIO = io;
  };
  API.observarReveal = function (el) { if (API._rvIO) API._rvIO.observe(el); };

  /* ---------- ojito de contraseña ---------- */
  API.iniciarOjos = function (scope) {
    (scope || d).querySelectorAll('.eye').forEach(function (b) {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.addEventListener('click', function () {
        var inp = b.parentNode.querySelector('input');
        if (!inp) return;
        var ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.innerHTML = ver ? API.ICON_OJO_OFF : API.ICON_OJO;
        b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    });
  };
  API.ICON_OJO = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  API.ICON_OJO_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 4"/><path d="M6.5 7.9A17 17 0 0 0 2 12s3.6 6.5 10 6.5a10 10 0 0 0 4-.8"/><path d="M9.5 9.7a2.8 2.8 0 0 0 4 3.9"/></svg>';

  /* ---------- Calendly ---------- */
  API.abrirCalendly = function (extra) {
    var url = (API._calendly || CFG.CALENDLY || '').trim();
    if (!url) { alert('Aún no hay enlace de Calendly configurado.'); return; }
    var q = [];
    if (extra && extra.name) q.push('name=' + encodeURIComponent(extra.name));
    if (extra && extra.email) q.push('email=' + encodeURIComponent(extra.email));
    if (extra && extra.nota) q.push('a1=' + encodeURIComponent(extra.nota));
    var full = url + (q.length ? (url.indexOf('?') > -1 ? '&' : '?') + q.join('&') : '');
    if (w.Calendly && w.Calendly.initPopupWidget) {
      w.Calendly.initPopupWidget({ url: full });
    } else {
      w.open(full, '_blank', 'noopener');
    }
  };

  /* ---------- arranque común ---------- */
  API.iniciarBase = function () {
    API.iniciarTema();
    API.iniciarCursor();
    API.iniciarNav();
    API.iniciarReveal();
    API.iniciarOjos();
    var yr = d.getElementById('yr');
    if (yr) yr.textContent = new Date().getFullYear();
    if (!configurado) {
      console.warn('[Enny] Supabase sin configurar: el sitio funciona con el contenido por defecto del HTML. Edita public/js/config.js.');
    }
  };

  w.EnnyApp = API;
})(window, document);
