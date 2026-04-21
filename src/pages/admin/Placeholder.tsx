import { PageHeader } from '../../components/ui'

type Props = {
  title: string
  subtitle?: string
  tarea: string
}

export default function Placeholder({ title, subtitle, tarea }: Props) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Módulo en construcción — {tarea}
        </p>
        <p className="text-xs text-[var(--color-text-faint)] mt-2">
          Ver <code className="mono">docs/plan/03-fase1-tareas.md</code> para el detalle.
        </p>
      </div>
    </>
  )
}
