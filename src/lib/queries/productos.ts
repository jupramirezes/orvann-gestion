import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Producto = Database['public']['Tables']['productos']['Row']
export type ProductoInsert = Database['public']['Tables']['productos']['Insert']
export type ProductoUpdate = Database['public']['Tables']['productos']['Update']
export type Proveedor = Database['public']['Tables']['proveedores']['Row']

export type ProductoConProveedor = Producto & {
  proveedor: { id: string; nombre: string } | null
}

export async function listProductos(opts?: {
  search?: string
  tipo?: Database['public']['Enums']['tipo_producto']
  includeInactive?: boolean
  limit?: number
  offset?: number
}) {
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  let q = supabase
    .from('productos')
    .select('*, proveedor:proveedores(id, nombre)', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1)
  if (!opts?.includeInactive) q = q.eq('activo', true)
  if (opts?.tipo) q = q.eq('tipo', opts.tipo)
  if (opts?.search) q = q.ilike('nombre', `%${opts.search}%`)
  return q
}

export async function getProducto(id: string) {
  return supabase
    .from('productos')
    .select('*, proveedor:proveedores(id, nombre)')
    .eq('id', id)
    .single()
}

export async function createProducto(data: ProductoInsert) {
  return supabase.from('productos').insert(data).select().single()
}

export async function updateProducto(id: string, patch: ProductoUpdate) {
  return supabase
    .from('productos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function toggleProducto(id: string, activo: boolean) {
  return updateProducto(id, { activo })
}

export async function listProveedores(onlyActive = true) {
  let q = supabase.from('proveedores').select('*').order('nombre')
  if (onlyActive) q = q.eq('activo', true)
  return q
}
