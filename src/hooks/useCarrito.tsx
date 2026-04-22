/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type CarritoItem = {
  varianteId: string
  sku: string
  nombre: string          // "Camisa Oversize Peruana · Negro · L"
  imagenUrl: string | null
  precioVenta: number     // precio de la variante (referencia)
  costoUnitario: number   // snapshot del costo_total al agregar
  cantidad: number
  precioAplicado: number  // puede diferir del precio_venta (editable en POS)
}

type CarritoCtx = {
  items: CarritoItem[]
  subtotal: number
  count: number
  add: (item: Omit<CarritoItem, 'cantidad'>) => void
  updateCantidad: (varianteId: string, cantidad: number) => void
  updatePrecio: (varianteId: string, precio: number) => void
  remove: (varianteId: string) => void
  clear: () => void
}

const Ctx = createContext<CarritoCtx | null>(null)

export function useCarrito(): CarritoCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CarritoItem[]>([])

  const add = useCallback((item: Omit<CarritoItem, 'cantidad'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.varianteId === item.varianteId && i.precioAplicado === item.precioAplicado)
      if (existing) {
        return prev.map(i =>
          i.varianteId === existing.varianteId && i.precioAplicado === existing.precioAplicado
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        )
      }
      return [...prev, { ...item, cantidad: 1 }]
    })
  }, [])

  const updateCantidad = useCallback((varianteId: string, cantidad: number) => {
    setItems(prev =>
      cantidad <= 0
        ? prev.filter(i => i.varianteId !== varianteId)
        : prev.map(i => (i.varianteId === varianteId ? { ...i, cantidad } : i)),
    )
  }, [])

  const updatePrecio = useCallback((varianteId: string, precio: number) => {
    setItems(prev => prev.map(i => (i.varianteId === varianteId ? { ...i, precioAplicado: precio } : i)))
  }, [])

  const remove = useCallback((varianteId: string) => {
    setItems(prev => prev.filter(i => i.varianteId !== varianteId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.cantidad * i.precioAplicado, 0),
    [items],
  )
  const count = useMemo(() => items.reduce((s, i) => s + i.cantidad, 0), [items])

  const value = useMemo(
    () => ({ items, subtotal, count, add, updateCantidad, updatePrecio, remove, clear }),
    [items, subtotal, count, add, updateCantidad, updatePrecio, remove, clear],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
