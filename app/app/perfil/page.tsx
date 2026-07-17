'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User, LogOut, Share2, Ticket } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setPerfil(data)
      setLoading(false)
    }
    loadPerfil()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/app/login'
  }

  const handleShare = async () => {
    if (!perfil) return
    const text = `¡Agenda tu cita de fisioterapia con Liliana! Usa mi código de referido ${perfil.codigo_referido} al registrarte en la app. Descárgala aquí: ${window.location.origin}/app`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Referido FisioGestión',
          text: text,
        })
      } catch (err) {
        console.error('Error sharing', err)
      }
    } else {
      navigator.clipboard.writeText(text)
      alert('Código copiado al portapapeles')
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando perfil...</div>
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display italic text-3xl text-rose-950 tracking-tighter mb-8">
        Mi Perfil
      </h1>

      <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-rose-100/50 border border-rose-50 mb-6 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-rose-400 to-rose-600 rounded-[32px] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200">
          <User size={40} className="text-white" />
        </div>
        <h2 className="font-black text-2xl text-rose-950 tracking-tighter">
          {perfil?.nombre} {perfil?.apellido}
        </h2>
        <p className="text-xs text-rose-400 font-bold uppercase tracking-widest mt-1">
          {perfil?.telefono}
        </p>
      </div>

      {/* Referidos */}
      <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-[32px] p-6 shadow-xl shadow-rose-300 text-white mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Ticket size={24} />
          </div>
          <div>
            <h3 className="font-black tracking-tighter text-lg">Gana Recompensas</h3>
            <p className="text-[10px] text-white/80 uppercase tracking-widest font-bold">Sesión gratis al 7mo referido</p>
          </div>
        </div>
        
        <div className="bg-rose-900/40 rounded-2xl p-4 flex items-center justify-between mb-4">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-white/70 font-bold mb-1">Tu código único</p>
            <p className="font-black text-xl tracking-widest">{perfil?.codigo_referido}</p>
          </div>
          <button 
            onClick={handleShare}
            className="w-10 h-10 bg-white text-rose-600 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-bold text-white/90">Personas referidas:</span>
            <span className="font-black flex items-center gap-1">
              <span className="text-white/80 text-xs tracking-widest">
                {Array.from({ length: perfil?.referidos_completados || 0 }).map((_, i) => '*').join(' ')}
              </span>
              <span>(Llevas {perfil?.referidos_completados || 0})</span>
            </span>
          </div>
          {perfil?.descuentos_disponibles > 0 && (
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-bold text-emerald-300">Descuentos 15% disponibles:</span>
              <span className="font-black text-emerald-400">{perfil.descuentos_disponibles}</span>
            </div>
          )}
          {perfil?.sesiones_gratis > 0 && (
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-bold text-amber-300">¡Sesiones GRATIS!:</span>
              <span className="font-black text-amber-400">{perfil.sesiones_gratis}</span>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-rose-950/20 rounded-xl">
          <p className="text-[9px] text-white/80 font-medium leading-relaxed">
            <strong className="font-bold text-white uppercase tracking-widest">Importante:</strong> Para recibir tu recompensa, la persona que invites debe registrarse usando tu código y <strong className="text-white">agendar su primera cita obligatoriamente desde esta aplicación</strong>.
          </p>
        </div>
      </div>

      {/* Settings / Logout */}
      <button 
        onClick={handleLogout}
        className="w-full bg-white rounded-3xl p-5 flex items-center justify-between shadow-sm border border-rose-50 hover:bg-rose-50 transition-colors"
      >
        <span className="font-bold text-rose-950 text-sm">Cerrar Sesión</span>
        <LogOut size={20} className="text-rose-300" />
      </button>
    </div>
  )
}
