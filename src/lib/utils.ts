import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(value: number, options?: { short?: boolean }): string {
  if (options?.short) {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
    return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`
  }
  return '$' + Math.round(value).toLocaleString('es-CO')
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Timestamp corto para timelines — formato "21/04/2026 · 3:42 PM" (Bogotá). */
export function formatShortDateTime(ts: number | string | null | undefined): string {
  if (ts == null) return ''
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return ''
  const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${fecha} · ${hora}`
}

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316']

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function daysSince(date: string | null | undefined): number {
  if (!date) return 0
  const d = new Date(date)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
}

/** Dispara descarga de un Blob en memoria. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
