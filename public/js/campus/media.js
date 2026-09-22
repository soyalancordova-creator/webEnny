/* ============================================================
   COMPRESIÓN DE IMÁGENES EN EL NAVEGADOR
   Toda foto que sube un usuario pasa por aquí antes de guardarse:
   - se reescala (lado mayor ≤ maxSide)
   - se reencoda a WebP (o JPEG si el navegador no lo soporta)
   - al redibujar en canvas se DESCARTAN los metadatos EXIF, incluida
     la ubicación GPS que traen muchas fotos de celular (privacidad).
   Una foto típica de celular de 3–5 MB queda en ~150–350 KB.
============================================================ */

const ACCEPTED = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i;
export const MAX_INPUT_MB = 25;

function supportsWebP() {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}
const WEBP = typeof document !== 'undefined' && supportsWebP();

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* cae al <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

/**
 * @param {File} file
 * @param {{maxSide?:number, quality?:number}} [o]
 * @returns {Promise<{blob:Blob, width:number, height:number, type:string, before:number, after:number}>}
 */
export async function compressImage(file, o = {}) {
  const maxSide = o.maxSide || 1600, quality = o.quality ?? 0.8;
  if (!file || !ACCEPTED.test(file.type || '')) throw new Error('El archivo no es una imagen compatible.');
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new Error(`La imagen supera ${MAX_INPUT_MB} MB.`);
  const src = await decode(file);
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  if (src.close) src.close();
  const type = WEBP ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo comprimir la imagen.'))), type, quality));
  // si por algún motivo "comprimir" la agranda (PNG pequeño), se queda la original re-dibujada igual
  return { blob, width: w, height: h, type, before: file.size, after: blob.size };
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

export function kb(n) { return n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
