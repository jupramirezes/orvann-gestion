import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Transformacion = Database['public']['Tables']['transformaciones']['Row']
export type TransformacionInsert = Database['public']['Tables']['transformaciones']['Insert']

type VarianteLite = {
  id: string
  sku: string
  color: string | null
  talla: string | null
  estampado: Database['public']['Enums']['tipo_estampado'] | null
  producto: { id: string; nombre: string } | null
  diseno: { id: string; nombre: string } | null
}

export type TransformacionConJoin = Transformacion & {
  origen: VarianteLite | null
  destino: VarianteLite | null
}

export async function listTransformaciones(opts?: {
  desde?: string
  hasta?: string
  limit?: number
  offset?: number
}) {
  const limit = opts?.limit ?? 100
  const offset = opts?.offset ?? 0
  let q = supabase
    .from('transformaciones')
    .select(
      `*,
       origen:variantes!transformaciones_variante_origen_id_fkey(
         id, sku, color, talla, estampado,
         producto:productos(id, nombre),
         diseno:disenos(id, nombre)
       ),
       destino:variantes!transformaciones_variante_destino_id_fkey(
         id, sku, color, talla, estampado,
         producto:productos(id, nombre),
         diseno:disenos(id, nombre)
       )`,
      { count: 'exact' },
    )
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (opts?.desde) q = q.gte('fecha', opts.desde)
  if (opts?.hasta) q = q.lte('fecha', opts.hasta)
  return q
}

export async function createTransformacion(data: TransformacionInsert) {
  return supabase.from('transformaciones').insert(data).select().single()
}

export async function deleteTransformacion(id: string) {
  // Ojo: el trigger fn_post_transformacion NO reversea stock al delete.
  // Para revertir una transformación mal registrada, crear una nueva
  // transformación inversa (origen y destino intercambiados).
  return supabase.from('transformaciones').delete().eq('id', id)
}
