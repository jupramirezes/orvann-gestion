import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Minus, Plus, RotateCcw, Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/Toast'
import { formatCOP, formatShortDateTime } from '../../lib/utils'
import { POSFooterFixed } from '../../components/pos/POSFooterFixed'
import {
  buscarVentasParaDevolver,
  getVentaConItems,
  unidadesYaDevueltas,
  createDevolucion,
  type VentaBuscable,
  type VentaItemConVariante,
} from '../../lib/queries/devoluciones'

/**
 * Devoluciones desde el POS. Flujo:
 *   1. Buscar venta por teléfono del cliente o por fecha reciente
 *   2. Ver items con unidades disponibles (original - ya devuelto)
 *   3. Marcar cuántas unidades de cada ítem devolver
 *   4. Confirmar → crea venta tipo_transaccion='devolucion' que
 *      reintegra stock al inventario (via trigger).
 */
export default function Devoluciones() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VentaBuscable[]>([])
  const [searching, setSearching] = useState(false)

  const [ventaSeleccionada, setVentaSeleccionada] = useState<string | null>(null)
  const [items, setItems] = useState<VentaItemConVariante[]>([])
  const [yaDevueltas, setYaDevueltas] = useState<Record<string, number>>({})
  const [cantDevolver, setCantDevolver] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  // Busca al tipear (debounced)
  useEffect(() => {
    if (ventaSeleccionada) return
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await buscarVentasParaDevolver({
        telefono: query.trim() || undefined,
        limit: 20,
      })
      if (cancelled) return
      setSearching(false)
      setResults(data ?? [])
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, ventaSeleccionada])

  async function abrirVenta(ventaId: string) {
    const [{ items: its, error }, { data: ya }] = await Promise.all([
      getVentaConItems(ventaId),
      unidadesYaDevueltas(ventaId),
    ])
    if (error) {
      addToast('error', error)
      return
    }
    setVentaSeleccionada(ventaId)
    setItems(its)
    setYaDevueltas(ya)
    setCantDevolver({})
  }

  function cerrarVenta() {
    setVentaSeleccionada(null)
    setItems([])
    setYaDevueltas({})
    setCantDevolver({})
  }

  function setCant(itemId: string, n: number) {
    setCantDevolver(prev => ({ ...prev, [itemId]: Math.max(0, n) }))
  }

  const totalDevolucion = items.reduce((sum, it) => {
    const n = cantDevolver[it.id] ?? 0
    return sum + n * Number(it.precio_unitario)
  }, 0)

  const totalUnidades = Object.values(cantDevolver).reduce((a, b) => a + b, 0)

  const puedeConfirmar =
    !!ventaSeleccionada && totalUnidades > 0 && !submitting

  async function handleConfirmar() {
    if (!puedeConfirmar || !ventaSeleccionada) return
    if (
      !confirm(
        `Confirmar devolución de ${totalUnidades} ${totalUnidades === 1 ? 'unidad' : 'unidades'} por ${formatCOP(totalDevolucion)}?`,
      )
    ) {
      return
    }

    setSubmitting(true)
    const itemsPayload = items
      .filter(it => (cantDevolver[it.id] ?? 0) > 0)
      .map(it => ({
        variante_id: it.variante_id,
        cantidad: cantDevolver[it.id] ?? 0,
        precio_unitario: Number(it.precio_unitario),
        costo_unitario: Number(it.costo_unitario),
      }))

    const { error } = await createDevolucion({
      ventaOriginalId: ventaSeleccionada,
      items: itemsPayload,
      vendedorId: user?.id ?? null,
    })

    setSubmitting(false)
    if (error) {
      addToast('error', error)
      return
    }
    addToast('success', 'Devolución registrada — stock reintegrado')
    navigate('/pos', { replace: true })
  }

  // Vista 2: venta seleccionada con items a devolver
  if (ventaSeleccionada) {
    return (
      <div className="pb-40">
        <div className="bg-[var(--color-bg)] border-b border-[var(--color-border-light)] px-4 py-3">
          <button
            type="button"
            onClick={cerrarVenta}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
          >
            <ArrowLeft size={16} /> Elegir otra venta
          </button>
          <h1 className="text-xl font-bold text-[var(--color-text)] mt-1">
            Devolver ítems
          </h1>
          <p className="text-xs text-[var(--color-text-label)] mt-0.5">
            Marcá las unidades a devolver y confirmá.
          </p>
        </div>

        <div className="p-4">
          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-text-label)] text-center py-6">
              Esta venta no tiene ítems.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map(it => {
                const ya = yaDevueltas[it.variante_id] ?? 0
                const disponible = Math.max(0, it.cantidad - ya)
                const devolver = cantDevolver[it.id] ?? 0
                const sinStock = disponible === 0
                return (
                  <li
                    key={it.id}
                    className={`rounded-lg border p-3 ${
                      sinStock
                        ? 'border-[var(--color-border-light)] bg-[var(--color-surface-2)] opacity-60'
                        : devolver > 0
                          ? 'border-[var(--color-text)] bg-[var(--color-surface)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    }`}
                  >
                    <p className="text-sm font-medium leading-tight">
                      {it.variante?.producto?.nombre ?? '—'}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {[it.variante?.color, it.variante?.talla].filter(Boolean).join(' · ')}
                      {' · '}
                      <span className="font-mono">{it.variante?.sku ?? '—'}</span>
                    </p>
                    <p className="text-[11px] text-[var(--color-text-label)] mt-0.5">
                      Vendidas: {it.cantidad}
                      {ya > 0 && (
                        <span className="text-[var(--color-accent-orange)]">
                          {' '}· Ya devueltas: {ya}
                        </span>
                      )}
                      <span className="text-[var(--color-text-muted)]">
                        {' '}· Disponibles: {disponible}
                      </span>
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-label)]">
                        {formatCOP(Number(it.precio_unitario))}/u
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCant(it.id, devolver - 1)}
                          disabled={sinStock || devolver <= 0}
                          className="w-9 h-9 rounded-md border border-[var(--color-border)] flex items-center justify-center active:bg-[var(--color-surface-2)] disabled:opacity-30"
                          aria-label="Menos"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[36px] text-center text-base font-bold tabular-nums">
                          {devolver}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCant(it.id, Math.min(disponible, devolver + 1))}
                          disabled={sinStock || devolver >= disponible}
                          className="w-9 h-9 rounded-md border border-[var(--color-border)] flex items-center justify-center active:bg-[var(--color-surface-2)] disabled:opacity-30"
                          aria-label="Más"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <section className="rounded-lg bg-[var(--color-surface-2)] p-3 mt-4 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Unidades a devolver</span>
              <span className="tabular-nums">{totalUnidades}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--color-border-light)]">
              <span>Monto a reintegrar</span>
              <span className="tabular-nums">{formatCOP(totalDevolucion)}</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-faint)] pt-1">
              El dinero se entrega al cliente por fuera del sistema. Acá solo
              se registra la devolución y se reintegra el stock.
            </p>
          </section>
        </div>

        <POSFooterFixed>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!puedeConfirmar}
            className="w-full h-14 rounded-xl bg-[var(--color-text)] text-[var(--color-surface)] font-bold text-base disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <Check size={16} />
              {submitting ? 'Registrando…' : `Confirmar devolución · ${formatCOP(totalDevolucion)}`}
            </span>
          </button>
        </POSFooterFixed>
      </div>
    )
  }

  // Vista 1: buscador de ventas
  return (
    <div className="pb-20">
      <div className="bg-[var(--color-bg)] border-b border-[var(--color-border-light)] px-4 py-3">
        <Link
          to="/pos"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={16} /> Volver al catálogo
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-text)] mt-1 flex items-center gap-2">
          <RotateCcw size={18} /> Devoluciones
        </h1>
        <p className="text-xs text-[var(--color-text-label)] mt-0.5">
          Elegí la venta original. Se puede devolver total o parcialmente.
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
          />
          <input
            type="tel"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por teléfono del cliente (opcional)"
            className="w-full h-11 pl-9 pr-3 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
            inputMode="numeric"
          />
        </div>

        {searching ? (
          <p className="text-xs text-[var(--color-text-label)] text-center py-6">
            Buscando…
          </p>
        ) : results.length === 0 ? (
          <p className="text-xs text-[var(--color-text-label)] text-center py-6">
            Sin ventas que coincidan.
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map(v => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => abrirVenta(v.id)}
                  className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 active:bg-[var(--color-surface-2)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">
                      {formatShortDateTime(v.fecha)}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatCOP(Number(v.total ?? 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--color-text-label)]">
                    <span>
                      {v.cliente?.nombre ?? 'sin cliente'}
                      {v.cliente?.telefono && ` · ${v.cliente.telefono}`}
                    </span>
                    <span className="font-mono">{v.metodo_pago}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
