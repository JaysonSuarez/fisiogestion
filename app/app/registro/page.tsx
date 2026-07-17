'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Heart, Loader2, Mail, Lock, User, Phone, Ticket, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function PatientRegistroPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    tipo_documento: 'CC',
    documento_numero: '',
    sexo: 'Femenino',
    edad: '',
    telefono: '',
    email: '',
    password: '',
    codigo_referido_input: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: any) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Verificar si el código de referido existe (si se ingresó)
      let referidoPorId = null
      if (formData.codigo_referido_input.trim()) {
        const { data: refUser } = await supabase
          .from('patient_profiles')
          .select('id')
          .eq('codigo_referido', formData.codigo_referido_input.trim().toUpperCase())
          .single()
        
        if (!refUser) {
          throw new Error('El código de referido no existe.')
        }
        referidoPorId = refUser.id
      }

      // 2. Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Error al crear usuario')

      // 3. Generar código propio
      const randomNum = Math.floor(1000 + Math.random() * 9000)
      const ownCode = `LILO-${formData.nombre.substring(0,3).toUpperCase()}-${randomNum}`

      // 4. Crear Perfil
      const { error: profileError } = await supabase
        .from('patient_profiles')
        .insert({
          id: authData.user.id,
          nombre: formData.nombre,
          apellido: formData.apellido,
          tipo_documento: formData.tipo_documento,
          documento_numero: formData.documento_numero,
          sexo: formData.sexo,
          edad: parseInt(formData.edad),
          telefono: formData.telefono,
          codigo_referido: ownCode,
          referido_por: referidoPorId
        })

      if (profileError) {
        // Fallback si falla el insert
        console.error('Error insert profile:', profileError)
      }

      window.location.href = '/app'
    } catch (err: any) {
      setError(err.message || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fffafa] py-10 px-6">
      <div className="w-full max-w-md mx-auto relative z-10">
        
        <Link href="/app/login" className="inline-flex items-center gap-1 text-rose-400 font-bold text-xs uppercase tracking-widest mb-6 hover:text-rose-600 transition-colors">
          <ChevronLeft size={16} /> Volver
        </Link>

        <div className="text-center mb-10 text-rose-950 font-display">
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">Crear Cuenta</h1>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em]">Únete a FisioGestión</p>
        </div>

        <form 
          onSubmit={handleRegister}
          className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-[48px] shadow-2xl shadow-rose-200/40 border border-white/50 space-y-4"
        >
          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center animate-shake">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre" className="input-field" required />
            <input name="apellido" value={formData.apellido} onChange={handleChange} placeholder="Apellido" className="input-field" required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <select name="tipo_documento" value={formData.tipo_documento} onChange={handleChange} className="input-field col-span-1 appearance-none">
              <option value="CC">CC</option>
              <option value="TI">TI</option>
              <option value="CE">CE</option>
            </select>
            <input name="documento_numero" value={formData.documento_numero} onChange={handleChange} placeholder="Número Doc." className="input-field col-span-2" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <select name="sexo" value={formData.sexo} onChange={handleChange} className="input-field appearance-none">
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
            </select>
            <input name="edad" type="number" value={formData.edad} onChange={handleChange} placeholder="Edad" className="input-field" required />
          </div>

          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={20} />
            <input name="telefono" type="tel" value={formData.telefono} onChange={handleChange} placeholder="Teléfono" className="input-field pl-12" required />
          </div>

          <hr className="border-rose-100 my-4" />

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={20} />
            <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Correo Electrónico" className="input-field pl-12" required />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={20} />
            <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Contraseña segura" className="input-field pl-12" required />
          </div>

          <div className="relative group mt-6">
            <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={20} />
            <input 
              name="codigo_referido_input" 
              value={formData.codigo_referido_input} 
              onChange={handleChange} 
              placeholder="Código de referido (Opcional)" 
              className="w-full pl-12 pr-4 py-4 bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-300 focus:bg-emerald-50/50 rounded-3xl outline-none transition-all font-medium text-emerald-900 shadow-inner uppercase" 
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 mt-4 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Registrarse'}
          </button>
        </form>
      </div>
      <style jsx>{`
        .input-field {
          @apply w-full px-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-rose-950 shadow-inner text-sm;
        }
      `}</style>
    </div>
  )
}
