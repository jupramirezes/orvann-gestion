import { useState, useRef, type ChangeEvent } from 'react'
import { Camera, Image as ImageIcon, X } from 'lucide-react'

/**
 * Captura foto de comprobante de pago. Dos vías:
 *   - "Cámara": fuerza cámara rear del dispositivo (input con capture).
 *   - "Galería": selector nativo del sistema (cámara o archivos, sin hint).
 * Devuelve el File al parent; la subida al bucket se hace después de
 * crear la venta (necesitamos el venta_id para armar el path).
 */
export function FotoComprobanteUpload({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const camaraRef = useRef<HTMLInputElement>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      onChange(null)
      setPreview(null)
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    onChange(file)
  }

  function handleClear() {
    if (camaraRef.current) camaraRef.current.value = ''
    if (archivoRef.current) archivoRef.current.value = ''
    setPreview(null)
    onChange(null)
  }

  return (
    <div>
      <input
        ref={camaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="hidden"
        disabled={disabled}
      />

      {preview ? (
        <div className="flex items-center gap-3">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-border)] shrink-0">
            <img src={preview} alt="Comprobante" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
              aria-label="Quitar foto"
            >
              <X size={12} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => camaraRef.current?.click()}
            disabled={disabled}
            className="text-[11px] text-[var(--color-text-muted)] underline"
          >
            Reemplazar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => camaraRef.current?.click()}
            disabled={disabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-10 text-xs rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            <Camera size={14} /> Cámara
          </button>
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            disabled={disabled}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-10 text-xs rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-2)] disabled:opacity-40"
          >
            <ImageIcon size={14} /> Galería
          </button>
        </div>
      )}
    </div>
  )
}
