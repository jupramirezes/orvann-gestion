import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { createGasto } from '../../lib/queries/gastos'
import { GastoForm } from '../../components/admin/GastoForm'

export default function GastoNuevo() {
  const navigate = useNavigate()
  const { addToast } = useToast()

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
        title="Nuevo gasto"
        subtitle="La distribución entre socios se calcula automáticamente"
      />

      <GastoForm
        onSubmit={async payload => {
          const { error } = await createGasto(payload)
          if (error) {
            addToast('error', error.message)
            return { error: error.message }
          }
          addToast('success', 'Gasto registrado')
          navigate('/admin/gastos')
          return { error: null }
        }}
      />
    </div>
  )
}
