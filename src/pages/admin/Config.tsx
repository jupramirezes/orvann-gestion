import { useEffect, useState } from 'react'
import { Save, AlertCircle, Upload } from 'lucide-react'
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
import { MoneyInput } from '../../components/MoneyInput'
import { useToast } from '../../components/Toast'
import {
  listParametros,
  updateParametro,
  type ParametroCosto,
} from '../../lib/queries/parametros'
import { CotizadorImporterModal } from '../../components/CotizadorImporter'

const CONCEPTO_LABELS: Record<string, string> = {
  etiqueta_espalda: 'Etiqueta espalda',
  marquilla_lavado: 'Marquilla lavado',
  bolsa: 'Bolsa (empaque)',
  estampado_dtg_grande: 'DTG completo (grande)',
  punto_corazon_estampado: 'Punto corazón estampado',
  punto_corazon_bordado: 'Punto corazón bordado',
}

/**
 * Página de configuración: edita los parámetros de costo que se usan
 * para calcular el `costo_adicional` al crear variantes. Los cambios
 * afectan SOLO a variantes futuras (las existentes tienen el costo
 * fotografiado al momento de creación).
 */
export default function Config() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<ParametroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [openCotizador, setOpenCotizador] = useState(false)

  useEffect(() => {
    let cancelled = false
    listParametros({ includeInactive: true }).then(({ data, error }) => {
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
  }, [reloadKey, addToast])

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle="Parámetros de costo y opciones del sistema"
        actions={
          <Button variant="ghost" size="sm" onClick={() => setOpenCotizador(true)}>
            <Upload size={14} /> Aplicar costos del Cotizador
          </Button>
        }
      />

      <section className="mb-5">
        <h3 className="text-sm font-semibold mb-1">Parámetros de costo</h3>
        <p className="text-xs text-[var(--color-text-label)] mb-3">
          Montos que se usan automáticamente al crear una variante para
          calcular el <code className="text-[10px] font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">costo_adicional</code>.
        </p>
        <div className="card p-3 mb-3 border border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle size={14} className="text-amber-700 mt-0.5 shrink-0" />
            <p className="text-amber-800">
              Los cambios <strong>solo aplican a variantes nuevas</strong>. Las variantes
              existentes mantienen el costo fotografiado en el momento en que se crearon.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sin parámetros"
            description="Se deberían haber cargado desde el seed inicial."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Concepto</TH>
                <TH>Descripción</TH>
                <TH>Aplica a</TH>
                <TH align="right">Costo unitario</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(p => (
                <ParametroRow
                  key={p.id}
                  param={p}
                  onSaved={() => setReloadKey(k => k + 1)}
                />
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <CotizadorImporterModal
        open={openCotizador}
        onClose={() => setOpenCotizador(false)}
        onDone={() => setReloadKey(k => k + 1)}
      />
    </div>
  )
}

function ParametroRow({
  param,
  onSaved,
}: {
  param: ParametroCosto
  onSaved: () => void
}) {
  const { addToast } = useToast()
  const [costo, setCosto] = useState(Number(param.costo_unitario))
  const [saving, setSaving] = useState(false)
  const dirty = costo !== Number(param.costo_unitario)

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    const { error } = await updateParametro(param.id, {
      costo_unitario: costo,
    })
    setSaving(false)
    if (error) {
      addToast('error', error.message)
      return
    }
    addToast('success', `"${param.concepto}" actualizado`)
    onSaved()
  }

  return (
    <TR>
      <TD className="font-mono text-xs">
        {CONCEPTO_LABELS[param.concepto] ?? param.concepto}
      </TD>
      <TD className="text-xs text-[var(--color-text-muted)] max-w-[280px]">
        {param.descripcion ?? '—'}
      </TD>
      <TD>
        <div className="flex flex-wrap gap-1">
          {(param.aplicable_a ?? []).length === 0 ? (
            <span className="text-[10px] text-[var(--color-text-faint)]">todos</span>
          ) : (
            (param.aplicable_a ?? []).map(t => (
              <span
                key={t}
                className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded font-mono"
              >
                {t}
              </span>
            ))
          )}
        </div>
      </TD>
      <TD align="right" className="w-[180px]">
        <MoneyInput
          value={costo}
          onChange={setCosto}
          step="100"
          min="0"
          className="w-full"
        />
      </TD>
      <TD align="right">
        <Button
          variant={dirty ? 'accent' : 'ghost'}
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
          title={dirty ? 'Guardar cambio' : 'Sin cambios'}
        >
          <Save size={12} />
          {saving ? 'Guardando…' : dirty ? 'Guardar' : 'OK'}
        </Button>
      </TD>
    </TR>
  )
}
