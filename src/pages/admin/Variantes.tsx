import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Search, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Constants } from '../../types/database'
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { ESTAMPADO_LABELS, TIPO_PRODUCTO_LABELS } from '../../lib/catalogo'
import { formatCOP } from '../../lib/utils'
import { listVariantes, type VarianteConJoin } from '../../lib/queries/variantes'
import { VarianteImporterModal } from '../../components/VarianteImporter'

type SortKey =
  | 'sku'
  | 'producto'
  | 'tipo'
  | 'talla_color'
  | 'diseno'
  | 'costo'
  | 'precio'
  | 'margen'
  | 'stock'
type SortDir = 'asc' | 'desc'

function sortValue(v: VarianteConJoin, key: SortKey): string | number {
  switch (key) {
    case 'sku':
      return v.sku.toLowerCase()
    case 'producto':
      return (v.producto?.nombre ?? '').toLowerCase()
    case 'tipo':
      return v.producto?.tipo ?? ''
    case 'talla_color':
      return `${v.talla ?? ''} ${v.color ?? ''}`.toLowerCase()
    case 'diseno':
      return (v.diseno?.nombre ?? '').toLowerCase()
    case 'costo':
      return Number(v.costo_total ?? 0)
    case 'precio':
      return Number(v.precio_venta)
    case 'margen':
      return Number(v.margen_porcentaje ?? 0)
    case 'stock':
      return Number(v.stock_cache ?? 0)
  }
}

