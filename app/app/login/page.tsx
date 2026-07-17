'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Heart, Loader2, Mail, Lock, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function PatientLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      window.location.href = '/app'
    } catch (err: any) {
      setError('Credenciales inválidas')
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
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">Liliana's Therapy</h1>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em]">Bienvenido Paciente</p>
        </div>

        <form 
          onSubmit={handleLogin}
          className="bg-white/80 backdrop-blur-xl p-8 rounded-[48px] shadow-2xl shadow-rose-200/40 border border-white/50 space-y-6"
        >
          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="w-full pl-12 pr-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-3xl outline-none transition-all font-medium text-rose-950 shadow-inner"
                required
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full pl-12 pr-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-3xl outline-none transition-all font-medium text-rose-950 shadow-inner"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input type="checkbox" className="peer sr-only" defaultChecked />
                <div className="w-5 h-5 border-2 border-rose-200 rounded-lg peer-checked:bg-rose-500 peer-checked:border-rose-500 transition-colors flex items-center justify-center">
                  <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-400 group-hover:text-rose-600 transition-colors">Recordar sesión</span>
            </label>
            <Link href="/app/recuperar-password" className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Ingresar'}
          </button>
          
          <div className="mt-6 pt-6 border-t border-rose-100 text-center">
            <p className="text-xs text-rose-400 font-medium mb-3">¿No tienes cuenta?</p>
            <Link href="/app/registro" className="inline-flex items-center justify-center gap-2 w-full py-4 bg-rose-50 text-rose-600 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-colors">
              Crear cuenta <ChevronRight size={14} />
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
