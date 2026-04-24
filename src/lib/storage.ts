import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

export const COMPROBANTES_BUCKET = 'comprobantes'

/**
 * Comprime una imagen y la sube al bucket `comprobantes` bajo la ruta
 * `{ventaId}/{timestamp}.{ext}`. Devuelve el path (NO la URL) — el
 * bucket es privado y los lectores deben generar signed URLs en F2.
 */
export async function uploadComprobante(
  ventaId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    })

    const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
    const path = `${ventaId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from(COMPROBANTES_BUCKET)
      .upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      })
    if (error) return { path: null, error: error.message }
    return { path, error: null }
  } catch (e) {
    return {
      path: null,
      error: e instanceof Error ? e.message : 'Error subiendo foto',
    }
  }
}

/**
 * Genera una signed URL temporal para visualizar un comprobante privado.
 * Uso pensado para admin en F2. `expiresIn` en segundos (default 1h).
 */
export async function getComprobanteUrl(path: string, expiresIn = 3600) {
  return supabase.storage
    .from(COMPROBANTES_BUCKET)
    .createSignedUrl(path, expiresIn)
}
