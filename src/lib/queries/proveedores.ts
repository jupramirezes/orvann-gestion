import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Proveedor = Database['public']['Tables']['proveedores']['Row']
export type ProveedorInsert = Database['public']['Tables']['proveedores']['Insert']
export type ProveedorUpdate = Database['public']['Tables']['proveedores']['Update']

export async function listProveedores(opts?: { includeInactive?: boolean }) {
  let q = supabase
    .from('proveedores')
    .select('*')
    .order('nombre', { ascending: true })
  if (!opts?.includeInactive) q = q.eq('activo', true)
  return q
}

export async function createProveedor(data: ProveedorInsert) {
  return supabase.from('proveedores').insert(data).select().single()
}

export async function updateProveedor(id: string, patch: ProveedorUpdate) {
  return supabase.from('proveedores').update(patch).eq('id', id).select().single()
}
