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
  // Nombre de la academia (aparece en la plataforma). Cámbialo cuando elijan uno.
  APP_NAME: 'Academia Enny Toro',

  // Supabase → Project Settings → API
  SUPABASE_URL:  'PEGA_AQUI_TU_PROJECT_URL',
  SUPABASE_ANON: 'PEGA_AQUI_TU_ANON_KEY',

  // Modo demostración: 'auto' = se activa solo si Supabase no está configurado.
  // true = forzarlo aunque haya Supabase (para mostrar la plataforma sin datos reales).
  DEMO_MODE: 'auto',

  // PayPal → developer.paypal.com → Apps & Credentials → Client ID (público)
  PAYPAL_CLIENT_ID: '',
  // IDs de los 3 planes creados en PayPal (Billing → Subscriptions → Plans)
  PAYPAL_PLANS: { mensual: '', trimestral: '', anual: '' },

  // Calendly → tu enlace público, ej: https://calendly.com/enny-toro/clase
  CALENDLY: '',

  // Skool u otra comunidad de clases pregrabadas
  COMUNIDAD_URL: '',

  // Datos de contacto por defecto (el panel los puede sobrescribir)
  EMAIL: 'ennytorov@gmail.com',
  WHATSAPP: '593959460818',
  INSTAGRAM: 'ennytoro'
};
