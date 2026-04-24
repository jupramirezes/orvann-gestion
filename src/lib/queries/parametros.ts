import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']
export type ParametroCostoUpdate = Database['public']['Tables']['parametros_costo']['Update']

/**
 * Lista los parámetros de costo, ordenados por concepto. Por defecto
 * solo los activos (los mismos que usa el cálculo de costo_adicional).
 */
export async function listParametros(opts?: { includeInactive?: boolean }) {
  let q = supabase.from('parametros_costo').select('*').order('concepto')
  if (!opts?.includeInactive) q = q.eq('activo', true)
  return q
}

export async function updateParametro(id: string, patch: ParametroCostoUpdate) {
  return supabase.from('parametros_costo').update(patch).eq('id', id).select().single()
}
