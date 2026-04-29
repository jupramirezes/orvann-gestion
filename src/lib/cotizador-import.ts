import * as XLSX from 'xlsx'
import { supabase } from './supabase'

/**
 * Importer del Cotizador del Sheet Control Operativo. Lee la hoja
 * "Cotizador" que tiene un catálogo de productos con `costo_base`
 * por (Tipo Producto + Proveedor). Sirve para auto-completar el
 * costo de variantes que se importaron con `costo_base = 0`.
 *
 * Estructura esperada (header row 4 del xlsx):
 *   Tipo Producto | Proveedor | Costo Base | ... otras columnas ...
 *
 * Como una misma combinación (producto + proveedor) aparece varias
 * veces con distintos estampados, tomamos solo la primera y
 * descartamos las repetidas — el costo_adicional se calcula aparte.
 */

export type CotizadorEntry = {
  productoNombre: string
  proveedorNombre: string
  costoBase: number
}

export type CotizadorMatch = {
  varianteId: string
  sku: string
  productoNombre: string
  proveedorNombre: string
  costoBaseActual: number
  costoBaseSugerido: number
}

export type CotizadorParseResult = {
  entries: CotizadorEntry[]
  matches: CotizadorMatch[]
  variantesSinCosto: number
  sinMatch: Array<{ sku: string; producto: string; proveedor: string }>
}

function normalizeName(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function parseMonto(raw: string): number {
  if (!raw) return 0
  const s = String(raw).replace(/[$\s]/g, '').replace(/,/g, '').replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * Lee el Cotizador del xlsx y mapea contra las variantes con
 * `costo_base = 0` en BD para sugerir actualizaciones.
 */
export async function parseCotizador(file: File): Promise<CotizadorParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('cotizador'))
  if (!sheetName) {
    throw new Error('No se encontró la hoja "Cotizador" en el archivo')
  }
  const sheet = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })

  // Buscar la fila de header del catálogo (la que tiene "Tipo Producto" en col 0
  // o "Proveedor" en col 1)
  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i] as unknown[]
    const c0 = String(row[0] ?? '').toLowerCase().trim()
    const c1 = String(row[1] ?? '').toLowerCase().trim()
    if (c0.includes('tipo producto') && c1.includes('proveedor')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    throw new Error('No se encontró el header del catálogo (Tipo Producto | Proveedor | Costo Base)')
  }

  const entries: CotizadorEntry[] = []
  const seen = new Set<string>()
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] as unknown[]
    const tipo = String(row[0] ?? '').trim()
    const prov = String(row[1] ?? '').trim()
    const costo = parseMonto(String(row[2] ?? ''))
    if (!tipo || !prov || costo <= 0) continue
    const key = `${normalizeName(tipo)}|${normalizeName(prov)}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ productoNombre: tipo, proveedorNombre: prov, costoBase: costo })
  }

  // Cargar variantes con costo_base = 0 + join con producto y proveedor
  const { data: variantes, error } = await supabase
    .from('variantes')
    .select(`
      id, sku, costo_base,
      producto:productos(id, nombre, proveedor_id, proveedor:proveedores(id, nombre))
    `)
    .eq('costo_base', 0)

  if (error) {
    throw new Error(`Error cargando variantes sin costo: ${error.message}`)
  }

  // Construir el mapa del cotizador
  const cotMap = new Map<string, number>()
  for (const e of entries) {
    cotMap.set(`${normalizeName(e.productoNombre)}|${normalizeName(e.proveedorNombre)}`, e.costoBase)
  }

  type VarianteRow = {
    id: string
    sku: string
    costo_base: number | null
    producto: {
      id: string
      nombre: string
      proveedor_id: string | null
      proveedor: { id: string; nombre: string } | null
    } | null
  }

  const matches: CotizadorMatch[] = []
  const sinMatch: Array<{ sku: string; producto: string; proveedor: string }> = []
  for (const v of (variantes ?? []) as unknown as VarianteRow[]) {
    const productoNombre = v.producto?.nombre ?? ''
    const proveedorNombre = v.producto?.proveedor?.nombre ?? ''
    if (!productoNombre || !proveedorNombre) {
      sinMatch.push({ sku: v.sku, producto: productoNombre || '—', proveedor: proveedorNombre || '—' })
      continue
    }
    const key = `${normalizeName(productoNombre)}|${normalizeName(proveedorNombre)}`
    const costoSugerido = cotMap.get(key)
    if (!costoSugerido) {
      // Match parcial: starts-with
      let costoSug: number | undefined
      for (const [k, v2] of cotMap) {
        const [tipoNorm, provNorm] = k.split('|')
        const tn = normalizeName(productoNombre)
        const pn = normalizeName(proveedorNombre)
        if (provNorm === pn && (tn.startsWith(tipoNorm) || tipoNorm.startsWith(tn))) {
          costoSug = v2
          break
        }
      }
      if (costoSug) {
        matches.push({
          varianteId: v.id,
          sku: v.sku,
          productoNombre,
          proveedorNombre,
          costoBaseActual: Number(v.costo_base ?? 0),
          costoBaseSugerido: costoSug,
        })
      } else {
        sinMatch.push({ sku: v.sku, producto: productoNombre, proveedor: proveedorNombre })
      }
      continue
    }
    matches.push({
      varianteId: v.id,
      sku: v.sku,
      productoNombre,
      proveedorNombre,
      costoBaseActual: Number(v.costo_base ?? 0),
      costoBaseSugerido: costoSugerido,
    })
  }

  return {
    entries,
    matches,
    variantesSinCosto: (variantes ?? []).length,
    sinMatch,
  }
}

export async function aplicarCotizador(matches: CotizadorMatch[]): Promise<{
  ok: number
  failed: number
  errors: Array<{ sku: string; error: string }>
}> {
  let ok = 0
  let failed = 0
  const errors: Array<{ sku: string; error: string }> = []
  for (const m of matches) {
    const { error } = await supabase
      .from('variantes')
      .update({ costo_base: m.costoBaseSugerido })
      .eq('id', m.varianteId)
    if (error) {
      failed++
      errors.push({ sku: m.sku, error: error.message })
    } else {
      ok++
    }
  }
  return { ok, failed, errors }
}
