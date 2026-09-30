/* ============================================================
   CONFIGURACIÓN  ·  este es el único archivo que tienes que editar
   ------------------------------------------------------------
   Todo lo de aquí es PÚBLICO por diseño (se descarga al navegador):
   - La anon key de Supabase no da acceso a nada por sí sola; lo que
     protege los datos son las políticas RLS (supabase/*.sql).
   - El Client ID de PayPal también es público.
   NUNCA pegues aquí la service_role de Supabase ni el secret de
   PayPal: esos van solo en las variables de entorno de Vercel.
============================================================ */
window.ENNY = {
  // Nombre de la herramienta (aparece en toda la plataforma).
  APP_NAME: 'Hosannia',

  // Dirección pública de Hosannia. Mientras viva en el mismo sitio, déjalo
  // vacío y el sitio de Enny enlazará a academia.html. Cuando tenga su dominio:
  // HOSANNIA_URL: 'https://hosannia.com'
  HOSANNIA_URL: '',

  // Correo al que escriben los alumnos desde Ajustes → Ayuda
  SOPORTE_EMAIL: 'ennytorov@gmail.com',

  // Supabase → Project Settings → API
  SUPABASE_URL:  'https://scljwctnlqgzgcwbcofv.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjbGp3Y3RubHFnemdjd2Jjb2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NDEwOTksImV4cCI6MjEwNjMxNzA5OX0.xa7yHaTgcH_w7FYnQQXpflY6wM_gwikzFj6ktA_hJIs',

  // Modo demostración: 'auto' = se activa solo si Supabase no está configurado.
  // true = forzarlo aunque haya Supabase (útil mientras no haya SMTP propio
  // para el correo de registro — ver CLAUDE.md).
  DEMO_MODE: 'auto',

  // PayPal → developer.paypal.com → Apps & Credentials → Client ID (público)
  PAYPAL_CLIENT_ID: 'BAAoMXfjgI_-Z2GtCVIY7xKZWy5Vd9sQEI7cB0dGdWPLpzHYzs2-mbgX07D7ZcO02YkHTlOoufinCEdzC4',
  // IDs de los 3 planes creados en PayPal (Billing → Subscriptions → Plans)
  PAYPAL_PLANS: { mensual: 'P-8DX54050UA925603XNK6KCVA', trimestral: 'P-2BR79167E1270072ANK6KCVA', anual: 'P-23X28049FH291053CNK6KCVI' },

  // Calendly → tu enlace público, ej: https://calendly.com/enny-toro/clase
  CALENDLY: '',

  // Skool u otra comunidad de clases pregrabadas
  COMUNIDAD_URL: '',

  // Datos de contacto por defecto (el panel los puede sobrescribir)
  EMAIL: 'ennytorov@gmail.com',
  WHATSAPP: '593959460818',
  INSTAGRAM: 'ennytoro'
};
