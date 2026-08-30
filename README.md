# Web de Enny Toro de Córdova

Sitio web estático de la violinista Enny Toro de Córdova.

## Cómo abrir este proyecto en Claude Code

1. Descomprime esta carpeta en tu computadora (ej. `C:\proyectos\enny-violin`).
2. Abre una terminal (PowerShell en Windows) dentro de esa carpeta:
   ```
   cd C:\proyectos\enny-violin
   ```
3. Inicia Claude Code:
   ```
   claude
   ```
   Claude Code leerá automáticamente el archivo `CLAUDE.md` y entenderá todo el contexto del proyecto.

## Ver el sitio en local
```
npm run dev
```
Luego abre `http://localhost:5173` en tu navegador.

## Estructura
- `index.html` — el sitio completo (una sola página)
- `CLAUDE.md` — contexto e instrucciones para Claude Code
- `public/img/` — aquí van las fotos reales de Enny
- `package.json` — comandos de desarrollo

## Lo que falta (díselo a Claude Code)
Ejemplos de cosas que puedes pedirle a Claude Code una vez dentro:
- "Conecta mi Calendly: https://calendly.com/mi-usuario en el botón de reservar"
- "Reemplaza las fotos por las que puse en public/img/"
- "Conecta el formulario de contacto con Formspree para que llegue a mi correo"
- "Agrega una sección de testimonios después de la galería"
