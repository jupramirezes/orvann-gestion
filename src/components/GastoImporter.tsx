import { useState } from 'react'
import { Upload, CheckCircle, AlertTriangle, Sparkles, Info } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './Toast'
import {
  parseGastosFile,
  importGastos,
  type GastoImportResult,
  type GastoParsedSheet,
} from '../lib/gastos-import'
import { formatCOP } from '../lib/utils'

/**
 * Modal para importar la hoja "Gastos" del Sheet original. Detecta
 * automáticamente cuando un gasto equitativo aparece como 3 filas (una
 * por socio) y lo consolida en 1 fila con distribucion='equitativa'.
 */
export function GastoImporterModal({
  open, onClose, onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<GastoImportResult | null>(null)
  const [preview, setPreview] = useState<GastoParsedSheet | null>(null)

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    try {
      const parsed = await parseGastosFile(f)
      setPreview(parsed)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error leyendo archivo')
      setPreview(null)
    }
  }

  async function handleRun() {
    if (!preview || preview.gastos.length === 0) return
    setRunning(true)
    const res = await importGastos(preview.gastos)
    setRunning(false)
    setResult(res)
    if (res.failed === 0) addToast('success', `${res.ok} gastos importados`)
    else addToast('warning', `${res.ok} OK · ${res.failed} con error`)
    onDone()
  }

  function close() {
    setFile(null)
    setPreview(null)
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="Importar gastos del Sheet" size="lg">
      <div className="space-y-4">
        {!file && (
          <div className="card p-6 border-dashed text-center">
            <Upload size={28} className="mx-auto text-[var(--color-text-faint)] mb-3" />
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Subí el xlsx del Sheet (Control_Operativo_Orvann_Sheet_Original.xlsx).
              El importer detecta la hoja "Gastos" automáticamente.
            </p>
            <label className="btn-d accent cursor-pointer inline-flex">
              <Upload size={14} /> Seleccionar archivo
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
            <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
              Columnas esperadas en la hoja "Gastos":
              <code className="block mt-1 mono text-[10px]">Fecha · Categoría · Monto · Descripción · Método Pago · Responsable · Notas</code>
            </p>
            <p className="text-[10px] text-[var(--color-text-faint)] mt-2">
              Si un gasto equitativo aparece como 3 filas (KATHE, ANDRES, JP) con el mismo monto,
              se consolida en 1 sola fila con distribución equitativa.
            </p>
          </div>
        )}

        {file && preview && !result && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-[var(--color-text-label)]">
                  {preview.gastos.length} gasto{preview.gastos.length === 1 ? '' : 's'} a importar
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null) }}>
                Cambiar archivo
              </Button>
            </div>

            <div className="card p-3 border border-blue-200 bg-blue-50/60">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-blue-700 mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-medium text-blue-900">Detección automática</p>
                  <p className="text-blue-800">
                    {preview.filasCrudas} filas crudas · {preview.triosDetectados} gastos consolidados como
                    "equitativa" (3 filas KATHE+ANDRES+JP con mismo monto)
                  </p>
                  {preview.saltadas.length > 0 && (
                    <p className="text-blue-800">
                      {preview.saltadas.length} fila{preview.saltadas.length === 1 ? '' : 's'} salteada{preview.saltadas.length === 1 ? '' : 's'} (categoría/responsable/método no reconocido).
                    </p>
                  )}
                </div>
              </div>
            </div>

            {preview.categoriasSinMatch.length > 0 && (
              <div className="card p-3 border border-amber-200 bg-amber-50/60">
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle size={14} className="text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Categorías sin match en BD</p>
                    <p className="text-[var(--color-text-muted)] mt-0.5">
                      {preview.categoriasSinMatch.join(', ')}.
                      Creálas en /admin/config (próximamente) o saldrán como filas salteadas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="card overflow-x-auto max-h-[280px]">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[var(--color-surface-2)] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide">Categoría</th>
                    <th className="px-3 py-2.5 text-right text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide whitespace-nowrap">Monto</th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide whitespace-nowrap">Distribución</th>
                    <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide whitespace-nowrap">Pagador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {preview.gastos.slice(0, 10).map((g, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-[var(--color-text-muted)] font-mono whitespace-nowrap">{g.fecha}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{g.categoria_nombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCOP(g.monto_total)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                          {g.distribucion}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)] font-mono text-[10px] whitespace-nowrap">{g.pagador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.gastos.length > 10 && (
                <p className="text-[10px] text-center text-[var(--color-text-faint)] py-2 border-t border-[var(--color-border-light)]">
                  … y {preview.gastos.length - 10} gastos más
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button
                variant="accent"
                onClick={handleRun}
                disabled={running || preview.gastos.length === 0}
              >
                {running ? 'Importando…' : `Importar ${preview.gastos.length} gastos`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 bg-emerald-50/60 border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">OK</span>
                </div>
                <p className="text-2xl font-bold text-emerald-800 mt-1">{result.ok}</p>
              </div>
              <div className="card p-4 bg-red-50/60 border-red-200">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Con error</span>
                </div>
                <p className="text-2xl font-bold text-red-800 mt-1">{result.failed}</p>
              </div>
            </div>

            {preview && preview.saltadas.length > 0 && (
              <div className="card p-3 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5">
                  <Info size={12} />
                  Filas salteadas ({preview.saltadas.length})
                </p>
                <ul className="space-y-1.5 text-xs">
                  {preview.saltadas.map(s => (
                    <li key={s.row} className="flex gap-2">
                      <span className="text-[var(--color-text-faint)] font-mono">#{s.row}</span>
                      <span className="text-[var(--color-text-muted)]">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="card p-3 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-2">
                  Inserts con error ({result.errors.length})
                </p>
                <ul className="space-y-1.5 text-xs">
                  {result.errors.map(e => (
                    <li key={e.row} className="flex gap-2">
                      <span className="text-[var(--color-text-faint)] font-mono">#{e.row}</span>
                      <span className="text-[var(--color-accent-red)]">{e.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="accent" onClick={close}>Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
