/**
 * Seed de variantes iniciales para ORVANN
 * Ejecutar: npx tsx scripts/seed-variantes.ts
 *
 * Lee productos base existentes en Supabase y crea variantes
 * con stock inicial real del inventario de la tienda.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Tipos ──────────────────────────────────────────────
interface VarianteSeed {
  productoNombre: string
  sku: string
  talla: string
  color: string
  costo: number
  precio_venta: number
  stock: number
  stock_minimo?: number
}

// ─── Datos de variantes ─────────────────────────────────

const TALLAS_CAMISA_OVS = ['S', 'M', 'L', 'XL']
const COLORES_CAMISA_OVS = ['Negro', 'Blanco', 'Perla']
const STOCK_CAMISA_OVS: Record<string, number> = { S: 2, M: 6, L: 6, XL: 6 }

const SKU_COLOR_MAP: Record<string, string> = {
  Negro: 'NEG',
  Blanco: 'BLA',
  Perla: 'PER',
  'Acid Wash Gris': 'ACID',
  'Gris Claro': 'GRCL',
  'Gris Oscuro': 'GROS',
  Gris: 'GRI',
  Varios: 'VAR',
}

function buildVariantes(): VarianteSeed[] {
  const variantes: VarianteSeed[] = []

  // ── 1. Camisa Oversize Peruana ──
  for (const color of COLORES_CAMISA_OVS) {
    for (const talla of TALLAS_CAMISA_OVS) {
      variantes.push({
        productoNombre: 'Camisa Oversize Peruana',
        sku: `CAM-OVS-${SKU_COLOR_MAP[color]}-${talla}`,
        talla,
        color,
        costo: 37000,
        precio_venta: 75000,
        stock: STOCK_CAMISA_OVS[talla],
        stock_minimo: 3,
      })
    }
  }

  // ── 2. Hoodie ──
  variantes.push({
    productoNombre: 'Hoodie',
    sku: 'HOOD-ACID-L',
    talla: 'L',
    color: 'Acid Wash Gris',
    costo: 120000,
    precio_venta: 190000,
    stock: 7,
    stock_minimo: 2,
  })

  // ── 3. Chaqueta Cortavientos ──
  const TALLAS_CHA = ['M', 'L', 'XL']
  const COLORES_CHA = ['Negro', 'Gris Claro', 'Gris Oscuro']
  for (const color of COLORES_CHA) {
    for (const talla of TALLAS_CHA) {
      variantes.push({
        productoNombre: 'Chaqueta Cortavientos',
        sku: `CHA-${SKU_COLOR_MAP[color]}-${talla}`,
        talla,
        color,
        costo: 40000,
        precio_venta: 110000,
        stock: 4,
        stock_minimo: 2,
      })
    }
  }

  // ── 4. Camisa Réplica 1.1 ──
  variantes.push({
    productoNombre: 'Camisa Réplica 1.1',
    sku: 'CAM-REP11-VAR-M',
    talla: 'M',
    color: 'Varios',
    costo: 54000,
    precio_venta: 75000,
    stock: 8,
    stock_minimo: 3,
  })

  return variantes
}

// ─── Ejecución ──────────────────────────────────────────

async function main() {
  console.log('🌱 Cargando variantes iniciales de ORVANN...\n')

  // 1. Obtener productos base
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('id, nombre')

  if (prodError || !productos) {
    console.error('❌ Error al obtener productos:', prodError?.message)
    process.exit(1)
  }

  const productoMap = new Map(productos.map((p) => [p.nombre, p.id]))
  console.log(`📦 Productos base encontrados: ${productos.length}`)
  for (const p of productos) {
    console.log(`   • ${p.nombre}`)
  }
  console.log()

  // 2. Construir variantes
  const variantes = buildVariantes()

  // 3. Verificar que todos los productos referenciados existen
  const nombresUnicos = [...new Set(variantes.map((v) => v.productoNombre))]
  const faltantes = nombresUnicos.filter((n) => !productoMap.has(n))
  if (faltantes.length > 0) {
    console.error('❌ Productos no encontrados en Supabase:')
    faltantes.forEach((f) => console.error(`   • ${f}`))
    console.error('\n   Asegurate de haber ejecutado schema_01_tablas.sql primero.')
    process.exit(1)
  }

  // 4. Preparar rows para insert
  const rows = variantes.map((v) => ({
    producto_id: productoMap.get(v.productoNombre)!,
    sku: v.sku,
    talla: v.talla,
    color: v.color,
    costo: v.costo,
    precio_venta: v.precio_venta,
    stock: v.stock,
    stock_minimo: v.stock_minimo ?? 3,
  }))

  // 5. Upsert (por si se corre más de una vez)
  const { data: inserted, error: insertError } = await supabase
    .from('variantes')
    .upsert(rows, { onConflict: 'sku' })
    .select('sku, talla, color, stock, precio_venta')

  if (insertError) {
    console.error('❌ Error al insertar variantes:', insertError.message)
    process.exit(1)
  }

  console.log(`✅ ${inserted?.length ?? 0} variantes cargadas:\n`)

  // 6. Resumen por producto
  for (const nombre of nombresUnicos) {
    const productoVariantes = variantes.filter((v) => v.productoNombre === nombre)
    const totalStock = productoVariantes.reduce((sum, v) => sum + v.stock, 0)
    console.log(`── ${nombre} (${productoVariantes.length} variantes, ${totalStock} uds) ──`)
    for (const v of productoVariantes) {
      console.log(`   ${v.sku.padEnd(22)} ${v.talla.padEnd(4)} ${v.color.padEnd(16)} stock=${v.stock}  $${v.precio_venta.toLocaleString('es-CO')}`)
    }
    console.log()
  }

  // 7. Registrar movimientos de entrada inicial
  console.log('📋 Registrando movimientos de entrada inicial...')

  // Obtener variantes recién insertadas con sus IDs
  const { data: variantesDb, error: varErr } = await supabase
    .from('variantes')
    .select('id, sku, stock')
    .in('sku', rows.map((r) => r.sku))

  if (varErr || !variantesDb) {
    console.error('❌ Error al obtener variantes insertadas:', varErr?.message)
    process.exit(1)
  }

  const skuToId = new Map(variantesDb.map((v) => [v.sku, { id: v.id, stock: v.stock }]))

  const movimientos = rows
    .filter((r) => r.stock > 0)
    .map((r) => {
      const info = skuToId.get(r.sku)!
      return {
        variante_id: info.id,
        tipo: 'entrada',
        cantidad: r.stock,
        stock_resultante: info.stock,
        referencia_tipo: 'seed',
        notas: 'Inventario inicial - seed script',
      }
    })

  const { error: movError } = await supabase
    .from('movimientos_inv')
    .insert(movimientos)

  if (movError) {
    console.error('⚠️  Error al registrar movimientos (variantes sí se crearon):', movError.message)
  } else {
    console.log(`✅ ${movimientos.length} movimientos de entrada registrados\n`)
  }

  // 8. Totales
  const totalUnidades = variantes.reduce((sum, v) => sum + v.stock, 0)
  const valorCosto = variantes.reduce((sum, v) => sum + v.stock * v.costo, 0)
  const valorVenta = variantes.reduce((sum, v) => sum + v.stock * v.precio_venta, 0)

  console.log('═══════════════════════════════════════════')
  console.log(`  Total unidades:   ${totalUnidades}`)
  console.log(`  Valor a costo:    $${valorCosto.toLocaleString('es-CO')}`)
  console.log(`  Valor a venta:    $${valorVenta.toLocaleString('es-CO')}`)
  console.log('═══════════════════════════════════════════')
  console.log('\n🎉 Seed completado!')
}

main().catch((err) => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
