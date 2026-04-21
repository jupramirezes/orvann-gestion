import { PageHeader, KPICard } from '../../components/ui'

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen operativo — en construcción (Fase 2)"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Ventas del mes" value="—" subtitle="Disponible en F2" />
        <KPICard label="Gastos del mes" value="—" subtitle="Disponible en F2" />
        <KPICard label="Utilidad bruta" value="—" subtitle="Disponible en F2" />
        <KPICard label="Inventario a costo" value="—" subtitle="Disponible en F2" />
      </div>
    </>
  )
}
