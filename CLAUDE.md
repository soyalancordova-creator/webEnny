# Enny Toro · Sitio web (violinista)

Sitio web personal de Enny Toro, violinista cristiana basada en Guayaquil, Ecuador.
La web es estática (HTML + CSS + JS, sin framework). El objetivo es transmitir fe, elegancia y un look luxury (no usar "de Córdova" en el sitio).

## Comandos
- `npm run dev` — sirve el sitio en local (puerto 5173) con recarga en vivo
- `npm run build` — copia los archivos listos para publicar a `dist/`

## Estructura
- `index.html` — página principal (one-page): nav, hero, secciones y footer. JS embebido al final.
- `academia.html` — página aparte de la Academia con login/registro (gate). JS embebido propio.
- `public/css/style.css` — hoja de estilos COMPARTIDA por ambas páginas (toda la apariencia vive aquí).
- `public/img/` — fotos reales de Enny optimizadas (.jpg ~1600px): enny-escenario, enny-escenario2, enny-estudio, enny-retrato, enny-rostro, enny-tocando, enny-concierto, enny-partituras.

## Login / Registro (academia.html)
- Hoy es solo front-end (demo): los formularios muestran un mensaje, NO hay backend de cuentas.
- Para que funcione de verdad falta conectar autenticación real (API propia, Firebase Auth, Supabase, etc.).

## Secciones del sitio (en orden)
Inicio (hero) → versículo → Pilares → Sobre mí → Academia (gateway que enlaza a `academia.html`) → Reservar clase (Calendly) → Eventos → Partituras → Galería → Contacto → Footer

## Identidad visual (luxury)
- Paleta: blanco/marfil `#FFFFFF`/`#F7F4EE`/`#F2ECDD`, dorado metálico `#CD9C20` + brillo `#F5CB5C` + profundo `#A07F3A`, gris/carbón `#2F2F2F`/`#222220`, negro `#0B0B0B`. (Variables CSS en `public/css/style.css`.)
- Estética: luxury, blanco dominante con detalles dorados tipo oro, degradados dorados y mucho **vidrio esmerilado (glassmorphism) estilo Apple** (`backdrop-filter: blur`). Secciones claras en marfil; secciones de contraste (academia, reservar, contacto, footer) en gris/carbón con dorado.
- Tipografías: Cormorant Garamond (display, títulos) + Jost (cuerpo).
- El dorado se aplica como degradado metálico (`--gold-grad`); halo dorado suave detrás del retrato del hero.

## Configuración (bloque `CONFIG` al inicio del `<script>` en index.html)
Toda la conexión externa se controla desde un único objeto `CONFIG`:
- `calendly` — enlace de Calendly; abre el popup al pulsar `#calendly-btn`
- `whatsapp` — número solo con dígitos y código de país (Ecuador 593); el formulario de contacto arma el mensaje y abre wa.me, y rellena el dato de contacto
- `email` — ya configurado: `ennytorov@gmail.com`
- `instagram` / `youtube` / `facebook` — si están vacíos, el ícono se oculta

## Pendientes (TODO)
- Pegar el enlace real de Calendly en `CONFIG.calendly`
- Pegar el número real de WhatsApp en `CONFIG.whatsapp`
- Rellenar enlaces de redes en `CONFIG.instagram/youtube/facebook`
- Reemplazar imágenes de Unsplash por fotos reales en `public/img/` (la carpeta está vacía aún)
- Opcional: sección de testimonios

## Convenciones
- Mantener todo en español (audiencia latinoamericana)
- Respetar la paleta y tipografías; no introducir colores nuevos sin acordarlo
- Cada cambio debe verse bien en móvil (el sitio es responsive, breakpoints en 980px y 720px)
