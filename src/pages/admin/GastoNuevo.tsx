import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import {
  PageHeader,
  Button,
  Input,
  Select,
  Textarea,
  Field,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP } from '../../lib/utils'
import {
  createGasto,
  listCategoriasGasto,
  PAGADORES,
  DISTRIBUCIONES,
  type CategoriaGasto,
  type PagadorGasto,
  type DistribucionGasto,
} from '../../lib/queries/gastos'
import type { Database } from '../../types/database'

type MetodoPago = Database['public']['Enums']['metodo_pago']

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'datafono', label: 'Datáfono' },
  { value: 'credito', label: 'Crédito' },
]

type FormState = {
  fecha: string
  categoria_id: string
  descripcion: string
  monto_total: number
  metodo_pago: MetodoPago
  pagador: PagadorGasto
  distribucion: DistribucionGasto
  monto_kathe: number
  monto_andres: number
  monto_jp: number
  monto_orvann: number
  notas: string
}

/**
 * Calcula la distribución entre socios según el modo elegido. Esto es
 * un preview local que coincide con la lógica del trigger
 * fn_calcular_distribucion_gasto (montos finales los setea el server).
 */
function previewDistribucion(form: FormState): {
  kathe: number
  andres: number
  jp: number
  orvann: number
} {
  const total = form.monto_total || 0
  if (form.distribucion === 'equitativa') {
    const tercio = Math.round((total / 3) * 100) / 100
    const resto = Math.round((total - tercio * 3) * 100) / 100
    return { kathe: tercio, andres: tercio, jp: tercio + resto, orvann: 0 }
  }
  if (form.distribucion === 'asignada') {
    return {
      kathe: form.pagador === 'KATHE' ? total : 0,
      andres: form.pagador === 'ANDRES' ? total : 0,
      jp: form.pagador === 'JP' ? total : 0,
      orvann: form.pagador === 'ORVANN' ? total : 0,
    }
  }
  if (form.distribucion === 'orvann') {
    return { kathe: 0, andres: 0, jp: 0, orvann: total }
  }
  return {
    kathe: form.monto_kathe,
    andres: form.monto_andres,
    jp: form.monto_jp,
    orvann: form.monto_orvann,
  }
}

