import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCOP } from '@/lib/format'
import type { InventarioRow } from '@/types/database'

type Filtro = 'todos' | 'basico' | 'estampado' | 'replica' | 'stock_bajo' | 'sin_stock'

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'basico', label: 'Básico' },
  { value: 'estampado', label: 'Estampado' },
  { value: 'replica', label: 'Réplica' },
  { value: 'stock_bajo', label: 'Stock bajo' },
  { value: 'sin_stock', label: 'Sin stock' },
]

export default function Inventario() {
  const [items, setItems] = useState<InventarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('v_inventario').select('*')
    if (data) setItems(data as unknown as InventarioRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter((item) => {
    const searchMatch = busqueda === '' ||
      item.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.sku.toLowerCase().includes(busqueda.toLowerCase())

    if (!searchMatch) return false

    switch (filtro) {
      case 'basico': return !item.diseno && !item.producto_tipo.includes('plica')
      case 'estampado': return !!item.diseno
      case 'replica': return item.producto_nombre.toLowerCase().includes('réplica') || item.producto_nombre.toLowerCase().includes('replica')
      case 'stock_bajo': return item.alerta_stock_bajo
      case 'sin_stock': return item.sin_stock
      default: return true
    }
  })

  const totalUnidades = filtered.reduce((s, i) => s + i.stock, 0)
  const totalCosto = filtered.reduce((s, i) => s + i.stock * i.costo, 0)
  const totalVenta = filtered.reduce((s, i) => s + i.stock * i.precio_venta, 0)

  return (
    <div className="p-4 space-y-3">
      {/* Búsqueda */}
      <input
        type="text"
        placeholder="Buscar por nombre o SKU..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
      />

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {FILTROS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFiltro(value)}
            className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border transition-colors ${
              filtro === value
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-text-secondary border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div className="flex gap-3 text-xs text-text-muted">
        <span>{totalUnidades} uds</span>
        <span>Costo: {formatCOP(totalCosto)}</span>
        <span>Venta: {formatCOP(totalVenta)}</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">No se encontraron variantes</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <InventarioCard key={item.id} item={item} onUpdate={load} />
          ))}
        </div>
      )}

      {/* Botón agregar */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full py-2.5 text-sm border border-dashed border-border-light rounded-lg text-text-secondary hover:border-accent hover:text-accent transition-colors"
      >
        + Agregar variante
      </button>

      {showAdd && <AddVarianteForm onDone={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function InventarioCard({ item, onUpdate }: { item: InventarioRow; onUpdate: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const stockColor = item.sin_stock ? 'text-danger' : item.alerta_stock_bajo ? 'text-warning' : 'text-text'

  async function save(field: 'stock' | 'precio_venta' | 'costo') {
    const val = parseInt(editValue)
    if (isNaN(val) || val < 0) { setEditing(null); return }

    if (field === 'stock') {
      const diff = val - item.stock
      if (diff !== 0) {
        await supabase.from('variantes').update({ stock: val }).eq('id', item.id)
        await supabase.from('movimientos_inv').insert({
          variante_id: item.id,
          tipo: 'ajuste',
          cantidad: diff,
          stock_resultante: val,
          notas: 'Ajuste manual desde inventario',
        })
      }
    } else {
      await supabase.from('variantes').update({ [field]: val }).eq('id', item.id)
    }
    setEditing(null)
    onUpdate()
  }

  function startEdit(field: string, value: number) {
    setEditing(field)
    setEditValue(String(value))
  }

  return (
    <div className="bg-surface rounded-lg p-3 border border-border">
      <div className="flex justify-between items-start mb-1">
        <div>
          <p className="text-sm font-medium">{item.producto_nombre}</p>
          <p className="text-xs text-text-muted">{item.sku}</p>
        </div>
        {item.diseno && (
          <span className="text-[10px] bg-accent-dim text-accent px-2 py-0.5 rounded-full">{item.diseno}</span>
        )}
      </div>
      <div className="flex gap-4 text-xs mt-2">
        <span className="text-text-muted">{item.talla} · {item.color}</span>

        {/* Stock inline edit */}
        <span className="flex items-center gap-1">
          <span className="text-text-muted">Stock:</span>
          {editing === 'stock' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => save('stock')}
              onKeyDown={(e) => e.key === 'Enter' && save('stock')}
              className="w-12 bg-bg border border-accent rounded px-1 py-0.5 text-xs text-text focus:outline-none"
              autoFocus
            />
          ) : (
            <button onClick={() => startEdit('stock', item.stock)} className={`${stockColor} font-semibold hover:underline`}>
              {item.stock}
            </button>
          )}
        </span>

        {/* Precio inline edit */}
        <span className="flex items-center gap-1">
          <span className="text-text-muted">$</span>
          {editing === 'precio_venta' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => save('precio_venta')}
              onKeyDown={(e) => e.key === 'Enter' && save('precio_venta')}
              className="w-20 bg-bg border border-accent rounded px-1 py-0.5 text-xs text-text focus:outline-none"
              autoFocus
            />
          ) : (
            <button onClick={() => startEdit('precio_venta', item.precio_venta)} className="text-text hover:underline">
              {formatCOP(item.precio_venta).replace('$', '').trim()}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

function AddVarianteForm({ onDone }: { onDone: () => void }) {
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [form, setForm] = useState({
    producto_id: '', sku: '', talla: '', color: '', diseno: '',
    costo: '', precio_venta: '', stock: '0',
  })

  useEffect(() => {
    supabase.from('productos').select('id, nombre').eq('activo', true).then(({ data }) => {
      if (data) setProductos(data)
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('variantes').insert({
      producto_id: form.producto_id,
      sku: form.sku.toUpperCase(),
      talla: form.talla,
      color: form.color,
      diseno: form.diseno || null,
      costo: parseInt(form.costo),
      precio_venta: parseInt(form.precio_venta),
      stock: parseInt(form.stock),
    })
    if (!error) onDone()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const inputCls = 'w-full bg-bg border border-border rounded px-2 py-2 text-sm text-text focus:outline-none focus:border-accent'

  return (
    <form onSubmit={submit} className="bg-surface rounded-lg p-4 border border-accent/30 space-y-3">
      <select value={form.producto_id} onChange={set('producto_id')} required className={inputCls}>
        <option value="">Seleccionar producto...</option>
        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="SKU" value={form.sku} onChange={set('sku')} required className={inputCls} />
        <input placeholder="Talla" value={form.talla} onChange={set('talla')} required className={inputCls} />
        <input placeholder="Color" value={form.color} onChange={set('color')} required className={inputCls} />
      </div>
      <input placeholder="Diseño (opcional)" value={form.diseno} onChange={set('diseno')} className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="Costo" type="number" value={form.costo} onChange={set('costo')} required className={inputCls} />
        <input placeholder="Precio venta" type="number" value={form.precio_venta} onChange={set('precio_venta')} required className={inputCls} />
        <input placeholder="Stock" type="number" value={form.stock} onChange={set('stock')} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 py-2 bg-accent text-white text-sm rounded-lg font-medium">
          Guardar
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg">
          Cancelar
        </button>
      </div>
    </form>
  )
}
