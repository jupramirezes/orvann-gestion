import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Truck,
  Receipt,
  Users,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

function displayName(user: User | null): string {
  if (!user?.email) return 'Usuario'
  const local = user.email.split('@')[0]
  const KNOWN: Record<string, string> = {
    jp: 'J.P. Ramírez',
    kathe: 'Kathe',
    andres: 'Andrés',
  }
  if (KNOWN[local]) return KNOWN[local]
  return local[0].toUpperCase() + local.slice(1)
}

function getInitials(user: User | null): string {
  const name = displayName(user)
  return name
    .replace('.', '')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type NavItem = {
  to: string
  icon: typeof LayoutDashboard
  label: string
  end?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/ventas', icon: ShoppingBag, label: 'Ventas' },
      { to: '/admin/pedidos', icon: Truck, label: 'Pedidos' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/admin/productos', icon: Package, label: 'Productos' },
      { to: '/admin/variantes', icon: ArrowLeftRight, label: 'Variantes' },
      { to: '/admin/disenos', icon: BarChart3, label: 'Diseños' },
    ],
  },
  {
    label: 'Financiero',
    items: [
      { to: '/admin/gastos', icon: Receipt, label: 'Gastos' },
      { to: '/admin/consignaciones', icon: Wallet, label: 'Consignaciones' },
    ],
  },
  {
    label: 'Relaciones',
    items: [
      { to: '/admin/clientes', icon: Users, label: 'Clientes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/config', icon: Settings, label: 'Configuración' },
    ],
  },
]

function SidebarContent({ onClose, user }: { onClose?: () => void; user: User | null }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <>
      <div className="sb-brand">
        <div className="sb-mark">O</div>
        <div className="sb-brand-text flex-1">
          <div className="n">ORVANN</div>
          <div className="s">Gestión · Retail</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-[var(--color-text-label)]" aria-label="Cerrar menú">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="sb-nav">
        {GROUPS.map(group => (
          <div key={group.label} className="sb-group">
            <div className="sb-group-label">{group.label}</div>
            {group.items.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={onClose}
                className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}
              >
                <l.icon />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        {user ? (
          <>
            <div className="avatar">{getInitials(user)}</div>
            <div className="who">
              <div className="n">{displayName(user)}</div>
              <div className="r">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-[var(--color-text-label)] hover:text-[var(--color-accent-red)] p-1 rounded-md"
              style={{ minHeight: 0 }}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <div className="who"><div className="r">v0.1 Fase 1</div></div>
        )}
      </div>
    </>
  )
}

export default function Sidebar({ user }: { user: User | null }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] md:hidden"
        style={{ minHeight: 0 }}
        aria-label="Abrir menú"
      >
        <Menu size={16} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <aside
            className="sb absolute left-0 top-0 bottom-0 w-[232px]"
            onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', height: 'auto' }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} user={user} />
          </aside>
        </div>
      )}

      <aside className="sb hidden md:flex">
        <SidebarContent user={user} />
      </aside>
    </>
  )
}
