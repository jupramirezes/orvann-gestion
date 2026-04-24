import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus } from 'lucide-react'
import { Constants } from '../../types/database'
import {
  Button,
  EmptyState,
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
  Textarea,
  TR,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import {
  calcularCostoAdicional,
  calcularMargen,
  ESTAMPADO_LABELS,
  TIPO_PRODUCTO_LABELS,
  previewSku,
} from '../../lib/catalogo'
import { formatCOP } from '../../lib/utils'
import {
  getProducto,
  updateProducto,
  type ProductoConProveedor,
} from '../../lib/queries/productos'
import { listProveedores, type Proveedor } from '../../lib/queries/proveedores'
import { listDisenos, type Diseno } from '../../lib/queries/disenos'
import {
  createVariante,
  generarSku,
  listParametrosCosto,
  listVariantes,
  type ParametroCosto,
  type VarianteConJoin,
} from '../../lib/queries/variantes'

const productoEditSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  tipo: z.enum(Constants.public.Enums.tipo_producto),
  marca: z.string().trim().max(40).nullish(),
  proveedor_id: z.string().uuid().nullish().or(z.literal('').transform(() => null)),
  descripcion: z.string().trim().max(300).nullish(),
})
type ProductoEditForm = z.infer<typeof productoEditSchema>

