export interface Producto {
  id: string
  nombre: string
  tipo: string
  proveedor: string | null
  costo_base: number
  costo_estampado_pecho: number
  costo_estampado_espalda: number
  costo_etiquetas: number
  costo_empaque: number
  precio_venta_basica: number
  precio_venta_estampado: number
  activo: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Variante {
  id: string
  producto_id: string
  sku: string
  talla: string
  color: string
  diseno: string | null
  tipo_estampado: string | null
  costo: number
  precio_venta: number
  stock: number
  stock_minimo: number
  activo: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface InventarioRow {
  id: string
  sku: string
  talla: string
  color: string
  diseno: string | null
  tipo_estampado: string | null
  costo: number
  precio_venta: number
  stock: number
  stock_minimo: number
  activo: boolean
  notas: string | null
  producto_id: string
  producto_nombre: string
  producto_tipo: string
  proveedor: string | null
  alerta_stock_bajo: boolean
  sin_stock: boolean
}

export interface Venta {
  id: string
  fecha: string
  metodo_pago: 'Efectivo' | 'Transferencia' | 'Datáfono' | 'Crédito'
  cliente: string | null
  responsable: 'JP' | 'Andrés' | 'Kathe'
  subtotal: number
  descuento: number
  total: number
  cierre_id: string | null
  notas: string | null
  created_at: string
}

export interface ItemVenta {
  id: string
  venta_id: string
  variante_id: string
  cantidad: number
  precio_unitario: number
  created_at: string
}

export interface KpisMes {
  ventas_count: number
  ventas_total: number
  prendas_vendidas: number
  gastos_total: number
  stock_bajo: number
  sin_stock: number
  total_unidades: number
  inventario_costo: number
  inventario_venta: number
}

export interface VentaDetalle extends Venta {
  items: {
    variante_id: string
    sku: string
    nombre: string
    cantidad: number
    precio_unitario: number
  }[]
}

export interface CartItem {
  variante: InventarioRow
  cantidad: number
  precio_unitario: number
}
