import { z } from 'zod'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { calcularCostoAdicional } from './catalogo'
import { Constants, type Database } from '../types/database'

type TipoProducto = Database['public']['Enums']['tipo_producto']
type TipoEstampado = Database['public']['Enums']['tipo_estampado']
type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']

/**
 * Columnas esperadas del archivo de inventario:
 *   tipo, producto_base, color, talla, diseno, estampado,
 *   cantidad, costo_unit, precio_venta, zona, observacion
 *
 * Las cabeceras se normalizan antes de matchear: se pasa a minúsculas,
 * se eliminan acentos y los espacios se reemplazan por guiones bajos.
 * Así un Excel con "Precio Venta" o "PRECIO_VENTA" o "precio venta"
 * mapea a `precio_venta`.
 */

export type ImportResult = {
  ok: number
  failed: number
  errors: Array<{ row: number; error: string; raw: Record<string, string> }>
  created: Array<{ sku: string; productoNombre: string }>
}

export const EXPECTED_COLUMNS = [
  'tipo',
  'producto_base',
  'color',
  'talla',
  'diseno',
  'estampado',
  'cantidad',
  'costo_unit',
  'precio_venta',
  'zona',
  'observacion',
] as const

/** Aliases comunes: acepta también sin guión bajo y sinónimos razonables. */
const HEADER_ALIASES: Record<string, string> = {
  // producto_base
  'producto': 'producto_base',
  'producto_nombre': 'producto_base',
  'nombre_producto': 'producto_base',
  'nombre': 'producto_base',
  // costo_unit
  'costo': 'costo_unit',
  'costo_unitario': 'costo_unit',
  'costo_base': 'costo_unit',
  'costo_proveedor': 'costo_unit',
  // precio_venta
  'precio': 'precio_venta',
  'pvp': 'precio_venta',
  // cantidad
  'stock': 'cantidad',
  'existencias': 'cantidad',
  'unidades': 'cantidad',
  // diseno
  'diseño': 'diseno',
  'referencia': 'diseno',
  // observacion
  'observaciones': 'observacion',
  'notas': 'observacion',
  'nota': 'observacion',
}

function normalizeHeader(raw: string): string {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Mapea una cabecera al nombre canónico (producto_base, precio_venta, etc). */
function canonicalHeader(raw: string): string {
  const normalized = normalizeHeader(raw)
  return HEADER_ALIASES[normalized] ?? normalized
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

/* ─── Parsing ────────────────────────────────────────────────────── */

export type ParsedSheet = {
  headers: string[]          // headers ya canónicos
  originalHeaders: string[]  // headers tal como los escribió el usuario
  rows: Record<string, string>[]
  missingHeaders: string[]
  unknownHeaders: string[]
}

/** Parsea CSV o XLSX según el tipo de archivo. */
export async function parseFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSX(await file.arrayBuffer())
  }
  return parseCSV(await file.text())
}

export function parseCSV(text: string): ParsedSheet {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return emptyParsed()
  const originalHeaders = splitCSVLine(lines[0]).map(h => h.trim())
  const headers = originalHeaders.map(canonicalHeader)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return buildParsed(headers, originalHeaders, rows)
}

export function parseXLSX(buffer: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buffer, { type: 'array' })
  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  if (!firstSheet) return emptyParsed()

  // Leemos como matriz para preservar el orden de columnas.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })
  if (aoa.length === 0) return emptyParsed()

  const originalHeaders = (aoa[0] as unknown[]).map(h => String(h ?? '').trim())
  const headers = originalHeaders.map(canonicalHeader)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < aoa.length; i++) {
    const values = aoa[i] as unknown[]
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = String(values[idx] ?? '').trim() })
    // saltar filas totalmente vacías
    if (Object.values(row).every(v => !v)) continue
    rows.push(row)
  }
  return buildParsed(headers, originalHeaders, rows)
}

function emptyParsed(): ParsedSheet {
  return { headers: [], originalHeaders: [], rows: [], missingHeaders: [...EXPECTED_COLUMNS], unknownHeaders: [] }
}

function buildParsed(headers: string[], original: string[], rows: Record<string, string>[]): ParsedSheet {
  // Columnas críticas que no tienen default en el schema
  const REQUIRED = ['tipo', 'producto_base', 'costo_unit', 'precio_venta']
  const missingHeaders = REQUIRED.filter(c => !headers.includes(c))
  const unknownHeaders = headers.filter(h => h && !EXPECTED_COLUMNS.includes(h as typeof EXPECTED_COLUMNS[number]))
  return { headers, originalHeaders: original, rows, missingHeaders, unknownHeaders }
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { out.push(current); current = ''; continue }
    current += ch
  }
  out.push(current)
  return out
}

/* ─── Import ─────────────────────────────────────────────────────── */

export async function importRows(rows: Record<string, string>[]): Promise<ImportResult> {
  const result: ImportResult = { ok: 0, failed: 0, errors: [], created: [] }

  const [{ data: parametros }, { data: disenos }] = await Promise.all([
    supabase.from('parametros_costo').select('*').eq('activo', true),
    supabase.from('disenos').select('id, nombre').eq('activo', true),
  ])
  const params = (parametros ?? []) as ParametroCosto[]
  const disenosMap = new Map<string, string>()
  for (const d of disenos ?? []) disenosMap.set(d.nombre.toLowerCase(), d.id)

  const productosCache = new Map<string, string>() // `${tipo}|${nombre.lower()}` → id

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

      const disenoId = parsed.diseno
        ? disenosMap.get(parsed.diseno.toLowerCase()) ?? null
        : null

      if (parsed.diseno && !disenoId) {
        throw new Error(`Diseño "${parsed.diseno}" no existe. Creálo primero en /admin/disenos.`)
      }

      const breakdown = calcularCostoAdicional(
        params,
        parsed.tipo as TipoProducto,
        parsed.estampado as TipoEstampado,
      )

      const { data: sku, error: skuErr } = await supabase.rpc('fn_generar_sku', {
        p_producto_id: productoId,
        p_color: parsed.color || '',
        p_talla: parsed.talla || '',
        p_diseno_id: (disenoId ?? null) as unknown as string,
      })
      if (skuErr || !sku) throw new Error(`Generar SKU: ${skuErr?.message}`)

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

      if (parsed.cantidad > 0) {
        const { error: errM } = await supabase.from('movimientos_inventario').insert({
          variante_id: variante.id,
          tipo: 'entrada_pedido',
          cantidad: parsed.cantidad,
          referencia_tipo: 'import_inicial',
          notas: 'Carga inicial desde importador',
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
