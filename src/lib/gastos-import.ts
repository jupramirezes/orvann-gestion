import { z } from 'zod'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { Constants, type Database } from '../types/database'

type PagadorGasto = Database['public']['Enums']['pagador_gasto']
type DistribucionGasto = Database['public']['Enums']['distribucion_gasto']
type MetodoPago = Database['public']['Enums']['metodo_pago']

/**
 * Importer de gastos históricos del Sheet Control Operativo. La hoja
 * "Gastos" tiene un quirk: cada gasto equitativo aparece como 3 filas
 * (una por socio: KATHE/ANDRES/JP). El importer detecta esa repetición
 * y consolida en 1 solo gasto con distribucion='equitativa'.
 *
 * Estructura esperada del xlsx:
 *   Fecha | Categoría | Monto | Descripción | Método Pago | Responsable | Notas
 */

export type GastoImportResult = {
  ok: number
  failed: number
  errors: Array<{ row: number; error: string; raw: Record<string, string> }>
}

export type GastoParsedSheet = {
  headers: string[]
  originalHeaders: string[]
  /** Gastos consolidados listos para insert (cada uno = 1 fila en BD). */
  gastos: GastoNormalizado[]
  /** Filas crudas del Sheet antes de consolidar. */
  filasCrudas: number
  /** Cuántos gastos eran trios (3 filas por equitativa). */
  triosDetectados: number
  /** Filas con error que se saltean (categoría desconocida, monto inválido). */
  saltadas: Array<{ row: number; reason: string }>
  /** Categorías del Sheet que no matchearon ninguna en BD. */
  categoriasSinMatch: string[]
}

export type GastoNormalizado = {
  fecha: string  // YYYY-MM-DD
  categoria_id: string
  categoria_nombre: string
  monto_total: number
  descripcion: string | null
  metodo_pago: MetodoPago
  pagador: PagadorGasto
  distribucion: DistribucionGasto
  notas: string | null
}

const HEADER_ALIASES: Record<string, string> = {
  fecha: 'fecha',
  categoria: 'categoria',
  categoría: 'categoria',
  monto: 'monto',
  descripcion: 'descripcion',
  descripción: 'descripcion',
  metodo_pago: 'metodo_pago',
  método_pago: 'metodo_pago',
  responsable: 'responsable',
  pagador: 'responsable',
  notas: 'notas',
}

function normalizeHeader(raw: string): string {
  if (!raw) return ''
  const n = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return HEADER_ALIASES[n] ?? n
}

const METODO_MAP: Record<string, MetodoPago> = {
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  datafono: 'datafono',
  datáfono: 'datafono',
  credito: 'credito',
  crédito: 'credito',
  tarjeta: 'datafono',
}

const PAGADOR_MAP: Record<string, PagadorGasto> = {
  kathe: 'KATHE',
  andres: 'ANDRES',
  andrés: 'ANDRES',
  jp: 'JP',
  jp_ramirez: 'JP',
  orvann: 'ORVANN',
  empresa: 'ORVANN',
}

