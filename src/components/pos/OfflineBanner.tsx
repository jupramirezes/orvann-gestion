import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnline } from '../../hooks/useOnline'

/**
 * Banner persistente en el tope del POS cuando no hay red.
 * En F1 el POS NO opera ventas sin conexión (eso es F1.5). El banner
 * informa al vendedor y deshabilita el botón de confirmar venta.
 */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="sticky top-0 z-40 bg-[var(--color-accent-red)] text-white px-4 py-2 flex items-center gap-3 text-sm">
      <WifiOff size={16} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">Sin conexión</p>
        <p className="text-[11px] opacity-90 leading-tight">
          Las ventas se habilitan cuando vuelva internet. El catálogo visible es el último cargado.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold underline"
        aria-label="Reintentar conexión"
      >
        <RefreshCw size={12} />
        Reintentar
      </button>
    </div>
  )
}