export default function Variantes() {
  const [rows, setRows] = useState<VarianteConJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<string>('')
  const [stockBajo, setStockBajo] = useState(false)
  const [sinImagen, setSinImagen] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'sku',
    dir: 'asc',
  })
  const [openImport, setOpenImport] = useState(false)
  const { addToast } = useToast()

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  // Carga todas las variantes una vez y filtra/ordena client-side para que
  // el search y sort abarquen columnas joineadas (producto.nombre, diseño).
  useEffect(() => {
    let cancelled = false
    listVariantes({ limit: 1000, includeInactive: true }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error.message)
        return
      }
      setRows((data as VarianteConJoin[]) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey, addToast])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = rows
    if (!includeInactive) list = list.filter(v => v.activo !== false)
    if (tipo) list = list.filter(v => v.producto?.tipo === tipo)
    if (stockBajo) list = list.filter(v => (v.stock_cache ?? 0) < 3)
    if (sinImagen) list = list.filter(v => !v.imagen_url)
    if (s) {
      list = list.filter(v => {
        const fields = [
          v.sku,
          v.producto?.nombre ?? '',
          v.color ?? '',
          v.talla ?? '',
          v.diseno?.nombre ?? '',
          v.notas ?? '',
          v.estampado ?? '',
        ]
        return fields.some(f => f.toLowerCase().includes(s))
      })
    }
    const sign = sort.dir === 'asc' ? 1 : -1
    const sorted = [...list].sort((a, b) => {
      const va = sortValue(a, sort.key)
      const vb = sortValue(b, sort.key)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
      return String(va).localeCompare(String(vb)) * sign
    })
    return sorted
  }, [rows, search, tipo, stockBajo, sinImagen, includeInactive, sort])

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  return (
    <>
      <PageHeader
        title="Variantes"
        subtitle={`${filtered.length} de ${rows.length} ${rows.length === 1 ? 'SKU' : 'SKUs'}`}
        actions={
          <Button variant="accent" onClick={() => setOpenImport(true)}>
            <Upload size={14} /> Importar CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por SKU, producto, color, talla, diseño, estampado…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipo} onChange={e => setTipo(e.target.value)} className="max-w-[180px]">
          <option value="">Todos los tipos</option>
          {Constants.public.Enums.tipo_producto.map(t => (
            <option key={t} value={t}>
              {TIPO_PRODUCTO_LABELS[t]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-2">
          <input type="checkbox" checked={stockBajo} onChange={e => setStockBajo(e.target.checked)} style={{ width: 14, height: 14 }} />
          Stock bajo (&lt;3)
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-2">
          <input type="checkbox" checked={sinImagen} onChange={e => setSinImagen(e.target.checked)} style={{ width: 14, height: 14 }} />
          Sin imagen
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-2">
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} style={{ width: 14, height: 14 }} />
          Incluir inactivas
        </label>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'Sin variantes' : 'Sin resultados'}
          description={
            rows.length === 0
              ? 'Cargá el inventario físico desde la ficha de producto o importando un CSV.'
              : 'Ajustá el buscador o los filtros.'
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <SortableTH label="SKU" sortKey="sku" current={sort} onClick={toggleSort} />
              <SortableTH label="Producto" sortKey="producto" current={sort} onClick={toggleSort} />
              <SortableTH label="Tipo" sortKey="tipo" current={sort} onClick={toggleSort} />
              <SortableTH label="Talla / Color" sortKey="talla_color" current={sort} onClick={toggleSort} />
              <SortableTH label="Diseño / Estampado" sortKey="diseno" current={sort} onClick={toggleSort} />
              <SortableTH label="Costo" sortKey="costo" current={sort} onClick={toggleSort} align="right" />
              <SortableTH label="Precio" sortKey="precio" current={sort} onClick={toggleSort} align="right" />
              <SortableTH label="Margen" sortKey="margen" current={sort} onClick={toggleSort} align="right" />
              <SortableTH label="Stock" sortKey="stock" current={sort} onClick={toggleSort} align="center" />
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map(v => (
              <TR key={v.id}>
                <TD className="font-mono text-xs">{v.sku}</TD>
                <TD className="font-medium">
                  {v.producto ? (
                    <Link
                      to={`/admin/productos/${v.producto.id}`}
                      className="hover:text-[var(--color-primary)]"
                    >
                      {v.producto.nombre}
                    </Link>
                  ) : '—'}
                </TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {v.producto ? TIPO_PRODUCTO_LABELS[v.producto.tipo] : '—'}
                </TD>
                <TD className="text-xs">{[v.talla, v.color].filter(Boolean).join(' · ') || '—'}</TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {v.diseno?.nombre ?? '—'}
                  {v.estampado && v.estampado !== 'ninguno' && (
                    <span className="block text-[10px] text-[var(--color-text-faint)]">
                      {ESTAMPADO_LABELS[v.estampado]}
                    </span>
                  )}
                </TD>
                <TD align="right" className="text-xs">{formatCOP(Number(v.costo_total ?? 0))}</TD>
                <TD align="right" className="font-medium">{formatCOP(Number(v.precio_venta))}</TD>
                <TD align="right" className="text-xs">
                  {Number(v.margen_porcentaje ?? 0).toLocaleString('es-CO', { style: 'percent', maximumFractionDigits: 1 })}
                </TD>
                <TD align="center" className={`tabular-nums font-medium ${(v.stock_cache ?? 0) < 3 ? 'text-[var(--color-accent-red)]' : ''}`}>
                  {v.stock_cache ?? 0}
                </TD>
                <TD><StatusBadge estado={v.activo ? 'activo' : 'inactivo'} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <VarianteImporterModal
        open={openImport}
        onClose={() => setOpenImport(false)}
        onDone={reload}
      />
    </>
  )
}

/**
 * Header clickeable que dispara sort por esa key. Muestra flecha
 * neutra / asc / desc según el estado actual.
 */
function SortableTH({
  label,
  sortKey,
  current,
  onClick,
  align,
}: {
  label: ReactNode
  sortKey: SortKey
  current: { key: SortKey; dir: SortDir }
  onClick: (key: SortKey) => void
  align?: 'left' | 'right' | 'center'
}) {
  const active = current.key === sortKey
  const Icon = active ? (current.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TH align={align}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 select-none hover:text-[var(--color-text)] transition-colors ${
          active ? 'text-[var(--color-text)]' : ''
        } ${align === 'right' ? 'ml-auto' : ''}`}
        style={{ minHeight: 0 }}
      >
        <span>{label}</span>
        <Icon
          size={11}
          className={active ? '' : 'opacity-40'}
        />
      </button>
    </TH>
  )
}
