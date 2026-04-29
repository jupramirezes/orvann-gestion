import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Truck } from 'lucide-react'
import { Constants, type Database } from '../../types/database'
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SortableTH,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { toggleSort, type SortState } from '../../lib/sort'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate } from '../../lib/utils'
import { listPedidos, type PedidoConJoin } from '../../lib/queries/pedidos'
import { listProveedores, type Proveedor } from '../../lib/queries/proveedores'

type EstadoPago = Database['public']['Enums']['estado_pago_pedido']
type SortKeyPed = 'fecha' | 'proveedor' | 'total' | 'estado_pago' | 'recepcion'

export default function Pedidos() {
  const [rows, setRows] = useState<PedidoConJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [estadoPago, setEstadoPago] = useState<string>('')
  const [mes, setMes] = useState('')
  const [sort, setSort] = useState<SortState<SortKeyPed>>({ key: 'fecha', dir: 'desc' })
  const { addToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const desde = mes ? `${mes}-01` : undefined
    const hasta = mes ? lastDayOfMonth(mes) : undefined
    Promise.all([
      listPedidos({
        proveedorId: proveedorId || undefined,
        estadoPago: (estadoPago || undefined) as EstadoPago | undefined,
        desde,
        hasta,
      }),
      listProveedores(),
    ]).then(([{ data, error }, { data: provs }]) => {
      if (cancelled) return
      setLoading(false)
      if (error) { addToast('error', error.message); return }
      setRows((data as unknown as PedidoConJoin[]) ?? [])
      if (provs) setProveedores(provs)
    })
    return () => { cancelled = true }
  }, [proveedorId, estadoPago, mes, addToast])

  const totalGeneral = rows.reduce((s, p) => s + Number(p.total ?? 0), 0)

  const sortedRows = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va: string | number =
        sort.key === 'fecha'         ? a.fecha_pedido ?? ''
        : sort.key === 'proveedor'   ? (a.proveedor?.nombre ?? '').toLowerCase()
        : sort.key === 'total'       ? Number(a.total ?? 0)
        : sort.key === 'estado_pago' ? (a.estado_pago ?? 'pendiente')
        : a.fecha_recepcion ?? ''
      const vb: string | number =
        sort.key === 'fecha'         ? b.fecha_pedido ?? ''
        : sort.key === 'proveedor'   ? (b.proveedor?.nombre ?? '').toLowerCase()
        : sort.key === 'total'       ? Number(b.total ?? 0)
        : sort.key === 'estado_pago' ? (b.estado_pago ?? 'pendiente')
        : b.fecha_recepcion ?? ''
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
      return String(va).localeCompare(String(vb)) * sign
    })
  }, [rows, sort])

  function handleSort(key: SortKeyPed) {
    setSort(prev => toggleSort(prev, key))
  }

  return (
    <>
      <PageHeader
        title="Pedidos a proveedor"
        subtitle={`${rows.length} pedido${rows.length === 1 ? '' : 's'} · ${formatCOP(totalGeneral)} total`}
        actions={
          <Button variant="accent" onClick={() => navigate('/admin/pedidos/nuevo')}>
            <Plus size={14} /> Nuevo pedido
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className="max-w-[200px]">
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </Select>
        <Select value={estadoPago} onChange={e => setEstadoPago(e.target.value)} className="max-w-[180px]">
          <option value="">Todos los estados</option>
          {Constants.public.Enums.estado_pago_pedido.map(e => (
            <option key={e} value={e}>{capitalize(e)}</option>
          ))}
        </Select>
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="max-w-[160px]" />
        {(proveedorId || estadoPago || mes) && (
          <Button variant="ghost" size="sm" onClick={() => { setProveedorId(''); setEstadoPago(''); setMes('') }}>
            Limpiar filtros
          </Button>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input className="pl-9" placeholder="Buscar por notas…" disabled title="Disponible próximamente" />
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description="Creá el primer pedido a proveedor."
          action={<Button variant="accent" onClick={() => navigate('/admin/pedidos/nuevo')}><Plus size={14} /> Nuevo pedido</Button>}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <SortableTH label="Fecha" sortKey="fecha" current={sort} onClick={handleSort} />
              <SortableTH label="Proveedor" sortKey="proveedor" current={sort} onClick={handleSort} />
              <TH align="right">Items</TH>
              <SortableTH label="Total" sortKey="total" current={sort} onClick={handleSort} align="right" />
              <SortableTH label="Pago" sortKey="estado_pago" current={sort} onClick={handleSort} />
              <SortableTH label="Recepción" sortKey="recepcion" current={sort} onClick={handleSort} />
            </TR>
          </THead>
          <TBody>
            {sortedRows.map(p => (
              <TR key={p.id} onClick={() => navigate(`/admin/pedidos/${p.id}`)}>
                <TD className="font-mono text-xs">{formatDate(p.fecha_pedido)}</TD>
                <TD className="font-medium">{p.proveedor?.nombre ?? '—'}</TD>
                <TD align="right" className="text-xs">{(p.items_count as unknown as { count: number }[])?.[0]?.count ?? 0}</TD>
                <TD align="right" className="font-medium">{formatCOP(Number(p.total ?? 0))}</TD>
                <TD>
                  <StatusBadge estado={p.estado_pago ?? 'pendiente'} />
                  {p.fecha_pago && (
                    <span className="block text-[10px] text-[var(--color-text-faint)] mt-0.5">
                      {formatDate(p.fecha_pago)}
                    </span>
                  )}
                </TD>
                <TD>
                  {p.fecha_recepcion ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <Truck size={11} /> {formatDate(p.fecha_recepcion)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--color-text-faint)]">Pendiente</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
        <Link to="/admin/pedidos/nuevo" className="hover:text-[var(--color-primary)]">Crear pedido →</Link>
      </p>
    </>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 0)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
