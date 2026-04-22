import { ShoppingCart, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCarrito } from '../../hooks/useCarrito'

/**
 * Topbar mobile-first del POS. Compacto: logo a la izquierda,
 * carrito con badge + menú de usuario a la derecha.
 */
export function POSTopbar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { count } = useCarrito()

  const vendedor = user?.email
    ? user.email.split('@')[0].replace(/^\w/, c => c.toUpperCase())
    : 'Vendedor'

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-text)] text-[var(--color-surface)] flex items-center justify-center font-bold text-sm shrink-0">
          O
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">ORVANN POS</p>
          <p className="text-[11px] text-[var(--color-text-label)] leading-tight truncate">{vendedor}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/pos/carrito')}
          className="relative p-2 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label={`Carrito (${count} items)`}
        >
          <ShoppingCart size={20} className="text-[var(--color-text)]" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {count}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-label)]"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
