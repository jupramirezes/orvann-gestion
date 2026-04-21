import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from '../lib/supabase'

/**
 * Suscripción al usuario de Supabase Auth. Retorna `null` si no hay sesión.
 * El App se encarga del gating inicial (redirect a Login); este hook se usa
 * dentro del admin para leer el usuario actual cuando hace falta (sidebar,
 * filtros personales, etc.).
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(isSupabaseReady)

  useEffect(() => {
    if (!isSupabaseReady) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
