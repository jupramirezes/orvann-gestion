/**
 * Lee el xlsx de JP (docs/referencia/inventario-fisico.xlsx)
 * y transforma cada fila al formato canónico del sistema. Devuelve un
 * JSON que el caller (o Claude via MCP) usa para generar SQL de import.
 *
 * Particularidades del xlsx de JP:
 *   - Row 0: totales (ignorar).
 *   - Row 1: headers reales.
 *   - Row 2+: datos.
 *   - 3 columnas SI/NO para estampado (Estampado Punto Corazón,
 *     Bordado Punto Corazón, Estampado Completo) que se combinan.
 *   - Números con comas (separador de miles) o strings vacíos.
 *   - Algunas filas finales vacías o con solo "Prenda" en col 0.
 *
 * Uso: node scripts/preparar-import-jp.mjs > /tmp/import-payload.json
 */

import XLSX from 'xlsx'

const FILE = 'docs/referencia/inventario-fisico.xlsx'

const wb = XLSX.readFile(FILE)
const sheet = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: '',
  blankrows: false,
  raw: false,
})

// Detectar la fila de headers: buscar la que tenga "Tipo" en col 0.
let headerRowIdx = -1
for (let i = 0; i < Math.min(aoa.length, 5); i++) {
  if (String(aoa[i][0]).trim().toLowerCase() === 'tipo') {
    headerRowIdx = i
    break
  }
}
if (headerRowIdx === -1) {
  console.error('No se encontró fila de headers con "Tipo"')
  process.exit(1)
}

const headers = aoa[headerRowIdx].map(h => String(h ?? '').trim())
const dataRows = aoa.slice(headerRowIdx + 1)

// Índices de columnas por etiqueta exacta
function col(label) {
  const idx = headers.findIndex(h => h.toLowerCase().replace(/\s+/g, ' ') === label.toLowerCase())
  if (idx === -1) {
    console.error(`Columna esperada no encontrada: "${label}". Headers: ${JSON.stringify(headers)}`)
    process.exit(1)
  }
  return idx
}

const colMap = {
  tipo:         col('Tipo'),
  productoBase: col('Producto_base'),
  color:        col('Color'),
  talla:        col('Talla'),
  diseno:       col('Diseño'),
  estPunto:     col('Estampado Punto Corazón'),
  estBordado:   col('Bordado Punto Corazón'),
  estCompleto:  col('Estampado Completo'),
  cantidad:     col('Cantidad'),
  costo:        col('Costo_unit'),
  precio:       col('Precio_venta'),
  observacion:  col('Observación'),
}

