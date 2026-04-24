import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Cliente = Database['public']['Tables']['clientes']['Row']
export type ClienteInsert = Database['public']['Tables']['clientes']['Insert']
export type ClienteUpdate = Database['public']['Tables']['clientes']['Update']

/**
 * Busca clientes por teléfono (parcial). El matching ignora caracteres
 * no numéricos para que el usuario pueda tipear "3104567890" o "310 456 7890".
 */
export async function buscarClientesPorTelefono(q: string, limit = 6) {
  const solo_digitos = q.replace(/[^\d]/g, '')
  if (solo_digitos.length < 3) return { data: [], error: null }
  return supabase
    .from('clientes')
    .select('id, nombre, telefono, num_compras_cache, total_comprado_cache')
    .ilike('telefono', `%${solo_digitos}%`)
    .order('num_compras_cache', { ascending: false, nullsFirst: false })
    .limit(limit)
}

export async function crearCliente(data: ClienteInsert) {
  return supabase.from('clientes').insert(data).select().single()
}

export async function getCliente(id: string) {
  return supabase.from('clientes').select('*').eq('id', id).single()
}

export async function listClientes(opts?: { limit?: number }) {
  const limit = opts?.limit ?? 500
  return supabase
    .from('clientes')
    .select('*')
    .order('num_compras_cache', { ascending: false, nullsFirst: false })
    .order('nombre', { ascending: true })
    .limit(limit)
}

export async function updateCliente(id: string, patch: ClienteUpdate) {
  return supabase.from('clientes').update(patch).eq('id', id).select().single()
}
