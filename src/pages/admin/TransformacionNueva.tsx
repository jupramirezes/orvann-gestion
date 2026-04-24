import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Save } from 'lucide-react'
import {
  PageHeader,
  Button,
  Input,
  Select,
  Textarea,
  Field,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/useAuth'
import { formatCOP } from '../../lib/utils'
import { listVariantes, listParametrosCosto, type VarianteConJoin } from '../../lib/queries/variantes'
import { calcularCostoAdicional, ESTAMPADO_LABELS } from '../../lib/catalogo'
import { createTransformacion } from '../../lib/queries/transformaciones'
import type { Database } from '../../types/database'

type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']

/**
 * Costo del estampado puro (sin base: etiqueta/marquilla/bolsa, que ya
 * estaban en la variante origen). Es la diferencia entre el total con
 * estampado y el total sin estampado para el mismo tipo de producto.
 */
function costoSoloEstampado(
  parametros: ParametroCosto[],
  tipo: Database['public']['Enums']['tipo_producto'],
  estampado: Database['public']['Enums']['tipo_estampado'],
): number {
  const conEstampado = calcularCostoAdicional(parametros, tipo, estampado).total
  const sinEstampado = calcularCostoAdicional(parametros, tipo, 'ninguno').total
  return conEstampado - sinEstampado
}

function nombreVariante(v: VarianteConJoin): string {
  return [
    v.producto?.nombre ?? '—',
    [v.color, v.talla].filter(Boolean).join(' '),
    v.diseno?.nombre,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function TransformacionNueva() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [variantes, setVariantes] = useState<VarianteConJoin[]>([])
  const [parametros, setParametros] = useState<ParametroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [costoUnit, setCostoUnit] = useState(0)
  const [costoTocado, setCostoTocado] = useState(false)
  const [notas, setNotas] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listVariantes({ limit: 500, includeInactive: false }),
      listParametrosCosto(),
    ]).then(([vs, ps]) => {
      if (cancelled) return
      setLoading(false)
      if (vs.error) {
        addToast('error', vs.error.message)
        return
      }
      setVariantes((vs.data as VarianteConJoin[]) ?? [])
      if (ps.data) setParametros(ps.data)
    })
    return () => {
      cancelled = true
    }
  }, [addToast])

  // Filtros: origen = básicas con stock > 0. destino = cualquier variante.
  const origenes = useMemo(
    () =>
      variantes
        .filter(v => (v.estampado ?? 'ninguno') === 'ninguno' && (v.stock_cache ?? 0) > 0)
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [variantes],
  )
  const destinos = useMemo(
    () =>
      variantes
        .filter(v => v.id !== origenId)
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [variantes, origenId],
  )

  const origen = useMemo(
    () => variantes.find(v => v.id === origenId) ?? null,
    [variantes, origenId],
  )
  const destino = useMemo(
    () => variantes.find(v => v.id === destinoId) ?? null,
    [variantes, destinoId],
  )

  const stockOrigen = origen?.stock_cache ?? 0

  // Handler del select de destino: al cambiar, calcula el costo
  // sugerido inline (sin useEffect) para evitar cascading renders.
  function handleChangeDestino(id: string) {
    setDestinoId(id)
    setCostoTocado(false)
    const dest = variantes.find(v => v.id === id)
    if (!dest || !parametros.length) {
      setCostoUnit(0)
      return
    }
    const tipoProd = dest.producto?.tipo ?? 'prenda'
    const estampadoDestino = dest.estampado ?? 'ninguno'
    setCostoUnit(costoSoloEstampado(parametros, tipoProd, estampadoDestino))
  }

  const puedeGuardar =
    !!origenId &&
    !!destinoId &&
    origenId !== destinoId &&
    cantidad > 0 &&
    cantidad <= stockOrigen &&
    costoUnit >= 0 &&
    !submitting

  async function handleSubmit() {
    if (!puedeGuardar) return
    setSubmitting(true)
    const { error } = await createTransformacion({
      fecha,
      variante_origen_id: origenId,
      variante_destino_id: destinoId,
      cantidad,
      costo_estampado_unit: costoUnit,
      notas: notas.trim() || null,
      usuario_id: user?.id ?? null,
    })
    setSubmitting(false)
    if (error) {
      addToast('error', error.message)
      return
    }
    addToast(
      'success',
      `Transformación registrada — stock ajustado en las 2 variantes`,
    )
    navigate('/admin/transformaciones')
  }

  if (loading) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
        Cargando…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/transformaciones"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={14} /> Volver
        </Link>
      </div>

      <PageHeader
        title="Nueva transformación"
        subtitle="Registrar paso de variante básica a estampada"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" required>
              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </Field>
            <Field label="Cantidad" required hint={stockOrigen ? `Stock disponible: ${stockOrigen}` : ''}>
              <Input
                type="number"
                value={cantidad || ''}
                onChange={e => setCantidad(Number(e.target.value) || 0)}
                min="1"
                max={stockOrigen || undefined}
                invalid={cantidad > stockOrigen && stockOrigen > 0}
              />
            </Field>
          </div>

          <Field
            label="Variante origen (básica con stock)"
            required
            hint={
              origenes.length === 0
                ? 'No hay variantes básicas con stock disponible'
                : `${origenes.length} variantes elegibles`
            }
          >
            <Select
              value={origenId}
              onChange={e => {
                setOrigenId(e.target.value)
                if (destinoId === e.target.value) setDestinoId('')
              }}
            >
              <option value="">— Seleccionar origen —</option>
              {origenes.map(v => (
                <option key={v.id} value={v.id}>
                  [{v.stock_cache}] {v.sku} · {nombreVariante(v)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Variante destino (estampada)"
            required
            hint={
              destino && (destino.stock_cache ?? 0) === 0
                ? 'Stock actual del destino: 0'
                : destino
                  ? `Stock actual del destino: ${destino.stock_cache}`
                  : 'Seleccioná el destino para ver el costo sugerido'
            }
          >
            <Select
              value={destinoId}
              onChange={e => handleChangeDestino(e.target.value)}
              disabled={!origenId}
            >
              <option value="">— Seleccionar destino —</option>
              {destinos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.sku} · {nombreVariante(v)}
                  {v.estampado && v.estampado !== 'ninguno'
                    ? ` — ${ESTAMPADO_LABELS[v.estampado]}`
                    : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Costo del estampado por unidad"
            hint={
              costoTocado
                ? 'Editado manualmente'
                : 'Sugerido según el tipo de estampado del destino'
            }
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-label)]">
                $
              </span>
              <Input
                type="number"
                value={costoUnit || ''}
                onChange={e => {
                  setCostoUnit(Number(e.target.value) || 0)
                  setCostoTocado(true)
                }}
                className="pl-7 tabular-nums"
                step="500"
                min="0"
              />
            </div>
          </Field>

          <Field label="Notas">
            <Textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Lote, detalles del estampado, ajustes del diseño…"
            />
          </Field>
        </div>

        <aside className="card p-5 h-fit sticky top-4 space-y-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold">
            Flujo
          </p>

          <div className="space-y-3">
            <VariantePreview v={origen} label="De" stockOverride={stockOrigen} />
            <div className="flex items-center justify-center text-[var(--color-text-faint)] gap-1 text-xs">
              <span>×{cantidad}</span>
              <ArrowRight size={14} />
            </div>
            <VariantePreview v={destino} label="A" />
          </div>

          <div className="pt-3 border-t border-[var(--color-border-light)] space-y-1.5 text-sm">
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Costo/unit</span>
              <span className="tabular-nums">{formatCOP(costoUnit)}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCOP(costoUnit * cantidad)}</span>
            </div>
          </div>

          {cantidad > stockOrigen && stockOrigen > 0 && (
            <p className="text-xs font-semibold text-[var(--color-accent-red)]">
              Cantidad excede el stock disponible ({stockOrigen}).
            </p>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!puedeGuardar}
            className="w-full"
          >
            <Save size={14} />
            {submitting ? 'Registrando…' : 'Registrar transformación'}
          </Button>
        </aside>
      </div>
    </div>
  )
}

function VariantePreview({
  v,
  label,
  stockOverride,
}: {
  v: VarianteConJoin | null
  label: string
  stockOverride?: number
}) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-1">
        {label}
      </p>
      {v ? (
        <>
          <p className="text-sm font-medium leading-tight">
            {v.producto?.nombre ?? '—'}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {[v.color, v.talla].filter(Boolean).join(' · ')}
            {v.diseno && ` · ${v.diseno.nombre}`}
          </p>
          {v.estampado && v.estampado !== 'ninguno' && (
            <p className="text-[10px] text-[var(--color-text-faint)] italic mt-0.5">
              {ESTAMPADO_LABELS[v.estampado]}
            </p>
          )}
          <p className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1">
            Stock: {stockOverride ?? v.stock_cache ?? 0}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--color-text-faint)] italic">Sin seleccionar</p>
      )}
    </div>
  )
}