export default function GastoNuevo() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<FormState>({
    fecha: new Date().toISOString().slice(0, 10),
    categoria_id: '',
    descripcion: '',
    monto_total: 0,
    metodo_pago: 'efectivo',
    pagador: 'ORVANN',
    distribucion: 'orvann',
    monto_kathe: 0,
    monto_andres: 0,
    monto_jp: 0,
    monto_orvann: 0,
    notas: '',
  })

  useEffect(() => {
    listCategoriasGasto().then(({ data }) => setCategorias(data ?? []))
  }, [])

  const preview = useMemo(() => previewDistribucion(form), [form])
  const sumaCustom = useMemo(
    () =>
      form.monto_kathe + form.monto_andres + form.monto_jp + form.monto_orvann,
    [form.monto_kathe, form.monto_andres, form.monto_jp, form.monto_orvann],
  )
  const diferenciaCustom =
    form.distribucion === 'custom' ? form.monto_total - sumaCustom : 0

  const puedeGuardar =
    !!form.categoria_id &&
    form.monto_total > 0 &&
    form.fecha.length > 0 &&
    (form.distribucion !== 'custom' || Math.abs(diferenciaCustom) <= 1) &&
    !submitting

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!puedeGuardar) return
    setSubmitting(true)

    const payload = {
      fecha: form.fecha,
      categoria_id: form.categoria_id,
      descripcion: form.descripcion.trim() || null,
      monto_total: form.monto_total,
      metodo_pago: form.metodo_pago,
      pagador: form.pagador,
      distribucion: form.distribucion,
      notas: form.notas.trim() || null,
      // Solo enviamos montos manuales si distribución=custom;
      // el trigger los recalcula para los otros modos.
      ...(form.distribucion === 'custom'
        ? {
            monto_kathe: form.monto_kathe,
            monto_andres: form.monto_andres,
            monto_jp: form.monto_jp,
            monto_orvann: form.monto_orvann,
          }
        : {}),
    }

    const { error } = await createGasto(payload)
    setSubmitting(false)
    if (error) {
      addToast('error', error.message)
      return
    }
    addToast('success', 'Gasto registrado')
    navigate('/admin/gastos')
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/gastos"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={14} /> Volver a gastos
        </Link>
      </div>

      <PageHeader
        title="Nuevo gasto"
        subtitle="La distribución entre socios se calcula automáticamente"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna principal (form) */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" required>
              <Input
                type="date"
                value={form.fecha}
                onChange={e => setField('fecha', e.target.value)}
              />
            </Field>
            <Field label="Método de pago" required>
              <Select
                value={form.metodo_pago}
                onChange={e => setField('metodo_pago', e.target.value as MetodoPago)}
              >
                {METODOS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Categoría" required>
            <Select
              value={form.categoria_id}
              onChange={e => setField('categoria_id', e.target.value)}
              invalid={!form.categoria_id && form.monto_total > 0}
            >
              <option value="">— Seleccionar —</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.tipo === 'fijo' ? '(fijo)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Descripción">
            <Input
              value={form.descripcion}
              onChange={e => setField('descripcion', e.target.value)}
              placeholder="Ej. Mercado mes de abril, publicidad FB semana 3…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto total" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-label)]">
                  $
                </span>
                <Input
                  type="number"
                  value={form.monto_total || ''}
                  onChange={e => setField('monto_total', Number(e.target.value) || 0)}
                  className="pl-7 tabular-nums"
                  step="1000"
                  min="0"
                />
              </div>
            </Field>
            <Field label="Pagador" required hint="Quién hizo el pago materialmente">
              <Select
                value={form.pagador}
                onChange={e => setField('pagador', e.target.value as PagadorGasto)}
              >
                {PAGADORES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Distribución */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Distribución <span className="text-[var(--color-accent-red)]">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DISTRIBUCIONES.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setField('distribucion', d.value)}
                  className={`h-10 px-3 rounded-md border text-xs font-medium ${
                    form.distribucion === d.value
                      ? 'bg-[var(--color-text)] text-[var(--color-surface)] border-[var(--color-text)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-text-label)] mt-1.5">
              {DISTRIBUCIONES.find(d => d.value === form.distribucion)?.hint}
            </p>
          </div>

          {/* Campos de montos custom */}
          {form.distribucion === 'custom' && (
            <div className="rounded-lg bg-[var(--color-surface-2)] p-4 space-y-3">
              <p className="text-[11px] text-[var(--color-text-label)]">
                La suma de los 4 montos debe igualar el monto total (±1 peso).
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['kathe', 'andres', 'jp', 'orvann'] as const).map(k => (
                  <Field key={k} label={k.toUpperCase()}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-label)]">
                        $
                      </span>
                      <Input
                        type="number"
                        value={form[`monto_${k}` as const] || ''}
                        onChange={e =>
                          setField(
                            `monto_${k}` as const,
                            Number(e.target.value) || 0,
                          )
                        }
                        className="pl-7 tabular-nums"
                        step="1000"
                        min="0"
                      />
                    </div>
                  </Field>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--color-border-light)]">
                <span className="text-[var(--color-text-muted)]">Suma actual</span>
                <span className="tabular-nums font-semibold">
                  {formatCOP(sumaCustom)} / {formatCOP(form.monto_total)}
                </span>
              </div>
              {Math.abs(diferenciaCustom) > 1 && (
                <p className="text-xs font-semibold text-[var(--color-accent-red)]">
                  {diferenciaCustom > 0
                    ? `Falta asignar ${formatCOP(diferenciaCustom)}`
                    : `Sobra ${formatCOP(-diferenciaCustom)}`}
                </p>
              )}
            </div>
          )}

          <Field label="Notas">
            <Textarea
              value={form.notas}
              onChange={e => setField('notas', e.target.value)}
              placeholder="Contexto adicional, proveedor, justificación…"
            />
          </Field>
        </div>

        {/* Columna preview */}
        <aside className="card p-5 h-fit sticky top-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-2">
              Previsualización
            </p>
            <p className="text-3xl font-extrabold tabular-nums">
              {formatCOP(form.monto_total)}
            </p>
            <p className="text-xs text-[var(--color-text-label)] mt-0.5">
              Total · {form.fecha}
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--color-border-light)] space-y-1.5 text-sm">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-1">
              Así se distribuye
            </p>
            <PreviewRow label="Kathe" value={preview.kathe} />
            <PreviewRow label="Andrés" value={preview.andres} />
            <PreviewRow label="JP" value={preview.jp} />
            <PreviewRow label="ORVANN" value={preview.orvann} />
          </div>

          <div className="pt-3 border-t border-[var(--color-border-light)]">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!puedeGuardar}
              className="w-full"
            >
              <Save size={14} />
              {submitting ? 'Guardando…' : 'Guardar gasto'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: number }) {
  const activo = value > 0
  return (
    <div
      className={`flex justify-between ${activo ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCOP(value)}</span>
    </div>
  )
}
