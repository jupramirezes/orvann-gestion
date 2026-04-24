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

  // Si hay algún pago a crédito, la venta queda con saldo pendiente.
  // saldo_pendiente = suma de los pagos con metodo='credito'.
  // Los abonos posteriores (tabla venta_abonos) disminuyen ese saldo.
  const saldoCredito = input.pagos
    .filter(p => p.metodo === 'credito')
    .reduce((s, p) => s + p.monto, 0)
  const esCredito = saldoCredito > 0

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
    es_credito: esCredito,
    saldo_pendiente: saldoCredito,
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

export type VentaConJoin = Venta & {
  cliente: { id: string; nombre: string; telefono: string | null } | null
  vendedor: { id: string; nombre: string } | null
  items_count: { count: number }[]
}

/**
 * Helper para extraer el conteo de items desde la columna joinada
 * (Supabase devuelve [{count: N}] para agregados).
 */
export function itemsCount(v: Pick<VentaConJoin, 'items_count'>): number {
  return v.items_count?.[0]?.count ?? 0
}

/**
 * Lista ventas para el admin con filtros. Solo las completadas por
 * default (las en estado='anulada' del flujo intermedio no interesan).
 */
export async function listVentas(opts?: {
  desde?: string
  hasta?: string
  tipo?: Database['public']['Enums']['tipo_transaccion']
  metodo?: MetodoPago
  clienteId?: string
  limit?: number
  incluirTodosEstados?: boolean
}) {
  const limit = opts?.limit ?? 200
  let q = supabase
    .from('ventas')
    .select(
      `*,
       cliente:clientes(id, nombre, telefono),
       vendedor:profiles(id, nombre),
       items_count:venta_items(count)`,
      { count: 'exact' },
    )
    .order('fecha', { ascending: false })
    .limit(limit)

  if (!opts?.incluirTodosEstados) q = q.eq('estado', 'completada')
  if (opts?.desde) q = q.gte('fecha', `${opts.desde}T00:00:00`)
  if (opts?.hasta) q = q.lte('fecha', `${opts.hasta}T23:59:59`)
  if (opts?.tipo) q = q.eq('tipo_transaccion', opts.tipo)
  if (opts?.metodo) q = q.eq('metodo_pago', opts.metodo)
  if (opts?.clienteId) q = q.eq('cliente_id', opts.clienteId)

  return q
}

export async function getVentaDetalle(ventaId: string) {
  const [ventaRes, itemsRes, pagosRes, abonosRes] = await Promise.all([
    supabase
      .from('ventas')
      .select(
        `*,
         cliente:clientes(id, nombre, telefono),
         vendedor:profiles(id, nombre)`,
      )
      .eq('id', ventaId)
      .single(),
    supabase
      .from('venta_items')
      .select(
        `*, variante:variantes(id, sku, color, talla, producto:productos(id, nombre))`,
      )
      .eq('venta_id', ventaId),
    supabase
      .from('venta_pagos')
      .select('*')
      .eq('venta_id', ventaId)
      .order('created_at', { ascending: true }),
    supabase
      .from('venta_abonos')
      .select('*')
      .eq('venta_id', ventaId)
      .order('fecha', { ascending: true }),
  ])
  return {
    venta: ventaRes.data,
    items: itemsRes.data ?? [],
    pagos: pagosRes.data ?? [],
    abonos: abonosRes.data ?? [],
    error: ventaRes.error?.message ?? itemsRes.error?.message ?? pagosRes.error?.message ?? abonosRes.error?.message ?? null,
  }
}

export type AbonoInput = {
  venta_id: string
  monto: number
  metodo: MetodoPago
  referencia?: string | null
  fecha?: string
  notas?: string | null
}

/**
 * Registra un abono sobre una venta a crédito.
 *   1. Valida que la venta tenga saldo_pendiente > 0.
 *   2. INSERT en venta_abonos.
 *   3. UPDATE ventas: saldo_pendiente -= monto; es_credito=false cuando
 *      el saldo llega a 0 (±1 peso de tolerancia).
 *
 * Si el monto excede el saldo, se rechaza para evitar sobre-pago.
 */
export async function registrarAbono(input: AbonoInput): Promise<{ error: string | null }> {
  const { data: venta, error: errV } = await supabase
    .from('ventas')
    .select('id, es_credito, saldo_pendiente')
    .eq('id', input.venta_id)
    .single()
  if (errV || !venta) {
    return { error: errV?.message ?? 'Venta no encontrada' }
  }
  const saldoActual = Number(venta.saldo_pendiente ?? 0)
  if (saldoActual <= 0) {
    return { error: 'Esta venta no tiene saldo pendiente' }
  }
  if (input.monto <= 0) {
    return { error: 'El monto del abono debe ser mayor a cero' }
  }
  if (input.monto > saldoActual + 1) {
    return { error: `El abono (${input.monto}) excede el saldo pendiente (${saldoActual})` }
  }

  const { error: errAbono } = await supabase.from('venta_abonos').insert({
    venta_id: input.venta_id,
    monto: input.monto,
    metodo: input.metodo,
    referencia: input.referencia ?? null,
    fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
    notas: input.notas ?? null,
  })
  if (errAbono) return { error: errAbono.message }

  const nuevoSaldo = Math.max(0, saldoActual - input.monto)
  const { error: errUpd } = await supabase
    .from('ventas')
    .update({
      saldo_pendiente: nuevoSaldo,
      es_credito: nuevoSaldo > 0,
    })
    .eq('id', input.venta_id)
  if (errUpd) return { error: errUpd.message }

  return { error: null }
}
