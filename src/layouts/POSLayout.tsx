import { Outlet } from 'react-router-dom'
import { CarritoProvider } from '../hooks/useCarrito'
import { OfflineBanner } from '../components/pos/OfflineBanner'
import { POSTopbar } from '../components/pos/POSTopbar'

/**
 * Layout del POS móvil. Mobile-first, sin sidebar. En PC el contenido
 * queda centrado con max-w-md para simular un teléfono y no extender
 * la UI al ancho completo de la pantalla (evita que el layout se vea
 * "feo" en escritorio). El banner de offline y el topbar viven dentro
 * del container centrado para mantener coherencia visual.
 */
export default function POSLayout() {
  return (
    <CarritoProvider>
      <div className="min-h-screen bg-[var(--color-surface-3)] flex justify-center">
        <div className="w-full max-w-md bg-[var(--color-bg)] min-h-screen shadow-sm relative flex flex-col">
          <OfflineBanner />
          <POSTopbar />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </CarritoProvider>
  )
}
