# Enny Toro · Sitio web (violinista)

Sitio web personal de Enny Toro, violinista basada en Guayaquil, Ecuador.
Web estática (HTML + CSS + JS, sin framework). Objetivo: elegancia, minimalismo luxury y mucha interacción (no usar "de Córdova" en el sitio).

## Comandos
- `npm run dev` — sirve el sitio en local (puerto 5173)
- `npm run build` — copia los archivos listos para publicar a `dist/`

## Estructura
- `index.html` — **one-page con scroll continuo**. CSS y JS embebidos (autocontenido, sin peticiones extra).
- `academia.html` — página aparte de la Academia con login/registro (gate). Usa `public/css/style.css`.
- `public/css/style.css` — **solo la usa `academia.html`**. El diseño de `index.html` vive embebido en su `<style>`.
- `public/img/` — fotos reales de Enny (.jpg): enny-escenario, enny-escenario2, enny-estudio, enny-retrato,
  enny-rostro, enny-tocando, enny-concierto, enny-partituras, **enny-editorial-negro**, **enny-editorial-beige**,
  **enny-alan** (Enny con su esposo Alan Córdova, B/N).
- `public/videos/violin-transform.mp4` — video del violín que se desarma. **Debe servirse local**: cargarlo
  desde una URL remota (GitHub raw) mete latencia de red en cada seek y traba el scroll.

## Secciones de `index.html` (en orden)
Hero → marquee → **escena de video con scroll** → stats (contadores) → Sobre mí → Servicios → Galería → Blog → banda CTA → Contacto → Footer

## Escena de video (`.vscene`)
- `640vh` de alto; `#vpin` se pinea con ScrollTrigger (`pinSpacing:false`).
- El progreso del scroll mapea a `video.currentTime`.
- **Umbral de seek `0.12s`** (`seek()` en el script). Bajarlo dispara ~50 seeks/s y traba el scroll; no reducirlo.
- Encima van **5 tarjetas glassmorphic** (`.gcard`) que entran alternando izquierda/derecha con cross-fade,
  repartidas en 5 tramos iguales del scroll. Fondo oscuro translúcido a propósito: sobre los frames claros
  del video, un glass blanco deja el texto ilegible.

## Identidad visual
- Paleta (variables en `:root`): marfil `#F7F4EF`/`#EFE9DF`, tinta `#141110`, vino `#6E1423`, dorado `#B08442`/`#D8B87C`.
- **Tema claro por defecto + toggle a oscuro** (botón `#theme`, se recuerda en `localStorage` bajo `enny-theme`).
  Los colores se cambian SOLO vía variables en `:root` y `html[data-theme="dark"]`.
- Botón primario usa `--fill` / `--fill-ink` / `--fill-hov` (en oscuro es crema sobre fondo negro, no vino).
- Estética Apple / liquid glass: `backdrop-filter: blur() saturate()` en nav, tarjetas, tags, formulario.
- Tipografías: Playfair Display (display) + Jost (cuerpo, pesos 200–400 con tracking amplio).
- Cursor propio (punto + anillo con lag) que crece sobre elementos interactivos; se desactiva en táctil.

## Interacciones implementadas
- Contadores animados (`[data-n]`) con IntersectionObserver.
- Reveal on scroll (`.rv` + `.in`), con retardos vía `data-d`.
- Nav pill deslizante + scroll-spy **por geometría** (no IntersectionObserver: falla con la sección pineada).
- Halo que sigue al puntero en `.card`, tilt 3D en la foto del hero, hover en galería con caption.

## Configuración (`CONFIG` al inicio del `<script>` en index.html)
- `video` — ruta del mp4 (local)
- `whatsapp` — dígitos + código de país (593); el formulario arma el mensaje y abre wa.me

## Pendientes (TODO)
- Enlazar los artículos del Blog a páginas o posts reales (hoy los enlaces son `#`).
- Conectar autenticación real en `academia.html` (hoy es demo front-end sin backend).
- Opcional: Calendly para reservas; hoy todo el contacto sale por WhatsApp.
- Opcional: sección de testimonios.
- Limpieza: en la raíz quedan los mp4 originales (`kling_...mp4`, `davinci_...mp4`); el que usa el sitio es
  la copia en `public/videos/`. Se pueden borrar los de la raíz si no se necesitan como respaldo.

## Convenciones
- Todo en español (audiencia latinoamericana).
- Respetar paleta y tipografías; no introducir colores nuevos sin acordarlo, y siempre como variable CSS
  definida en los dos temas.
- Cada cambio debe verse bien en móvil (breakpoints en 1080px, 900px y 720px).
- El menú móvil usa `--panel` (color sólido): con glass translúcido el texto del hero se transparenta detrás.
