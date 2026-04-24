import { useState, useEffect } from 'react'
import { Search, Plus, User, X } from 'lucide-react'
import {
  buscarClientesPorTelefono,
  crearCliente,
  type Cliente,
} from '../../lib/queries/clientes'
import { formatCOP } from '../../lib/utils'
import { useToast } from '../Toast'

type ClienteListItem = Pick<
  Cliente,
  'id' | 'nombre' | 'telefono' | 'num_compras_cache' | 'total_comprado_cache'
>

/**
 * Input de búsqueda de cliente por teléfono con opción a crear al vuelo.
 * El parent pasa el cliente seleccionado (o null) y recibe cambios.
 */
export function ClienteSearchInput({
  value,
  onChange,
}: {
  value: Cliente | null
  onChange: (cliente: Cliente | null) => void
}) {
  const { addToast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClienteListItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  useEffect(() => {
    if (value) return // ya seleccionado, no buscar
    let cancelled = false
    const t = setTimeout(async () => {
      const solo_digitos = query.replace(/[^\d]/g, '')
      if (solo_digitos.length < 3) {
        if (!cancelled) setResults([])
        return
      }
      const { data } = await buscarClientesPorTelefono(query)
      if (!cancelled) setResults(data ?? [])
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, value])

  async function handleCrear() {
    const telefono = query.trim()
    const nombre = nuevoNombre.trim()
    if (!nombre || !telefono) return
    setCreating(true)
    const { data, error } = await crearCliente({ nombre, telefono })
    setCreating(false)
    if (error || !data) {
      addToast('error', error?.message ?? 'Error creando cliente')
      return
    }
    onChange(data)
    setQuery('')
    setShowCreate(false)
    setNuevoNombre('')
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
            <User size={16} className="text-[var(--color-text-muted)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{value.nombre}</p>
            <p className="text-[11px] text-[var(--color-text-label)] truncate">
              {value.telefono ?? 'sin teléfono'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1.5 text-[var(--color-text-label)] rounded-md active:bg-[var(--color-surface-2)] shrink-0"
          aria-label="Quitar cliente"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  if (showCreate) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          Crear cliente nuevo
        </p>
        <input
          type="tel"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Teléfono"
          className="w-full h-10 px-3 text-sm"
          inputMode="numeric"
        />
        <input
          type="text"
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          placeholder="Nombre"
          className="w-full h-10 px-3 text-sm"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowCreate(false)
              setNuevoNombre('')
            }}
            className="flex-1 h-9 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCrear}
            disabled={creating || !nuevoNombre.trim() || !query.trim()}
            className="flex-1 h-9 text-xs rounded-md bg-[var(--color-text)] text-[var(--color-surface)] font-medium disabled:opacity-40"
          >
            {creating ? 'Creando…' : 'Crear y asociar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
        />
        <input
          type="tel"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por teléfono (opcional)"
          className="w-full h-10 pl-9 pr-3 text-sm"
          inputMode="numeric"
        />
      </div>
      {query.replace(/[^\d]/g, '').length >= 3 && (
        <>
          {results.length > 0 && (
            <ul className="border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border-light)]">
              {results.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onChange(c as Cliente)}
                    className="w-full text-left p-2.5 active:bg-[var(--color-surface-2)]"
                  >
                    <p className="text-sm font-medium">{c.nombre}</p>
                    <p className="text-[11px] text-[var(--color-text-label)]">
                      {c.telefono ?? 'sin tel'}
                      {c.num_compras_cache && c.num_compras_cache > 0
                        ? ` · ${c.num_compras_cache} compras · ${formatCOP(Number(c.total_comprado_cache ?? 0), { short: true })}`
                        : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-1.5 h-9 text-xs text-[var(--color-text-muted)] rounded-md border border-dashed border-[var(--color-border)]"
          >
            <Plus size={14} /> Crear cliente con este teléfono
          </button>
        </>
      )}
    </div>
  )
}
