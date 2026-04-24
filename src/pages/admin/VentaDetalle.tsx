import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import {
  PageHeader,
  StatusBadge,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCOP, formatShortDateTime } from '../../lib/utils'
import { getVentaDetalle } from '../../lib/queries/ventas'
import { getComprobanteUrl } from '../../lib/storage'
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

export default function VentaDetalle() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useToast()
  const [venta, setVenta] = useState<Venta | null>(null)
  const [items, setItems] = useState<VentaItem[]>([])
  const [pagos, setPagos] = useState<VentaPago[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getVentaDetalle(id).then(({ venta, items, pagos, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error)
        return
      }
      setVenta(venta as Venta)
      setItems((items ?? []) as VentaItem[])
      setPagos((pagos ?? []) as VentaPago[])
    })
    return () => {
      cancelled = true
    }
  }, [id, addToast])

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
  const subtotal = items.reduce(
    (s, i) => s + Number(i.subtotal ?? i.cantidad * Number(i.precio_unitario)),
    0,
  )

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
          esDevolucion && venta.venta_original_id ? (
            <Link
              to={`/admin/ventas/${venta.venta_original_id}`}
              className="text-xs text-[var(--color-primary)] underline"
            >
              Ver venta original →
            </Link>
          ) : null
        }
      />

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
          <h3 className="text-sm font-semibold mt-6 mb-3">Pagos</h3>
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
