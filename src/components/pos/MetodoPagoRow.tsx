import { Trash2 } from 'lucide-react'
import type { Database } from '../../types/database'
import { FotoComprobanteUpload } from './FotoComprobanteUpload'

type MetodoPago = Database['public']['Enums']['metodo_pago']

export type PagoDraft = {
  metodo: MetodoPago
  monto: number
  referencia: string
  foto: File | null
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'datafono', label: 'Datáfono' },
  { value: 'credito', label: 'A crédito' },
]

/**
 * Fila de un pago dentro del cobro. Permite elegir método, monto,
 * referencia opcional y foto del comprobante (cuando aplica:
 * transferencia o datáfono). El parent orquesta la lista.
 */
export function MetodoPagoRow({
  pago,
  onChange,
  onRemove,
  canRemove,
}: {
  pago: PagoDraft
  onChange: (p: PagoDraft) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const aceptaFoto = pago.metodo === 'transferencia' || pago.metodo === 'datafono'
  const placeholderRef =
    pago.metodo === 'transferencia'
      ? 'N° de confirmación (opcional)'
      : pago.metodo === 'datafono'
        ? 'Últimos 4 de la tarjeta (opcional)'
        : 'Referencia (opcional)'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <select
          value={pago.metodo}
          onChange={e => onChange({ ...pago, metodo: e.target.value as MetodoPago })}
          className="h-10 px-2 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] flex-1 min-w-0"
          aria-label="Método de pago"
        >
          {METODOS.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="relative w-[140px]">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-label)]">
            $
          </span>
          <input
            type="number"
            value={pago.monto || ''}
            onChange={e => onChange({ ...pago, monto: Number(e.target.value) || 0 })}
            placeholder="0"
            className="w-full h-10 pl-6 pr-2 text-sm tabular-nums text-right"
            step="1000"
            min="0"
            inputMode="decimal"
            aria-label="Monto"
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-10 w-10 flex items-center justify-center text-[var(--color-accent-red)] rounded-md active:bg-[var(--color-surface-2)] shrink-0"
            aria-label="Quitar pago"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {aceptaFoto && (
        <div className="space-y-2">
          <input
            type="text"
            value={pago.referencia}
            onChange={e => onChange({ ...pago, referencia: e.target.value })}
            placeholder={placeholderRef}
            className="w-full h-9 px-3 text-xs"
          />
          <FotoComprobanteUpload onChange={f => onChange({ ...pago, foto: f })} />
        </div>
      )}
    </div>
  )
}
