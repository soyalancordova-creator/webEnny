# Enny Toro · Sitio + Academia

Sitio de Enny Toro, violinista en Guayaquil, más la plataforma de su academia.
Web estática (HTML + CSS + JS, sin framework ni build) sobre **Supabase** (auth, base de datos, storage),
desplegada en **Vercel**. No usar "de Córdova" en el sitio.

## Comandos
- `npm run dev` — sirve en local (puerto 5173). `serve.json` desactiva clean-URLs para que
  `articulo.html?slug=…` no pierda la query, y añade un rewrite explícito de `/` → `/index.html`.
  **Ambas claves son necesarias**: `serve` 14.x, en cuanto detecta CUALQUIER `serve.json`, dejar de
  resolver `index.html` para `/` automáticamente (muestra listado de archivos) a menos que el rewrite
  esté explícito. Si `npm run dev` muestra "Files within enny-violin" en vez del sitio, es esto.
- No hay build: Vercel publica los archivos tal cual.

## Páginas
| Archivo | Qué es | Acceso |
|---|---|---|
| `index.html` | One-page: hero, video con scroll, stats, sobre mí, servicios, galería, blog, contacto | público |
| `blog.html` | Todos los artículos, con filtro por categoría | público |
| `articulo.html` | Un artículo. Lee `?slug=…` (y `#slug=…` de respaldo) | público |
| `academia.html` | Login / registro / verificación por código | público |
| `campus.html` | Campus del alumno: perfil, biblioteca, proyectos, comunidad | requiere sesión |
| `admin.html` | Panel: edita todo el contenido del sitio y ve los alumnos | requiere rol `admin` |

## Archivos compartidos
- `public/css/brand.css` — **el sistema de diseño entero**: tokens de color (claro y oscuro), nav,
  botones, glass, formularios, footer. Todas las páginas lo cargan. Los estilos propios de cada
  página van embebidos en su `<style>`.
- `public/js/config.js` — **el único archivo que se edita a mano**: claves de Supabase, Calendly,
  enlace de la comunidad.
- `public/js/app.js` — cliente Supabase, sesión, guardas de acceso, helpers de contenido,
  subida de archivos, y la UI común (tema, cursor, nav, reveal, ojito de contraseña).
- `supabase/schema.sql` — esquema completo con RLS. Idempotente: se puede volver a ejecutar.

## Contenido editable
El HTML trae el contenido por defecto escrito a mano; al cargar, `hidratar()` lo sobrescribe con lo
que haya en Supabase. Si Supabase no responde, el sitio sigue viéndose bien. Marcadores en el HTML:
- `data-c="bloque.campo"` → reemplaza texto
- `data-c-html="bloque.campo"` → reemplaza HTML (pasa por `limpiarHTML`)
- `data-c-img="bloque.campo"` → reemplaza `src`

Bloques JSON en `site_content`: `hero`, `scene`, `stats`, `about`, `contact`, `band`, `community`, `academia`.
Colecciones: `video_cards`, `services`, `gallery`, `posts`, `resources`, `student_projects`.

## Seguridad (no aflojar esto)
- **RLS activo en todas las tablas.** Lectura pública solo del contenido del sitio y de los posts
  publicados. Escritura solo con rol `admin`.
- `is_admin()` es `SECURITY DEFINER` a propósito: sin eso, una policy de `profiles` que consulta
  `profiles` entra en recursión infinita.
- Un alumno **no puede auto-ascenderse a admin**: la policy de update de `profiles` compara el `role`
  contra el valor actual.
- En storage, cada usuario solo escribe bajo `su-uid/` en `avatars` y `projects`.
- La **anon key es pública por diseño** y va en `config.js`. La `service_role` NUNCA va al front.
- `vercel.json` manda CSP, HSTS, `nosniff`, `X-Frame-Options` y `noindex` para admin/campus.

## Auth
Registro pide nombre, correo, edad y contraseña dos veces (con ojito y medidor de fuerza).
Supabase envía un código de 6 dígitos; se verifica con `verifyOtp({type:'signup'})`.
**Para que llegue el código y no un enlace**, la plantilla de correo de Supabase
(Authentication → Email Templates → Confirm signup) tiene que incluir `{{ .Token }}`.

