import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter } from 'lucide-react'
import { Constants } from '../../types/database'
import {
  PageHeader,
  Button,
  Input,
  Select,
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
import { formatCOP, formatShortDateTime } from '../../lib/utils'
import { listVentas, itemsCount, type VentaConJoin, type MetodoPago } from '../../lib/queries/ventas'
import type { Database } from '../../types/database'

type TipoTransaccion = Database['public']['Enums']['tipo_transaccion']

export default function Ventas() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [rows, setRows] = useState<VentaConJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Default: mes actual
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState<TipoTransaccion | ''>('')
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')

  const filterOpts = useMemo(
    () => ({
      desde: desde || undefined,
      hasta: hasta || undefined,
      tipo: (tipo || undefined) as TipoTransaccion | undefined,
      metodo: (metodo || undefined) as MetodoPago | undefined,
    }),
    [desde, hasta, tipo, metodo],
  )

  useEffect(() => {
    let cancelled = false
    listVentas({ ...filterOpts, limit: 500 }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error.message)
        return
      }
      setRows((data as VentaConJoin[]) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [filterOpts, addToast])

  const totales = useMemo(() => {
    const ventas = rows.filter(v => v.tipo_transaccion === 'venta')
    const devoluciones = rows.filter(v => v.tipo_transaccion === 'devolucion')
    const bruto = ventas.reduce((s, v) => s + Number(v.total ?? 0), 0)
    const devuelto = devoluciones.reduce((s, v) => s + Number(v.total ?? 0), 0)
    return {
      bruto,
      devuelto,
      neto: bruto - devuelto,
      countVentas: ventas.length,
      countDev: devoluciones.length,
    }
  }, [rows])

  function resetFiltros() {
    setDesde('')
    setHasta('')
    setTipo('')
    setMetodo('')
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Historial con detalle de cada transacción"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(s => !s)}>
            <Filter size={14} /> Filtros
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPICard
          label="Ventas"
          value={formatCOP(totales.bruto, { short: true })}
          small
          subtitle={`${totales.countVentas} transacciones`}
        />
        <KPICard
          label="Devoluciones"
          value={formatCOP(totales.devuelto, { short: true })}
          small
          subtitle={`${totales.countDev} devoluciones`}
        />
        <KPICard
          label="Neto"
          value={formatCOP(totales.neto, { short: true })}
          small
          subtitle="Bruto − devoluciones"
        />
        <KPICard
          label="Ticket promedio"
          value={formatCOP(
            totales.countVentas ? Math.round(totales.bruto / totales.countVentas) : 0,
            { short: true },
          )}
          small
          subtitle="Solo ventas"
        />
      </div>

      {showFilters && (
        <div className="card p-4 mb-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Desde</label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Hasta</label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Tipo</label>
            <Select value={tipo} onChange={e => setTipo(e.target.value as TipoTransaccion | '')}>
              <option value="">Todos</option>
              {Constants.public.Enums.tipo_transaccion.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Método</label>
            <Select value={metodo} onChange={e => setMetodo(e.target.value as MetodoPago | '')}>
              <option value="">Todos</option>
              {Constants.public.Enums.metodo_pago.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFiltros}>
            Limpiar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin ventas en el rango"
          description="Ajustá los filtros o esperá a que se registren ventas desde el POS."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Tipo</TH>
              <TH>Cliente</TH>
              <TH>Vendedor</TH>
              <TH>Método</TH>
              <TH align="center">Ítems</TH>
              <TH align="right">Total</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(v => (
              <TR key={v.id} onClick={() => navigate(`/admin/ventas/${v.id}`)}>
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
                <TD className="text-xs">
                  {v.cliente ? (
                    <>
                      <span className="font-medium">{v.cliente.nombre}</span>
                      {v.cliente.telefono && (
                        <span className="block text-[10px] text-[var(--color-text-faint)] font-mono">
                          {v.cliente.telefono}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">sin cliente</span>
                  )}
                </TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {v.vendedor?.nombre ?? '—'}
                </TD>
                <TD className="text-xs font-mono text-[var(--color-text-muted)]">
                  {v.metodo_pago}
                </TD>
                <TD align="center">{itemsCount(v)}</TD>
                <TD
                  align="right"
                  className={`font-semibold ${v.tipo_transaccion === 'devolucion' ? 'text-[var(--color-accent-red)]' : ''}`}
                >
                  {v.tipo_transaccion === 'devolucion' ? '−' : ''}
                  {formatCOP(Number(v.total ?? 0))}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