function parseNumber(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().replace(/,/g, '')
  if (s === '' || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseYesNo(raw) {
  const s = String(raw ?? '').trim().toUpperCase()
  return s === 'SI' || s === 'SÍ' || s === 'YES' || s === 'Y' || s === 'X'
}

function estampadoFromColumns(punto, bordado, completo) {
  // Matriz completa de combinaciones:
  //   - los 3 SI          → triple_completo (raro)
  //   - completo+punto    → doble_punto_y_completo
  //   - completo+bordado  → doble_bordado_y_completo
  //   - punto+bordado (sin completo) → se toma bordado (más costoso, más "terminado")
  //   - solo completo     → completo_dtg
  //   - solo bordado      → punto_corazon_bordado
  //   - solo punto        → punto_corazon_estampado
  //   - todos NO          → ninguno
  if (completo && punto && bordado) return 'triple_completo'
  if (completo && punto)            return 'doble_punto_y_completo'
  if (completo && bordado)          return 'doble_bordado_y_completo'
  if (completo)                     return 'completo_dtg'
  if (bordado)                      return 'punto_corazon_bordado'
  if (punto)                        return 'punto_corazon_estampado'
  return 'ninguno'
}

const TIPO_MAP = {
  'prenda':    'prenda',
  'fragancia': 'fragancia',
  'accesorio': 'accesorio',
  'otro':      'otro',
}

const items = []
const skipped = []

for (let i = 0; i < dataRows.length; i++) {
  const r = dataRows[i]
  const sourceRow = headerRowIdx + 1 + i + 1  // 1-based row number en Excel

  const tipoRaw = String(r[colMap.tipo] ?? '').trim().toLowerCase()
  const productoBase = String(r[colMap.productoBase] ?? '').trim()

  // saltar filas vacías (solo tipo sin producto_base)
  if (!productoBase) {
    skipped.push({ row: sourceRow, reason: 'producto_base vacío' })
    continue
  }

  const tipo = TIPO_MAP[tipoRaw]
  if (!tipo) {
    skipped.push({ row: sourceRow, reason: `tipo desconocido: "${r[colMap.tipo]}"` })
    continue
  }

  const color = String(r[colMap.color] ?? '').trim() || null
  const talla = String(r[colMap.talla] ?? '').trim() || null
  const diseno = String(r[colMap.diseno] ?? '').trim() || null

  const punto = parseYesNo(r[colMap.estPunto])
  const bordado = parseYesNo(r[colMap.estBordado])
  const completo = parseYesNo(r[colMap.estCompleto])
  const estampado = estampadoFromColumns(punto, bordado, completo)

  const cantidad = parseNumber(r[colMap.cantidad]) ?? 0
  const costo = parseNumber(r[colMap.costo])
  const precio = parseNumber(r[colMap.precio])

  const observacionParts = []
  const obs = String(r[colMap.observacion] ?? '').trim()
  if (obs) observacionParts.push(obs)
  if (costo === null) observacionParts.push('COSTO PENDIENTE')

  // si no hay precio lo salteamos (no se puede vender sin precio)
  if (precio === null || precio <= 0) {
    skipped.push({ row: sourceRow, reason: `precio_venta vacío para "${productoBase}"` })
    continue
  }

  items.push({
    sourceRow,
    tipo,
    producto_base: productoBase,
    color,
    talla,
    diseno,
    estampado,
    cantidad,
    costo_unit: costo ?? 0,
    precio_venta: precio,
    observacion: observacionParts.length ? observacionParts.join(' · ') : null,
    flags: { punto, bordado, completo },
  })
}

/**
 * Consolida filas duplicadas por clave (tipo, producto, color, talla,
 * diseno, estampado). Si JP registra la misma variante en varias filas
 * del xlsx (una por unidad o por lote), sumamos cantidades y tomamos
 * el primer precio/costo encontrado.
 *
 * Esto evita que fn_generar_sku genere SKU-2, SKU-3, etc. para lo que
 * en realidad es una sola variante con stock acumulado.
 */
const consolidados = new Map()
for (const it of items) {
  const key = [
    it.tipo,
    it.producto_base.toLowerCase().trim(),
    (it.color ?? '').toLowerCase().trim(),
    (it.talla ?? '').toLowerCase().trim(),
    (it.diseno ?? '').toLowerCase().trim(),
    it.estampado,
  ].join('|')

  const prev = consolidados.get(key)
  if (prev) {
    prev.cantidad += it.cantidad
    // Mantener el costo no-cero si el primero era 0
    if (prev.costo_unit === 0 && it.costo_unit > 0) prev.costo_unit = it.costo_unit
    // Concatenar observaciones únicas
    if (it.observacion && !prev.observacion?.includes(it.observacion)) {
      prev.observacion = prev.observacion
        ? `${prev.observacion} · ${it.observacion}`
        : it.observacion
    }
    prev.rows.push(it.sourceRow)
  } else {
    consolidados.set(key, { ...it, rows: [it.sourceRow] })
  }
}

const consolidatedItems = [...consolidados.values()]
const dedupInfo = consolidatedItems
  .filter(i => i.rows.length > 1)
  .map(i => ({
    producto: i.producto_base,
    color: i.color,
    talla: i.talla,
    diseno: i.diseno,
    estampado: i.estampado,
    cantidadTotal: i.cantidad,
    filas: i.rows,
  }))

console.log(JSON.stringify({
  fuente: FILE,
  headerRow: headerRowIdx + 1,
  totalFilas: dataRows.length,
  filasCrudas: items.length,
  itemsConsolidados: consolidatedItems.length,
  saltadas: skipped.length,
  duplicadosConsolidados: dedupInfo.length,
  skipped,
  dedupInfo,
  items: consolidatedItems,
}, null, 2))
