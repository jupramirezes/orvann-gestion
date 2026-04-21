import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Variante = Database['public']['Tables']['variantes']['Row']
export type VarianteInsert = Database['public']['Tables']['variantes']['Insert']
export type VarianteUpdate = Database['public']['Tables']['variantes']['Update']
export type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']
export type MovimientoInsert = Database['public']['Tables']['movimientos_inventario']['Insert']

export type VarianteConJoin = Variante & {
  producto: { id: string; nombre: string; tipo: Database['public']['Enums']['tipo_producto'] } | null
  diseno: { id: string; nombre: string } | null
}

export async function listVariantes(opts?: {
  search?: string
  productoId?: string
  tipoProducto?: Database['public']['Enums']['tipo_producto']
  stockBajo?: boolean
  sinImagen?: boolean
  includeInactive?: boolean
  limit?: number
  offset?: number
}) {
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  // Si se filtra por tipo de producto, usamos !inner para que el filtro
  // sobre productos.tipo efectivamente filtre las variantes.
  const select = opts?.tipoProducto
    ? '*, producto:productos!inner(id, nombre, tipo), diseno:disenos(id, nombre)'
    : '*, producto:productos(id, nombre, tipo), diseno:disenos(id, nombre)'
  let q = supabase
    .from('variantes')
    .select(select, { count: 'exact' })
    .order('sku', { ascending: true })
    .range(offset, offset + limit - 1)
  if (!opts?.includeInactive) q = q.eq('activo', true)
  if (opts?.productoId) q = q.eq('producto_id', opts.productoId)
  if (opts?.stockBajo) q = q.lt('stock_cache', 3)
  if (opts?.sinImagen) q = q.is('imagen_url', null)
  if (opts?.search) q = q.or(`sku.ilike.%${opts.search}%,color.ilike.%${opts.search}%,talla.ilike.%${opts.search}%`)
  if (opts?.tipoProducto) q = q.eq('productos.tipo', opts.tipoProducto)
  return q
}

export async function getVariante(id: string) {
  return supabase
    .from('variantes')
    .select('*, producto:productos(id, nombre, tipo), diseno:disenos(id, nombre)')
    .eq('id', id)
    .single()
}

export async function createVariante(data: VarianteInsert) {
  return supabase.from('variantes').insert(data).select().single()
}

export async function updateVariante(id: string, patch: VarianteUpdate) {
  return supabase
    .from('variantes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function generarSku(
  productoId: string,
  color: string | null,
  talla: string | null,
  disenoId: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_generar_sku', {
    p_producto_id: productoId,
    p_color: color ?? '',
    p_talla: talla ?? '',
    p_diseno_id: disenoId ?? null as unknown as string,
  })
  if (error) throw error
  return data ?? 'SKU'
}

export async function listParametrosCosto() {
  return supabase.from('parametros_costo').select('*').eq('activo', true).order('concepto')
}

/**
 * Crea un movimiento de inventario tipo `entrada_pedido` para sembrar stock
 * inicial (usado por el importador CSV y por ajustes manuales).
 */
export async function crearEntradaInicial(
  varianteId: string,
  cantidad: number,
  notas?: string,
) {
  if (cantidad <= 0) return { data: null, error: null }
  const payload: MovimientoInsert = {
    variante_id: varianteId,
    tipo: 'entrada_pedido',
    cantidad,
    referencia_tipo: 'import_inicial',
    notas: notas ?? 'Carga inicial de inventario',
  }
  return supabase.from('movimientos_inventario').insert(payload)
}
