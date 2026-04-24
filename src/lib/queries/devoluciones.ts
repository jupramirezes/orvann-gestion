import { supabase } from '../supabase'
import type { Database } from '../../types/database'

type VentaItemRow = Database['public']['Tables']['venta_items']['Row']

export type VentaItemConVariante = VentaItemRow & {
  variante: {
    id: string
    sku: string
    color: string | null
    talla: string | null
    producto: { id: string; nombre: string } | null
  } | null
}

export type VentaBuscable = {
  id: string
  fecha: string | null
  total: number | null
  metodo_pago: Database['public']['Enums']['metodo_pago']
  tipo_transaccion: Database['public']['Enums']['tipo_transaccion'] | null
  estado: Database['public']['Enums']['estado_venta'] | null
  cliente: { id: string; nombre: string; telefono: string | null } | null
  items_count: number
}

/**
 * Busca ventas candidatas a devolver:
 *  - Solo tipo_transaccion='venta' y estado='completada'
 *  - Por teléfono del cliente (dígitos parciales) o por rango de fechas
 *  - Ordenadas por fecha desc
 */
export async function buscarVentasParaDevolver(opts: {
  telefono?: string
  desde?: string
  hasta?: string
  limit?: number
}) {
  const limit = opts.limit ?? 30
  let q = supabase
    .from('ventas')
    .select(
      `id, fecha, total, metodo_pago, tipo_transaccion, estado,
       cliente:clientes(id, nombre, telefono),
       items_count:venta_items(count)`,
    )
    .eq('tipo_transaccion', 'venta')
    .eq('estado', 'completada')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (opts.desde) q = q.gte('fecha', `${opts.desde}T00:00:00`)
  if (opts.hasta) q = q.lte('fecha', `${opts.hasta}T23:59:59`)

  if (opts.telefono) {
    const soloDigitos = opts.telefono.replace(/[^\d]/g, '')
    if (soloDigitos.length >= 3) {
      // Filtro via relación: trae clientes cuyos teléfonos coinciden
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .ilike('telefono', `%${soloDigitos}%`)
      const ids = (clientes ?? []).map(c => c.id)
      if (ids.length === 0) return { data: [] as VentaBuscable[], error: null }
      q = q.in('cliente_id', ids)
    }
  }

  return q as unknown as Promise<{
    data: VentaBuscable[] | null
    error: { message: string } | null
  }>
}

export async function getVentaConItems(ventaId: string) {
  const [ventaRes, itemsRes] = await Promise.all([
    supabase
      .from('ventas')
      .select(`*, cliente:clientes(id, nombre, telefono)`)
      .eq('id', ventaId)
      .single(),
    supabase
      .from('venta_items')
      .select(
        `*, variante:variantes(id, sku, color, talla, producto:productos(id, nombre))`,
      )
      .eq('venta_id', ventaId),
  ])
  return {
    venta: ventaRes.data,
    items: (itemsRes.data as VentaItemConVariante[]) ?? [],
    error: ventaRes.error?.message ?? itemsRes.error?.message ?? null,
  }
}

/**
 * Cuenta cuántas unidades de cada item ya fueron devueltas en
 * devoluciones previas contra la misma venta original. Se usa para
 * limitar la cantidad disponible en una devolución nueva.
 */
export async function unidadesYaDevueltas(ventaOriginalId: string) {
  const { data, error } = await supabase
    .from('ventas')
    .select(
      `id, tipo_transaccion,
       venta_items:venta_items(variante_id, cantidad)`,
    )
    .eq('venta_original_id', ventaOriginalId)
    .eq('tipo_transaccion', 'devolucion')
  if (error) return { data: {} as Record<string, number>, error: error.message }
  const acc: Record<string, number> = {}
  for (const v of data ?? []) {
    type DevItem = { variante_id: string; cantidad: number }
    for (const it of (v.venta_items ?? []) as DevItem[]) {
      acc[it.variante_id] = (acc[it.variante_id] ?? 0) + Number(it.cantidad)
    }
  }
  return { data: acc, error: null }
}

export type CrearDevolucionInput = {
  ventaOriginalId: string
  items: Array<{
    variante_id: string
    cantidad: number
    precio_unitario: number
    costo_unitario: number
  }>
  vendedorId?: string | null
  notas?: string | null
}

/**
 * Crea una devolución como fila espejo en `ventas`:
 *  1. Insert ventas con tipo_transaccion='devolucion', venta_original_id,
 *     metodo_pago copiado del original, estado='anulada' (intermedio).
 *  2. Insert venta_items (cantidades positivas; el trigger
 *     fn_post_venta_item lee tipo_transaccion y emite movimiento con
 *     signo positivo tipo anulacion_venta — stock vuelve al inventario).
 *  3. Update estado='completada'.
 *
 * No inserta venta_pagos: la devolución representa que el dinero sale
 * de caja (reintegro), no que entra. Si el cliente recibió reembolso
 * efectivo, eso se refleja en cierre_caja aparte (F2).
 */
export async function createDevolucion(
  input: CrearDevolucionInput,
): Promise<{ data: { id: string } | null; error: string | null }> {
  if (input.items.length === 0) {
    return { data: null, error: 'Seleccioná al menos un ítem a devolver.' }
  }

  // Copiar método_pago de la venta original
  const { data: original, error: errOrig } = await supabase
    .from('ventas')
    .select('metodo_pago, cliente_id')
    .eq('id', input.ventaOriginalId)
    .single()
  if (errOrig || !original) {
    return { data: null, error: errOrig?.message ?? 'Venta original no existe' }
  }

  // 1) Insert venta (devolución) en estado intermedio
  const { data: devolucion, error: errDev } = await supabase
    .from('ventas')
    .insert({
      tipo_transaccion: 'devolucion',
      venta_original_id: input.ventaOriginalId,
      cliente_id: original.cliente_id,
      vendedor_id: input.vendedorId ?? null,
      metodo_pago: original.metodo_pago,
      canal: 'tienda_fisica',
      estado: 'anulada',
      notas: input.notas ?? null,
    })
    .select('id')
    .single()
  if (errDev || !devolucion) {
    return { data: null, error: errDev?.message ?? 'Error creando devolución' }
  }

  // 2) Insert items (triggers reintegran stock)
  const itemsPayload = input.items.map(it => ({
    venta_id: devolucion.id,
    variante_id: it.variante_id,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    costo_unitario: it.costo_unitario,
  }))
  const { error: errItems } = await supabase
    .from('venta_items')
    .insert(itemsPayload)
  if (errItems) {
    await supabase.from('ventas').delete().eq('id', devolucion.id)
    return { data: null, error: errItems.message }
  }

  // 3) Completar
  const { error: errCompletar } = await supabase
    .from('ventas')
    .update({ estado: 'completada' })
    .eq('id', devolucion.id)
  if (errCompletar) {
    await supabase.from('ventas').delete().eq('id', devolucion.id)
    return { data: null, error: errCompletar.message }
  }

  return { data: { id: devolucion.id }, error: null }
}
