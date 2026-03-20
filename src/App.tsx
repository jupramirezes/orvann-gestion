import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Inventario from '@/pages/Inventario'
import VentaRapida from '@/pages/VentaRapida'
import Gastos from '@/pages/Gastos'
import Caja from '@/pages/Caja'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="venta" element={<VentaRapida />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="caja" element={<Caja />} />
      </Route>
    </Routes>
  )
}
