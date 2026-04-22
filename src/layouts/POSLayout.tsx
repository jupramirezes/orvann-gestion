import { Outlet } from 'react-router-dom'
import { CarritoProvider } from '../hooks/useCarrito'
import { OfflineBanner } from '../components/pos/OfflineBanner'
import { POSTopbar } from '../components/pos/POSTopbar'

/**
 * Layout del POS móvil. Mobile-first, sin sidebar. El topbar tiene
 * logo + nombre del vendedor + carrito con badge. Un banner rojo se
 * muestra en la parte superior cuando no hay conexión.
 */
export default function POSLayout() {
  return (
    <CarritoProvider>
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
        <OfflineBanner />
        <POSTopbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </CarritoProvider>
  )
}
