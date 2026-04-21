import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Textarea,
  TR,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP } from '../../lib/utils'
import { createPedido } from '../../lib/queries/pedidos'
import { listProveedores, type Proveedor } from '../../lib/queries/productos'
import { listVariantes, type VarianteConJoin } from '../../lib/queries/variantes'

const itemSchema = z.object({
  variante_id: z.string().uuid().nullable(),
  descripcion_libre: z.string().trim().max(200).nullable(),
  unidades: z.coerce.number().int().min(1, 'Mínimo 1'),
  costo_unitario: z.coerce.number().min(0, 'No puede ser negativo'),
}).refine(
  it => it.variante_id || (it.descripcion_libre && it.descripcion_libre.length > 0),
  { message: 'Elegí variante o escribí descripción', path: ['descripcion_libre'] },
)

const pedidoSchema = z.object({
  proveedor_id: z.string().uuid('Seleccioná proveedor'),
  fecha_pedido: z.string().min(1),
  notas: z.string().trim().max(400).nullish(),
  items: z.array(itemSchema).min(1, 'Agregá al menos un item'),
})

type PedidoForm = z.infer<typeof pedidoSchema>

const today = new Date().toISOString().slice(0, 10)

export default function PedidoNuevo() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [variantes, setVariantes] = useState<VarianteConJoin[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([listProveedores(true), listVariantes({ limit: 500 })]).then(
      ([{ data: provs }, { data: vars }]) => {
        if (cancelled) return
        if (provs) setProveedores(provs)
        if (vars) setVariantes(vars as VarianteConJoin[])
      },
    )
    return () => { cancelled = true }
  }, [])

  const { control, register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<PedidoForm>({
      resolver: zodResolver(pedidoSchema),
      defaultValues: {
        proveedor_id: '',
        fecha_pedido: today,
        notas: '',
        items: [{ variante_id: null, descripcion_libre: '', unidades: 1, costo_unitario: 0 }],
      },
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const items = watch('items')
  const totalPedido = items.reduce(
    (sum, it) => sum + (Number(it.unidades) || 0) * (Number(it.costo_unitario) || 0),
    0,
  )

  async function onSubmit(values: PedidoForm) {
    const payload = {
      proveedor_id: values.proveedor_id,
      fecha_pedido: values.fecha_pedido,
      notas: values.notas?.trim() ? values.notas.trim() : null,
    }
    const itemsPayload = values.items.map(it => ({
      variante_id: it.variante_id || null,
      descripcion_libre: it.descripcion_libre?.trim() ? it.descripcion_libre.trim() : null,
      unidades: it.unidades,
      costo_unitario: it.costo_unitario,
    }))

    const { data, error } = await createPedido(payload, itemsPayload)
    if (error || !data) {
      return addToast('error', error?.message ?? 'No se pudo crear el pedido')
    }
    addToast('success', `Pedido creado con ${itemsPayload.length} items`)
    navigate(`/admin/pedidos/${data.id}`)
  }

  return (
    <>
      <div className="mb-4">
        <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-label)] hover:text-[var(--color-text)]">
          <ArrowLeft size={12} /> Volver a pedidos
        </Link>
      </div>

      <PageHeader title="Nuevo pedido" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Proveedor" required error={errors.proveedor_id?.message}>
              <Select {...register('proveedor_id')}>
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha de pedido" required error={errors.fecha_pedido?.message}>
              <Input type="date" {...register('fecha_pedido')} />
            </Field>
            <Field label="Notas" hint="Opcional">
              <Input {...register('notas')} placeholder="Referencia del proveedor, detalles…" />
            </Field>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Items del pedido</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                append({ variante_id: null, descripcion_libre: '', unidades: 1, costo_unitario: 0 })
              }
            >
              <Plus size={12} /> Agregar item
            </Button>
          </div>

          {errors.items?.message && (
            <p className="text-[11px] text-[var(--color-accent-red)] mb-2">{errors.items.message}</p>
          )}

          <Table>
            <THead>
              <TR>
                <TH>Variante existente</TH>
                <TH>o Descripción libre</TH>
                <TH align="right">Unidades</TH>
                <TH align="right">Costo unit</TH>
                <TH align="right">Subtotal</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {fields.map((field, idx) => {
                const itemErr = errors.items?.[idx]
                const item = items[idx]
                const subtotal = (Number(item?.unidades) || 0) * (Number(item?.costo_unitario) || 0)
                return (
                  <TR key={field.id}>
                    <TD className="w-[320px]">
                      <Controller
                        control={control}
                        name={`items.${idx}.variante_id`}
                        render={({ field: f }) => (
                          <Select
                            value={f.value ?? ''}
                            onChange={e => f.onChange(e.target.value || null)}
                          >
                            <option value="">— Sin mapear —</option>
                            {variantes.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.sku} · {v.producto?.nombre} · {v.color ?? ''} {v.talla ?? ''}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                    </TD>
                    <TD className="w-[260px]">
                      <Input
                        placeholder="ej. 10 camisas boxy M negras"
                        invalid={!!itemErr?.descripcion_libre}
                        {...register(`items.${idx}.descripcion_libre`)}
                      />
                      {itemErr?.descripcion_libre && (
                        <span className="text-[10px] text-[var(--color-accent-red)]">
                          {itemErr.descripcion_libre.message}
                        </span>
                      )}
                    </TD>
                    <TD align="right" className="w-[90px]">
                      <Input
                        type="number"
                        min="1"
                        className="text-right"
                        invalid={!!itemErr?.unidades}
                        {...register(`items.${idx}.unidades`)}
                      />
                    </TD>
                    <TD align="right" className="w-[130px]">
                      <Input
                        type="number"
                        step="100"
                        className="text-right"
                        invalid={!!itemErr?.costo_unitario}
                        {...register(`items.${idx}.costo_unitario`)}
                      />
                    </TD>
                    <TD align="right" className="tabular-nums font-medium">
                      {formatCOP(subtotal)}
                    </TD>
                    <TD>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        title="Quitar"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>

          <div className="flex justify-end mt-3 gap-6 text-sm">
            <span className="text-[var(--color-text-label)]">Total del pedido</span>
            <span className="tabular-nums font-semibold text-base">{formatCOP(totalPedido)}</span>
          </div>
        </div>

        <div className="card p-4">
          <Field label="Notas internas del pedido" hint="Opcional, visible en el detalle">
            <Textarea rows={2} {...register('notas')} />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/pedidos')}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear pedido'}
          </Button>
        </div>
      </form>
    </>
  )
}
