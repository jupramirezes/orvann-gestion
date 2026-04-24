import { useEffect, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase'
import { useToast } from './Toast'
import { formatCOP } from '../lib/utils'
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js'

type VentaRow = {
  id: string
  estado: string | null
  tipo_transaccion: string | null
  total: number | null
  metodo_pago: string | null
}

/**
 * Reproduce un beep corto con Web Audio — sin archivo externo, funciona
 * en casi cualquier browser moderno. Se activa en un user gesture (en
 * nuestro caso vive tras un submit desde otro device), así que puede
 * fallar por autoplay policy en algunos casos; el toast igual se ve.
 */
function playBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    // Cerrar el ctx para liberar recursos después del beep
    setTimeout(() => ctx.close().catch(() => {}), 400)
  } catch {
    // silent — el toast es el fallback
  }
}

function maybeShowBrowserNotification(total: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification('ORVANN — Nueva venta', {
      body: `Total ${formatCOP(total)}`,
      tag: 'orvann-venta', // agrupa notifs seguidas
      silent: false,
    })
    setTimeout(() => n.close(), 5000)
  } catch {
    // silent
  }
}

/**
 * Se monta una vez dentro del admin. Suscribe al evento UPDATE de
 * `ventas` y dispara toast + beep + notificación del navegador cuando
 * una venta pasa de estado != 'completada' a 'completada' (momento en
 * que nuestro flujo de /pos/cobro considera una venta registrada).
 *
 * Pide permiso de notificación la primera vez que se carga.
 */
export function AdminRealtimeNotifier() {
  const { addToast } = useToast()
  const permissionRequested = useRef(false)

  useEffect(() => {
    if (
      !permissionRequested.current &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      permissionRequested.current = true
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseReady) return

    const channel = supabase
      .channel('admin-ventas-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ventas' },
        (payload: RealtimePostgresUpdatePayload<VentaRow>) => {
          const vieja = payload.old?.estado
          const nueva = payload.new?.estado
          const tipo = payload.new?.tipo_transaccion ?? 'venta'
          if (nueva !== 'completada' || vieja === 'completada') return
          if (tipo !== 'venta') return // devoluciones/cambios los manejamos aparte

          const total = Number(payload.new?.total ?? 0)
          const metodo = payload.new?.metodo_pago ?? 'efectivo'
          addToast(
            'success',
            `🛒 Nueva venta · ${formatCOP(total)} (${metodo})`,
          )
          playBeep()
          maybeShowBrowserNotification(total)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [addToast])

  return null
}
