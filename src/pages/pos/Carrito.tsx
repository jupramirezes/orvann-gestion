import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus, Minus, ShoppingCart } from 'lucide-react'
import { useCarrito } from '../../hooks/useCarrito'
import { formatCOP } from '../../lib/utils'
import { POSFooterFixed } from '../../components/pos/POSFooterFixed'

export default function Carrito() {
  const navigate = useNavigate()
  const { items, subtotal, count, updateCantidad, updatePrecio, remove, clear } = useCarrito()

  return (
    <div className="pb-32">
      <div className="bg-[var(--color-bg)] border-b border-[var(--color-border-light)] px-4 py-3 flex items-center justify-between">
        <Link
          to="/pos"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={16} /> Seguir vendiendo
        </Link>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => { if (confirm('¿Vaciar el carrito?')) clear() }}
            className="text-xs text-[var(--color-accent-red)] font-medium"
          >
            Vaciar
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <ShoppingCart size={40} className="text-[var(--color-text-faint)] mb-3" />
          <p className="text-sm font-medium text-[var(--color-text)]">Carrito vacío</p>
          <p className="text-xs text-[var(--color-text-label)] mt-1">
            Agregá productos desde la grilla.
          </p>
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="mt-6 h-11 px-5 rounded-lg bg-[var(--color-text)] text-[var(--color-surface)] text-sm font-semibold"
          >
            Ver catálogo
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-border-light)]">
            {items.map(it => (
              <li key={it.varianteId} className="flex gap-3 p-3">
                <div className="w-16 h-16 rounded-lg bg-[var(--color-surface-2)] overflow-hidden shrink-0">
                  {it.imagenUrl ? (
                    <img src={it.imagenUrl} alt={it.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-mono text-[var(--color-text-faint)] p-1 text-center">
                      {it.sku}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] leading-tight">
                    {it.nombre}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-faint)] font-mono mt-0.5">{it.sku}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCantidad(it.varianteId, it.cantidad - 1)}
                      className="w-7 h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center active:bg-[var(--color-surface-2)]"
                      aria-label="Quitar uno"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="min-w-[28px] text-center text-sm font-semibold tabular-nums">{it.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => updateCantidad(it.varianteId, it.cantidad + 1)}
                      className="w-7 h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center active:bg-[var(--color-surface-2)]"
                      aria-label="Agregar uno"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(it.varianteId)}
                      className="ml-auto p-1 text-[var(--color-accent-red)]"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <label className="text-[var(--color-text-label)]">Precio unit:</label>
                    <div className="relative flex-1 max-w-[120px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-label)]">$</span>
                      <input
                        type="number"
                        value={it.precioAplicado}
                        onChange={e => updatePrecio(it.varianteId, Number(e.target.value))}
                        className="w-full h-7 pl-5 pr-1 text-xs tabular-nums text-right"
                        step="1000"
                        min="0"
                        inputMode="decimal"
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] font-semibold tabular-nums ml-auto">
                      = {formatCOP(it.precioAplicado * it.cantidad)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer fijo con total + cobrar (centrado dentro del shell POS) */}
          <POSFooterFixed>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-[var(--color-text-label)]">
                  {count} {count === 1 ? 'ítem' : 'ítems'}
                </p>
                <p className="text-[10px] text-[var(--color-text-faint)]">Subtotal</p>
              </div>
              <p className="text-2xl font-extrabold tabular-nums">{formatCOP(subtotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pos/cobro')}
              className="w-full h-14 rounded-xl bg-[var(--color-text)] text-[var(--color-surface)] font-bold text-base active:brightness-90"
            >
              Cobrar · {formatCOP(subtotal)}
            </button>
          </POSFooterFixed>
        </>
      )}
    </div>
  )
}
