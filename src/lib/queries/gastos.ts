import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Gasto = Database['public']['Tables']['gastos']['Row']
export type GastoInsert = Database['public']['Tables']['gastos']['Insert']
export type GastoUpdate = Database['public']['Tables']['gastos']['Update']
export type CategoriaGasto = Database['public']['Tables']['categorias_gasto']['Row']
export type PagadorGasto = Database['public']['Enums']['pagador_gasto']
export type DistribucionGasto = Database['public']['Enums']['distribucion_gasto']

export type GastoConJoin = Gasto & {
  categoria: Pick<CategoriaGasto, 'id' | 'nombre' | 'tipo'> | null
}

export async function listCategoriasGasto() {
  return supabase
    .from('categorias_gasto')
    .select('*')
    .eq('activa', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })
}

export async function listGastos(opts?: {
  desde?: string
  hasta?: string
  categoriaId?: string
  pagador?: PagadorGasto
  limit?: number
  offset?: number
}) {
  const limit = opts?.limit ?? 200
  const offset = opts?.offset ?? 0
  let q = supabase
    .from('gastos')
    .select('*, categoria:categorias_gasto(id, nombre, tipo)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (opts?.desde) q = q.gte('fecha', opts.desde)
  if (opts?.hasta) q = q.lte('fecha', opts.hasta)
  if (opts?.categoriaId) q = q.eq('categoria_id', opts.categoriaId)
  if (opts?.pagador) q = q.eq('pagador', opts.pagador)
  return q
}

export async function createGasto(data: GastoInsert) {
  return supabase.from('gastos').insert(data).select().single()
}

export async function updateGasto(id: string, patch: GastoUpdate) {
  return supabase.from('gastos').update(patch).eq('id', id).select().single()
}

export async function deleteGasto(id: string) {
  return supabase.from('gastos').delete().eq('id', id)
}

/**
 * Agregados por socio para el pie del listado. Suma en memoria; para
 * volúmenes grandes convendría una vista materializada en F2.
 */
export async function getTotalesGastos(opts?: {
  desde?: string
  hasta?: string
  categoriaId?: string
  pagador?: PagadorGasto
}) {
  let q = supabase
    .from('gastos')
    .select('monto_total, monto_kathe, monto_andres, monto_jp, monto_orvann')
  if (opts?.desde) q = q.gte('fecha', opts.desde)
  if (opts?.hasta) q = q.lte('fecha', opts.hasta)
  if (opts?.categoriaId) q = q.eq('categoria_id', opts.categoriaId)
  if (opts?.pagador) q = q.eq('pagador', opts.pagador)
  const { data, error } = await q
  if (error) return { data: null, error: error.message }
  const totals = (data ?? []).reduce(
    (acc, g) => ({
      total: acc.total + Number(g.monto_total ?? 0),
      kathe: acc.kathe + Number(g.monto_kathe ?? 0),
      andres: acc.andres + Number(g.monto_andres ?? 0),
      jp: acc.jp + Number(g.monto_jp ?? 0),
      orvann: acc.orvann + Number(g.monto_orvann ?? 0),
    }),
    { total: 0, kathe: 0, andres: 0, jp: 0, orvann: 0 },
  )
  return { data: totals, error: null }
}

export const PAGADORES: PagadorGasto[] = ['ORVANN', 'KATHE', 'ANDRES', 'JP']
export const DISTRIBUCIONES: {
  value: DistribucionGasto
  label: string
  hint: string
}[] = [
  { value: 'equitativa', label: 'Equitativa', hint: 'Dividido entre los 3 socios (33.3% cada uno)' },
  { value: 'asignada', label: 'Asignada', hint: 'Lo absorbe el pagador (no afecta a los otros)' },
  { value: 'orvann', label: 'ORVANN', hint: 'Lo absorbe la caja del negocio (no afecta a socios)' },
  { value: 'custom', label: 'Personalizada', hint: 'Definís manualmente cuánto paga cada uno' },
]
