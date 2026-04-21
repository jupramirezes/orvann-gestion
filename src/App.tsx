import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from './lib/supabase'
import { ToastProvider } from './components/Toast'
import Login from './components/Login'
import AdminLayout from './layouts/AdminLayout'
import POSLayout from './layouts/POSLayout'
import Dashboard from './pages/admin/Dashboard'
import Placeholder from './pages/admin/Placeholder'
import Productos from './pages/admin/Productos'
import ProductoDetalle from './pages/admin/ProductoDetalle'
import Disenos from './pages/admin/Disenos'
import Variantes from './pages/admin/Variantes'
import Pedidos from './pages/admin/Pedidos'
import PedidoNuevo from './pages/admin/PedidoNuevo'
import PedidoDetalle from './pages/admin/PedidoDetalle'
import POSHome from './pages/pos/POSHome'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  // Si Supabase no está configurado, no hay loading (modo dev sin auth).
  const [loading, setLoading] = useState<boolean>(isSupabaseReady)

  useEffect(() => {
    if (!isSupabaseReady) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-baseline justify-center mb-2 gap-1.5">
            <span className="text-2xl font-extrabold text-[var(--color-text)]">ORVANN</span>
            <span className="text-2xl font-extrabold text-[var(--color-primary)]">Gestión</span>
          </div>
          <p className="text-xs text-[var(--color-text-label)] font-mono">Cargando…</p>
        </div>
      </div>
    )
  }

  if (isSupabaseReady && !user) {
    return <Login />
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />

        <Route path="/admin" element={<AdminLayout user={user} />}>
          <Route index element={<Dashboard />} />
          <Route path="ventas" element={<Placeholder title="Ventas" subtitle="Historial y detalle" tarea="Tarea 1.5 (POS) + 1.7 (detalle)" />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="pedidos/nuevo" element={<PedidoNuevo />} />
          <Route path="pedidos/:id" element={<PedidoDetalle />} />
          <Route path="productos" element={<Productos />} />
          <Route path="productos/:id" element={<ProductoDetalle />} />
          <Route path="variantes" element={<Variantes />} />
          <Route path="disenos" element={<Disenos />} />
          <Route path="gastos" element={<Placeholder title="Gastos" subtitle="Distribución entre socios" tarea="Tarea 1.6" />} />
          <Route path="consignaciones" element={<Placeholder title="Consignaciones" subtitle="Caja → cuenta bancaria" tarea="Fase 2" />} />
          <Route path="clientes" element={<Placeholder title="Clientes" subtitle="Historial de compras" tarea="Tarea 1.7" />} />
          <Route path="config" element={<Placeholder title="Configuración" subtitle="Parámetros del sistema" tarea="Fase 2" />} />
        </Route>

        <Route path="/pos" element={<POSLayout />}>
          <Route index element={<POSHome />} />
        </Route>
      </Routes>
    </ToastProvider>
  )
}
