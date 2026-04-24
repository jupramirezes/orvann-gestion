import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number
  onChange: (value: number) => void
  invalid?: boolean
  /** Label visual dentro del addon. Default: "$". */
  symbol?: string
  /** Alinear texto a la derecha (numérico). Default: true. */
  alignRight?: boolean
}

/**
 * Input monetario con addon `$` a la izquierda en un "pill" con bg y
 * borde propios (en vez de overlay absoluto). Evita el overlap visual
 * del símbolo con los dígitos, sobre todo cuando el texto del input
 * está en bold/tabular y el padding no alcanza.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    { value, onChange, invalid, symbol = '$', alignRight = true, className, disabled, placeholder = '0', ...rest },
    ref,
  ) {
    return (
      <div
        className={cn(
          'flex items-stretch rounded-md border bg-[var(--color-surface)] h-9 overflow-hidden',
          'focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-weak)]',
          invalid
            ? 'border-[var(--color-accent-red)] focus-within:border-[var(--color-accent-red)] focus-within:ring-[color:oklch(0.9_0.05_28)]'
            : 'border-[var(--color-border)]',
          disabled && 'opacity-60',
          className,
        )}
      >
        <span
          aria-hidden
          className="inline-flex items-center px-2.5 text-[13px] font-medium text-[var(--color-text-label)] bg-[var(--color-surface-2)] border-r border-[var(--color-border)] select-none"
        >
          {symbol}
        </span>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={value || ''}
          onChange={e => onChange(Number(e.target.value) || 0)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-0 px-2 bg-transparent outline-none text-sm tabular-nums',
            alignRight && 'text-right',
          )}
          {...rest}
        />
      </div>
    )
  },
)
