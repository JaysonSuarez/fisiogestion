'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Heart, Loader2, Lock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Si no hay sesión (lo que indica que no llegó del link de reset) 
    // supabase auth onAuthStateChange manejará el token del hash de la url
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffafa] flex items-center justify-center p-6">
      <div className="w-full max-w-md relative z-10">

        <div className="text-center mb-10 text-rose-950 font-display">
          <div className="inline-flex p-4 bg-white rounded-[32px] shadow-xl shadow-rose-200/50 mb-6">
            <Heart size={40} className="text-rose-500" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter mb-2">Nueva Contraseña</h1>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.2em]">
            Establece tu nueva contraseña
          </p>
        </div>

        {success ? (
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[48px] shadow-2xl shadow-rose-200/40 border border-white/50 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h2 className="font-black text-rose-950 text-xl tracking-tighter mb-2">¡Contraseña Actualizada!</h2>
            <p className="text-sm font-medium text-rose-400 mb-6">
              Tu contraseña ha sido cambiada exitosamente.
            </p>
            <Link href="/app/login" className="w-full inline-flex py-4 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl justify-center hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs">
              Ir al Login
            </Link>
          </div>
        ) : (
          <form 
            onSubmit={handleUpdate}
            className="bg-white/80 backdrop-blur-xl p-8 rounded-[48px] shadow-2xl shadow-rose-200/40 border border-white/50 space-y-6"
          >
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center animate-shake">
                {error}
              </div>
            )}

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva Contraseña segura"
                className="w-full pl-12 pr-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-3xl outline-none transition-all font-medium text-rose-950 shadow-inner text-sm"
                required
                minLength={6}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Actualizar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
