import { useState, useEffect } from 'react'
import { Search, User, X, CheckCircle2 } from 'lucide-react'
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
 * Flujo de cliente en el cobro. Tres estados:
 *   1. Sin teléfono → muestra solo el input de búsqueda.
 *   2. Con teléfono (≥3 dígitos) y resultados → muestra lista seleccionable
 *      + form inline para crear si el cliente no está.
 *   3. Con teléfono y sin resultados → muestra form inline de crear AUTO
 *      (el usuario no tiene que apretar "crear" primero).
 *
 * Al crear o seleccionar dispara toast explícito para que el vendedor
 * sepa que el cliente quedó asociado.
 */
export function ClienteSearchInput({
  value,
  onChange,
}: {
  value: Cliente | null
  onChange: (cliente: Cliente | null) => void
}) {
  const { addToast } = useToast()
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [results, setResults] = useState<ClienteListItem[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  // Búsqueda debounced
  useEffect(() => {
    if (value) return
    let cancelled = false
    const t = setTimeout(async () => {
      const soloDigitos = telefono.replace(/[^\d]/g, '')
      if (soloDigitos.length < 3) {
        if (!cancelled) {
          setResults([])
          setSearching(false)
        }
        return
      }
      if (!cancelled) setSearching(true)
      const { data } = await buscarClientesPorTelefono(telefono)
      if (!cancelled) {
        setResults(data ?? [])
        setSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [telefono, value])

  async function handleCrear() {
    const tel = telefono.trim()
    const name = nombre.trim()
    if (!name || !tel) {
      addToast('warning', 'Completá nombre y teléfono para crear cliente')
      return
    }
    setCreating(true)
    const { data, error } = await crearCliente({ nombre: name, telefono: tel })
    setCreating(false)
    if (error || !data) {
      addToast('error', error?.message ?? 'Error creando cliente')
      return
    }
    addToast('success', `Cliente "${data.nombre}" creado y asociado a la venta`)
    onChange(data)
    setTelefono('')
    setNombre('')
    setResults([])
  }

  function handleSeleccionar(c: ClienteListItem) {
    onChange(c as Cliente)
    addToast('success', `Cliente "${c.nombre}" asociado a la venta`)
  }

  // ESTADO: cliente seleccionado → card prominente verde
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900 truncate">
              {value.nombre}
            </p>
            <p className="text-[11px] text-emerald-700 truncate">
              {value.telefono ?? 'sin teléfono'} · asociado a esta venta
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-md active:bg-emerald-100 shrink-0"
          aria-label="Quitar cliente"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  const soloDigitos = telefono.replace(/[^\d]/g, '')
  const haBusqueda = soloDigitos.length >= 3
  const sinResultados = haBusqueda && !searching && results.length === 0

  return (
    <div className="space-y-2">
      {/* Input teléfono */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
        />
        <input
          type="tel"
          value={telefono}
          onChange={e => setTelefono(e.target.value)}
          placeholder="Teléfono del cliente (opcional)"
          className="w-full h-11 pl-9 pr-3 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
          inputMode="numeric"
          autoComplete="off"
        />
      </div>

      {/* Resultados existentes */}
      {haBusqueda && results.length > 0 && (
        <ul className="border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border-light)]">
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handleSeleccionar(c)}
                className="w-full text-left p-2.5 active:bg-[var(--color-surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <User size={14} className="text-[var(--color-text-muted)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.nombre}</p>
                    <p className="text-[11px] text-[var(--color-text-label)] truncate">
                      {c.telefono ?? 'sin tel'}
                      {c.num_compras_cache && c.num_compras_cache > 0
                        ? ` · ${c.num_compras_cache} compras · ${formatCOP(Number(c.total_comprado_cache ?? 0), { short: true })}`
                        : ''}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Form de crear (auto-show si no hay resultados) */}
      {(sinResultados || (haBusqueda && results.length > 0)) && (
        <div
          className={`rounded-lg border p-3 space-y-2 ${
            sinResultados
              ? 'border-amber-300 bg-amber-50'
              : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <p className="text-xs font-semibold text-[var(--color-text)]">
            {sinResultados
              ? 'Cliente no existe — creá uno nuevo'
              : '¿No encontrás? Crear cliente nuevo'}
          </p>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full h-10 px-3 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={handleCrear}
            disabled={creating || !nombre.trim() || !telefono.trim()}
            className="w-full h-10 text-sm rounded-md bg-[var(--color-text)] text-[var(--color-surface)] font-semibold disabled:opacity-40 active:brightness-90"
          >
            {creating ? 'Creando…' : `Crear y asociar "${nombre.trim() || '…'}"`}
          </button>
        </div>
      )}

      {searching && (
        <p className="text-[11px] text-[var(--color-text-faint)] text-center py-1">
          Buscando…
        </p>
      )}
    </div>
  )
}
