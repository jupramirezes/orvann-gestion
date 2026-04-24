import { useState, useRef, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'

/**
 * Input de foto con captura de cámara (rear-facing en móvil) + preview.
 * Devuelve el File al parent; la subida real al bucket se hace después
 * de crear la venta (necesitamos el venta_id para el path).
 */
export function FotoComprobanteUpload({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (inputRef.current) inputRef.current.value = ''
    setPreview(null)
    onChange(null)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
        disabled={disabled}
      />
      {preview ? (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-border)]">
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
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 h-9 text-xs rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-2)] disabled:opacity-40"
        >
          <Camera size={14} /> Adjuntar foto
        </button>
      )}
    </div>
  )
}
