import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Search } from 'lucide-react'
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
import { TIPO_PRODUCTO_LABELS } from '../../lib/catalogo'
import {
  createProducto,
  listProductos,
  type ProductoConProveedor,
} from '../../lib/queries/productos'
import { listProveedores, type Proveedor } from '../../lib/queries/proveedores'

const productoSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100),
  tipo: z.enum(Constants.public.Enums.tipo_producto),
  proveedor_id: z.string().uuid().nullish().or(z.literal('').transform(() => null)),
  descripcion: z.string().trim().max(300).nullish(),
  marca: z.string().trim().max(40).nullish(),
})
type ProductoForm = z.infer<typeof productoSchema>

export default function Productos() {
  const [rows, setRows] = useState<ProductoConProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const { addToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listProductos({ search: search || undefined, tipo: (tipo || undefined) as ProductoForm['tipo'] | undefined }),
      listProveedores(),
    ]).then(([{ data, error }, { data: provs }]) => {
      if (cancelled) return
      setLoading(false)
      if (error) { addToast('error', error.message); return }
      setRows((data as ProductoConProveedor[]) ?? [])
      if (provs) setProveedores(provs)
    })
    return () => { cancelled = true }
  }, [search, tipo, addToast])

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={`${rows.length} ${rows.length === 1 ? 'producto activo' : 'productos activos'}`}
        actions={
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={14} /> Nuevo producto
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipo} onChange={e => setTipo(e.target.value)} className="max-w-[180px]">
          <option value="">Todos los tipos</option>
          {Constants.public.Enums.tipo_producto.map(t => (
            <option key={t} value={t}>{TIPO_PRODUCTO_LABELS[t]}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin productos"
          description="Creá el primer producto del catálogo."
          action={<Button variant="accent" onClick={() => setOpen(true)}><Plus size={14} /> Nuevo producto</Button>}
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Tipo</TH>
              <TH>Marca</TH>
              <TH>Proveedor</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(p => (
              <TR key={p.id} onClick={() => navigate(`/admin/productos/${p.id}`)}>
                <TD className="font-medium">{p.nombre}</TD>
                <TD>{TIPO_PRODUCTO_LABELS[p.tipo]}</TD>
                <TD className="text-[var(--color-text-muted)]">{p.marca ?? '—'}</TD>
                <TD className="text-[var(--color-text-muted)]">{p.proveedor?.nombre ?? '—'}</TD>
                <TD><StatusBadge estado={p.activo ? 'activo' : 'inactivo'} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ProductoFormModal
        open={open}
        onClose={() => setOpen(false)}
        proveedores={proveedores}
        onSaved={(id) => { setOpen(false); navigate(`/admin/productos/${id}`) }}
      />
    </>
  )
}

function ProductoFormModal({
  open, onClose, proveedores, onSaved,
}: {
  open: boolean
  onClose: () => void
  proveedores: Proveedor[]
  onSaved: (id: string) => void
}) {
  const { addToast } = useToast()

  const defaults = useMemo<ProductoForm>(() => ({
    nombre: '',
    tipo: 'prenda',
    proveedor_id: null,
    descripcion: '',
    marca: 'ORVANN',
  }), [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProductoForm>({
    resolver: zodResolver(productoSchema),
    defaultValues: defaults,
  })

  useEffect(() => { if (open) reset(defaults) }, [open, defaults, reset])

  async function onSubmit(values: ProductoForm) {
    const payload = {
      nombre: values.nombre,
      tipo: values.tipo,
      proveedor_id: values.proveedor_id || null,
      descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
      marca: values.marca?.trim() ? values.marca.trim() : null,
    }
    const { data, error } = await createProducto(payload)
    if (error || !data) return addToast('error', error?.message ?? 'No se pudo crear')
    addToast('success', 'Producto creado')
    onSaved(data.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo producto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Nombre" required error={errors.nombre?.message}>
          <Input autoFocus invalid={!!errors.nombre} {...register('nombre')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
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
        </div>

        <Field label="Proveedor">
          <Select {...register('proveedor_id')}>
            <option value="">—</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Field>

        <Field label="Descripción" hint="Opcional">
          <Textarea rows={3} {...register('descripcion')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
