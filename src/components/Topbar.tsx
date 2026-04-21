import { useLocation } from 'react-router-dom'

const ROUTE_LABELS: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/ventas': 'Ventas',
  '/admin/pedidos': 'Pedidos',
  '/admin/productos': 'Productos',
  '/admin/variantes': 'Variantes',
  '/admin/disenos': 'Diseños',
  '/admin/gastos': 'Gastos',
  '/admin/consignaciones': 'Consignaciones',
  '/admin/clientes': 'Clientes',
  '/admin/config': 'Configuración',
}

function Crumb({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="crumb">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="sep">/</span>}
          <span className={i === items.length - 1 ? 'cur' : ''}>{c}</span>
        </span>
      ))}
    </div>
  )
}

function useCrumbs(): string[] {
  const { pathname } = useLocation()
  if (pathname === '/admin' || pathname === '/admin/') return ['Dashboard']
  const label = ROUTE_LABELS[pathname]
  if (label) return [label]
  // fallback: inferir desde el path
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (segments.length === 0) return ['Dashboard']
  const first = `/admin/${segments[0]}`
  const base = ROUTE_LABELS[first] || segments[0]
  return segments.length > 1 ? [base, 'Detalle'] : [base]
}

export default function Topbar() {
  const crumbs = useCrumbs()

  return (
    <div className="topbar">
      <Crumb items={crumbs} />
      <div className="tb-actions" />
    </div>
  )
}
