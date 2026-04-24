import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserRound } from 'lucide-react'
import {
  PageHeader,
  Input,
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
import { listClientes, type Cliente } from '../../lib/queries/clientes'

export default function Clientes() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [rows, setRows] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    listClientes({ limit: 1000 }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error.message)
        return
      }
      setRows(data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [addToast])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(c => {
      const fields = [
        c.nombre,
        c.telefono ?? '',
        c.email ?? '',
        c.instagram ?? '',
        c.notas ?? '',
      ]
      return fields.some(f => f.toLowerCase().includes(s))
    })
  }, [rows, search])

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${filtered.length} de ${rows.length} clientes`}
      />

      {rows.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
          />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, teléfono, email, instagram…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin clientes"
          description="Los clientes se crean desde el POS al cobrar una venta con teléfono."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Ajustá el buscador."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Teléfono</TH>
              <TH align="center">Compras</TH>
              <TH align="right">Total comprado</TH>
              <TH>Primera compra</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map(c => (
              <TR
                key={c.id}
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
              >
                <TD className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
                      <UserRound size={14} className="text-[var(--color-text-muted)]" />
                    </div>
                    <span>{c.nombre}</span>
                  </div>
                </TD>
                <TD className="text-[var(--color-text-muted)] font-mono text-xs">
                  {c.telefono ?? '—'}
                </TD>
                <TD align="center">
                  <span className="font-semibold tabular-nums">
                    {c.num_compras_cache ?? 0}
                  </span>
                </TD>
                <TD align="right" className="font-semibold">
                  {formatCOP(Number(c.total_comprado_cache ?? 0))}
                </TD>
                <TD className="text-xs text-[var(--color-text-muted)]">
                  {formatDate(c.primera_compra_fecha)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
