import { useState } from 'react'
import { Modal, Field, Input, Select, Button } from '../ui'
import { MoneyInput } from '../MoneyInput'
import { useToast } from '../Toast'
import { formatCOP } from '../../lib/utils'
import { registrarAbono } from '../../lib/queries/ventas'
import type { Database } from '../../types/database'

type MetodoPago = Database['public']['Enums']['metodo_pago']

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'datafono', label: 'Datáfono' },
]

/**
 * Modal para registrar un abono a una venta a crédito. El monto se
 * limita al saldo pendiente actual para evitar sobre-pagos.
 */
export function AbonoModal(props: {
  open: boolean
  ventaId: string
  saldoPendiente: number
  onClose: () => void
  onSaved: () => void
}) {
  if (!props.open) return null
  return <AbonoModalBody {...props} />
}

function AbonoModalBody({
  ventaId,
  saldoPendiente,
  onClose,
  onSaved,
}: {
  ventaId: string
  saldoPendiente: number
  onClose: () => void
  onSaved: () => void
}) {
  const { addToast } = useToast()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(saldoPendiente)
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [saving, setSaving] = useState(false)

  const saldoDespues = Math.max(0, saldoPendiente - monto)
  const puedeGuardar = monto > 0 && monto <= saldoPendiente + 1 && !saving

  async function handleSave() {
    if (!puedeGuardar) return
    setSaving(true)
    const { error } = await registrarAbono({
      venta_id: ventaId,
      monto,
      metodo,
      referencia: referencia.trim() || null,
      fecha,
    })
    setSaving(false)
    if (error) {
      addToast('error', error)
      return
    }
    addToast(
      'success',
      saldoDespues === 0
        ? 'Abono registrado — venta totalmente pagada'
        : `Abono registrado — saldo ahora ${formatCOP(saldoDespues)}`,
    )
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Registrar abono" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-label)]">Saldo pendiente</span>
            <span className="font-semibold tabular-nums">
              {formatCOP(saldoPendiente)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" required>
            <Input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </Field>
          <Field label="Método" required>
            <Select
              value={metodo}
              onChange={e => setMetodo(e.target.value as MetodoPago)}
            >
              {METODOS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Monto del abono" required>
          <MoneyInput
            value={monto}
            onChange={setMonto}
            step="1000"
            min="0"
            max={saldoPendiente}
          />
        </Field>

        <Field label="Referencia" hint="N° confirmación, últimos 4 tarjeta, etc.">
          <Input
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Opcional"
          />
        </Field>

        <div className="flex justify-between text-sm pt-2 border-t border-[var(--color-border-light)]">
          <span className="text-[var(--color-text-label)]">
            {saldoDespues === 0 ? 'Quedaría totalmente pagado' : 'Saldo después del abono'}
          </span>
          <span className="font-bold tabular-nums">
            {formatCOP(saldoDespues)}
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!puedeGuardar}
            className="flex-1"
          >
            {saving ? 'Guardando…' : 'Registrar abono'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
