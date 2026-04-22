import type { Database } from '../types/database'

type TipoProducto = Database['public']['Enums']['tipo_producto']
type TipoEstampado = Database['public']['Enums']['tipo_estampado']
type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']

/**
 * Conceptos "base" (siempre aplican si el tipo de producto lo permite) vs.
 * "estampado" (aplican según el tipo_estampado elegido). Los nombres deben
 * coincidir con `parametros_costo.concepto` del seed.
 */
const CONCEPTO_CATEGORIA: Record<string, 'base' | 'estampado'> = {
  etiqueta_espalda:         'base',
  marquilla_lavado:         'base',
  bolsa:                    'base',
  estampado_dtg_grande:     'estampado',
  punto_corazon_estampado:  'estampado',
  punto_corazon_bordado:    'estampado',
}

/**
 * Mapeo de `tipo_estampado` → conceptos de `parametros_costo` que aplican.
 *
 * Reglas de combinación:
 *   - `doble_punto_y_completo`: DTG grande (12k) + punto corazón estampado (2k).
 *   - `doble_bordado_y_completo`: DTG grande (12k) + punto corazón bordado (7k).
 *   - `triple_completo`: DTG (12k) + estampado (2k) + bordado (7k) — raro pero posible.
 */
const ESTAMPADO_MAP: Record<TipoEstampado, string[]> = {
  ninguno: [],
  punto_corazon_estampado:  ['punto_corazon_estampado'],
  punto_corazon_bordado:    ['punto_corazon_bordado'],
  completo_dtg:             ['estampado_dtg_grande'],
  doble_punto_y_completo:   ['estampado_dtg_grande', 'punto_corazon_estampado'],
  doble_bordado_y_completo: ['estampado_dtg_grande', 'punto_corazon_bordado'],
  triple_completo:          ['estampado_dtg_grande', 'punto_corazon_estampado', 'punto_corazon_bordado'],
}

export type BreakdownItem = {
  concepto: string
  descripcion: string | null
  monto: number
}

export type Breakdown = {
  items: BreakdownItem[]
  total: number
}

/**
 * Calcula el `costo_adicional` de una variante sumando los conceptos
 * aplicables de `parametros_costo` según tipo de producto y estampado.
 *
 * Fotografía del costo al momento de la creación: si `parametros_costo`
 * cambia después, las variantes existentes no se recalculan.
 */
export function calcularCostoAdicional(
  parametros: ParametroCosto[],
  tipo: TipoProducto,
  estampado: TipoEstampado,
): Breakdown {
  const items: BreakdownItem[] = []
  const activos = parametros.filter(p => p.activo !== false)

  // Conceptos base (aplicables al tipo de producto)
  for (const p of activos) {
    if (CONCEPTO_CATEGORIA[p.concepto] !== 'base') continue
    const aplica = !p.aplicable_a || p.aplicable_a.includes(tipo)
    if (!aplica) continue
    items.push({
      concepto: p.concepto,
      descripcion: p.descripcion,
      monto: Number(p.costo_unitario),
    })
  }

  // Conceptos por estampado
  const aplicables = ESTAMPADO_MAP[estampado] || []
  for (const concepto of aplicables) {
    const p = activos.find(x => x.concepto === concepto)
    if (!p) continue
    items.push({
      concepto: p.concepto,
      descripcion: p.descripcion,
      monto: Number(p.costo_unitario),
    })
  }

  const total = items.reduce((acc, it) => acc + it.monto, 0)
  return { items, total }
}

/**
 * Genera un preview del SKU del lado cliente para mostrar al usuario al
 * crear variante. La verdad canónica es `fn_generar_sku` en el servidor;
 * esta versión produce un string idéntico salvo en el caso de colisión
 * (no consulta BD, por lo que no puede resolver el sufijo incremental).
 */
export function previewSku(
  productoNombre: string | null | undefined,
  color: string | null | undefined,
  talla: string | null | undefined,
  disenoNombre: string | null | undefined,
): string {
  const prod = slug(productoNombre, 3)
  const col = slug(color, 3)
  const tal = slug(talla, 4)
  const dis = disenoNombre ? slug(disenoNombre, 4) : ''
  return [prod, col, tal, dis].filter(Boolean).join('-') || 'SKU'
}

function slug(txt: string | null | undefined, n: number): string {
  if (!txt) return ''
  const clean = txt
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
  return clean.slice(0, n)
}

/**
 * Margen porcentual (snapshot). Devuelve 0 si precio <= 0.
 */
export function calcularMargen(costoTotal: number, precio: number): number {
  if (!precio || precio <= 0) return 0
  return (precio - costoTotal) / precio
}

/**
 * Label amigable para tipo_estampado.
 */
export const ESTAMPADO_LABELS: Record<TipoEstampado, string> = {
  ninguno: 'Ninguno',
  punto_corazon_estampado: 'Punto corazón estampado',
  punto_corazon_bordado: 'Punto corazón bordado',
  completo_dtg: 'DTG completo',
  doble_punto_y_completo: 'DTG + punto estampado',
  doble_bordado_y_completo: 'DTG + punto bordado',
  triple_completo: 'DTG + estampado + bordado',
}

/**
 * Label amigable para tipo_producto.
 */
export const TIPO_PRODUCTO_LABELS: Record<TipoProducto, string> = {
  prenda: 'Prenda',
  fragancia: 'Fragancia',
  accesorio: 'Accesorio',
  otro: 'Otro',
}

/**
 * Label amigable para categoria_diseno.
 */
export const CATEGORIA_DISENO_LABELS: Record<string, string> = {
  cine: 'Cine',
  musica: 'Música',
  literatura: 'Literatura',
  tv: 'TV',
  deporte: 'Deporte',
  cultura_pop: 'Cultura pop',
  otro: 'Otro',
}
