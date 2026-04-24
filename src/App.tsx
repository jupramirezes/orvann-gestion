import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from './lib/supabase'
import { ToastProvider } from './components/Toast'
import Login from './components/Login'
import AdminLayout from './layouts/AdminLayout'
import POSLayout from './layouts/POSLayout'

// Admin pages lazy — el chunk incluye xlsx y libs pesadas del importer; fuera de /admin no se descargan.
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Placeholder = lazy(() => import('./pages/admin/Placeholder'))
const Productos = lazy(() => import('./pages/admin/Productos'))
const ProductoDetalle = lazy(() => import('./pages/admin/ProductoDetalle'))
const Disenos = lazy(() => import('./pages/admin/Disenos'))
const Variantes = lazy(() => import('./pages/admin/Variantes'))
const Pedidos = lazy(() => import('./pages/admin/Pedidos'))
const PedidoNuevo = lazy(() => import('./pages/admin/PedidoNuevo'))
const PedidoDetalle = lazy(() => import('./pages/admin/PedidoDetalle'))
const Gastos = lazy(() => import('./pages/admin/Gastos'))
const GastoNuevo = lazy(() => import('./pages/admin/GastoNuevo'))
const Transformaciones = lazy(() => import('./pages/admin/Transformaciones'))
const TransformacionNueva = lazy(() => import('./pages/admin/TransformacionNueva'))

// POS pages lazy — chunk separado para que el móvil no descargue código admin.
const POSHome = lazy(() => import('./pages/pos/POSHome'))
const Carrito = lazy(() => import('./pages/pos/Carrito'))
const Cobro = lazy(() => import('./pages/pos/Cobro'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-xs text-[var(--color-text-label)] font-mono">Cargando…</p>
    </div>
  )
}

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
      <Suspense fallback={<PageFallback />}>
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
            <Route path="gastos" element={<Gastos />} />
            <Route path="gastos/nuevo" element={<GastoNuevo />} />
            <Route path="transformaciones" element={<Transformaciones />} />
            <Route path="transformaciones/nueva" element={<TransformacionNueva />} />
            <Route path="consignaciones" element={<Placeholder title="Consignaciones" subtitle="Caja → cuenta bancaria" tarea="Fase 2" />} />
            <Route path="clientes" element={<Placeholder title="Clientes" subtitle="Historial de compras" tarea="Tarea 1.7" />} />
            <Route path="config" element={<Placeholder title="Configuración" subtitle="Parámetros del sistema" tarea="Fase 2" />} />
          </Route>

          <Route path="/pos" element={<POSLayout />}>
            <Route index element={<POSHome />} />
            <Route path="carrito" element={<Carrito />} />
            <Route path="cobro" element={<Cobro />} />
          </Route>
        </Routes>
      </Suspense>
    </ToastProvider>
  )
}
