import { useState } from 'react'
import { Upload, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react'
import { Button, Modal } from './ui'
import { useToast } from './Toast'
import { formatCOP } from '../lib/utils'
import {
  parseCotizador,
  aplicarCotizador,
  type CotizadorParseResult,
} from '../lib/cotizador-import'

/**
 * Modal para importar costos del Cotizador del Sheet. Aplica solo a
 * variantes con costo_base = 0 que matcheen por (producto + proveedor).
 */
export function CotizadorImporterModal({
  open, onClose, onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { addToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<CotizadorParseResult | null>(null)
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null)

  async function handleFile(f: File) {
    setFile(f)
    setResult(null)
    try {
      const parsed = await parseCotizador(f)
      setPreview(parsed)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error leyendo archivo')
      setPreview(null)
    }
  }

  async function handleRun() {
    if (!preview || preview.matches.length === 0) return
    setRunning(true)
    const res = await aplicarCotizador(preview.matches)
    setRunning(false)
    setResult({ ok: res.ok, failed: res.failed })
    if (res.failed === 0) {
      addToast('success', `${res.ok} costos actualizados`)
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
    <Modal open={open} onClose={close} title="Aplicar costos del Cotizador" size="lg">
      <div className="space-y-4">
        {!file && (
          <div className="card p-6 border-dashed text-center">
            <Upload size={28} className="mx-auto text-[var(--color-text-faint)] mb-3" />
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Subí el xlsx del Sheet (Control_Operativo_Orvann.xlsx). Detecto la
              hoja "Cotizador" y actualizo automáticamente las variantes con
              <code className="mx-1 text-[10px] font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">costo_base = 0</code>
              que tengan match por producto + proveedor.
            </p>
            <label className="btn-d accent cursor-pointer inline-flex">
              <Upload size={14} /> Seleccionar archivo
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
            <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
              No toca variantes que ya tienen costo_base &gt; 0. El costo_adicional
              se mantiene (ya está calculado por trigger al crear variante).
            </p>
          </div>
        )}

        {file && preview && !result && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-[var(--color-text-label)]">
                  {preview.entries.length} entradas en el Cotizador
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
                  <p className="font-medium text-blue-900">Resumen del análisis</p>
                  <p className="text-blue-800">
                    {preview.variantesSinCosto} variantes con costo_base=0 ·{' '}
                    {preview.matches.length} con match · {preview.sinMatch.length} sin match
                  </p>
                </div>
              </div>
            </div>

            {preview.matches.length > 0 && (
              <div className="card overflow-x-auto max-h-[260px]">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-[var(--color-surface-2)] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide">SKU</th>
                      <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide">Producto</th>
                      <th className="px-3 py-2.5 text-left text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide">Proveedor</th>
                      <th className="px-3 py-2.5 text-right text-[10px] uppercase font-semibold text-[var(--color-text-label)] tracking-wide">Costo sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-light)]">
                    {preview.matches.slice(0, 15).map(m => (
                      <tr key={m.varianteId}>
                        <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">{m.sku}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{m.productoNombre}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{m.proveedorNombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatCOP(m.costoBaseSugerido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.matches.length > 15 && (
                  <p className="text-[10px] text-center text-[var(--color-text-faint)] py-2 border-t border-[var(--color-border-light)]">
                    … y {preview.matches.length - 15} matches más
                  </p>
                )}
              </div>
            )}

            {preview.sinMatch.length > 0 && (
              <div className="card p-3 border border-amber-200 bg-amber-50/60">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-800">
                      {preview.sinMatch.length} variantes sin match en el Cotizador
                    </p>
                    <p className="text-[var(--color-text-muted)] mt-0.5">
                      Tienen costo_base=0 pero no encontré entrada en el Cotizador para su
                      producto + proveedor. Revisá manualmente en /admin/variantes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={close}>Cancelar</Button>
              <Button
                variant="accent"
                onClick={handleRun}
                disabled={running || preview.matches.length === 0}
              >
                {running ? 'Aplicando…' : `Aplicar a ${preview.matches.length} variantes`}
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
                  <span className="text-xs font-semibold uppercase tracking-wide">Actualizadas</span>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="accent" onClick={close}>Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
