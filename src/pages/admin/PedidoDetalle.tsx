import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  Truck,
  AlertCircle,
  Pencil,
} from 'lucide-react'
import {
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate } from '../../lib/utils'
import {
  getPedido,
  listPedidoItems,
  marcarPagado,
  marcarRecibido,
  recalcularTotalPedido,
  updatePedidoItem,
  type Pedido,
  type PedidoItemConVariante,
} from '../../lib/queries/pedidos'
import {
  listVariantes,
  listParametrosCosto,
  createVariante,
  generarSku,
  type VarianteConJoin,
} from '../../lib/queries/variantes'
import { listDisenos, type Diseno } from '../../lib/queries/disenos'
import { calcularCostoAdicional, ESTAMPADO_LABELS } from '../../lib/catalogo'
import { Constants } from '../../types/database'
import { MoneyInput } from '../../components/MoneyInput'
import type { Database } from '../../types/database'

const today = new Date().toISOString().slice(0, 10)

type PedidoDetalle = Pedido & { proveedor: { id: string; nombre: string } | null }

export default function PedidoDetalle() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null)
  const [items, setItems] = useState<PedidoItemConVariante[]>([])
  const [variantes, setVariantes] = useState<VarianteConJoin[]>([])
  const [disenos, setDisenos] = useState<Diseno[]>([])
  const [parametros, setParametros] = useState<Database['public']['Tables']['parametros_costo']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [openPago, setOpenPago] = useState(false)
  const [openRecepcion, setOpenRecepcion] = useState(false)
  const [mapeoItem, setMapeoItem] = useState<PedidoItemConVariante | null>(null)
  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getPedido(id),
      listPedidoItems(id),
      listVariantes({ limit: 500 }),
      listDisenos({ includeInactive: false }),
      listParametrosCosto(),
    ]).then(([{ data: p, error: errP }, { data: its, error: errI }, { data: vars }, { data: dis }, { data: params }]) => {
      if (cancelled) return
      setLoading(false)
      if (errP) { addToast('error', errP.message); return }
      setPedido(p as PedidoDetalle)
      if (errI) addToast('error', errI.message)
      else setItems((its as PedidoItemConVariante[]) ?? [])
      if (vars) setVariantes(vars as VarianteConJoin[])
      if (dis) setDisenos(dis)
      if (params) setParametros(params)
    })
    return () => { cancelled = true }
  }, [id, reloadKey, addToast])

  if (loading) return <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
  if (!pedido) return <div className="card p-8 text-center text-sm">Pedido no encontrado.</div>

  const itemsSinMapear = items.filter(i => !i.variante_id).length
  const totalCalculado = items.reduce((s, i) => s + i.unidades * Number(i.costo_unitario), 0)
  const totalOk = Math.abs(totalCalculado - Number(pedido.total ?? 0)) < 1
  const recepcionHecha = !!pedido.fecha_recepcion
  const pagoHecho = pedido.estado_pago === 'pagado'

  return (
    <>
      <div className="mb-4">
        <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-label)] hover:text-[var(--color-text)]">
          <ArrowLeft size={12} /> Volver a pedidos
        </Link>
      </div>

      <PageHeader
        title={`Pedido · ${pedido.proveedor?.nombre ?? '—'}`}
        subtitle={`${formatDate(pedido.fecha_pedido)} · ${items.length} item${items.length === 1 ? '' : 's'}`}
        actions={
          <div className="flex gap-2">
            {!pagoHecho && (
              <Button variant="default" onClick={() => setOpenPago(true)}>
                <CheckCircle size={14} /> Marcar pagado
              </Button>
            )}
            {!recepcionHecha && (
              <Button variant="accent" onClick={() => setOpenRecepcion(true)}>
                <Truck size={14} /> Registrar recepción
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">Resumen</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Proveedor</dt>
              <dd className="font-medium">{pedido.proveedor?.nombre ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Fecha de pedido</dt>
              <dd className="font-medium">{formatDate(pedido.fecha_pedido)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Estado de pago</dt>
              <dd className="flex items-center gap-2">
                <StatusBadge estado={pedido.estado_pago ?? 'pendiente'} />
                {pedido.fecha_pago && <span className="text-xs text-[var(--color-text-muted)]">el {formatDate(pedido.fecha_pago)}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Recepción</dt>
              <dd className="flex items-center gap-2">
                {recepcionHecha ? (
                  <>
                    <StatusBadge estado="entregado" />
                    <span className="text-xs text-[var(--color-text-muted)]">el {formatDate(pedido.fecha_recepcion)}</span>
                  </>
                ) : (
                  <span className="text-xs text-[var(--color-text-faint)]">Pendiente</span>
                )}
              </dd>
            </div>
            {pedido.notas && (
              <div className="col-span-2">
                <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Notas</dt>
                <dd className="text-xs text-[var(--color-text-muted)]">{pedido.notas}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">Montos</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Total calculado</dt>
              <dd className="font-semibold tabular-nums">{formatCOP(totalCalculado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Total guardado</dt>
              <dd className="tabular-nums">{formatCOP(Number(pedido.total ?? 0))}</dd>
            </div>
            {!totalOk && (
              <button
                type="button"
                className="text-[11px] text-[var(--color-primary)] underline block"
                onClick={async () => {
                  if (!id) return
                  const { error } = await recalcularTotalPedido(id)
                  if (error) addToast('error', error.message)
                  else { addToast('success', 'Total recalculado'); reload() }
                }}
              >
                Recalcular total
              </button>
            )}
            <div className="flex justify-between text-xs pt-2 border-t border-[var(--color-border-light)]">
              <dt className="text-[var(--color-text-label)]">Items sin mapear</dt>
              <dd className="tabular-nums font-medium">
                {itemsSinMapear}
                {itemsSinMapear > 0 && <span className="ml-1 text-[var(--color-accent-orange)]">•</span>}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3">Items</h3>

      {!recepcionHecha && itemsSinMapear > 0 && (
        <div className="card p-3 mb-3 border border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle size={14} className="text-amber-700 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">
                {itemsSinMapear} item{itemsSinMapear === 1 ? '' : 's'} sin variante mapeada
              </p>
              <p className="text-[var(--color-text-muted)] mt-0.5">
                Los items sin mapear <strong>no generan movimiento de inventario</strong> al registrar recepción.
                Mapealos antes de confirmar la recepción (click en el botón ↻ de cada fila).
              </p>
            </div>
          </div>
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>Variante / Descripción</TH>
            <TH align="right">Unidades</TH>
            <TH align="right">Costo unit</TH>
            <TH align="right">Subtotal</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {items.map(it => (
            <TR key={it.id}>
              <TD>
                {it.variante ? (
                  <>
                    <span className="font-mono text-xs">{it.variante.sku}</span>
                    <span className="block text-[11px] text-[var(--color-text-muted)]">
                      {it.variante.producto?.nombre ?? '—'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--color-text-muted)]">
                      {it.descripcion_libre ?? '—'}
                    </span>
                    <span className="block text-[10px] text-[var(--color-accent-orange)]">Sin mapear</span>
                  </>
                )}
              </TD>
              <TD align="right">{it.unidades}</TD>
              <TD align="right" className="text-xs">{formatCOP(Number(it.costo_unitario))}</TD>
              <TD align="right" className="font-medium">{formatCOP(Number(it.subtotal ?? 0))}</TD>
              <TD>
                {!it.variante_id && !recepcionHecha && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon
                    onClick={() => setMapeoItem(it)}
                    title="Mapear a variante"
                  >
                    <Pencil size={13} />
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <MarcarPagoModal
        open={openPago}
        onClose={() => setOpenPago(false)}
        onConfirm={async (fecha) => {
          if (!id) return
          const { error } = await marcarPagado(id, fecha)
          if (error) addToast('error', error.message)
          else {
            addToast('success', 'Pedido pagado — gasto creado en categoría Mercancía')
            setOpenPago(false)
            reload()
          }
        }}
      />

      <RecepcionModal
        open={openRecepcion}
        onClose={() => setOpenRecepcion(false)}
        itemsSinMapear={itemsSinMapear}
        onConfirm={async (fecha) => {
          if (!id) return
          const { error } = await marcarRecibido(id, fecha)
          if (error) addToast('error', error.message)
          else {
            addToast('success', 'Recepción registrada — stock actualizado')
            setOpenRecepcion(false)
            reload()
          }
        }}
      />

      {mapeoItem && (
        <MapeoItemModal
          item={mapeoItem}
          variantes={variantes}
          disenos={disenos}
          parametros={parametros}
          onClose={() => setMapeoItem(null)}
          onConfirm={async (varianteId) => {
            const { error } = await updatePedidoItem(mapeoItem.id, { variante_id: varianteId })
            if (error) addToast('error', error.message)
            else { addToast('success', 'Item mapeado'); setMapeoItem(null); reload() }
          }}
        />
      )}
    </>
  )
}

/* ─── Modals ─────────────────────────────────────────────────────── */

function MarcarPagoModal({
  open, onClose, onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (fecha: string) => Promise<void>
}) {
  const [fecha, setFecha] = useState(today)
  const [saving, setSaving] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Marcar pedido como pagado">
      <div className="space-y-4">
        <Field label="Fecha de pago" required>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            variant="accent"
            disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(fecha); setSaving(false) }}
          >
            {saving ? 'Guardando…' : 'Confirmar pago'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RecepcionModal({
  open, onClose, onConfirm, itemsSinMapear,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (fecha: string) => Promise<void>
  itemsSinMapear: number
}) {
  const [fecha, setFecha] = useState(today)
  const [saving, setSaving] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Registrar recepción">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Al confirmar, el stock de todas las variantes mapeadas se incrementa con las unidades del pedido.
          Esta acción no se puede deshacer fácilmente.
        </p>
        {itemsSinMapear > 0 && (
          <div className="card p-3 border border-amber-200 bg-amber-50/60">
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle size={14} className="text-amber-700 mt-0.5 shrink-0" />
              <p className="text-amber-800">
                <strong>{itemsSinMapear} item{itemsSinMapear === 1 ? '' : 's'} sin mapear</strong> no afectarán stock.
                Podés seguir sin ellos o cerrar, mapear, y volver.
              </p>
            </div>
          </div>
        )}
        <Field label="Fecha de recepción" required>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            variant="accent"
            disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(fecha); setSaving(false) }}
          >
            {saving ? 'Registrando…' : 'Confirmar recepción'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

type ProductoLite = {
  id: string
  nombre: string
  tipo: Database['public']['Enums']['tipo_producto']
}

function MapeoItemModal({
  item, variantes, disenos, parametros, onClose, onConfirm,
}: {
  item: PedidoItemConVariante
  variantes: VarianteConJoin[]
  disenos: Diseno[]
  parametros: Database['public']['Tables']['parametros_costo']['Row'][]
  onClose: () => void
  onConfirm: (varianteId: string) => Promise<void>
}) {
  const { addToast } = useToast()
  const [modo, setModo] = useState<'existente' | 'nueva'>('existente')
  const [varianteId, setVarianteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState(item.descripcion_libre ?? '')

  // Modo "nueva variante"
  const [productoId, setProductoId] = useState('')
  const [color, setColor] = useState('')
  const [talla, setTalla] = useState('')
  const [disenoId, setDisenoId] = useState('')
  const [estampado, setEstampado] = useState<Database['public']['Enums']['tipo_estampado']>('ninguno')
  const [costoBase, setCostoBase] = useState(Number(item.costo_unitario) || 0)
  const [precioVenta, setPrecioVenta] = useState(0)

  // Lista única de productos tomada de las variantes (dedup)
  const productos: ProductoLite[] = (() => {
    const map = new Map<string, ProductoLite>()
    for (const v of variantes) {
      if (v.producto && !map.has(v.producto.id)) {
        map.set(v.producto.id, v.producto)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  })()

  const productoSeleccionado = productos.find(p => p.id === productoId) ?? null
  const costoAdicional = productoSeleccionado
    ? calcularCostoAdicional(parametros, productoSeleccionado.tipo, estampado).total
    : 0

  const filtered = variantes.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      v.sku.toLowerCase().includes(s) ||
      (v.producto?.nombre ?? '').toLowerCase().includes(s) ||
      (v.color ?? '').toLowerCase().includes(s) ||
      (v.talla ?? '').toLowerCase().includes(s) ||
      (v.diseno?.nombre ?? '').toLowerCase().includes(s)
    )
  }).slice(0, 50)

  const puedeCrearNueva =
    !!productoId &&
    !!color.trim() &&
    !!talla.trim() &&
    costoBase > 0 &&
    precioVenta > 0 &&
    !saving

  async function handleCrearYMapear() {
    if (!puedeCrearNueva) return
    setSaving(true)

    const sku = await generarSku(
      productoId,
      color.trim(),
      talla.trim(),
      disenoId || null,
    ).catch(() => null)

    if (!sku) {
      setSaving(false)
      addToast('error', 'No se pudo generar el SKU')
      return
    }

    const { data: nueva, error: errCrear } = await createVariante({
      producto_id: productoId,
      sku,
      color: color.trim(),
      talla: talla.trim(),
      diseno_id: disenoId || null,
      estampado,
      costo_base: costoBase,
      costo_adicional: costoAdicional,
      precio_venta: precioVenta,
      activo: true,
      notas: `Creada desde mapeo de pedido (item "${item.descripcion_libre ?? ''}")`,
    })

    if (errCrear || !nueva) {
      setSaving(false)
      addToast('error', errCrear?.message ?? 'Error creando variante')
      return
    }

    await onConfirm(nueva.id)
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title="Mapear item a variante" size="lg">
      <div className="space-y-4">
        <div className="card p-3 text-xs">
          <p className="font-semibold">Item del pedido</p>
          <p className="text-[var(--color-text-muted)]">
            {item.descripcion_libre ?? '—'} · {item.unidades} unidades · {formatCOP(Number(item.costo_unitario))}/u
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo('existente')}
            className={`flex-1 h-9 text-xs rounded-md ${
              modo === 'existente'
                ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            Elegir variante existente
          </button>
          <button
            type="button"
            onClick={() => setModo('nueva')}
            className={`flex-1 h-9 text-xs rounded-md ${
              modo === 'nueva'
                ? 'bg-[var(--color-text)] text-[var(--color-surface)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            + Crear variante nueva
          </button>
        </div>

        {modo === 'existente' ? (
          <>
            <Field label="Buscar variante" hint="Por SKU, producto, color, talla o diseño">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ej. boxy M negra"
              />
            </Field>

            <Field label="Variante" required>
              <Select value={varianteId} onChange={e => setVarianteId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {filtered.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.sku} · {v.producto?.nombre ?? ''} · {v.color ?? ''} {v.talla ?? ''} · stock {v.stock_cache}
                  </option>
                ))}
              </Select>
              {filtered.length === 50 && (
                <span className="text-[10px] text-[var(--color-text-faint)]">
                  Mostrando 50 variantes, refiná la búsqueda.
                </span>
              )}
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                variant="accent"
                disabled={!varianteId || saving}
                onClick={async () => { setSaving(true); await onConfirm(varianteId); setSaving(false) }}
              >
                {saving ? 'Guardando…' : 'Confirmar mapeo'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Producto" required>
                <Select value={productoId} onChange={e => setProductoId(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Estampado">
                <Select
                  value={estampado}
                  onChange={e => setEstampado(e.target.value as Database['public']['Enums']['tipo_estampado'])}
                >
                  {Constants.public.Enums.tipo_estampado.map(te => (
                    <option key={te} value={te}>{ESTAMPADO_LABELS[te]}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color" required>
                <Input value={color} onChange={e => setColor(e.target.value)} placeholder="ej. Negro" />
              </Field>
              <Field label="Talla" required>
                <Input value={talla} onChange={e => setTalla(e.target.value)} placeholder="ej. M" />
              </Field>
            </div>
            <Field label="Diseño" hint="Opcional; solo si aplica (diseño cultural)">
              <Select value={disenoId} onChange={e => setDisenoId(e.target.value)}>
                <option value="">— Sin diseño —</option>
                {disenos.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo base" required hint={`+ ${formatCOP(costoAdicional)} adicional calculado`}>
                <MoneyInput value={costoBase} onChange={setCostoBase} step="500" min="0" />
              </Field>
              <Field label="Precio de venta" required>
                <MoneyInput value={precioVenta} onChange={setPrecioVenta} step="1000" min="0" />
              </Field>
            </div>
            <p className="text-[11px] text-[var(--color-text-faint)]">
              El SKU se genera automáticamente. Costo total = {formatCOP(costoBase + costoAdicional)}.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                variant="accent"
                disabled={!puedeCrearNueva}
                onClick={handleCrearYMapear}
              >
                {saving ? 'Creando…' : 'Crear variante y mapear'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
