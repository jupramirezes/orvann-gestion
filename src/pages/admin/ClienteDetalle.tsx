import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Instagram } from 'lucide-react'
import {
  PageHeader,
  KPICard,
  StatusBadge,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  EmptyState,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate, formatShortDateTime } from '../../lib/utils'
import { getCliente, type Cliente } from '../../lib/queries/clientes'
import { listVentas, itemsCount, type VentaConJoin } from '../../lib/queries/ventas'

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [ventas, setVentas] = useState<VentaConJoin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getCliente(id),
      listVentas({ clienteId: id, limit: 200, incluirTodosEstados: false }),
    ]).then(([clRes, vsRes]) => {
      if (cancelled) return
      setLoading(false)
      if (clRes.error) {
        addToast('error', clRes.error.message)
        return
      }
      setCliente(clRes.data)
      if (vsRes.error) addToast('error', vsRes.error.message)
      else setVentas((vsRes.data as VentaConJoin[]) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [id, addToast])

  if (loading) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
        Cargando…
      </div>
    )
  }
  if (!cliente) {
    return <div className="card p-8 text-center text-sm">Cliente no encontrado.</div>
  }

  const devoluciones = ventas.filter(v => v.tipo_transaccion === 'devolucion')

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={14} /> Volver a clientes
        </Link>
      </div>

      <PageHeader
        title={cliente.nombre}
        subtitle={`Desde ${formatDate(cliente.primera_compra_fecha)}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-3">
            Contacto
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone size={12} className="text-[var(--color-text-label)]" />
              <dd className="font-mono">{cliente.telefono ?? '—'}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={12} className="text-[var(--color-text-label)]" />
              <dd>{cliente.email ?? '—'}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Instagram size={12} className="text-[var(--color-text-label)]" />
              <dd>{cliente.instagram ?? '—'}</dd>
            </div>
          </dl>
          {cliente.notas && (
            <p className="text-xs text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border-light)]">
              {cliente.notas}
            </p>
          )}
        </div>
        <KPICard
          label="Compras"
          value={String(cliente.num_compras_cache ?? 0)}
          small
          subtitle={devoluciones.length > 0 ? `${devoluciones.length} devoluciones` : undefined}
        />
        <KPICard
          label="Total comprado"
          value={formatCOP(Number(cliente.total_comprado_cache ?? 0), { short: true })}
          small
          subtitle="Histórico (netos de devoluciones)"
        />
      </div>

      <h3 className="text-sm font-semibold mb-3">Historial de compras</h3>

      {ventas.length === 0 ? (
        <EmptyState
          title="Sin compras todavía"
          description="Cuando este cliente vuelva al POS y se asocie la venta, aparecerá acá."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Tipo</TH>
              <TH>Método</TH>
              <TH align="center">Ítems</TH>
              <TH align="right">Total</TH>
              <TH>Vendedor</TH>
            </TR>
          </THead>
          <TBody>
            {ventas.map(v => (
              <TR key={v.id}>
                <TD className="text-xs">{formatShortDateTime(v.fecha)}</TD>
                <TD>
                  {v.tipo_transaccion === 'devolucion' ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                      Devolución
                    </span>
                  ) : v.tipo_transaccion === 'cambio' ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      Cambio
                    </span>
                  ) : (
                    <StatusBadge estado={v.estado ?? 'completada'} />
                  )}
                </TD>
                <TD className="text-xs text-[var(--color-text-muted)]">{v.metodo_pago}</TD>
                <TD align="center">{itemsCount(v)}</TD>
                <TD
                  align="right"
                  className={`font-semibold ${v.tipo_transaccion === 'devolucion' ? 'text-[var(--color-accent-red)]' : ''}`}
                >
                  {v.tipo_transaccion === 'devolucion' ? '−' : ''}
                  {formatCOP(Number(v.total ?? 0))}
                </TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {v.vendedor?.nombre ?? '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
