export default function POSHome() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="flex items-baseline justify-center gap-2 mb-4">
          <span className="text-[28px] font-extrabold text-[var(--color-text)] tracking-tight">
            ORVANN
          </span>
          <span className="text-[28px] font-extrabold text-[var(--color-primary)]">POS</span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          POS móvil — disponible en Tarea 1.5.
        </p>
        <p className="text-xs text-[var(--color-text-faint)] mt-2">
          Ver <code className="mono">docs/plan/03-fase1-tareas.md</code>.
        </p>
      </div>
    </div>
  )
}
