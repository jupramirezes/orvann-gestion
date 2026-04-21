import { z } from 'zod'
import { supabase } from './supabase'
import { calcularCostoAdicional } from './catalogo'
import { Constants, type Database } from '../types/database'

type TipoProducto = Database['public']['Enums']['tipo_producto']
type TipoEstampado = Database['public']['Enums']['tipo_estampado']
type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']

/**
 * Columnas esperadas del CSV (basado en
 * docs/referencia/inventario-fisico-template.csv):
 *
 *   tipo, producto_base, color, talla, diseno, estampado,
 *   cantidad, costo_unit, precio_venta, zona, observacion
 *
 * - `tipo` ∈ tipo_producto enum.
 * - `estampado` ∈ tipo_estampado enum (vacío → ninguno).
 * - `diseno` match por nombre (case insensitive). Vacío → null.
 * - `producto_base` → find-or-create productos por (nombre, tipo).
 * - `cantidad` inicial crea un movimiento `entrada_pedido` si > 0.
 * - `zona` se guarda como nota (no hay campo estructurado, decisión F1).
 * - `observacion` opcional → `variantes.notas`.
 */

export type ImportResult = {
  ok: number
  failed: number
  errors: Array<{ row: number; error: string; raw: Record<string, string> }>
  created: Array<{ sku: string; productoNombre: string }>
}

const rowSchema = z.object({
  tipo: z.enum(Constants.public.Enums.tipo_producto),
  producto_base: z.string().trim().min(1, 'producto_base requerido'),
  color: z.string().trim().optional().default(''),
  talla: z.string().trim().optional().default(''),
  diseno: z.string().trim().optional().default(''),
  estampado: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? 'ninguno' : v),
    z.enum(Constants.public.Enums.tipo_estampado),
  ),
  cantidad: z.coerce.number().int().min(0).default(0),
  costo_unit: z.coerce.number().min(0),
  precio_venta: z.coerce.number().min(0),
  zona: z.string().trim().optional().default(''),
  observacion: z.string().trim().optional().default(''),
})

type RowInput = z.infer<typeof rowSchema>

/**
 * Parsea un CSV con encabezados. Soporta valores entre comillas y comas
 * dentro de comillas, pero no maneja comillas escapadas con "". Suficiente
 * para nuestro template controlado.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = splitCSVLine(lines[0]).map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? ''
    })
    rows.push(row)
  }
  return { headers, rows }
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

/**
 * Importa filas al catálogo. find-or-create productos, crea variantes
 * con costo_adicional calculado, y genera movimiento de inventario inicial
 * con `cantidad` si > 0.
 */
export async function importCSV(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const result: ImportResult = { ok: 0, failed: 0, errors: [], created: [] }

  // Precarga de dependencias: parametros_costo, disenos.
  const [{ data: parametros }, { data: disenos }] = await Promise.all([
    supabase.from('parametros_costo').select('*').eq('activo', true),
    supabase.from('disenos').select('id, nombre').eq('activo', true),
  ])
  const params = (parametros ?? []) as ParametroCosto[]
  const disenosMap = new Map<string, string>()
  for (const d of disenos ?? []) disenosMap.set(d.nombre.toLowerCase(), d.id)

  // Cache de productos creados durante la importación para evitar duplicados
  // si el CSV tiene varias filas con el mismo `producto_base`.
  const productosCache = new Map<string, string>() // key: `${tipo}|${nombre.toLowerCase()}` → id

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    let parsed: RowInput
    try {
      parsed = rowSchema.parse(raw)
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : String(err)
      result.failed++
      result.errors.push({ row: i + 2, error: msg, raw })
      continue
    }

    try {
      // 1) find-or-create producto
      const productoKey = `${parsed.tipo}|${parsed.producto_base.toLowerCase()}`
      let productoId = productosCache.get(productoKey)

      if (!productoId) {
        const { data: existing } = await supabase
          .from('productos')
          .select('id')
          .eq('tipo', parsed.tipo)
          .ilike('nombre', parsed.producto_base)
          .limit(1)
          .maybeSingle()

        if (existing) {
          productoId = existing.id
        } else {
          const { data: created, error: errP } = await supabase
            .from('productos')
            .insert({
              nombre: parsed.producto_base,
              tipo: parsed.tipo,
              marca: 'ORVANN',
            })
            .select('id')
            .single()
          if (errP || !created) throw new Error(`Crear producto: ${errP?.message}`)
          productoId = created.id
        }
        productosCache.set(productoKey, productoId)
      }

      // 2) Resolver diseño
      const disenoId = parsed.diseno
        ? disenosMap.get(parsed.diseno.toLowerCase()) ?? null
        : null

      // 3) Calcular costo_adicional (fotografía)
      const breakdown = calcularCostoAdicional(
        params,
        parsed.tipo as TipoProducto,
        parsed.estampado as TipoEstampado,
      )

      // 4) Generar SKU servidor-side
      const { data: sku, error: skuErr } = await supabase.rpc('fn_generar_sku', {
        p_producto_id: productoId,
        p_color: parsed.color || '',
        p_talla: parsed.talla || '',
        p_diseno_id: (disenoId ?? null) as unknown as string,
      })
      if (skuErr || !sku) throw new Error(`Generar SKU: ${skuErr?.message}`)

      // 5) Crear variante
      const notasParts: string[] = []
      if (parsed.observacion) notasParts.push(parsed.observacion)
      if (parsed.zona) notasParts.push(`Zona: ${parsed.zona}`)

      const { data: variante, error: errV } = await supabase
        .from('variantes')
        .insert({
          producto_id: productoId,
          sku,
          talla: parsed.talla || null,
          color: parsed.color || null,
          diseno_id: disenoId,
          estampado: parsed.estampado as TipoEstampado,
          costo_base: parsed.costo_unit,
          costo_adicional: breakdown.total,
          precio_venta: parsed.precio_venta,
          notas: notasParts.length ? notasParts.join(' · ') : null,
        })
        .select('id')
        .single()
      if (errV || !variante) throw new Error(`Crear variante: ${errV?.message}`)

      // 6) Movimiento inicial de inventario si hay cantidad
      if (parsed.cantidad > 0) {
        const { error: errM } = await supabase.from('movimientos_inventario').insert({
          variante_id: variante.id,
          tipo: 'entrada_pedido',
          cantidad: parsed.cantidad,
          referencia_tipo: 'import_inicial',
          notas: 'Carga inicial desde CSV',
        })
        if (errM) throw new Error(`Movimiento inicial: ${errM.message}`)
      }

      result.ok++
      result.created.push({ sku, productoNombre: parsed.producto_base })
    } catch (err) {
      result.failed++
      result.errors.push({
        row: i + 2,
        error: err instanceof Error ? err.message : String(err),
        raw,
      })
    }
  }

  return result
}
