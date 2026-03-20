import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCOP, formatDate } from '@/lib/format'
import type { KpisMes, VentaDetalle } from '@/types/database'

const COSTOS_FIJOS = 1957900
const PRENDAS_EQUILIBRIO = 42

export default function Dashboard() {
  const [kpis, setKpis] = useState<KpisMes | null>(null)
  const [ventas, setVentas] = useState<VentaDetalle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [kpisRes, ventasRes] = await Promise.all([
        supabase.from('v_kpis_mes').select('*').single(),
        supabase.from('v_ventas_detalle').select('*').limit(5),
      ])
      if (kpisRes.data) setKpis(kpisRes.data as unknown as KpisMes)
      if (ventasRes.data) setVentas(ventasRes.data as unknown as VentaDetalle[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const k = kpis ?? {
    ventas_count: 0, ventas_total: 0, prendas_vendidas: 0, gastos_total: 0,
    stock_bajo: 0, sin_stock: 0, total_unidades: 0, inventario_costo: 0, inventario_venta: 0,
  }

  const progreso = Math.min((k.prendas_vendidas / PRENDAS_EQUILIBRIO) * 100, 100)

  return (
    <div className="p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ventas del mes" value={formatCOP(k.ventas_total)} sub={`${k.ventas_count} ventas`} />
        <KpiCard label="Gastos del mes" value={formatCOP(k.gastos_total)} />
        <KpiCard label="Inventario" value={`${k.total_unidades} uds`} sub={`Costo: ${formatCOP(k.inventario_costo)}`} />
        <KpiCard
          label="Alertas stock"
          value={`${k.stock_bajo + k.sin_stock}`}
          sub={`${k.sin_stock} sin stock`}
          warn={k.sin_stock > 0}
        />
      </div>

      {/* Punto de equilibrio */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-text-secondary">Punto de equilibrio</span>
          <span className="text-xs text-text-muted">{k.prendas_vendidas}/{PRENDAS_EQUILIBRIO} prendas</span>
        </div>
        <div className="h-3 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <p className="text-xs text-text-muted mt-1">
          Costos fijos: {formatCOP(COSTOS_FIJOS)}/mes
        </p>
      </div>

      {/* Últimas ventas */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Últimas ventas</h2>
        {ventas.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">No hay ventas registradas</p>
        ) : (
          <div className="space-y-2">
            {ventas.map((v) => (
              <div key={v.id} className="bg-surface rounded-lg p-3 border border-border flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">
                    {(v.items as VentaDetalle['items']).map(i => i.nombre).join(', ')}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(v.fecha)} · {v.metodo_pago} · {v.responsable}
                  </p>
                </div>
                <span className="text-sm font-semibold text-accent">{formatCOP(v.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="bg-surface rounded-xl p-3 border border-border">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${warn ? 'text-warning' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
