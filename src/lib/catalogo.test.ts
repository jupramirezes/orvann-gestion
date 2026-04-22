import { describe, it, expect } from 'vitest'
import { calcularCostoAdicional, previewSku, calcularMargen } from './catalogo'
import type { Database } from '../types/database'

type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']

// Seed de referencia (docs/plan/seed-disenos.sql y seed.sql).
const PARAMS: ParametroCosto[] = [
  { id: '1', concepto: 'estampado_dtg_grande',    descripcion: 'DTG', costo_unitario: 12000, aplicable_a: ['prenda'], activo: true, vigente_desde: null, vigente_hasta: null },
  { id: '2', concepto: 'punto_corazon_estampado', descripcion: 'Logo estampado', costo_unitario: 2000, aplicable_a: ['prenda'], activo: true, vigente_desde: null, vigente_hasta: null },
  { id: '3', concepto: 'punto_corazon_bordado',   descripcion: 'Logo bordado',    costo_unitario: 7000, aplicable_a: ['prenda'], activo: true, vigente_desde: null, vigente_hasta: null },
  { id: '4', concepto: 'etiqueta_espalda',        descripcion: 'Etiqueta',         costo_unitario: 600,  aplicable_a: ['prenda'], activo: true, vigente_desde: null, vigente_hasta: null },
  { id: '5', concepto: 'marquilla_lavado',        descripcion: 'Marquilla',        costo_unitario: 600,  aplicable_a: ['prenda'], activo: true, vigente_desde: null, vigente_hasta: null },
  { id: '6', concepto: 'bolsa',                   descripcion: 'Bolsa',            costo_unitario: 1000, aplicable_a: ['prenda', 'fragancia', 'accesorio'], activo: true, vigente_desde: null, vigente_hasta: null },
]

describe('calcularCostoAdicional', () => {
  it('prenda con DTG completo: 12000 + 600 + 600 + 1000 = 14200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'completo_dtg')
    expect(r.total).toBe(14200)
    expect(r.items.map(i => i.concepto).sort()).toEqual(
      ['bolsa', 'estampado_dtg_grande', 'etiqueta_espalda', 'marquilla_lavado'].sort(),
    )
  })

  it('prenda básica sin estampado: 600 + 600 + 1000 = 2200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'ninguno')
    expect(r.total).toBe(2200)
  })

  it('prenda punto corazón estampado: 2000 + 600 + 600 + 1000 = 4200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'punto_corazon_estampado')
    expect(r.total).toBe(4200)
  })

  it('prenda doble punto+completo: 12000 + 2000 + 600 + 600 + 1000 = 16200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'doble_punto_y_completo')
    expect(r.total).toBe(16200)
  })

  it('prenda doble bordado+completo: 12000 + 7000 + 600 + 600 + 1000 = 21200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'doble_bordado_y_completo')
    expect(r.total).toBe(21200)
  })

  it('prenda triple (DTG + estampado + bordado): 12000 + 2000 + 7000 + 600 + 600 + 1000 = 23200', () => {
    const r = calcularCostoAdicional(PARAMS, 'prenda', 'triple_completo')
    expect(r.total).toBe(23200)
  })

  it('accesorio sin estampado: solo bolsa = 1000', () => {
    const r = calcularCostoAdicional(PARAMS, 'accesorio', 'ninguno')
    expect(r.total).toBe(1000)
    expect(r.items).toHaveLength(1)
    expect(r.items[0].concepto).toBe('bolsa')
  })

  it('fragancia sin estampado: solo bolsa = 1000', () => {
    const r = calcularCostoAdicional(PARAMS, 'fragancia', 'ninguno')
    expect(r.total).toBe(1000)
  })

  it('otro (tipo sin reglas): 0', () => {
    const r = calcularCostoAdicional(PARAMS, 'otro', 'ninguno')
    expect(r.total).toBe(0)
  })

  it('ignora parámetros inactivos', () => {
    const inactivos: ParametroCosto[] = PARAMS.map(p => ({ ...p, activo: false }))
    const r = calcularCostoAdicional(inactivos, 'prenda', 'completo_dtg')
    expect(r.total).toBe(0)
  })
})

describe('previewSku', () => {
  it('genera formato PRD-COL-TAL-DIS', () => {
    expect(previewSku('Camisa Oversize Peruana', 'Negro', 'L', null)).toBe('CAM-NEG-L')
    expect(previewSku('Camisa Oversize Peruana', 'Blanco', 'M', 'Pulp Fiction')).toBe('CAM-BLA-M-PULP')
  })

  it('sin acentos y sin chars especiales', () => {
    expect(previewSku('Camisón Peñón', 'Añil', 'Única', 'Héctor Lavoe')).toBe('CAM-ANI-UNIC-HECT')
  })

  it('fallback cuando no hay datos', () => {
    expect(previewSku(null, null, null, null)).toBe('SKU')
  })

  it('maneja nombres cortos', () => {
    expect(previewSku('X', 'Y', 'S', null)).toBe('X-Y-S')
  })
})

describe('calcularMargen', () => {
  it('60% de margen', () => {
    expect(calcularMargen(40, 100)).toBe(0.6)
  })
  it('precio 0 devuelve 0', () => {
    expect(calcularMargen(40, 0)).toBe(0)
  })
  it('precio negativo devuelve 0', () => {
    expect(calcularMargen(40, -100)).toBe(0)
  })
})
