import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Filter, Trash2, Pencil, Link2 } from 'lucide-react'
import {
  PageHeader,
  KPICard,
  Button,
  Select,
  Input,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  EmptyState,
  StatusBadge,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate } from '../../lib/utils'
import {
  listGastos,
  listCategoriasGasto,
  getTotalesGastos,
  deleteGasto,
  PAGADORES,
  type CategoriaGasto,
  type GastoConJoin,
  type PagadorGasto,
} from '../../lib/queries/gastos'

type Totales = {
  total: number
  kathe: number
  andres: number
  jp: number
  orvann: number
}

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
  credito: 'Crédito',
  plan_separe: 'Plan separe',
  mixto: 'Mixto',
}

export default function Gastos() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [gastos, setGastos] = useState<GastoConJoin[]>([])
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [totales, setTotales] = useState<Totales>({
    total: 0,
    kathe: 0,
    andres: 0,
    jp: 0,
    orvann: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filtros: default al mes actual
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [categoriaId, setCategoriaId] = useState('')
  const [pagador, setPagador] = useState<PagadorGasto | ''>('')

  const filterOpts = useMemo(
    () => ({
      desde: desde || undefined,
      hasta: hasta || undefined,
      categoriaId: categoriaId || undefined,
      pagador: (pagador || undefined) as PagadorGasto | undefined,
    }),
    [desde, hasta, categoriaId, pagador],
  )

  useEffect(() => {
    listCategoriasGasto().then(({ data }) => setCategorias(data ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    // loading solo se desactiva al resolver — en refetches por filtros
    // los datos previos se muestran hasta que llegan los nuevos (evita
    // parpadeos y el setState síncrono dentro del effect).
    Promise.all([listGastos(filterOpts), getTotalesGastos(filterOpts)]).then(
      ([gs, ts]) => {
        if (cancelled) return
        setLoading(false)
        if (gs.error) {
          addToast('error', gs.error.message)
          return
        }
        setGastos((gs.data as GastoConJoin[]) ?? [])
        if (ts.data) setTotales(ts.data)
      },
    )
    return () => {
      cancelled = true
    }
  }, [filterOpts, addToast])

  async function handleDelete(g: GastoConJoin) {
    if (
      !confirm(
        `¿Borrar el gasto "${g.descripcion ?? g.categoria?.nombre ?? 'sin descripción'}" de ${formatCOP(Number(g.monto_total))}?`,
      )
    ) {
      return
    }
    const { error } = await deleteGasto(g.id)
    if (error) {
      addToast('error', error.message)
      return
    }
    addToast('success', 'Gasto eliminado')
    setGastos(prev => prev.filter(x => x.id !== g.id))
    // refrescar totales
    getTotalesGastos(filterOpts).then(({ data }) => {
      if (data) setTotales(data)
    })
  }

  function resetFiltros() {
    setDesde('')
    setHasta('')
    setCategoriaId('')
    setPagador('')
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        subtitle="Distribución automática entre socios"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(s => !s)}
            >
              <Filter size={14} />
              Filtros
            </Button>
            <Link to="/admin/gastos/nuevo">
              <Button variant="primary" size="sm">
                <Plus size={14} />
                Nuevo gasto
              </Button>
            </Link>
          </>
        }
      />

      {/* KPIs de totales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KPICard label="Total" value={formatCOP(totales.total, { short: true })} small />
        <KPICard label="Kathe" value={formatCOP(totales.kathe, { short: true })} small />
        <KPICard label="Andrés" value={formatCOP(totales.andres, { short: true })} small />
        <KPICard label="JP" value={formatCOP(totales.jp, { short: true })} small />
        <KPICard label="ORVANN" value={formatCOP(totales.orvann, { short: true })} small />
      </div>

      {/* Filtros colapsables */}
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
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Categoría</label>
            <Select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-label)] mb-1">Pagador</label>
            <Select
              value={pagador}
              onChange={e => setPagador(e.target.value as PagadorGasto | '')}
            >
              <option value="">Todos</option>
              {PAGADORES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
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
      ) : gastos.length === 0 ? (
        <EmptyState
          title="Sin gastos en este rango"
          description="Ajustá los filtros o creá el primer gasto."
          action={
            <Link to="/admin/gastos/nuevo">
              <Button variant="primary" size="sm">
                <Plus size={14} /> Nuevo gasto
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Descripción</TH>
              <TH>Categoría</TH>
              <TH>Pagador</TH>
              <TH>Método</TH>
              <TH>Distribución</TH>
              <TH align="right">Monto</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {gastos.map(g => (
              <TR
                key={g.id}
                onClick={() => navigate(`/admin/gastos/${g.id}`)}
              >
                <TD>{formatDate(g.fecha)}</TD>
                <TD className="max-w-[240px] truncate" title={g.descripcion ?? ''}>
                  <span className="inline-flex items-center gap-1.5">
                    {g.ref_pedido_id && (
                      <Link2
                        size={12}
                        className="text-[var(--color-text-faint)] shrink-0"
                      />
                    )}
                    <span className="truncate">{g.descripcion ?? '—'}</span>
                  </span>
                </TD>
                <TD>
                  <span className="text-[var(--color-text-muted)]">
                    {g.categoria?.nombre ?? '—'}
                  </span>
                </TD>
                <TD>
                  <span className="text-xs font-mono">{g.pagador}</span>
                </TD>
                <TD>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {METODO_LABELS[g.metodo_pago] ?? g.metodo_pago}
                  </span>
                </TD>
                <TD>
                  <StatusBadge estado={g.distribucion} />
                </TD>
                <TD align="right">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold">
                      {formatCOP(Number(g.monto_total))}
                    </span>
                    <BreakdownHint g={g} />
                  </div>
                </TD>
                <TD>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/admin/gastos/${g.id}`)
                      }}
                      className="p-1.5 text-[var(--color-text-label)] hover:text-[var(--color-text)] rounded-md"
                      aria-label="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        handleDelete(g)
                      }}
                      className="p-1.5 text-[var(--color-text-label)] hover:text-[var(--color-accent-red)] rounded-md"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

function BreakdownHint({ g }: { g: GastoConJoin }) {
  const parts: string[] = []
  if (Number(g.monto_kathe ?? 0) > 0)
    parts.push(`K ${formatCOP(Number(g.monto_kathe), { short: true })}`)
  if (Number(g.monto_andres ?? 0) > 0)
    parts.push(`A ${formatCOP(Number(g.monto_andres), { short: true })}`)
  if (Number(g.monto_jp ?? 0) > 0)
    parts.push(`J ${formatCOP(Number(g.monto_jp), { short: true })}`)
  if (Number(g.monto_orvann ?? 0) > 0)
    parts.push(`O ${formatCOP(Number(g.monto_orvann), { short: true })}`)
  if (parts.length === 0) return null
  return (
    <span className="text-[10px] text-[var(--color-text-faint)] font-mono">
      {parts.join(' · ')}
    </span>
  )
}
