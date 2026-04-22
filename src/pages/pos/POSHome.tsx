import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Constants, type Database } from '../../types/database'
import { listVariantes, type VarianteConJoin } from '../../lib/queries/variantes'
import { formatCOP } from '../../lib/utils'
import { TIPO_PRODUCTO_LABELS } from '../../lib/catalogo'
import { useToast } from '../../components/Toast'
import { VarianteDetalleModal } from '../../components/pos/VarianteDetalleModal'

type TipoProducto = Database['public']['Enums']['tipo_producto']

export default function POSHome() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<VarianteConJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<TipoProducto | ''>('')
  const [openVar, setOpenVar] = useState<VarianteConJoin | null>(null)

  useEffect(() => {
    let cancelled = false
    listVariantes({
      tipoProducto: tipo || undefined,
      includeInactive: false,
      limit: 500,
    }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) { addToast('error', error.message); return }
      setRows((data as VarianteConJoin[]) ?? [])
    })
    return () => { cancelled = true }
  }, [tipo, addToast])

  const filtered = useMemo(() => {
    if (!search) return rows
    const s = search.toLowerCase().trim()
    return rows.filter(v => {
      const nombre = v.producto?.nombre?.toLowerCase() ?? ''
      const sku = v.sku.toLowerCase()
      const color = (v.color ?? '').toLowerCase()
      const talla = (v.talla ?? '').toLowerCase()
      const diseno = (v.diseno?.nombre ?? '').toLowerCase()
      return (
        nombre.includes(s) ||
        sku.includes(s) ||
        color.includes(s) ||
        talla.includes(s) ||
        diseno.includes(s)
      )
    })
  }, [rows, search])

  return (
    <div className="pb-20">
      {/* Search sticky */}
      <div className="sticky top-14 z-20 bg-[var(--color-bg)] px-3 pt-3 pb-2 border-b border-[var(--color-border-light)]">
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU, color…"
            className="w-full h-11 pl-10 pr-10 text-[15px] rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-text-faint)]"
              aria-label="Limpiar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Chips de tipo */}
        <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 pb-0.5 scrollbar-thin">
          <Chip active={tipo === ''} onClick={() => setTipo('')}>Todas</Chip>
          {Constants.public.Enums.tipo_producto.map(t => (
            <Chip key={t} active={tipo === t} onClick={() => setTipo(t)}>
              {TIPO_PRODUCTO_LABELS[t]}
            </Chip>
          ))}
        </div>
      </div>

      {/* Grilla */}
      {loading ? (
        <div className="p-8 text-center text-sm text-[var(--color-text-label)]">Cargando catálogo…</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-text-label)]">
          {rows.length === 0 ? 'Sin variantes activas' : 'Sin resultados para tu búsqueda'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3">
          {filtered.map(v => (
            <VarianteCard key={v.id} variante={v} onTap={() => setOpenVar(v)} />
          ))}
        </div>
      )}

      <VarianteDetalleModal
        variante={openVar}
        onClose={() => setOpenVar(null)}
      />
    </div>
  )
}

/* ── Chip ────────────────────────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 h-8 text-[12px] font-medium rounded-full border transition-colors ${
        active
          ? 'bg-[var(--color-text)] text-[var(--color-surface)] border-[var(--color-text)]'
          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]'
      }`}
    >
      {children}
    </button>
  )
}

/* ── VarianteCard ────────────────────────────────────── */

function VarianteCard({ variante: v, onTap }: { variante: VarianteConJoin; onTap: () => void }) {
  const stock = v.stock_cache ?? 0
  const sinStock = stock <= 0
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={sinStock}
      className={`group card p-0 overflow-hidden text-left flex flex-col ${
        sinStock ? 'opacity-50' : 'card-hover'
      }`}
      style={{ minHeight: 180 }}
    >
      <div className="aspect-square bg-[var(--color-surface-2)] relative overflow-hidden">
        {v.imagen_url ? (
          <img
            src={v.imagen_url}
            alt={v.producto?.nombre ?? v.sku}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--color-text-faint)] font-mono p-2 text-center">
            {v.sku}
          </div>
        )}
        {stock < 3 && stock > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-[var(--color-accent-orange)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            Últimas {stock}
          </span>
        )}
        {sinStock && (
          <span className="absolute top-1.5 right-1.5 bg-[var(--color-accent-red)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            Sin stock
          </span>
        )}
      </div>
      <div className="p-2 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-[12px] font-medium text-[var(--color-text)] leading-tight line-clamp-2">
            {v.producto?.nombre ?? '—'}
          </p>
          <p className="text-[10px] text-[var(--color-text-label)] mt-0.5 truncate">
            {[v.color, v.talla].filter(Boolean).join(' · ') || '—'}
            {v.diseno && ` · ${v.diseno.nombre}`}
          </p>
        </div>
        <p className="text-sm font-bold text-[var(--color-text)] tabular-nums mt-1.5">
          {formatCOP(Number(v.precio_venta))}
        </p>
      </div>
    </button>
  )
}
