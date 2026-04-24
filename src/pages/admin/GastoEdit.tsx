import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { updateGasto, type Gasto } from '../../lib/queries/gastos'
import { GastoForm, type GastoFormState } from '../../components/admin/GastoForm'

export default function GastoEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [gasto, setGasto] = useState<Gasto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('gastos')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          addToast('error', error.message)
          return
        }
        setGasto(data as Gasto)
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

  if (!gasto) {
    return (
      <div className="card p-10 text-center text-sm">
        Gasto no encontrado.
      </div>
    )
  }

  const initial: Partial<GastoFormState> = {
    fecha: gasto.fecha,
    categoria_id: gasto.categoria_id,
    descripcion: gasto.descripcion ?? '',
    monto_total: Number(gasto.monto_total),
    metodo_pago: gasto.metodo_pago,
    pagador: gasto.pagador,
    distribucion: gasto.distribucion,
    monto_kathe: Number(gasto.monto_kathe ?? 0),
    monto_andres: Number(gasto.monto_andres ?? 0),
    monto_jp: Number(gasto.monto_jp ?? 0),
    monto_orvann: Number(gasto.monto_orvann ?? 0),
    notas: gasto.notas ?? '',
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/gastos"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={14} /> Volver a gastos
        </Link>
      </div>

      <PageHeader
        title="Editar gasto"
        subtitle={
          gasto.ref_pedido_id
            ? 'Gasto creado automáticamente desde un pedido a proveedor'
            : 'Modificá los datos y guardá los cambios'
        }
      />

      <GastoForm
        initial={initial}
        submitLabel="Guardar cambios"
        onSubmit={async payload => {
          if (!id) return { error: 'ID de gasto inválido' }
          const { error } = await updateGasto(id, payload)
          if (error) {
            addToast('error', error.message)
            return { error: error.message }
          }
          addToast('success', 'Gasto actualizado')
          navigate('/admin/gastos')
          return { error: null }
        }}
      />
    </div>
  )
}
