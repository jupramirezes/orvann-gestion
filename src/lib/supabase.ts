import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''

export const isSupabaseReady =
  SUPABASE_URL.includes('.supabase.co') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('TU-ANON-KEY')

// Guard contra URL vacía para que el import no truene en entornos sin .env.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
export const supabase = createClient<Database>(
  isSupabaseReady ? SUPABASE_URL : PLACEHOLDER_URL,
  isSupabaseReady ? SUPABASE_ANON_KEY : 'placeholder-key-for-offline-mode',
)

/**
 * Fetch paginado que bypasea el límite de 1000 filas por defecto de Supabase.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<{ data: T[]; error: string | null }> {
  const PAGE = 1000
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1)
    if (error) return { data: all, error: error.message }
    if (data) all.push(...data)
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  return { data: all, error: null }
}
