import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { formatCOP } from '../../lib/utils'
import { ESTAMPADO_LABELS } from '../../lib/catalogo'
import { useCarrito } from '../../hooks/useCarrito'
import { useToast } from '../Toast'
import type { VarianteConJoin } from '../../lib/queries/variantes'

/**
 * Modal full-screen de detalle de variante en el POS. Imagen grande +
 * info + input de precio editable (prellenado con precio_venta) +
 * selector de cantidad + botón "Agregar a venta".
 */
export function VarianteDetalleModal({
  variante, onClose,
}: {
  variante: VarianteConJoin | null
  onClose: () => void
}) {
  if (!variante) return null
  // key fuerza remount al cambiar de variante → estado limpio sin useEffect
  return <ModalBody key={variante.id} variante={variante} onClose={onClose} />
}

function ModalBody({
  variante, onClose,
}: {
  variante: VarianteConJoin
  onClose: () => void
}) {
  const { add } = useCarrito()
  const { addToast } = useToast()
  const [precio, setPrecio] = useState<number>(Number(variante.precio_venta))
  const [cantidad, setCantidad] = useState<number>(1)

  const stock = variante.stock_cache ?? 0
  const nombreCompleto = [
    variante.producto?.nombre,
    variante.color,
    variante.talla,
  ].filter(Boolean).join(' · ')

  function handleAdd() {
    for (let i = 0; i < cantidad; i++) {
      add({
        varianteId: variante.id,
        sku: variante.sku,
        nombre: nombreCompleto,
        imagenUrl: variante.imagen_url,
        precioVenta: Number(variante.precio_venta),
        costoUnitario: Number(variante.costo_total ?? 0),
        precioAplicado: precio,
      })
    }
    addToast('success', `${cantidad} × ${nombreCompleto} agregado`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con botón cerrar */}
        <div className="relative">
          <div className="aspect-square bg-[var(--color-surface-2)] flex items-center justify-center overflow-hidden">
            {variante.imagen_url ? (
              <img
                src={variante.imagen_url}
                alt={nombreCompleto}
                className="w-full h-full object-cover"
              />
            ) : (
              <p className="font-mono text-sm text-[var(--color-text-faint)]">{variante.sku}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-wide">
            {variante.sku}
          </p>
          <h2 className="text-lg font-bold text-[var(--color-text)] mt-0.5">
            {variante.producto?.nombre ?? '—'}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {[variante.color, variante.talla].filter(Boolean).join(' · ') || '—'}
          </p>
          {variante.diseno && (
            <p className="text-xs text-[var(--color-text-label)] mt-0.5">
              Diseño: <span className="font-medium text-[var(--color-text-muted)]">{variante.diseno.nombre}</span>
              {variante.estampado && variante.estampado !== 'ninguno' && (
                <span className="ml-1">· {ESTAMPADO_LABELS[variante.estampado]}</span>
              )}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-[var(--color-text-label)]">Stock:</span>
            <span className={`font-semibold tabular-nums ${stock < 3 ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-text)]'}`}>
              {stock}
            </span>
          </div>

          {/* Precio editable */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Precio de venta
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-label)] font-medium">$</span>
              <input
                type="number"
                value={precio}
                onChange={e => setPrecio(Number(e.target.value))}
                className="w-full h-12 pl-7 pr-3 text-lg font-bold tabular-nums"
                step="1000"
                min="0"
                inputMode="decimal"
              />
            </div>
            {precio !== Number(variante.precio_venta) && (
              <p className="text-[11px] text-[var(--color-text-label)] mt-1">
                Precio sugerido: {formatCOP(Number(variante.precio_venta))}
              </p>
            )}
          </div>

          {/* Cantidad */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Cantidad
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCantidad(c => Math.max(1, c - 1))}
                className="w-12 h-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center active:bg-[var(--color-surface-2)]"
                aria-label="Menos"
              >
                <Minus size={18} />
              </button>
              <span className="flex-1 text-center text-2xl font-bold tabular-nums">{cantidad}</span>
              <button
                type="button"
                onClick={() => setCantidad(c => Math.min(stock, c + 1))}
                disabled={cantidad >= stock}
                className="w-12 h-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center active:bg-[var(--color-surface-2)] disabled:opacity-40"
                aria-label="Más"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Subtotal */}
          <div className="mt-4 flex items-center justify-between text-sm pt-3 border-t border-[var(--color-border-light)]">
            <span className="text-[var(--color-text-label)]">Subtotal</span>
            <span className="text-lg font-bold tabular-nums">{formatCOP(precio * cantidad)}</span>
          </div>
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface)]">
          <button
            type="button"
            onClick={handleAdd}
            disabled={stock <= 0 || precio <= 0 || cantidad <= 0}
            className="w-full h-12 rounded-lg bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-base active:brightness-90 disabled:opacity-40"
          >
            Agregar a venta
          </button>
        </div>
      </div>
    </div>
  )
}
