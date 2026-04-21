import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Upload } from 'lucide-react'
import { Constants, type Database } from '../../types/database'

type TipoProducto = Database['public']['Enums']['tipo_producto']
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

export default function Variantes() {
  const [rows, setRows] = useState<VarianteConJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<string>('')
  const [stockBajo, setStockBajo] = useState(false)
  const [sinImagen, setSinImagen] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const { addToast } = useToast()

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    let cancelled = false
    listVariantes({
      search: search || undefined,
      tipoProducto: (tipo || undefined) as TipoProducto | undefined,
      stockBajo,
      sinImagen,
      includeInactive,
      limit: 200,
    }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) { addToast('error', error.message); return }
      setRows((data as VarianteConJoin[]) ?? [])
    })
    return () => { cancelled = true }
  }, [search, tipo, stockBajo, sinImagen, includeInactive, reloadKey, addToast])

  return (
    <>
      <PageHeader
        title="Variantes"
        subtitle={`${rows.length} SKU${rows.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="accent" onClick={() => setOpenImport(true)}>
            <Upload size={14} /> Importar CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por SKU, color o talla…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={tipo} onChange={e => setTipo(e.target.value)} className="max-w-[180px]">
          <option value="">Todos los tipos</option>
          {Constants.public.Enums.tipo_producto.map(t => (
            <option key={t} value={t}>{TIPO_PRODUCTO_LABELS[t]}</option>
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
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin variantes"
          description="Cargá el inventario físico desde la ficha de producto o importando un CSV."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Producto</TH>
              <TH>Tipo</TH>
              <TH>Talla / Color</TH>
              <TH>Diseño / Estampado</TH>
              <TH align="right">Costo</TH>
              <TH align="right">Precio</TH>
              <TH align="right">Margen</TH>
              <TH align="right">Stock</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(v => (
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
                <TD align="right" className={`tabular-nums font-medium ${(v.stock_cache ?? 0) < 3 ? 'text-[var(--color-accent-red)]' : ''}`}>
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
