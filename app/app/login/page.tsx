'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Heart, Loader2, Phone, User } from 'lucide-react'

export default function PatientLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const identityResponse = await fetch('/api/patient/resolve-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const identity = await identityResponse.json()
      if (!identityResponse.ok) throw new Error(identity.error || 'Credenciales inválidas')
      const { data, error } = await supabase.auth.setSession({ access_token: identity.access_token, refresh_token: identity.refresh_token })
      if (error) throw error
      if (identity.must_change_password || data.user?.app_metadata?.must_change_password) {
        window.location.href = '/app/cambiar-clave'
        return
      }
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
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
              <input 
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu primer nombre"
                className="w-full pl-12 pr-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-3xl outline-none transition-all font-medium text-rose-950 shadow-inner"
                required
              />
            </div>

            <div className="relative group">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
              <input 
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña inicial es tu teléfono"
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
            <span className="text-right text-xs font-bold text-rose-500">¿Problemas para entrar? Comunícate con la clínica.</span>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Ingresar'}
          </button>
          
          <div className="mt-6 pt-6 border-t border-rose-100 text-center">
            <p className="text-xs text-rose-400 font-medium">Si eres paciente, tu acceso se habilita al registrarte en la clínica. Si no puedes entrar, comunícate con nosotros.</p>
          </div>
        </form>
      </div>
    </div>
  )
}
