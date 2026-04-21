import { cn } from '../lib/utils'

/* ── PageHeader ─────────────────────────────────────── */

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-[28px] font-bold text-[var(--color-text)] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[#94a3b8] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── KPICard ────────────────────────────────────────── */

export function KPICard({ label, value, subtitle, small }: {
  label: string
  value: string
  small?: boolean
  subtitle?: string
}) {
  const valueClass = small
    ? 'text-[22px] font-extrabold text-[var(--color-text)] tabular-nums tracking-tight leading-none my-1.5 truncate'
    : 'text-[28px] font-extrabold text-[var(--color-text)] tabular-nums tracking-tight leading-none my-2 truncate'
  return (
    <div className="card card-hover p-5 min-h-[120px] flex flex-col justify-between overflow-hidden">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8] mb-1.5 truncate" title={label}>{label}</p>
      <p className={valueClass} title={value}>{value}</p>
      {subtitle && <p className="text-[11px] text-[#94a3b8] mt-1.5 truncate" title={subtitle}>{subtitle}</p>}
    </div>
  )
}

/* ── StatusBadge ─────────────────────────────────────── */
/*
  Badge genérico por estado. Los colores se mapean a tokens oklch de
  DURATA para que el visual se mantenga idéntico. Usado para
  estado_venta, estado_pago_pedido, estado_separe, estado_entrega.
*/

const STATUS_STYLES: Record<string, string> = {
  // éxito / completado
  completada:   'bg-emerald-50 text-emerald-700',
  completado:   'bg-emerald-50 text-emerald-700',
  pagado:       'bg-emerald-50 text-emerald-700',
  entregado:    'bg-emerald-50 text-emerald-700',
  // en proceso / neutral
  pendiente:    'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
  abierto:      'bg-blue-50 text-blue-700',
  plan_separe_abierto: 'bg-blue-50 text-blue-700',
  en_ruta:      'bg-blue-50 text-blue-700',
  credito:      'bg-amber-50 text-amber-700',
  // error / descartado
  anulada:      'bg-red-50 text-red-700',
  cancelado:    'bg-[var(--color-surface-2)] text-[var(--color-text-faint)] line-through',
  devuelto:     'bg-red-50 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  completada: 'Completada',
  completado: 'Completado',
  anulada: 'Anulada',
  plan_separe_abierto: 'Separe abierto',
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  credito: 'A crédito',
  abierto: 'Abierto',
  cancelado: 'Cancelado',
  en_ruta: 'En ruta',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
}

export function StatusBadge({ estado }: { estado: string }) {
  const cls = STATUS_STYLES[estado] || STATUS_STYLES.pendiente
  const label = STATUS_LABELS[estado] || estado
  return (
    <span className={cn('text-[11px] px-3 py-1 rounded-full font-medium', cls)}>
      {label}
    </span>
  )
}
