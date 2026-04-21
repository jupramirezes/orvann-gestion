/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// Global toast para usar fuera de componentes React (ej. desde hooks de sync).
let _globalAddToast: ((type: ToastType, message: string) => void) | null = null
export function showToast(type: ToastType, message: string) {
  if (_globalAddToast) _globalAddToast(type, message)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts(prev => [...prev.slice(-2), { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  useEffect(() => { _globalAddToast = addToast; return () => { _globalAddToast = null } }, [addToast])

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle }
  const colors = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] border shadow-card ${colors[t.type]} animate-[slideIn_0.2s_ease-out]`}>
              <Icon size={16} className="shrink-0 mt-0.5" />
              <span className="text-xs flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
