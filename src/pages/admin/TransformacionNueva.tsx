import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Save, Sparkles } from 'lucide-react'
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
import {
  listVariantes,
  listParametrosCosto,
  createVariante,
  generarSku,
  type VarianteConJoin,
} from '../../lib/queries/variantes'
import { listDisenos, type Diseno } from '../../lib/queries/disenos'
import { calcularCostoAdicional, ESTAMPADO_LABELS } from '../../lib/catalogo'
import { createTransformacion } from '../../lib/queries/transformaciones'
import type { Database } from '../../types/database'

type ParametroCosto = Database['public']['Tables']['parametros_costo']['Row']
type TipoEstampado = Database['public']['Enums']['tipo_estampado']

/**
 * Dado los 3 flags de estampado (punto estampado, punto bordado, DTG)
 * devuelve el valor canónico del enum `tipo_estampado`. `ninguno` si
 * no hay nada marcado (no es transformación válida).
 */
function combinacionAEstampado(flags: {
  puntoEstampado: boolean
  puntoBordado: boolean
  dtg: boolean
}): TipoEstampado {
  const { puntoEstampado, puntoBordado, dtg } = flags
  if (dtg && puntoEstampado && puntoBordado) return 'triple_completo'
  if (dtg && puntoEstampado) return 'doble_punto_y_completo'
  if (dtg && puntoBordado) return 'doble_bordado_y_completo'
  if (dtg) return 'completo_dtg'
  if (puntoBordado) return 'punto_corazon_bordado'
  if (puntoEstampado) return 'punto_corazon_estampado'
  return 'ninguno'
}

/**
 * Costo del estampado puro (sin base: etiqueta/marquilla/bolsa).
 * Diferencia entre total con estampado y total sin estampado.
 */
function costoSoloEstampado(
  parametros: ParametroCosto[],
  tipo: Database['public']['Enums']['tipo_producto'],
  estampado: TipoEstampado,
): number {
  const con = calcularCostoAdicional(parametros, tipo, estampado).total
  const sin = calcularCostoAdicional(parametros, tipo, 'ninguno').total
  return con - sin
}

/**
 * Busca en el catálogo una variante que coincida con los atributos
 * destino (producto + color + talla + estampado + diseño). Si existe,
 * la transformación suma a su stock; si no, se crea una nueva.
 */
