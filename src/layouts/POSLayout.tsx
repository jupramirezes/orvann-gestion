import { Outlet } from 'react-router-dom'

/**
 * Layout minimal para el POS móvil: sin sidebar. El Topbar del POS
 * es específico (logo + carrito + menú usuario) y se monta dentro de
 * las páginas del POS (Tarea 1.5).
 */
export default function POSLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <Outlet />
    </div>
  )
}
