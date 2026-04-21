import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Diseno = Database['public']['Tables']['disenos']['Row']
export type DisenoInsert = Database['public']['Tables']['disenos']['Insert']
export type DisenoUpdate = Database['public']['Tables']['disenos']['Update']

export async function listDisenos(opts?: {
  search?: string
  categoria?: Database['public']['Enums']['categoria_diseno']
  includeInactive?: boolean
}) {
  let q = supabase.from('disenos').select('*').order('nombre', { ascending: true })
  if (!opts?.includeInactive) q = q.eq('activo', true)
  if (opts?.categoria) q = q.eq('categoria', opts.categoria)
  if (opts?.search) q = q.ilike('nombre', `%${opts.search}%`)
  return q
}

export async function createDiseno(data: DisenoInsert) {
  return supabase.from('disenos').insert(data).select().single()
}

export async function updateDiseno(id: string, patch: DisenoUpdate) {
  return supabase.from('disenos').update(patch).eq('id', id).select().single()
}

export async function toggleDiseno(id: string, activo: boolean) {
  return supabase.from('disenos').update({ activo }).eq('id', id).select().single()
}
