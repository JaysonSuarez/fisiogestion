'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Heart, Sparkles, Loader2, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('liliana@fisio.com')
  const [password, setPassword] = useState('amor123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Verificar si ya hay una sesión al cargar para evitar el bucle
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/'
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    
    setLoading(true)
    setError(null)
    console.log('Intentando iniciar sesión...')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('Error de login:', signInError.message)
        
        // Si no existe, intentar crear
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('Usuario no encontrado, intentando registrar...')
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          })
          if (signUpError) throw signUpError
          setError('Cuenta creada. Por favor, intenta entrar de nuevo.')
        } else {
          throw signInError
        }
      } else if (data.session) {
        console.log('Login exitoso, redirigiendo...')
        // Usamos window.location.href para forzar que el middleware recoja las cookies frescas
        window.location.href = '/'
      }
    } catch (err: any) {
      console.error('Captura de error:', err)
      setError(err.message || 'Error al ingresar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffafa] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-200/30 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 text-rose-950 font-display">
          <div className="inline-flex p-4 bg-white rounded-[32px] shadow-xl shadow-rose-200/50 mb-6">
            <Heart size={40} className="text-rose-500" fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">FisioGestión</h1>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em]">Software de Bendición</p>
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

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>Ingresar <Sparkles size={18} /></>
            )}
          </button>
        </form>

        <p className="text-center mt-10 text-rose-300 text-[10px] font-bold uppercase tracking-widest italic flex items-center justify-center gap-2">
           Hecho con ❤️ para la Fisio Liliana
        </p>
      </div>
    </div>
  )
}
