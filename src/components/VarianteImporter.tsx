import { useState } from 'react'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './Toast'
import { parseCSV, importCSV, type ImportResult } from '../lib/csv-import'

const EXPECTED_HEADERS = [
  'tipo',
  'producto_base',
  'color',
  'talla',
  'diseno',
  'estampado',
  'cantidad',
  'costo_unit',
  'precio_venta',
  'zona',
  'observacion',
]

export function VarianteImporterModal({
  open, onClose, onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<{
    headers: string[]
    rows: Record<string, string>[]
    missingHeaders: string[]
  } | null>(null)

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    try {
      const text = await f.text()
      const { headers, rows } = parseCSV(text)
      const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h))
      setPreview({ headers, rows, missingHeaders: missing })
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error leyendo archivo')
      setPreview(null)
    }
  }

  async function handleRun() {
    if (!preview || preview.rows.length === 0) return
    setRunning(true)
    const res = await importCSV(preview.rows)
    setRunning(false)
    setResult(res)
    if (res.failed === 0) {
      addToast('success', `${res.ok} variantes importadas`)
    } else {
      addToast('warning', `${res.ok} OK · ${res.failed} con error`)
    }
    onDone()
  }

  function close() {
    setFile(null)
    setPreview(null)
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="Importar variantes desde CSV" size="lg">
      <div className="space-y-4">
        {/* Paso 1: subir archivo */}
        {!file && (
          <div className="card p-6 border-dashed text-center">
            <Upload size={28} className="mx-auto text-[var(--color-text-faint)] mb-3" />
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Subí un archivo CSV con las columnas esperadas.
            </p>
            <label className="btn-d accent cursor-pointer inline-flex">
              <Upload size={14} /> Seleccionar archivo
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
            <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
              Template: <code className="mono">docs/referencia/inventario-fisico-template.csv</code>
            </p>
          </div>
        )}

        {/* Paso 2: preview y validación de headers */}
        {file && preview && !result && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-[var(--color-text-label)]">
                  {preview.rows.length} filas · {preview.headers.length} columnas
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null) }}>
                Cambiar archivo
              </Button>
            </div>

            {preview.missingHeaders.length > 0 && (
              <div className="card p-3 border border-[var(--color-accent-red)] bg-red-50/60">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-[var(--color-accent-red)] mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-[var(--color-accent-red)]">Faltan columnas esperadas</p>
                    <p className="text-[var(--color-text-muted)] mt-0.5">
                      {preview.missingHeaders.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="card overflow-x-auto max-h-[260px]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-surface-2)] sticky top-0">
                  <tr>
                    {preview.headers.map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {preview.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      {preview.headers.map(h => (
                        <td key={h} className="px-3 py-1.5 text-[var(--color-text-muted)]">{r[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 10 && (
                <p className="text-[10px] text-center text-[var(--color-text-faint)] py-2">
                  … y {preview.rows.length - 10} filas más
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button
                variant="accent"
                onClick={handleRun}
                disabled={running || preview.missingHeaders.length > 0 || preview.rows.length === 0}
              >
                {running ? 'Importando…' : `Importar ${preview.rows.length} filas`}
              </Button>
            </div>
          </>
        )}

        {/* Paso 3: resultado */}
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

            {result.errors.length > 0 && (
              <div className="card p-3 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-semibold text-[var(--color-text)] mb-2">
                  Filas con error ({result.errors.length})
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
