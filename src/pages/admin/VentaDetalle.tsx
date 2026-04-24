import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, User, CreditCard, AlertCircle } from 'lucide-react'
import {
  PageHeader,
  Button,
  StatusBadge,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatDate, formatShortDateTime } from '../../lib/utils'
import { getVentaDetalle } from '../../lib/queries/ventas'
import { getComprobanteUrl } from '../../lib/storage'
import { AbonoModal } from '../../components/admin/AbonoModal'
import type { Database } from '../../types/database'

type Venta = Database['public']['Tables']['ventas']['Row'] & {
  cliente: { id: string; nombre: string; telefono: string | null } | null
  vendedor: { id: string; nombre: string } | null
}

type VentaItem = Database['public']['Tables']['venta_items']['Row'] & {
  variante: {
    id: string
    sku: string
    color: string | null
    talla: string | null
    producto: { id: string; nombre: string } | null
  } | null
}

type VentaPago = Database['public']['Tables']['venta_pagos']['Row']
type VentaAbono = Database['public']['Tables']['venta_abonos']['Row']

export default function VentaDetalle() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [venta, setVenta] = useState<Venta | null>(null)
  const [items, setItems] = useState<VentaItem[]>([])
  const [pagos, setPagos] = useState<VentaPago[]>([])
  const [abonos, setAbonos] = useState<VentaAbono[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [abonoOpen, setAbonoOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getVentaDetalle(id).then(({ venta, items, pagos, abonos, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error)
        return
      }
      setVenta(venta as Venta)
      setItems((items ?? []) as VentaItem[])
      setPagos((pagos ?? []) as VentaPago[])
      setAbonos((abonos ?? []) as VentaAbono[])
    })
    return () => {
      cancelled = true
    }
  }, [id, reloadKey, addToast])

  if (loading) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
        Cargando…
      </div>
    )
  }

  if (!venta) {
    return <div className="card p-8 text-center text-sm">Venta no encontrada.</div>
  }

  const esDevolucion = venta.tipo_transaccion === 'devolucion'
  const esCredito = !!venta.es_credito
  const saldoPendiente = Number(venta.saldo_pendiente ?? 0)
  const subtotal = items.reduce(
    (s, i) => s + Number(i.subtotal ?? i.cantidad * Number(i.precio_unitario)),
    0,
  )
  const totalAbonado = abonos.reduce((s, a) => s + Number(a.monto), 0)

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/admin/ventas"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={14} /> Volver a ventas
        </Link>
      </div>

      <PageHeader
        title={esDevolucion ? 'Devolución' : 'Venta'}
        subtitle={formatShortDateTime(venta.fecha)}
        actions={
          <div className="flex gap-2 items-center">
            {esDevolucion && venta.venta_original_id && (
              <Link
                to={`/admin/ventas/${venta.venta_original_id}`}
                className="text-xs text-[var(--color-primary)] underline"
              >
                Ver venta original →
              </Link>
            )}
            {esCredito && saldoPendiente > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAbonoOpen(true)}
              >
                <CreditCard size={14} /> Registrar abono
              </Button>
            )}
          </div>
        }
      />

      {esCredito && saldoPendiente > 0 && (
        <div className="card p-4 mb-5 border border-amber-300 bg-amber-50 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-700 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Venta a crédito — saldo pendiente {formatCOP(saldoPendiente)}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Total {formatCOP(Number(venta.total ?? 0))} · Ya abonado{' '}
              {formatCOP(totalAbonado)}. Registrá los abonos a medida que el
              cliente pague.
            </p>
          </div>
        </div>
      )}

      {esCredito && saldoPendiente <= 0 && totalAbonado > 0 && (
        <div className="card p-4 mb-5 border border-emerald-300 bg-emerald-50 flex items-start gap-3">
          <CreditCard size={18} className="text-emerald-700 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold text-emerald-900">
            Crédito cancelado — {formatCOP(totalAbonado)} abonados en total
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">
            Resumen
          </h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Tipo</dt>
              <dd>
                {esDevolucion ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                    Devolución
                  </span>
                ) : venta.tipo_transaccion === 'cambio' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                    Cambio
                  </span>
                ) : (
                  <StatusBadge estado={venta.estado ?? 'completada'} />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Método</dt>
              <dd className="font-mono">{venta.metodo_pago}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Cliente</dt>
              <dd>
                {venta.cliente ? (
                  <Link
                    to={`/admin/clientes/${venta.cliente.id}`}
                    className="hover:text-[var(--color-primary)] inline-flex items-center gap-1"
                  >
                    <User size={11} /> {venta.cliente.nombre}
                  </Link>
                ) : (
                  <span className="text-[var(--color-text-faint)]">sin cliente</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Vendedor</dt>
              <dd>{venta.vendedor?.nombre ?? '—'}</dd>
            </div>
            {venta.descuento_motivo && (
              <div className="col-span-2">
                <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Descuento</dt>
                <dd className="text-sm">
                  {formatCOP(Number(venta.descuento_monto ?? 0))} — {venta.descuento_motivo}
                </dd>
              </div>
            )}
            {venta.notas && (
              <div className="col-span-2">
                <dt className="text-[var(--color-text-label)] text-xs mb-0.5">Notas</dt>
                <dd className="text-xs text-[var(--color-text-muted)]">{venta.notas}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-label)] mb-3">
            Montos
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-label)]">Subtotal</dt>
              <dd className="tabular-nums">{formatCOP(subtotal)}</dd>
            </div>
            {Number(venta.descuento_monto ?? 0) > 0 && (
              <div className="flex justify-between text-[var(--color-accent-red)]">
                <dt>Descuento</dt>
                <dd className="tabular-nums">−{formatCOP(Number(venta.descuento_monto))}</dd>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--color-border-light)]">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCOP(Number(venta.total ?? 0))}</dd>
            </div>
            {venta.efectivo_recibido != null && (
              <>
                <div className="flex justify-between text-xs pt-2">
                  <dt className="text-[var(--color-text-label)]">Efectivo recibido</dt>
                  <dd className="tabular-nums">{formatCOP(Number(venta.efectivo_recibido))}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-[var(--color-text-label)]">Vueltas</dt>
                  <dd className="tabular-nums">{formatCOP(Number(venta.vueltas ?? 0))}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3">Ítems</h3>
      <Table>
        <THead>
          <TR>
            <TH>SKU</TH>
            <TH>Variante</TH>
            <TH align="center">Cantidad</TH>
            <TH align="right">Precio unit</TH>
            <TH align="right">Subtotal</TH>
          </TR>
        </THead>
        <TBody>
          {items.map(it => (
            <TR key={it.id}>
              <TD className="font-mono text-xs">{it.variante?.sku ?? '—'}</TD>
              <TD>
                <span className="font-medium">{it.variante?.producto?.nombre ?? '—'}</span>
                <span className="block text-[11px] text-[var(--color-text-muted)]">
                  {[it.variante?.color, it.variante?.talla].filter(Boolean).join(' · ')}
                </span>
              </TD>
              <TD align="center">{it.cantidad}</TD>
              <TD align="right">{formatCOP(Number(it.precio_unitario))}</TD>
              <TD align="right" className="font-semibold">
                {formatCOP(Number(it.subtotal ?? 0))}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {pagos.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mt-6 mb-3">Pagos iniciales</h3>
          <Table>
            <THead>
              <TR>
                <TH>Método</TH>
                <TH>Referencia</TH>
                <TH>Comprobante</TH>
                <TH align="right">Monto</TH>
              </TR>
            </THead>
            <TBody>
              {pagos.map(p => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.metodo}</TD>
                  <TD className="text-xs text-[var(--color-text-muted)]">
                    {p.referencia ?? '—'}
                  </TD>
                  <TD>
                    {p.comprobante_url ? (
                      <ComprobanteLink path={p.comprobante_url} />
                    ) : (
                      <span className="text-[11px] text-[var(--color-text-faint)]">—</span>
                    )}
                  </TD>
                  <TD align="right" className="font-semibold">
                    {formatCOP(Number(p.monto))}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {abonos.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mt-6 mb-3">
            Abonos posteriores al crédito
          </h3>
          <Table>
            <THead>
              <TR>
                <TH>Fecha</TH>
                <TH>Método</TH>
                <TH>Referencia</TH>
                <TH align="right">Monto</TH>
              </TR>
            </THead>
            <TBody>
              {abonos.map(a => (
                <TR key={a.id}>
                  <TD className="text-xs">{formatDate(a.fecha)}</TD>
                  <TD className="font-mono text-xs">{a.metodo}</TD>
                  <TD className="text-xs text-[var(--color-text-muted)]">
                    {a.referencia ?? '—'}
                  </TD>
                  <TD align="right" className="font-semibold">
                    {formatCOP(Number(a.monto))}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      <AbonoModal
        open={abonoOpen}
        ventaId={venta.id}
        saldoPendiente={saldoPendiente}
        onClose={() => setAbonoOpen(false)}
        onSaved={() => setReloadKey(k => k + 1)}
      />
    </div>
  )
}

function ComprobanteLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setLoading(true)
    const { data, error } = await getComprobanteUrl(path, 3600)
    setLoading(false)
    if (error || !data?.signedUrl) return
    setUrl(data.signedUrl)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-[11px] text-[var(--color-primary)] underline"
    >
      {loading ? 'Abriendo…' : 'Ver foto'}
    </button>
  )
}
