import type { ReactNode } from 'react'

/**
 * Footer fixed que respeta el max-w del POSLayout. En móvil toma el
 * 100% del viewport; en PC se centra con el mismo max-w-md del shell
 * para que no se extienda de edge a edge.
 */
export function POSFooterFixed({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="mx-auto max-w-md bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 safe-bottom pointer-events-auto">
        {children}
      </div>
    </div>
  )
}