export default function ProductoDetalle() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()

  const [producto, setProducto] = useState<ProductoConProveedor | null>(null)
  const [variantes, setVariantes] = useState<VarianteConJoin[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [disenos, setDisenos] = useState<Diseno[]>([])
  const [parametros, setParametros] = useState<ParametroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [openVariante, setOpenVariante] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      getProducto(id),
      listVariantes({ productoId: id, includeInactive: true, limit: 200 }),
      listProveedores(),
      listDisenos({ includeInactive: false }),
      listParametrosCosto(),
    ]).then(([
      { data: prod, error: err1 },
      { data: vars, error: err2 },
      { data: provs },
      { data: dis },
      { data: params },
    ]) => {
      if (cancelled) return
      setLoading(false)
      if (err1) { addToast('error', err1.message); return }
      setProducto(prod as ProductoConProveedor)
      if (err2) addToast('error', err2.message)
      else setVariantes((vars as VarianteConJoin[]) ?? [])
      if (provs) setProveedores(provs)
      if (dis) setDisenos(dis)
      if (params) setParametros(params)
    })
    return () => { cancelled = true }
  }, [id, reloadKey, addToast])

  if (loading) return <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
  if (!producto) return <div className="card p-8 text-center text-sm">Producto no encontrado.</div>

  const variantesActivas = variantes.filter(v => v.activo !== false).length

  return (
    <>
      <div className="mb-4">
        <Link to="/admin/productos" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-label)] hover:text-[var(--color-text)]">
          <ArrowLeft size={12} /> Volver a productos
        </Link>
      </div>

      <PageHeader
        title={producto.nombre}
        subtitle={`${TIPO_PRODUCTO_LABELS[producto.tipo]} · ${variantesActivas} variante${variantesActivas === 1 ? '' : 's'}`}
        actions={
          <Button variant="accent" onClick={() => setOpenVariante(true)}>
            <Plus size={14} /> Nueva variante
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <ProductoEditForm
            producto={producto}
            proveedores={proveedores}
            onSaved={reload}
          />
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">Resumen</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Variantes activas</dt>
              <dd className="font-medium">{variantesActivas}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Stock total</dt>
              <dd className="font-medium tabular-nums">{variantes.reduce((s, v) => s + (v.stock_cache ?? 0), 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Proveedor</dt>
              <dd className="font-medium">{producto.proveedor?.nombre ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Estado</dt>
              <dd><StatusBadge estado={producto.activo ? 'activo' : 'inactivo'} /></dd>
            </div>
          </dl>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3">Variantes</h3>
      {variantes.length === 0 ? (
        <EmptyState
          title="Sin variantes"
          description="Creá la primera variante (SKU vendible) de este producto."
          action={<Button variant="accent" onClick={() => setOpenVariante(true)}><Plus size={14} /> Nueva variante</Button>}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Talla</TH>
              <TH>Color</TH>
              <TH>Diseño</TH>
              <TH>Estampado</TH>
              <TH align="right">Costo</TH>
              <TH align="right">Precio</TH>
              <TH align="center">Stock</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {variantes.map(v => (
              <TR key={v.id}>
                <TD className="font-mono text-xs">{v.sku}</TD>
                <TD>{v.talla ?? '—'}</TD>
                <TD>{v.color ?? '—'}</TD>
                <TD className="text-[var(--color-text-muted)]">{v.diseno?.nombre ?? '—'}</TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {v.estampado ? ESTAMPADO_LABELS[v.estampado] : ESTAMPADO_LABELS.ninguno}
                </TD>
                <TD align="right" className="text-xs">{formatCOP(Number(v.costo_total ?? 0))}</TD>
                <TD align="right" className="font-medium">{formatCOP(Number(v.precio_venta))}</TD>
                <TD align="center" className={`tabular-nums ${(v.stock_cache ?? 0) < 3 ? 'text-[var(--color-accent-red)] font-semibold' : ''}`}>
                  {v.stock_cache ?? 0}
                </TD>
                <TD><StatusBadge estado={v.activo ? 'activo' : 'inactivo'} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <VarianteFormModal
        open={openVariante}
        onClose={() => setOpenVariante(false)}
        producto={producto}
        disenos={disenos}
        parametros={parametros}
        onSaved={() => { setOpenVariante(false); reload() }}
      />
    </>
  )
}

/* ──────────────────────────────────────────────────────────────── */
/* Form de edición inline del producto                               */
/* ──────────────────────────────────────────────────────────────── */

function ProductoEditForm({
  producto, proveedores, onSaved,
}: {
  producto: ProductoConProveedor
  proveedores: Proveedor[]
  onSaved: () => void
}) {
  const { addToast } = useToast()

  const defaults = useMemo<ProductoEditForm>(() => ({
    nombre: producto.nombre,
    tipo: producto.tipo,
    marca: producto.marca ?? '',
    proveedor_id: producto.proveedor?.id ?? null,
    descripcion: producto.descripcion ?? '',
  }), [producto])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProductoEditForm>({
    resolver: zodResolver(productoEditSchema),
    defaultValues: defaults,
  })

  useEffect(() => { reset(defaults) }, [defaults, reset])

  async function onSubmit(values: ProductoEditForm) {
    const payload = {
      nombre: values.nombre,
      tipo: values.tipo,
      marca: values.marca?.trim() ? values.marca.trim() : null,
      proveedor_id: values.proveedor_id || null,
      descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
    }
    const { error } = await updateProducto(producto.id, payload)
    if (error) return addToast('error', error.message)
    addToast('success', 'Producto actualizado')
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Field label="Nombre" required error={errors.nombre?.message}>
        <Input invalid={!!errors.nombre} {...register('nombre')} />
      </Field>
      <Field label="Tipo" required>
        <Select {...register('tipo')}>
          {Constants.public.Enums.tipo_producto.map(t => (
            <option key={t} value={t}>{TIPO_PRODUCTO_LABELS[t]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Marca">
        <Input {...register('marca')} />
      </Field>
      <Field label="Proveedor">
        <Select {...register('proveedor_id')}>
          <option value="">—</option>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Descripción">
          <Textarea rows={2} {...register('descripcion')} />
        </Field>
      </div>
      <div className="md:col-span-2 flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          disabled={!isDirty}
          onClick={() => reset(defaults)}
        >
          Descartar
        </Button>
        <Button type="submit" variant="accent" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

/* ──────────────────────────────────────────────────────────────── */
/* Form de crear variante con calculador de costo                    */
/* ──────────────────────────────────────────────────────────────── */

const varianteSchema = z.object({
  talla: z.string().trim().max(20).nullish().or(z.literal('').transform(() => null)),
  color: z.string().trim().max(40).nullish().or(z.literal('').transform(() => null)),
  diseno_id: z.string().uuid().nullish().or(z.literal('').transform(() => null)),
  estampado: z.enum(Constants.public.Enums.tipo_estampado),
  costo_base: z.coerce.number().min(0, 'No puede ser negativo'),
  precio_venta: z.coerce.number().min(0, 'No puede ser negativo'),
  notas: z.string().trim().max(200).nullish(),
})
type VarianteForm = z.infer<typeof varianteSchema>

function VarianteFormModal({
  open, onClose, producto, disenos, parametros, onSaved,
}: {
  open: boolean
  onClose: () => void
  producto: ProductoConProveedor
  disenos: Diseno[]
  parametros: ParametroCosto[]
  onSaved: () => void
}) {
  const { addToast } = useToast()

  const defaults = useMemo<VarianteForm>(() => ({
    talla: null,
    color: null,
    diseno_id: null,
    estampado: 'ninguno',
    costo_base: 0,
    precio_venta: 0,
    notas: '',
  }), [])

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<VarianteForm>({
    resolver: zodResolver(varianteSchema),
    defaultValues: defaults,
  })

  useEffect(() => { if (open) reset(defaults) }, [open, defaults, reset])

  const estampado = watch('estampado')
  const costoBase = Number(watch('costo_base') || 0)
  const precioVenta = Number(watch('precio_venta') || 0)
  const disenoId = watch('diseno_id')
  const talla = watch('talla')
  const color = watch('color')

  const breakdown = useMemo(
    () => calcularCostoAdicional(parametros, producto.tipo, estampado),
    [parametros, producto.tipo, estampado],
  )
  const costoTotal = costoBase + breakdown.total
  const margen = calcularMargen(costoTotal, precioVenta)

  const disenoNombre = disenos.find(d => d.id === disenoId)?.nombre ?? null
  const skuPreview = previewSku(producto.nombre, color, talla, disenoNombre)

  async function onSubmit(values: VarianteForm) {
    try {
      const sku = await generarSku(producto.id, values.color ?? null, values.talla ?? null, values.diseno_id ?? null)
      const payload = {
        producto_id: producto.id,
        sku,
        talla: values.talla || null,
        color: values.color || null,
        diseno_id: values.diseno_id || null,
        estampado: values.estampado,
        costo_base: values.costo_base,
        costo_adicional: breakdown.total,
        precio_venta: values.precio_venta,
        notas: values.notas?.trim() ? values.notas.trim() : null,
      }
      const { error } = await createVariante(payload)
      if (error) return addToast('error', error.message)
      addToast('success', `Variante ${sku} creada`)
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast('error', `Error generando SKU: ${msg}`)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva variante" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Talla" hint="S / M / L / XL / Única">
            <Input {...register('talla')} />
          </Field>
          <Field label="Color">
            <Input {...register('color')} />
          </Field>
          <Field label="Diseño" hint="Solo prendas con estampado">
            <Select {...register('diseno_id')}>
              <option value="">—</option>
              {disenos.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tipo de estampado">
          <Select {...register('estampado')}>
            {Constants.public.Enums.tipo_estampado.map(t => (
              <option key={t} value={t}>{ESTAMPADO_LABELS[t]}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Costo base" hint="Prenda pelada (sin estampado ni empaque)" required error={errors.costo_base?.message}>
            <Input type="number" step="100" invalid={!!errors.costo_base} {...register('costo_base')} />
          </Field>
          <Field label="Precio de venta" required error={errors.precio_venta?.message}>
            <Input type="number" step="1000" invalid={!!errors.precio_venta} {...register('precio_venta')} />
          </Field>
        </div>

        {/* Breakdown de costos */}
        <div className="card p-4 bg-[var(--color-surface-2)] border-dashed">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">
            Desglose de costo
          </h4>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">Costo base</dt>
              <dd className="tabular-nums">{formatCOP(costoBase)}</dd>
            </div>
            {breakdown.items.map(it => (
              <div key={it.concepto} className="flex justify-between text-xs">
                <dt className="text-[var(--color-text-label)]">+ {it.descripcion ?? it.concepto}</dt>
                <dd className="tabular-nums text-[var(--color-text-muted)]">{formatCOP(it.monto)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-[var(--color-border-light)]">
              <dt className="font-medium">Costo total</dt>
              <dd className="font-semibold tabular-nums">{formatCOP(costoTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Margen</dt>
              <dd className={`tabular-nums ${margen < 0.3 ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-accent-green)]'}`}>
                {(margen * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <dt className="text-[var(--color-text-label)]">SKU preview</dt>
              <dd className="font-mono text-[var(--color-text-muted)]">{skuPreview}</dd>
            </div>
          </dl>
        </div>

        <Field label="Notas" hint="Opcional">
          <Textarea rows={2} {...register('notas')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear variante'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
