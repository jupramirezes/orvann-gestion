import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Tag, User } from 'lucide-react'
import { useCarrito } from '../../hooks/useCarrito'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/Toast'
import { formatCOP } from '../../lib/utils'
import { createVentaCompleta } from '../../lib/queries/ventas'
import { uploadComprobante } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { Cliente } from '../../lib/queries/clientes'
import {
  MetodoPagoRow,
  type PagoDraft,
} from '../../components/pos/MetodoPagoRow'
import { ClienteSearchInput } from '../../components/pos/ClienteSearchInput'
import { DescuentoModal } from '../../components/pos/DescuentoModal'
import { POSFooterFixed } from '../../components/pos/POSFooterFixed'
import { MoneyInput } from '../../components/MoneyInput'

/**
 * Pantalla de cobro del POS. Orquesta pagos mixtos, cliente opcional,
 * descuento global con motivo, efectivo recibido/vueltas y foto de
 * comprobante para transferencia/datáfono. Al confirmar llama a
 * `createVentaCompleta` (ventas + items + pagos) y sube las fotos
 * post-creación con el venta_id como path.
 */
export default function Cobro() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const { items, subtotal, clear } = useCarrito()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [descuento, setDescuento] = useState({ monto: 0, motivo: '' })
  const [descuentoOpen, setDescuentoOpen] = useState(false)

  const [pagos, setPagos] = useState<PagoDraft[]>([
    { metodo: 'efectivo', monto: 0, referencia: '', foto: null },
  ])

  const [efectivoRecibido, setEfectivoRecibido] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const total = useMemo(
    () => Math.max(0, subtotal - descuento.monto),
    [subtotal, descuento.monto],
  )
  const sumaPagos = useMemo(
    () => pagos.reduce((s, p) => s + (p.monto || 0), 0),
    [pagos],
  )
  const pendiente = total - sumaPagos

  const montoEfectivo = useMemo(
    () =>
      pagos
        .filter(p => p.metodo === 'efectivo')
        .reduce((s, p) => s + (p.monto || 0), 0),
    [pagos],
  )
  const hayEfectivo = montoEfectivo > 0
  const vueltas = hayEfectivo ? Math.max(0, efectivoRecibido - montoEfectivo) : 0

  function addPago() {
    setPagos(prev => [
      ...prev,
      {
        metodo: 'transferencia',
        monto: Math.max(0, pendiente),
        referencia: '',
        foto: null,
      },
    ])
  }

  function updatePago(idx: number, p: PagoDraft) {
    setPagos(prev => prev.map((x, i) => (i === idx ? p : x)))
  }

  function removePago(idx: number) {
    setPagos(prev => prev.filter((_, i) => i !== idx))
  }

  function autocompletarUnico() {
    if (pagos.length === 1 && pagos[0]) {
      setPagos([{ ...pagos[0], monto: total }])
    }
  }

  const hayCredito = pagos.some(p => p.metodo === 'credito' && p.monto > 0)
  const necesitaCliente = hayCredito && !cliente

  const puedeConfirmar =
    items.length > 0 &&
    total > 0 &&
    Math.abs(sumaPagos - total) <= 1 &&
    pagos.every(p => p.monto > 0) &&
    !necesitaCliente &&
    !submitting &&
    (!hayEfectivo || efectivoRecibido >= montoEfectivo)

  async function handleConfirmar() {
    if (!puedeConfirmar) return
    setSubmitting(true)

    const { data: venta, error } = await createVentaCompleta({
      items: items.map(it => ({
        variante_id: it.varianteId,
        cantidad: it.cantidad,
        precio_unitario: it.precioAplicado,
        costo_unitario: it.costoUnitario,
      })),
      pagos: pagos.map(p => ({
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.referencia.trim() || null,
      })),
      descuento_monto: descuento.monto,
      descuento_motivo: descuento.motivo || null,
      cliente_id: cliente?.id ?? null,
      vendedor_id: user?.id ?? null,
      efectivo_recibido: hayEfectivo ? efectivoRecibido : null,
      vueltas: hayEfectivo ? vueltas : null,
    })

    if (error || !venta) {
      setSubmitting(false)
      addToast('error', error ?? 'No se pudo crear la venta')
      return
    }

    // Subir fotos y asociarlas a cada venta_pagos (best-effort)
    const fotosPagos = pagos.filter(p => p.foto)
    if (fotosPagos.length > 0) {
      const { data: pagosDB } = await supabase
        .from('venta_pagos')
        .select('id, metodo, monto')
        .eq('venta_id', venta.id)

      for (const p of fotosPagos) {
        if (!p.foto) continue
        const { path } = await uploadComprobante(venta.id, p.foto)
        if (!path) continue
        const match = (pagosDB ?? []).find(
          pdb =>
            pdb.metodo === p.metodo && Math.abs(Number(pdb.monto) - p.monto) < 1,
        )
        if (match) {
          await supabase
            .from('venta_pagos')
            .update({ comprobante_url: path })
            .eq('id', match.id)
        }
      }
    }

    addToast('success', 'Venta registrada')
    clear()
    setSubmitting(false)
    navigate('/pos', { replace: true })
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-sm font-medium">Carrito vacío</p>
        <p className="text-xs text-[var(--color-text-label)] mt-1">
          Agregá productos antes de cobrar.
        </p>
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="mt-6 h-11 px-5 rounded-lg bg-[var(--color-text)] text-[var(--color-surface)] text-sm font-semibold"
        >
          Ver catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="pb-40">
      <div className="bg-[var(--color-bg)] border-b border-[var(--color-border-light)] px-4 py-3">
        <Link
          to="/pos/carrito"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]"
        >
          <ArrowLeft size={16} /> Volver al carrito
        </Link>
        <h1 className="text-xl font-bold text-[var(--color-text)] mt-1">Cobrar</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Resumen items — card con detalle por ítem para revisar antes de cobrar */}
        <section>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-2">
            Resumen ({items.length} {items.length === 1 ? 'ítem' : 'ítems'})
          </p>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-light)]">
            {items.map(it => (
              <div key={it.varianteId} className="flex gap-3 p-3">
                <div className="w-12 h-12 rounded-md bg-[var(--color-surface-2)] overflow-hidden shrink-0 flex items-center justify-center">
                  {it.imagenUrl ? (
                    <img
                      src={it.imagenUrl}
                      alt={it.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] p-1 text-center leading-tight">
                      {it.sku}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">
                    {it.nombre}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-faint)] font-mono mt-0.5 truncate">
                    {it.sku}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-[var(--color-text-muted)] tabular-nums">
                      {it.cantidad} × {formatCOP(it.precioAplicado)}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatCOP(it.precioAplicado * it.cantidad)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Descuento */}
        <section>
          <button
            type="button"
            onClick={() => setDescuentoOpen(true)}
            className="w-full flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 h-11 text-sm"
          >
            <span className="flex items-center gap-2">
              <Tag size={14} />
              {descuento.monto > 0
                ? `Descuento ${formatCOP(descuento.monto)}`
                : 'Agregar descuento'}
            </span>
            {descuento.motivo && (
              <span className="text-[11px] text-[var(--color-text-label)] truncate max-w-[45%]">
                {descuento.motivo}
              </span>
            )}
          </button>
        </section>

        {/* Cliente */}
        <section>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold mb-2 flex items-center gap-1.5">
            <User size={11} /> Cliente{' '}
            <span className="normal-case text-[var(--color-text-faint)]">
              (opcional)
            </span>
          </p>
          <ClienteSearchInput value={cliente} onChange={setCliente} />
        </section>

        {/* Pagos */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-label)] font-semibold">
              Pagos
            </p>
            <button
              type="button"
              onClick={addPago}
              className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] font-medium"
            >
              <Plus size={12} /> Agregar método
            </button>
          </div>
          <div className="space-y-2">
            {pagos.map((p, i) => (
              <MetodoPagoRow
                key={i}
                pago={p}
                onChange={np => updatePago(i, np)}
                onRemove={() => removePago(i)}
                canRemove={pagos.length > 1}
              />
            ))}
            {pagos.length === 1 && pagos[0] && pagos[0].monto !== total && total > 0 && (
              <button
                type="button"
                onClick={autocompletarUnico}
                className="text-[11px] text-[var(--color-primary)] underline"
              >
                Asignar {formatCOP(total)} al único pago
              </button>
            )}
          </div>
        </section>

        {/* Efectivo recibido + vueltas */}
        {hayEfectivo && (
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Efectivo entregado por el cliente
            </label>
            <MoneyInput
              value={efectivoRecibido}
              onChange={setEfectivoRecibido}
              placeholder={`${montoEfectivo}`}
              step="1000"
              min="0"
              className="h-12"
            />
            {vueltas > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">
                  Vueltas
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-emerald-600">
                  {formatCOP(vueltas)}
                </span>
              </div>
            )}
          </section>
        )}

        {/* Totales */}
        <section className="rounded-lg bg-[var(--color-surface-2)] p-3 space-y-1 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCOP(subtotal)}</span>
          </div>
          {descuento.monto > 0 && (
            <div className="flex justify-between text-[var(--color-accent-red)]">
              <span>Descuento</span>
              <span className="tabular-nums">−{formatCOP(descuento.monto)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--color-border-light)]">
            <span>Total a cobrar</span>
            <span className="tabular-nums">{formatCOP(total)}</span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-[var(--color-text-label)]">Pagado</span>
            <span className="tabular-nums font-medium">
              {formatCOP(sumaPagos)}
            </span>
          </div>
          {Math.abs(pendiente) > 1 && (
            <div
              className={`flex justify-between text-xs font-semibold ${
                pendiente > 0
                  ? 'text-[var(--color-accent-red)]'
                  : 'text-[var(--color-accent-orange)]'
              }`}
            >
              <span>{pendiente > 0 ? 'Falta' : 'Sobra'}</span>
              <span className="tabular-nums">
                {formatCOP(Math.abs(pendiente))}
              </span>
            </div>
          )}
        </section>
      </div>

      {/* CTA fijo centrado dentro del shell POS */}
      <POSFooterFixed>
        {necesitaCliente && (
          <p className="text-[11px] font-semibold text-[var(--color-accent-red)] mb-2 text-center">
            Asociá un cliente antes de cobrar a crédito
          </p>
        )}
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={!puedeConfirmar}
          className="w-full h-14 rounded-xl bg-[var(--color-text)] text-[var(--color-surface)] font-bold text-base disabled:opacity-40"
        >
          {submitting
            ? 'Registrando…'
            : `Confirmar venta · ${formatCOP(total)}`}
        </button>
      </POSFooterFixed>

      <DescuentoModal
        open={descuentoOpen}
        subtotal={subtotal}
        descuentoActual={descuento.monto}
        motivoActual={descuento.motivo}
        onApply={(monto, motivo) => setDescuento({ monto, motivo })}
        onClose={() => setDescuentoOpen(false)}
      />
    </div>
  )
}
