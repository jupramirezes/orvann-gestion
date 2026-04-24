import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export type Venta = Database['public']['Tables']['ventas']['Row']
export type VentaInsert = Database['public']['Tables']['ventas']['Insert']
export type VentaItem = Database['public']['Tables']['venta_items']['Row']
export type VentaItemInsert = Database['public']['Tables']['venta_items']['Insert']
export type VentaPago = Database['public']['Tables']['venta_pagos']['Row']
export type VentaPagoInsert = Database['public']['Tables']['venta_pagos']['Insert']
export type MetodoPago = Database['public']['Enums']['metodo_pago']

export type CrearVentaInput = {
  items: Array<{
    variante_id: string
    cantidad: number
    precio_unitario: number
    costo_unitario: number
  }>
  pagos: Array<{
    metodo: MetodoPago
    monto: number
    referencia?: string | null
    comprobante_url?: string | null
  }>
  descuento_monto?: number
  descuento_motivo?: string | null
  cliente_id?: string | null
  vendedor_id?: string | null
  efectivo_recibido?: number | null
  vueltas?: number | null
  notas?: string | null
}

/**
 * Crea una venta completa (venta + items + pagos) con compensación en caso
 * de error. La secuencia es:
 *   1. INSERT ventas con estado='anulada' (intermedio). Esto evita que
 *      `fn_validar_pagos_venta` dispare el check de suma en pagos
 *      mientras el total aún no está calculado.
 *   2. INSERT venta_items → triggers descuentan stock y actualizan
 *      `ventas.subtotal`/`ventas.total` (vía `fn_actualizar_totales_venta`).
 *   3. INSERT venta_pagos (uno o varios, cumple "pagos mixtos").
 *   4. UPDATE ventas SET estado='completada' → la venta queda oficial.
 *
 * Si cualquier paso falla después del (1), se elimina la venta con
 * `delete ... cascade` de los registros dependientes ya insertados.
 *
 * Nota: no es atómico a nivel SQL (requeriría un RPC en una migración).
 * Para F1 el riesgo es aceptable: el cliente ya validó suma antes de
 * enviar, y si la foto de comprobante falla después de registrar la
 * venta, la venta persiste sin la foto (el usuario la puede adjuntar
 * desde admin en F2).
 */
export async function createVentaCompleta(
  input: CrearVentaInput,
): Promise<{ data: { id: string } | null; error: string | null }> {
  // Validación cliente-side
  const subtotalCalc = input.items.reduce(
    (s, i) => s + i.cantidad * i.precio_unitario,
    0,
  )
  const totalCalc = Math.max(subtotalCalc - (input.descuento_monto ?? 0), 0)
  const sumaPagos = input.pagos.reduce((s, p) => s + p.monto, 0)
  if (Math.abs(sumaPagos - totalCalc) > 1) {
    return {
      data: null,
      error: `La suma de pagos (${sumaPagos}) no cuadra con el total (${totalCalc}).`,
    }
  }
  if (input.items.length === 0) {
    return { data: null, error: 'La venta debe tener al menos un item.' }
  }
  if (input.pagos.length === 0) {
    return { data: null, error: 'La venta debe tener al menos un pago.' }
  }
  if ((input.descuento_monto ?? 0) > 0 && !input.descuento_motivo?.trim()) {
    return { data: null, error: 'Un descuento requiere motivo.' }
  }

  const metodoDominante: MetodoPago =
    input.pagos.length > 1 ? 'mixto' : input.pagos[0]!.metodo

  // 1) INSERT ventas (estado intermedio)
  const ventaPayload: VentaInsert = {
    tipo_transaccion: 'venta',
    metodo_pago: metodoDominante,
    canal: 'tienda_fisica',
    descuento_monto: input.descuento_monto ?? 0,
    descuento_motivo: input.descuento_motivo ?? null,
    cliente_id: input.cliente_id ?? null,
    vendedor_id: input.vendedor_id ?? null,
    efectivo_recibido: input.efectivo_recibido ?? null,
    vueltas: input.vueltas ?? null,
    notas: input.notas ?? null,
    estado: 'anulada', // temporal — se completa al final
  }
  const { data: venta, error: errVenta } = await supabase
    .from('ventas')
    .insert(ventaPayload)
    .select('id')
    .single()
  if (errVenta || !venta) {
    return { data: null, error: errVenta?.message ?? 'Error creando venta' }
  }
  const ventaId = venta.id

  // 2) INSERT venta_items (triggers descuentan stock y actualizan totales)
  const itemsPayload: VentaItemInsert[] = input.items.map(it => ({
    venta_id: ventaId,
    variante_id: it.variante_id,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    costo_unitario: it.costo_unitario,
  }))
  const { error: errItems } = await supabase
    .from('venta_items')
    .insert(itemsPayload)
  if (errItems) {
    await supabase.from('ventas').delete().eq('id', ventaId)
    return { data: null, error: `No se pudieron registrar los items: ${errItems.message}` }
  }

  // 3) INSERT venta_pagos
  const pagosPayload: VentaPagoInsert[] = input.pagos.map(p => ({
    venta_id: ventaId,
    metodo: p.metodo,
    monto: p.monto,
    referencia: p.referencia ?? null,
    comprobante_url: p.comprobante_url ?? null,
  }))
  const { error: errPagos } = await supabase
    .from('venta_pagos')
    .insert(pagosPayload)
  if (errPagos) {
    await supabase.from('ventas').delete().eq('id', ventaId)
    return { data: null, error: `No se pudieron registrar los pagos: ${errPagos.message}` }
  }

  // 4) Marcar como completada
  const { error: errCompletar } = await supabase
    .from('ventas')
    .update({ estado: 'completada' })
    .eq('id', ventaId)
  if (errCompletar) {
    await supabase.from('ventas').delete().eq('id', ventaId)
    return { data: null, error: `No se pudo completar la venta: ${errCompletar.message}` }
  }

  return { data: { id: ventaId }, error: null }
}

export async function actualizarComprobantePago(
  pagoId: string,
  path: string,
) {
  return supabase
    .from('venta_pagos')
    .update({ comprobante_url: path })
    .eq('id', pagoId)
}
