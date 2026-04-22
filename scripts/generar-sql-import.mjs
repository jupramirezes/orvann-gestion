/**
 * Lee tmp-import/payload.json (output de preparar-import-jp.mjs) y
 * genera una secuencia SQL lista para aplicar via MCP apply_migration.
 *
 * Estrategia:
 *   1. CTEs con (tipo, producto_base) únicos → find-or-create productos.
 *   2. Por cada item: INSERT en variantes usando fn_generar_sku + SELECT
 *      del producto_id y diseno_id por nombre.
 *   3. Movimiento de inventario inicial si cantidad > 0.
 *
 * Se agrupa en un DO block con bloqueo a nivel transacción para
 * atomicidad, y cada variante usa un sub-select del producto.
 */

import fs from 'fs'

const PARAMS = {
  etiqueta_espalda:          { monto: 600,  categoria: 'base', tipos: ['prenda'] },
  marquilla_lavado:          { monto: 600,  categoria: 'base', tipos: ['prenda'] },
  bolsa:                     { monto: 1000, categoria: 'base', tipos: ['prenda', 'fragancia', 'accesorio'] },
  estampado_dtg_grande:      { monto: 12000, categoria: 'estampado' },
  punto_corazon_estampado:   { monto: 2000,  categoria: 'estampado' },
  punto_corazon_bordado:     { monto: 7000,  categoria: 'estampado' },
}

const ESTAMPADO_MAP = {
  ninguno: [],
  punto_corazon_estampado:  ['punto_corazon_estampado'],
  punto_corazon_bordado:    ['punto_corazon_bordado'],
  completo_dtg:             ['estampado_dtg_grande'],
  doble_punto_y_completo:   ['estampado_dtg_grande', 'punto_corazon_estampado'],
  doble_bordado_y_completo: ['estampado_dtg_grande', 'punto_corazon_bordado'],
  triple_completo:          ['estampado_dtg_grande', 'punto_corazon_estampado', 'punto_corazon_bordado'],
}

function calcularCostoAdicional(tipo, estampado) {
  let total = 0
  for (const info of Object.values(PARAMS)) {
    if (info.categoria !== 'base') continue
    if (info.tipos && !info.tipos.includes(tipo)) continue
    total += info.monto
  }
  for (const concepto of ESTAMPADO_MAP[estampado] ?? []) {
    total += PARAMS[concepto]?.monto ?? 0
  }
  return total
}

const payload = JSON.parse(fs.readFileSync('tmp-import/payload.json', 'utf8'))

function escLit(s) {
  if (s === null || s === undefined) return 'null'
  return "'" + String(s).replace(/'/g, "''") + "'"
}
function escNum(n) {
  if (n === null || n === undefined) return 'null'
  return String(Number(n))
}
function escInt(n) {
  if (n === null || n === undefined) return 'null'
  return String(Math.trunc(Number(n)))
}

const productosUnicos = new Map() // `tipo|nombre` → true
for (const it of payload.items) {
  productosUnicos.set(`${it.tipo}|${it.producto_base}`, it)
}

const lines = []
lines.push('-- Import inventario fisico real de JP (2026-04-21)')
lines.push('-- Fuente: docs/referencia/inventario-fisico-template.xlsx (30% del total)')
lines.push('')
lines.push('begin;')
lines.push('')

// 1) find-or-create productos
lines.push('-- ===== productos (find-or-create) =====')
for (const [key] of productosUnicos) {
  const [tipo, nombre] = key.split('|')
  lines.push(
    `insert into productos (nombre, tipo, marca) values (${escLit(nombre)}, ${escLit(tipo)}, 'ORVANN')
     on conflict do nothing;`
  )
}
lines.push('')

// 2) variantes + movimiento inicial
lines.push('-- ===== variantes + movimientos_inventario =====')
for (const it of payload.items) {
  const breakdown = calcularCostoAdicional(it.tipo, it.estampado)

  const prodCte = `select id from productos where tipo = ${escLit(it.tipo)} and lower(nombre) = lower(${escLit(it.producto_base)}) limit 1`
  const disCte = it.diseno
    ? `select id from disenos where lower(nombre) = lower(${escLit(it.diseno)}) limit 1`
    : `select null::uuid as id`

  const movInsert = it.cantidad > 0
    ? `
insert into movimientos_inventario (variante_id, tipo, cantidad, referencia_tipo, notas)
select id, 'entrada_pedido', ${escInt(it.cantidad)}, 'import_inicial', 'Carga inicial inventario fisico JP'
from nueva_variante;`
    : `
select 1 from nueva_variante;`

  // Single-line compacto para fácil chunking via MCP
  const stmt = `with prod as (${prodCte}), dis as (${disCte}), ` +
    `new_sku as (select fn_generar_sku((select id from prod), ${escLit(it.color ?? '')}, ${escLit(it.talla ?? '')}, (select id from dis)) as sku), ` +
    `nueva_variante as (insert into variantes (producto_id, sku, talla, color, diseno_id, estampado, costo_base, costo_adicional, precio_venta, notas) values ((select id from prod), (select sku from new_sku), ${escLit(it.talla)}, ${escLit(it.color)}, (select id from dis), ${escLit(it.estampado)}, ${escNum(it.costo_unit)}, ${escNum(breakdown)}, ${escNum(it.precio_venta)}, ${escLit(it.observacion)}) returning id)` +
    movInsert.replace(/\n/g, ' ')
  lines.push(stmt)
}
lines.push('')
lines.push('commit;')

fs.writeFileSync('tmp-import/import.sql', lines.join('\n'))
console.log('SQL escrito en tmp-import/import.sql')
console.log('Productos a crear (o skippear si existen):', productosUnicos.size)
console.log('Variantes a crear:', payload.items.length)
console.log('Movimientos a crear:', payload.items.filter(i => i.cantidad > 0).length)

