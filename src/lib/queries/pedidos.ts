import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Pedido = Database['public']['Tables']['pedidos_proveedor']['Row']
export type PedidoInsert = Database['public']['Tables']['pedidos_proveedor']['Insert']
export type PedidoUpdate = Database['public']['Tables']['pedidos_proveedor']['Update']
export type PedidoItem = Database['public']['Tables']['pedidos_proveedor_items']['Row']
export type PedidoItemInsert = Database['public']['Tables']['pedidos_proveedor_items']['Insert']
export type PedidoItemUpdate = Database['public']['Tables']['pedidos_proveedor_items']['Update']

export type PedidoConJoin = Pedido & {
  proveedor: { id: string; nombre: string } | null
  items_count: number
}

export type PedidoItemConVariante = PedidoItem & {
  variante: {
    id: string
    sku: string
    producto: { id: string; nombre: string; tipo: Database['public']['Enums']['tipo_producto'] } | null
  } | null
}

/* ─── Listado y filtros ──────────────────────────────────────────── */

export async function listPedidos(opts?: {
  proveedorId?: string
  estadoPago?: Database['public']['Enums']['estado_pago_pedido']
  desde?: string
  hasta?: string
  limit?: number
  offset?: number
}) {
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  let q = supabase
    .from('pedidos_proveedor')
    .select(
      '*, proveedor:proveedores(id, nombre), items_count:pedidos_proveedor_items(count)',
      { count: 'exact' },
    )
    .order('fecha_pedido', { ascending: false })
    .range(offset, offset + limit - 1)
  if (opts?.proveedorId) q = q.eq('proveedor_id', opts.proveedorId)
  if (opts?.estadoPago) q = q.eq('estado_pago', opts.estadoPago)
  if (opts?.desde) q = q.gte('fecha_pedido', opts.desde)
  if (opts?.hasta) q = q.lte('fecha_pedido', opts.hasta)
  return q
}

/* ─── Detalle ────────────────────────────────────────────────────── */

export async function getPedido(id: string) {
  return supabase
    .from('pedidos_proveedor')
    .select('*, proveedor:proveedores(id, nombre)')
    .eq('id', id)
    .single()
}

export async function listPedidoItems(pedidoId: string) {
  return supabase
    .from('pedidos_proveedor_items')
    .select(
      '*, variante:variantes(id, sku, producto:productos(id, nombre, tipo))',
    )
    .eq('pedido_id', pedidoId)
    .order('id', { ascending: true })
}

/* ─── Mutaciones ─────────────────────────────────────────────────── */

export async function createPedido(
  pedido: PedidoInsert,
  items: Omit<PedidoItemInsert, 'pedido_id'>[],
) {
  const { data: created, error } = await supabase
    .from('pedidos_proveedor')
    .insert(pedido)
    .select()
    .single()
  if (error || !created) return { data: null, error }

  if (items.length === 0) return { data: created, error: null }

  const payload: PedidoItemInsert[] = items.map(it => ({ ...it, pedido_id: created.id }))
  const { error: errItems } = await supabase.from('pedidos_proveedor_items').insert(payload)
  if (errItems) return { data: created, error: errItems }

  // Actualizar total del pedido a partir de items (trigger lo haría si existiera).
  const total = payload.reduce((sum, it) => sum + it.unidades * Number(it.costo_unitario), 0)
  await supabase.from('pedidos_proveedor').update({ total }).eq('id', created.id)

  return { data: created, error: null }
}

export async function updatePedido(id: string, patch: PedidoUpdate) {
  return supabase.from('pedidos_proveedor').update(patch).eq('id', id).select().single()
}

export async function marcarPagado(id: string, fecha: string) {
  return updatePedido(id, { estado_pago: 'pagado', fecha_pago: fecha })
}

/**
 * Registra recepción: al setear `fecha_recepcion` de NULL a una fecha,
 * el trigger `fn_post_recepcion_pedido` crea movimientos `entrada_pedido`
 * por cada item con `variante_id` no nulo.
 */
export async function marcarRecibido(id: string, fecha: string) {
  return updatePedido(id, { fecha_recepcion: fecha })
}

export async function updatePedidoItem(itemId: string, patch: PedidoItemUpdate) {
  return supabase.from('pedidos_proveedor_items').update(patch).eq('id', itemId).select().single()
}

export async function deletePedidoItem(itemId: string) {
  return supabase.from('pedidos_proveedor_items').delete().eq('id', itemId)
}

/**
 * Recalcula el total del pedido sumando sus items.
 * Se llama después de agregar/editar/borrar items.
 */
export async function recalcularTotalPedido(pedidoId: string) {
  const { data } = await supabase
    .from('pedidos_proveedor_items')
    .select('unidades, costo_unitario')
    .eq('pedido_id', pedidoId)
  const total = (data ?? []).reduce(
    (sum, it) => sum + it.unidades * Number(it.costo_unitario),
    0,
  )
  return updatePedido(pedidoId, { total })
}
