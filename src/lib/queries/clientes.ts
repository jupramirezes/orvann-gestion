import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Cliente = Database['public']['Tables']['clientes']['Row']
export type ClienteInsert = Database['public']['Tables']['clientes']['Insert']

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