function encontrarDestino(
  variantes: VarianteConJoin[],
  origen: VarianteConJoin,
  estampado: TipoEstampado,
  disenoId: string | null,
): VarianteConJoin | null {
  return (
    variantes.find(
      v =>
        v.producto_id === origen.producto_id &&
        (v.color ?? null) === (origen.color ?? null) &&
        (v.talla ?? null) === (origen.talla ?? null) &&
        v.estampado === estampado &&
        (v.diseno_id ?? null) === (disenoId || null) &&
        v.id !== origen.id,
    ) ?? null
  )
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
  const [disenos, setDisenos] = useState<Diseno[]>([])
  const [parametros, setParametros] = useState<ParametroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [origenId, setOrigenId] = useState('')
  const [puntoEstampado, setPuntoEstampado] = useState(false)
  const [puntoBordado, setPuntoBordado] = useState(false)
  const [dtg, setDtg] = useState(false)
  const [disenoId, setDisenoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [costoUnit, setCostoUnit] = useState(0)
  const [costoTocado, setCostoTocado] = useState(false)
  const [notas, setNotas] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listVariantes({ limit: 500, includeInactive: false }),
      listParametrosCosto(),
      listDisenos({ includeInactive: false }),
    ]).then(([vs, ps, ds]) => {
      if (cancelled) return
      setLoading(false)
      if (vs.error) {
        addToast('error', vs.error.message)
        return
      }
      setVariantes((vs.data as VarianteConJoin[]) ?? [])
      if (ps.data) setParametros(ps.data)
      if (ds.data) setDisenos(ds.data)
    })
    return () => {
      cancelled = true
    }
  }, [addToast])

  const origenes = useMemo(
    () =>
      variantes
        .filter(v => (v.estampado ?? 'ninguno') === 'ninguno' && (v.stock_cache ?? 0) > 0)
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [variantes],
  )
  const origen = useMemo(
    () => variantes.find(v => v.id === origenId) ?? null,
    [variantes, origenId],
  )
  const stockOrigen = origen?.stock_cache ?? 0

  const tipoEstampado = useMemo(
    () =>
      combinacionAEstampado({ puntoEstampado, puntoBordado, dtg }),
    [puntoEstampado, puntoBordado, dtg],
  )
  const hayEstampado = tipoEstampado !== 'ninguno'

  const destinoExistente = useMemo(
    () =>
      origen && hayEstampado
        ? encontrarDestino(variantes, origen, tipoEstampado, disenoId || null)
        : null,
    [origen, hayEstampado, tipoEstampado, disenoId, variantes],
  )

  const disenoSeleccionado = useMemo(
    () => disenos.find(d => d.id === disenoId) ?? null,
    [disenos, disenoId],
  )

  // Costo sugerido = costo puro del estampado combinado
  function actualizarCostoSugerido(
    flags: { puntoEstampado: boolean; puntoBordado: boolean; dtg: boolean },
    tocado: boolean,
  ) {
    if (tocado || !origen || !parametros.length) return
    const estampado = combinacionAEstampado(flags)
    if (estampado === 'ninguno') {
      setCostoUnit(0)
      return
    }
    const tipoProd = origen.producto?.tipo ?? 'prenda'
    setCostoUnit(costoSoloEstampado(parametros, tipoProd, estampado))
  }

  function toggle(
    flag: 'puntoEstampado' | 'puntoBordado' | 'dtg',
    value: boolean,
  ) {
    const next = { puntoEstampado, puntoBordado, dtg, [flag]: value }
    if (flag === 'puntoEstampado') setPuntoEstampado(value)
    if (flag === 'puntoBordado') setPuntoBordado(value)
    if (flag === 'dtg') setDtg(value)
    actualizarCostoSugerido(next, costoTocado)
  }

  function handleChangeOrigen(id: string) {
    setOrigenId(id)
    const newOrigen = variantes.find(v => v.id === id) ?? null
    if (!costoTocado && newOrigen && parametros.length && hayEstampado) {
      const tipoProd = newOrigen.producto?.tipo ?? 'prenda'
      setCostoUnit(costoSoloEstampado(parametros, tipoProd, tipoEstampado))
    }
  }

  // Precio sugerido para la variante destino nueva = precio origen + costo estampado
  const precioDestinoSugerido = useMemo(() => {
    if (!origen) return 0
    return Number(origen.precio_venta) + costoUnit
  }, [origen, costoUnit])

  const dtgSinDiseno = dtg && !disenoId

  const puedeGuardar =
    !!origenId &&
    hayEstampado &&
    cantidad > 0 &&
    cantidad <= stockOrigen &&
    costoUnit >= 0 &&
    !dtgSinDiseno &&
    !submitting

  async function handleSubmit() {
    if (!puedeGuardar || !origen) return
    setSubmitting(true)

    let destinoId = destinoExistente?.id
    let varianteCreada = false

    // 1. Si el destino no existe, crearlo al vuelo con SKU automático
    if (!destinoId) {
      const sku = await generarSku(
        origen.producto_id,
        origen.color,
        origen.talla,
        disenoId || null,
      ).catch(() => null)

      if (!sku) {
        setSubmitting(false)
        addToast('error', 'No se pudo generar el SKU del destino')
        return
      }

      const tipoProd = origen.producto?.tipo ?? 'prenda'
      const costoAdicional = calcularCostoAdicional(
        parametros,
        tipoProd,
        tipoEstampado,
      ).total

      const { data: nueva, error: errCrear } = await createVariante({
        producto_id: origen.producto_id,
        sku,
        color: origen.color,
        talla: origen.talla,
        diseno_id: disenoId || null,
        estampado: tipoEstampado,
        costo_base: Number(origen.costo_base),
        costo_adicional: costoAdicional,
        precio_venta: precioDestinoSugerido,
        activo: true,
        notas: `Creada automáticamente desde transformación de ${origen.sku}`,
      })

      if (errCrear || !nueva) {
        setSubmitting(false)
        addToast(
          'error',
          `No se pudo crear la variante destino: ${errCrear?.message ?? 'desconocido'}`,
        )
        return
      }
      destinoId = nueva.id
      varianteCreada = true
    }

    // 2. Crear la transformación (trigger mueve stock)
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
      varianteCreada
        ? 'Variante destino creada + transformación registrada'
        : 'Transformación registrada — stock ajustado',
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
        subtitle="Tomá una básica, marcá qué se le aplica y el destino se calcula solo"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Paso 1 — prenda básica */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <h3 className="text-sm font-semibold">Prenda básica a transformar</h3>
            </div>
            <Select
              value={origenId}
              onChange={e => handleChangeOrigen(e.target.value)}
            >
              <option value="">
                — {origenes.length} básicas disponibles —
              </option>
              {origenes.map(v => (
                <option key={v.id} value={v.id}>
                  [{v.stock_cache}] {v.sku} · {nombreVariante(v)}
                </option>
              ))}
            </Select>
            <div className="flex items-center justify-between text-xs">
              <Field label="Cantidad" required hint={stockOrigen ? `Stock disponible: ${stockOrigen}` : ''}>
                <Input
                  type="number"
                  value={cantidad || ''}
                  onChange={e => setCantidad(Number(e.target.value) || 0)}
                  min="1"
                  max={stockOrigen || undefined}
                  invalid={cantidad > stockOrigen && stockOrigen > 0}
                  className="w-28"
                />
              </Field>
              <Field label="Fecha">
                <Input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-40"
                />
              </Field>
            </div>
          </section>

          {/* Paso 2 — aplicar estampados */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <h3 className="text-sm font-semibold">¿Qué se le aplica?</h3>
            </div>
            <p className="text-xs text-[var(--color-text-label)]">
              Marcá todo lo que tenga la prenda transformada. Se pueden combinar.
            </p>
            <div className="space-y-2">
              <CheckRow
                checked={puntoEstampado}
                onChange={v => toggle('puntoEstampado', v)}
                label="Punto corazón estampado"
                hint="Logo de ORVANN estampado en el pecho (sobre la letra)"
              />
              <CheckRow
                checked={puntoBordado}
                onChange={v => toggle('puntoBordado', v)}
                label="Punto corazón bordado"
                hint="Logo de ORVANN bordado en el pecho"
              />
              <CheckRow
                checked={dtg}
                onChange={v => toggle('dtg', v)}
                label="Estampado DTG completo"
                hint="Estampa grande (pecho, espalda o ambos) con diseño"
              />
            </div>

            {hayEstampado && (
              <div className="rounded-md bg-[var(--color-surface-2)] p-2.5 text-xs">
                <span className="text-[var(--color-text-label)]">Resultado: </span>
                <span className="font-medium">{ESTAMPADO_LABELS[tipoEstampado]}</span>
              </div>
            )}
          </section>

          {/* Paso 3 — diseño (requerido si DTG) */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <h3 className="text-sm font-semibold">
                Diseño {dtg && <span className="text-[var(--color-accent-red)] text-xs">obligatorio para DTG</span>}
                {!dtg && <span className="text-[var(--color-text-faint)] text-xs font-normal">(opcional)</span>}
              </h3>
            </div>
            <Select
              value={disenoId}
              onChange={e => setDisenoId(e.target.value)}
              invalid={dtgSinDiseno}
            >
              <option value="">— Sin diseño específico —</option>
              {disenos.map(d => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
            {disenos.length === 0 && (
              <p className="text-xs text-[var(--color-accent-orange)]">
                No hay diseños activos. Creá uno en /admin/disenos.
              </p>
            )}
          </section>

          {/* Paso 4 — costo + notas */}
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              <h3 className="text-sm font-semibold">Costo y notas</h3>
            </div>
            <Field
              label="Costo del estampado por unidad"
              hint={
                costoTocado
                  ? 'Editado manualmente'
                  : 'Sugerido según la combinación marcada — editable'
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
                placeholder="Detalles del lote, ajustes, etc."
              />
            </Field>
          </section>
        </div>

        {/* Panel de preview lateral */}
        <aside className="card p-5 h-fit sticky top-4 space-y-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold">
            Así quedará
          </p>

          {/* Origen */}
          <VariantePreview label="De" origen={origen} />

          <div className="flex items-center justify-center text-[var(--color-text-faint)] gap-1 text-xs">
            <span className="tabular-nums">×{cantidad}</span>
            <ArrowRight size={14} />
          </div>

          {/* Destino — existente o preview del nuevo */}
          {!hayEstampado || !origen ? (
            <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-faint)] italic">
              Seleccioná básica + marcá al menos un estampado
            </div>
          ) : destinoExistente ? (
            <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1 flex items-center gap-1">
                ✓ A (ya existe)
              </p>
              <p className="text-sm font-medium">{destinoExistente.producto?.nombre ?? '—'}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {[destinoExistente.color, destinoExistente.talla].filter(Boolean).join(' · ')}
                {destinoExistente.diseno && ` · ${destinoExistente.diseno.nombre}`}
              </p>
              <p className="text-[10px] text-[var(--color-text-faint)] italic mt-0.5">
                {ESTAMPADO_LABELS[tipoEstampado]}
              </p>
              <p className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1">
                Stock actual: {destinoExistente.stock_cache ?? 0} → {(destinoExistente.stock_cache ?? 0) + cantidad}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold mb-1 flex items-center gap-1">
                <Sparkles size={10} /> A (se creará)
              </p>
              <p className="text-sm font-medium">{origen.producto?.nombre ?? '—'}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {[origen.color, origen.talla].filter(Boolean).join(' · ')}
                {disenoSeleccionado && ` · ${disenoSeleccionado.nombre}`}
              </p>
              <p className="text-[10px] text-[var(--color-text-faint)] italic mt-0.5">
                {ESTAMPADO_LABELS[tipoEstampado]}
              </p>
              <p className="text-[10px] text-[var(--color-text-faint)] mt-1">
                Precio sugerido: {formatCOP(precioDestinoSugerido)}
              </p>
            </div>
          )}

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
          {dtgSinDiseno && (
            <p className="text-xs font-semibold text-[var(--color-accent-red)]">
              DTG requiere un diseño seleccionado.
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

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? 'bg-[var(--color-surface-2)] border-[var(--color-text)]'
          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-text)]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-[var(--color-text-label)] mt-0.5">{hint}</p>
      </div>
    </label>
  )
}

function VariantePreview({
  label,
  origen,
}: {
  label: string
  origen: VarianteConJoin | null
}) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-1">
        {label}
      </p>
      {origen ? (
        <>
          <p className="text-sm font-medium leading-tight">
            {origen.producto?.nombre ?? '—'}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {[origen.color, origen.talla].filter(Boolean).join(' · ')}
          </p>
          <p className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1">
            Stock: {origen.stock_cache ?? 0}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--color-text-faint)] italic">Sin seleccionar</p>
      )}
    </div>
  )
}
