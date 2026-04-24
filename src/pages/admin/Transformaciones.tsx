import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import {
  PageHeader,
  Button,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  EmptyState,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate } from '../../lib/utils'
import { ESTAMPADO_LABELS } from '../../lib/catalogo'
import {
  listTransformaciones,
  type TransformacionConJoin,
} from '../../lib/queries/transformaciones'

export default function Transformaciones() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<TransformacionConJoin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listTransformaciones({ limit: 100 }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error.message)
        return
      }
      setRows((data as TransformacionConJoin[]) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [addToast])

  return (
    <div>
      <PageHeader
        title="Transformaciones"
        subtitle="Básicas → estampadas. Ajusta inventario de las dos variantes."
        actions={
          <Link to="/admin/transformaciones/nueva">
            <Button variant="primary" size="sm">
              <Plus size={14} /> Nueva transformación
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin transformaciones registradas"
          description="Usá esta sección para convertir básicas en estampadas (ej. 2 camisas negras M → 2 camisas Pulp Fiction)."
          action={
            <Link to="/admin/transformaciones/nueva">
              <Button variant="primary" size="sm">
                <Plus size={14} /> Registrar primera
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Origen</TH>
              <TH />
              <TH>Destino</TH>
              <TH align="center">Cant.</TH>
              <TH align="right">Costo/unit</TH>
              <TH align="right">Total</TH>
              <TH>Notas</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(t => (
              <TR key={t.id}>
                <TD>{formatDate(t.fecha)}</TD>
                <TD>
                  <VarianteCell v={t.origen} />
                </TD>
                <TD>
                  <ArrowRight size={14} className="text-[var(--color-text-faint)]" />
                </TD>
                <TD>
                  <VarianteCell v={t.destino} />
                </TD>
                <TD align="center">
                  <span className="tabular-nums font-semibold">{t.cantidad}</span>
                </TD>
                <TD align="right">{formatCOP(Number(t.costo_estampado_unit))}</TD>
                <TD align="right" className="font-semibold">
                  {formatCOP(Number(t.costo_total ?? 0))}
                </TD>
                <TD
                  className="max-w-[200px] truncate text-xs text-[var(--color-text-label)]"
                  title={t.notas ?? ''}
                >
                  {t.notas ?? '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

function VarianteCell({ v }: { v: TransformacionConJoin['origen'] }) {
  if (!v) return <span className="text-[var(--color-text-faint)]">—</span>
  return (
    <div className="text-xs">
      <p className="font-medium">{v.producto?.nombre ?? '—'}</p>
      <p className="text-[var(--color-text-label)]">
        {[v.color, v.talla].filter(Boolean).join(' · ')}
        {v.diseno && ` · ${v.diseno.nombre}`}
      </p>
      {v.estampado && v.estampado !== 'ninguno' && (
        <p className="text-[10px] text-[var(--color-text-faint)] italic">
          {ESTAMPADO_LABELS[v.estampado]}
        </p>
      )}
    </div>
  )
}
