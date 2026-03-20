import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import type { InventarioRow, CartItem } from '@/types/database'

type Paso = 'buscar' | 'confirmar' | 'exito'
type MetodoPago = 'Efectivo' | 'Transferencia' | 'Datáfono' | 'Crédito'
type Responsable = 'JP' | 'Andrés' | 'Kathe'

export default function VentaRapida() {
  const [paso, setPaso] = useState<Paso>('buscar')
  const [items, setItems] = useState<InventarioRow[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [responsable, setResponsable] = useState<Responsable>('JP')
  const [cliente, setCliente] = useState('')
  const [notas, setNotas] = useState('')
  const [totalVenta, setTotalVenta] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('v_inventario').select('*')
    if (data) setItems(data as unknown as InventarioRow[])
  }, [])

  useEffect(() => { load() }, [load])

  const disponibles = items.filter(
    (i) => i.stock > 0 && (
      busqueda === '' ||
      i.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.sku.toLowerCase().includes(busqueda.toLowerCase())
    )
  )

  const total = cart.reduce((s, c) => s + c.precio_unitario * c.cantidad, 0)

  function addToCart(item: InventarioRow) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variante.id === item.id)
      if (existing) {
        if (existing.cantidad >= item.stock) return prev
        return prev.map((c) =>
          c.variante.id === item.id ? { ...c, cantidad: c.cantidad + 1 } : c
        )
      }
      return [...prev, { variante: item, cantidad: 1, precio_unitario: item.precio_venta }]
    })
  }

  function removeFromCart(varianteId: string) {
    setCart((prev) => prev.filter((c) => c.variante.id !== varianteId))
  }

  function updateCartQty(varianteId: string, qty: number) {
    if (qty <= 0) { removeFromCart(varianteId); return }
    setCart((prev) =>
      prev.map((c) =>
        c.variante.id === varianteId ? { ...c, cantidad: Math.min(qty, c.variante.stock) } : c
      )
    )
  }

  function updateCartPrice(varianteId: string, price: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.variante.id === varianteId ? { ...c, precio_unitario: price } : c
      )
    )
  }

  async function confirmarVenta() {
    if (cart.length === 0 || submitting) return
    setSubmitting(true)

    const { data: venta, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        metodo_pago: metodoPago,
        responsable,
        cliente: cliente || null,
        notas: notas || null,
      })
      .select('id')
      .single()

    if (ventaError || !venta) { setSubmitting(false); return }

    const itemsToInsert = cart.map((c) => ({
      venta_id: venta.id,
      variante_id: c.variante.id,
      cantidad: c.cantidad,
      precio_unitario: c.precio_unitario,
    }))

    const { error: itemsError } = await supabase.from('items_venta').insert(itemsToInsert)

    if (!itemsError) {
      setTotalVenta(total)
      setPaso('exito')
    }
    setSubmitting(false)
  }

  function nuevaVenta() {
    setCart([])
    setBusqueda('')
    setCliente('')
    setNotas('')
    setPaso('buscar')
    load()
  }

  // PASO 3: Éxito
  if (paso === 'exito') {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Venta registrada</h2>
        <p className="text-2xl font-bold text-accent">{formatCOP(totalVenta)}</p>
        <p className="text-sm text-text-muted">Inventario actualizado automáticamente</p>
        <div className="flex gap-3 mt-4 w-full">
          <button onClick={nuevaVenta} className="flex-1 py-3 bg-accent text-white rounded-lg font-medium text-sm">
            Nueva venta
          </button>
          <a href="/" className="flex-1 py-3 border border-border rounded-lg text-sm text-text-secondary text-center">
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  // PASO 2: Confirmar
  if (paso === 'confirmar') {
    return (
      <div className="p-4 space-y-4">
        <button onClick={() => setPaso('buscar')} className="text-sm text-text-muted flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver
        </button>

        <h2 className="text-lg font-bold">Confirmar venta</h2>

        {/* Items */}
        <div className="space-y-2">
          {cart.map((c) => (
            <div key={c.variante.id} className="bg-surface rounded-lg p-3 border border-border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium">{c.variante.producto_nombre}</p>
                  <p className="text-xs text-text-muted">{c.variante.sku} · {c.variante.talla} · {c.variante.color}</p>
                </div>
                <button onClick={() => removeFromCart(c.variante.id)} className="text-text-muted hover:text-danger">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Cant:</span>
                  <div className="flex items-center border border-border rounded">
                    <button onClick={() => updateCartQty(c.variante.id, c.cantidad - 1)} className="px-2 py-1 text-text-muted hover:text-text">-</button>
                    <span className="px-2 text-sm">{c.cantidad}</span>
                    <button onClick={() => updateCartQty(c.variante.id, c.cantidad + 1)} className="px-2 py-1 text-text-muted hover:text-text">+</button>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-text-muted">Precio:</span>
                  <input
                    type="number"
                    value={c.precio_unitario}
                    onChange={(e) => updateCartPrice(c.variante.id, parseInt(e.target.value) || 0)}
                    className="w-full bg-bg border border-border rounded px-2 py-1 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Método de pago */}
        <div>
          <label className="text-xs text-text-muted mb-1 block">Método de pago</label>
          <div className="grid grid-cols-4 gap-2">
            {(['Efectivo', 'Transferencia', 'Datáfono', 'Crédito'] as MetodoPago[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                className={`py-2 text-xs rounded-lg border transition-colors ${
                  metodoPago === m ? 'bg-accent text-white border-accent' : 'bg-surface text-text-secondary border-border'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Responsable */}
        <div>
          <label className="text-xs text-text-muted mb-1 block">Responsable</label>
          <div className="grid grid-cols-3 gap-2">
            {(['JP', 'Andrés', 'Kathe'] as Responsable[]).map((r) => (
              <button
                key={r}
                onClick={() => setResponsable(r)}
                className={`py-2 text-sm rounded-lg border transition-colors ${
                  responsable === r ? 'bg-accent text-white border-accent' : 'bg-surface text-text-secondary border-border'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Cliente y notas */}
        <input
          type="text"
          placeholder="Cliente (opcional)"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          placeholder="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {/* Total y confirmar */}
        <div className="bg-surface rounded-xl p-4 border border-accent/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-text-secondary">Total</span>
            <span className="text-2xl font-bold text-accent">{formatCOP(total)}</span>
          </div>
          <button
            onClick={confirmarVenta}
            disabled={submitting}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Procesando...' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    )
  }

  // PASO 1: Buscar y agregar
  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold">Venta rápida</h2>

      <input
        type="text"
        placeholder="Buscar producto o SKU..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        autoFocus
      />

      {/* Lista de productos disponibles */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto hide-scrollbar">
        {disponibles.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">
            {items.length === 0 ? 'Cargando...' : 'No hay productos con stock'}
          </p>
        ) : (
          disponibles.map((item) => {
            const inCart = cart.find((c) => c.variante.id === item.id)
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="w-full bg-surface hover:bg-surface-hover rounded-lg p-3 border border-border text-left transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {item.producto_nombre}
                      <span className="text-text-muted font-normal"> · {item.talla} · {item.color}</span>
                    </p>
                    <p className="text-xs text-text-muted">{item.sku} · Stock: {item.stock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCOP(item.precio_venta)}</p>
                    {inCart && (
                      <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded">x{inCart.cantidad}</span>
                    )}
                  </div>
                </div>
                {item.diseno && (
                  <span className="inline-block mt-1 text-[10px] bg-accent-dim text-accent px-2 py-0.5 rounded-full">
                    {item.diseno}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Carrito flotante */}
      {cart.length > 0 && (
        <div
          className="fixed bottom-20 left-4 right-4 bg-surface border border-accent/30 rounded-xl p-4 shadow-lg shadow-black/50 cursor-pointer"
          onClick={() => setPaso('confirmar')}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold">
                {cart.reduce((s, c) => s + c.cantidad, 0)} {cart.reduce((s, c) => s + c.cantidad, 0) === 1 ? 'item' : 'items'}
              </p>
              <p className="text-xs text-text-muted">Tap para confirmar</p>
            </div>
            <span className="text-lg font-bold text-accent">{formatCOP(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
