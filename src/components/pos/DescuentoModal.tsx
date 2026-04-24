import { useState } from 'react'
import { Modal } from '../ui'
import { formatCOP } from '../../lib/utils'

type DescuentoModalProps = {
  open: boolean
  subtotal: number
  descuentoActual: number
  motivoActual: string
  onApply: (monto: number, motivo: string) => void
  onClose: () => void
}

/**
 * Modal para aplicar/quitar descuento global a la venta. El descuento
 * puede ser monto fijo o porcentaje; al confirmar devuelve el monto
 * absoluto calculado. Motivo obligatorio si el descuento > 0.
 *
 * Patrón "mount-on-open": el body solo monta cuando `open=true`, de
 * modo que los valores iniciales se calculan en useState lazy y no
 * requieren useEffect de sincronización (evita cascading renders).
 */
export function DescuentoModal(props: DescuentoModalProps) {
  if (!props.open) return null
  return <DescuentoModalBody {...props} />
}

function DescuentoModalBody({
  open,
  subtotal,
  descuentoActual,
  motivoActual,
  onApply,
  onClose,
}: DescuentoModalProps) {
  const [tipo, setTipo] = useState<'monto' | 'porcentaje'>('monto')
  const [valor, setValor] = useState(descuentoActual)
  const [motivo, setMotivo] = useState(motivoActual)

  const montoCalculado =
    tipo === 'monto'
      ? Math.max(0, Math.min(valor || 0, subtotal))
      : Math.max(0, Math.min(Math.round(subtotal * ((valor || 0) / 100)), subtotal))

  const totalFinal = Math.max(0, subtotal - montoCalculado)
  const puedeAplicar = montoCalculado === 0 || motivo.trim().length > 0

  function handleApply() {
    onApply(montoCalculado, montoCalculado > 0 ? motivo.trim() : '')
    onClose()
  }

  function handleQuitar() {
    onApply(0, '')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Aplicar descuento" size="sm">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipo('monto')}
            className={`flex-1 h-9 text-xs rounded-md ${
              tipo === 'monto'
                ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            Monto fijo
          </button>
          <button
            type="button"
            onClick={() => setTipo('porcentaje')}
            className={`flex-1 h-9 text-xs rounded-md ${
              tipo === 'porcentaje'
                ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            Porcentaje
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            {tipo === 'monto' ? 'Descuento ($)' : 'Descuento (%)'}
          </label>
          <input
            type="number"
            value={valor || ''}
            onChange={e => setValor(Number(e.target.value) || 0)}
            className="w-full h-11 px-3 text-base tabular-nums"
            step={tipo === 'monto' ? 1000 : 1}
            min="0"
            max={tipo === 'porcentaje' ? 100 : subtotal}
            inputMode="decimal"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Motivo{' '}
            {montoCalculado > 0 && (
              <span className="text-[var(--color-accent-red)]">*</span>
            )}
          </label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Cliente frecuente, promoción, etc."
            className="w-full h-10 px-3 text-sm"
          />
        </div>

        <div className="text-sm space-y-1 pt-3 border-t border-[var(--color-border-light)]">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[var(--color-accent-red)]">
            <span>Descuento</span>
            <span className="tabular-nums">−{formatCOP(montoCalculado)}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatCOP(totalFinal)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {descuentoActual > 0 && (
            <button
              type="button"
              onClick={handleQuitar}
              className="flex-1 h-11 text-sm rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)]"
            >
              Quitar
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={!puedeAplicar}
            className="flex-1 h-11 text-sm rounded-md bg-[var(--color-text)] text-[var(--color-surface)] font-semibold disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  )
}
