import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

/* ── PageHeader ─────────────────────────────────────── */

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold text-[var(--color-text)] tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--color-text-label)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-label)] mb-1.5 truncate" title={label}>{label}</p>
      <p className={valueClass} title={value}>{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--color-text-label)] mt-1.5 truncate" title={subtitle}>{subtitle}</p>}
    </div>
  )
}

/* ── Button ─────────────────────────────────────────── */

type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon = false, className, ...props },
  ref,
) {
  const base = 'btn-d'
  const variantCls =
    variant === 'primary' ? 'primary'
    : variant === 'accent' ? 'accent'
    : variant === 'ghost'  ? 'ghost'
    : variant === 'danger' ? 'bg-[var(--color-accent-red)] text-white border-[var(--color-accent-red)]'
    : ''
  const sizeCls = size === 'sm' ? 'sm' : ''
  const iconCls = icon ? 'icon' : ''
  return (
    <button
      ref={ref}
      className={cn(base, variantCls, sizeCls, iconCls, className)}
      {...props}
    />
  )
})

/* ── Input / Select / Textarea ──────────────────────── */

const fieldBase = 'w-full h-9 px-3 text-sm'
const fieldInvalid = 'border-[var(--color-accent-red)] focus:border-[var(--color-accent-red)] focus:ring-[var(--color-accent-red)]'

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, invalid && fieldInvalid, className)}
      {...props}
    />
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldBase, invalid && fieldInvalid, className)}
      {...props}
    >
      {children}
    </select>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn('w-full px-3 py-2 text-sm min-h-[72px] resize-y', invalid && fieldInvalid, className)}
      {...props}
    />
  )
})

/* ── Field wrapper (label + input + error) ──────────── */

export function Field({ label, hint, error, required, children }: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
        {label}
        {required && <span className="text-[var(--color-accent-red)] ml-0.5">*</span>}
      </span>
      {children}
      {error ? (
        <span className="block text-[11px] text-[var(--color-accent-red)] mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-[var(--color-text-label)] mt-1">{hint}</span>
      ) : null}
    </label>
  )
}

/* ── Modal ──────────────────────────────────────────── */

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!open) return null
  const maxWidth = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn('modal-card', maxWidth)}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-label)] hover:text-[var(--color-text)] p-1 rounded"
            style={{ minHeight: 0 }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── EmptyState ─────────────────────────────────────── */

export function EmptyState({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-text-label)] mt-2 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/* ── Table helpers ──────────────────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('card overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">{children}</thead>
}

export function TH({ children, className, align = 'left' }: {
  children?: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th className={cn(
      'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-label)]',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      className,
    )}>
      {children}
    </th>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--color-border-light)]">{children}</tbody>
}

export function TR({ children, onClick, className }: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      className={cn(
        onClick && 'cursor-pointer hover:bg-[var(--color-surface-hover)]',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className, align = 'left', title }: {
  children?: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  title?: string
}) {
  return (
    <td
      title={title}
      className={cn(
        'px-3 py-2.5 text-[var(--color-text)]',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

/* ── StatusBadge ─────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  completada:   'bg-emerald-50 text-emerald-700',
  completado:   'bg-emerald-50 text-emerald-700',
  pagado:       'bg-emerald-50 text-emerald-700',
  entregado:    'bg-emerald-50 text-emerald-700',
  activo:       'bg-emerald-50 text-emerald-700',
  pendiente:    'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]',
  abierto:      'bg-blue-50 text-blue-700',
  plan_separe_abierto: 'bg-blue-50 text-blue-700',
  en_ruta:      'bg-blue-50 text-blue-700',
  credito:      'bg-amber-50 text-amber-700',
  anulada:      'bg-red-50 text-red-700',
  cancelado:    'bg-[var(--color-surface-2)] text-[var(--color-text-faint)] line-through',
  devuelto:     'bg-red-50 text-red-700',
  inactivo:     'bg-[var(--color-surface-2)] text-[var(--color-text-faint)]',
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
  activo: 'Activo',
  inactivo: 'Inactivo',
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