Para hacerte admin, regístrate y luego en el SQL Editor:
```sql
update public.profiles set role='admin'
where id = (select id from auth.users where email='tu@correo.com');
```

## Escena del violín 3D (`.vscene` en index.html)
Ya **no es un `<video>`**: es un violín pseudo-3D renderizado en vivo con Three.js a partir de UNA
foto (`public/img/violin-3d.jpg`), controlado por scroll. Sin seek, sin latencia de red, sin umbral
que ajustar — la cámara se recalcula cada frame directo sobre la trayectoria.

- `public/js/violin-flythrough.js` (ES module): recorta el fondo blanco de la foto con flood-fill,
  extruye una malla con bordes redondeados según la distancia al borde (transformada de distancia
  euclídea), y le aplica un shader con luz fija para que se vea el barniz y el volumen del cuerpo.
  Expone `createViolinFlythrough({container, imageSrc}) → {setProgress(t), destroy()}`.
- Es puerto 1:1 de un proyecto React/@react-three/fiber que subió el usuario
  (`3d Violin web y render/violin-3d-camera-flythrough (2).zip`, ignorado por git — ver más abajo).
  Se tradujo a JS vanilla porque el sitio no usa build ni framework; la matemática (recorte, extrusión,
  shader, trayectoria de 9 keyframes `KEYS`) es idéntica.
- `index.html` carga el módulo con `<script type="module">` e `import`; Three.js se trae de jsDelivr
  (`three@0.160.0`, ES module, sin bundler).
- `.vscene` sigue midiendo `640vh`; `#vpin` se pinea con ScrollTrigger (`pinSpacing:false`) igual que
  antes. En el `onUpdate` ya no se hace seek: se llama `flythrough.setProgress(self.progress)`.
- Las 5 tarjetas glass (`animarTarjetas()`) no cambiaron: siguen alternando izquierda/derecha sobre el
  mismo ScrollTrigger. Fondo oscuro a propósito: sobre los tonos claros del violín, un glass blanco
  deja el texto ilegible.
- No tocar la trayectoria `KEYS` sin necesidad: los ángulos están elegidos para que nunca se vea de
  perfil puro (90°), porque la malla es una extrusión (relieve), no un modelo 3D completo, y de canto
  se notaría que es plana.

### El otro archivo 3D (pendiente, no integrado)
`3d Violin web y render/violin/` es un modelo glTF real (geometría + texturas, ~60MB) — más exacto,
pero sin cámara ni ángulos sincronizados todavía. Está ignorado por git por el peso. Para usarlo algún
día hace falta: comprimir texturas (los PNG de 10-19MB deberían ir a JPG/WebP y bajar de resolución),
posiblemente Draco en la geometría, y armar a mano una trayectoria de cámara como `KEYS` pero en las
coordenadas de ese modelo. Es un proyecto aparte, no algo para hacer "de paso".

## Identidad visual
- Marfil `#F7F4EF`/`#EFE9DF`, tinta `#141110`, vino `#6E1423`, dorado `#B08442`/`#D8B87C`.
- Tema claro por defecto + toggle oscuro, recordado en `localStorage` (`enny-theme`).
- Botón primario usa `--fill`/`--fill-ink`/`--fill-hov` (en oscuro es crema, no vino).
- Playfair Display (display) + Jost (cuerpo). Liquid glass estilo Apple en nav y tarjetas.
- Cursor propio; se desactiva en táctil.
- El menú móvil usa `--panel` (sólido): con glass translúcido el texto de atrás se transparenta.

## Pendientes
- Skool **no se puede embeber** (bloquea iframes): la comunidad abre en pestaña nueva.
- Editor de blog en el panel: hoy se escribe HTML a mano en un textarea.
- Reordenar tarjetas/servicios/galería arrastrando (hoy el orden es el campo `position`).

## Convenciones
- Todo en español.
- Colores nuevos solo como variable CSS definida en los dos temas.
- Cada cambio debe verse bien en móvil (breakpoints 1080px, 980px, 900px, 720px).