function parseMonto(raw: string): number {
  if (!raw) return 0
  const s = String(raw).replace(/[$\s,.]/g, m => m === ',' ? '' : m === '.' ? '' : '')
  const n = Number(s.replace(/\$/g, '').replace(/,/g, '').replace(/\./g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function parseFecha(raw: string): string | null {
  if (!raw) return null
  // Soporta "1/12/2025", "01/12/2025", "2025-12-01"
  const s = String(raw).trim()
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Excel serial number
  const num = Number(s)
  if (Number.isFinite(num) && num > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + num * 86400000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }
  return null
}

const rowSchema = z.object({
  fecha: z.string().min(1),
  categoria: z.string().trim().min(1),
  monto: z.coerce.number().min(0),
  descripcion: z.string().trim().optional().default(''),
  metodo_pago: z.string().trim().min(1),
  responsable: z.string().trim().min(1),
  notas: z.string().trim().optional().default(''),
})

export async function parseGastosFile(file: File): Promise<GastoParsedSheet> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('gasto')) ?? wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) {
    return emptyParsed()
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })
  if (aoa.length === 0) return emptyParsed()

  // Detectar header row buscando "Fecha" en la primera columna
  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const first = String((aoa[i] as unknown[])[0] ?? '').trim().toLowerCase()
    if (first.startsWith('fecha')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) headerIdx = 0

  const originalHeaders = (aoa[headerIdx] as unknown[]).map(h => String(h ?? '').trim())
  const headers = originalHeaders.map(normalizeHeader)
  const rawRows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const values = aoa[i] as unknown[]
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = String(values[idx] ?? '').trim() })
    if (Object.values(row).every(v => !v)) continue
    rawRows.push(row)
  }

  // Cargar categorías de BD para matching
  const { data: categoriasDB } = await supabase
    .from('categorias_gasto')
    .select('id, nombre')
    .eq('activa', true)
  const catMap = new Map<string, string>()
  for (const c of categoriasDB ?? []) {
    catMap.set(normalizeHeader(c.nombre), c.id)
  }

  const saltadas: Array<{ row: number; reason: string }> = []
  const categoriasSinMatch = new Set<string>()
  const validRows: Array<{
    rowIdx: number
    fecha: string
    categoria_id: string
    categoria_nombre: string
    monto: number
    descripcion: string
    metodo_pago: MetodoPago
    pagador: PagadorGasto
    notas: string
  }> = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const rowIdx = headerIdx + 2 + i
    let parsed: z.infer<typeof rowSchema>
    try {
      parsed = rowSchema.parse({
        fecha: raw.fecha,
        categoria: raw.categoria,
        monto: parseMonto(raw.monto),
        descripcion: raw.descripcion,
        metodo_pago: raw.metodo_pago,
        responsable: raw.responsable,
        notas: raw.notas,
      })
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : String(err)
      saltadas.push({ row: rowIdx, reason: msg })
      continue
    }

    const fecha = parseFecha(parsed.fecha)
    if (!fecha) {
      saltadas.push({ row: rowIdx, reason: `Fecha inválida: "${parsed.fecha}"` })
      continue
    }
    if (parsed.monto <= 0) {
      saltadas.push({ row: rowIdx, reason: 'Monto cero o negativo' })
      continue
    }

    const catKey = normalizeHeader(parsed.categoria)
    const categoria_id = catMap.get(catKey)
    if (!categoria_id) {
      categoriasSinMatch.add(parsed.categoria)
      saltadas.push({ row: rowIdx, reason: `Categoría "${parsed.categoria}" no existe en BD` })
      continue
    }

    const pagador = PAGADOR_MAP[normalizeHeader(parsed.responsable)]
    if (!pagador) {
      saltadas.push({ row: rowIdx, reason: `Responsable "${parsed.responsable}" no reconocido` })
      continue
    }

    const metodo = METODO_MAP[normalizeHeader(parsed.metodo_pago)]
    if (!metodo) {
      saltadas.push({ row: rowIdx, reason: `Método "${parsed.metodo_pago}" no reconocido` })
      continue
    }

    validRows.push({
      rowIdx,
      fecha,
      categoria_id,
      categoria_nombre: parsed.categoria,
      monto: parsed.monto,
      descripcion: parsed.descripcion,
      metodo_pago: metodo,
      pagador,
      notas: parsed.notas,
    })
  }

  // Consolidar: agrupar por (fecha, categoria_id, descripcion, metodo, monto_individual)
  // Si los 3 socios (KATHE+ANDRES+JP) están con el mismo monto → equitativa.
  // Sino → asignada o orvann según pagador.
  type GrupoKey = string
  const grupos = new Map<GrupoKey, typeof validRows>()
  for (const r of validRows) {
    const key = [
      r.fecha,
      r.categoria_id,
      r.descripcion.toLowerCase(),
      r.metodo_pago,
      r.monto,
    ].join('|')
    const arr = grupos.get(key) ?? []
    arr.push(r)
    grupos.set(key, arr)
  }

  const gastos: GastoNormalizado[] = []
  let triosDetectados = 0
  for (const arr of grupos.values()) {
    const pagadores = new Set(arr.map(r => r.pagador))
    const esTrio = arr.length === 3 &&
      pagadores.has('KATHE') && pagadores.has('ANDRES') && pagadores.has('JP')
    if (esTrio) {
      triosDetectados++
      const r = arr[0]
      gastos.push({
        fecha: r.fecha,
        categoria_id: r.categoria_id,
        categoria_nombre: r.categoria_nombre,
        monto_total: r.monto * 3,
        descripcion: r.descripcion || null,
        metodo_pago: r.metodo_pago,
        pagador: 'ORVANN', // pagador "neutro" cuando es equitativa
        distribucion: 'equitativa',
        notas: r.notas ? `${r.notas} · import_sheet` : 'import_sheet',
      })
    } else {
      // Cada fila como gasto individual (asignada al pagador, o orvann si pagador=ORVANN)
      for (const r of arr) {
        gastos.push({
          fecha: r.fecha,
          categoria_id: r.categoria_id,
          categoria_nombre: r.categoria_nombre,
          monto_total: r.monto,
          descripcion: r.descripcion || null,
          metodo_pago: r.metodo_pago,
          pagador: r.pagador,
          distribucion: r.pagador === 'ORVANN' ? 'orvann' : 'asignada',
          notas: r.notas ? `${r.notas} · import_sheet` : 'import_sheet',
        })
      }
    }
  }

  return {
    headers,
    originalHeaders,
    gastos,
    filasCrudas: rawRows.length,
    triosDetectados,
    saltadas,
    categoriasSinMatch: [...categoriasSinMatch],
  }
}

function emptyParsed(): GastoParsedSheet {
  return {
    headers: [],
    originalHeaders: [],
    gastos: [],
    filasCrudas: 0,
    triosDetectados: 0,
    saltadas: [],
    categoriasSinMatch: [],
  }
}

export async function importGastos(gastos: GastoNormalizado[]): Promise<GastoImportResult> {
  const result: GastoImportResult = { ok: 0, failed: 0, errors: [] }
  for (let i = 0; i < gastos.length; i++) {
    const g = gastos[i]
    const { error } = await supabase.from('gastos').insert({
      fecha: g.fecha,
      categoria_id: g.categoria_id,
      monto_total: g.monto_total,
      descripcion: g.descripcion,
      metodo_pago: g.metodo_pago,
      pagador: g.pagador,
      distribucion: g.distribucion,
      notas: g.notas,
    })
    if (error) {
      result.failed++
      result.errors.push({
        row: i + 1,
        error: error.message,
        raw: {
          fecha: g.fecha,
          categoria: g.categoria_nombre,
          monto: String(g.monto_total),
          descripcion: g.descripcion ?? '',
          metodo_pago: g.metodo_pago,
          pagador: g.pagador,
          distribucion: g.distribucion,
        },
      })
    } else {
      result.ok++
    }
  }
  return result
}

export const PAGADORES_VALIDOS = Constants.public.Enums.pagador_gasto
