import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : err.message,
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] animate-scale-in">
        <div className="text-center mb-10">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-[32px] font-extrabold text-white tracking-tight">ORVANN</span>
            <span className="text-[32px] font-extrabold text-[var(--color-primary)]">Gestión</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 tracking-wider font-medium">
            Sistema de operación — Medellín
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white/[0.05] backdrop-blur-xl rounded-[20px] p-10 shadow-2xl border border-white/[0.08]"
        >
          <h2 className="text-white font-bold text-xl mb-8 tracking-tight">Iniciar sesión</h2>

          <label className="block text-[13px] text-slate-400 mb-2 font-medium">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full px-5 h-[52px] rounded-xl bg-white/[0.06] border border-white/10 text-white text-[15px] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent mb-5"
            placeholder="tu@orvann.co"
          />

          <label className="block text-[13px] text-slate-400 mb-2 font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-5 h-[52px] rounded-xl bg-white/[0.06] border border-white/10 text-white text-[15px] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent mb-7"
            placeholder="••••••••"
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-5 py-3 mb-5 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-base font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-[11px] text-slate-600 text-center mt-8 font-medium">
          ORVANN · Uso interno
        </p>
      </div>
    </div>
  )
}
