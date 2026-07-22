'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Instagram, Calendar, ChevronRight, Gift, Tag } from 'lucide-react'
import Link from 'next/link'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import Script from 'next/script'
import { format12h } from '@/lib/utils'

export default function PatientHomePage() {
  const [perfil, setPerfil] = useState<any>(null)
  const [proximaCita, setProximaCita] = useState<any>(null)
  const [promociones, setPromociones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar Perfil
      const { data: profile } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setPerfil(profile)

      if (profile?.paciente_id) {
        // Cargar próxima cita
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const { data: citas } = await supabase
          .from('citas')
          .select('*')
          .eq('paciente_id', profile.paciente_id)
          .gte('fecha', todayStr)
          .neq('estado', 'cancelada')
          .neq('estado', 'completada')
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true })
          .limit(1)
        
        if (citas && citas.length > 0) {
          setProximaCita(citas[0])
        }
      }

      // Cargar Promociones
      const { data: promos } = await supabase
        .from('promociones')
        .select('*')
        .eq('activa', true)
        .order('created_at', { ascending: false })
      setPromociones(promos || [])
      
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando...</div>
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display italic text-3xl text-rose-950 tracking-tighter">
            Hola, {perfil?.nombre || 'Paciente'} 👋
          </h1>
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mt-1">
            Bienvenido(a) de nuevo
          </p>
        </div>
        <div className="w-12 h-12 bg-white rounded-[20px] shadow-xl shadow-rose-200/50 flex items-center justify-center border border-rose-50">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        </div>
      </div>

      {/* Promociones */}
      {promociones.length > 0 && (
        <div className="mb-8">
           <h2 className="text-xs font-black text-rose-950 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Gift size={14} className="text-rose-500" /> Promociones
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 snap-x snap-mandatory hide-scrollbar">
            {promociones.map((promo) => (
              <div key={promo.id} className="min-w-[280px] sm:min-w-[320px] bg-white rounded-[32px] p-5 shadow-xl shadow-rose-100/50 border border-rose-50 snap-center relative overflow-hidden">
                {/* Descuento Ribbon */}
                {promo.porcentaje_descuento && (
                  <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Tag size={10} />
                    -{promo.porcentaje_descuento}%
                  </div>
                )}
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                  <Gift size={20} className="text-rose-500" />
                </div>
                <h3 className="font-black text-lg text-rose-950 leading-tight mb-2">{promo.titulo}</h3>
                <p className="text-xs text-rose-400 font-medium mb-4 line-clamp-2">{promo.descripcion}</p>
                {promo.porcentaje_descuento && (
                  <div className="flex items-end gap-2">
                    <span className="font-black text-xl text-rose-600">{promo.porcentaje_descuento}% DTO</span>
                  </div>
                )}
                <button 
                  onClick={() => {
                    localStorage.setItem('activePromo', JSON.stringify(promo));
                    window.location.href = '/app/agendar';
                  }}
                  className="mt-5 w-full py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-colors flex justify-center items-center gap-2"
                >
                  Aprovechar <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próxima Cita Widget */}
      <div className="mb-8">
        <h2 className="text-xs font-black text-rose-950 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-rose-500" /> Próxima Cita
        </h2>
        {proximaCita ? (
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-[32px] p-6 shadow-xl shadow-rose-300 relative overflow-hidden text-white">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <p className="text-rose-200 text-[10px] font-bold uppercase tracking-widest mb-1">
                  {isSameDay(new Date(proximaCita.fecha + 'T12:00:00'), new Date()) ? 'HOY' : format(new Date(proximaCita.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="font-black text-3xl tracking-tighter">
                  {format12h(proximaCita.hora_inicio)}
                </p>
              </div>
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                <Calendar size={24} />
              </div>
            </div>
            <div className="mt-6 flex justify-between items-center">
              <span className="text-xs font-medium bg-rose-900/40 px-3 py-1.5 rounded-full">
                En consultorio
              </span>
              <Link href="/app/mis-citas" className="text-xs font-bold flex items-center gap-1 hover:text-rose-200 transition-colors">
                Ver detalle <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-rose-100/50 border border-rose-50 text-center">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar size={20} className="text-rose-300" />
            </div>
            <p className="text-sm font-bold text-rose-950 mb-4">No tienes citas próximas</p>
            <Link 
              href="/app/agendar"
              className="inline-flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors"
            >
              Agendar Ahora
            </Link>
          </div>
        )}
      </div>



      {/* Instagram Connect */}
      <div className="mb-8">
        <h2 className="text-xs font-black text-rose-950 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Instagram size={14} className="text-pink-500" /> Nuestro Instagram
        </h2>
        
        {/* Contenedor del Widget de Elfsight */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-xl shadow-rose-100/50 border border-rose-50 mb-4 min-h-[300px]">
          <Script src="https://elfsightcdn.com/platform.js" strategy="lazyOnload" />
          <div className="elfsight-app-fc8bf5f9-f21c-4ebf-90a7-29eb86217bf8" data-elfsight-app-lazy></div>
        </div>

        <a 
          href="https://www.instagram.com/liliana_therapy"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] rounded-3xl p-1 shadow-lg shadow-pink-200/50 hover:scale-[1.02] transition-transform active:scale-95"
        >
          <div className="bg-white rounded-[20px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] p-0.5">
                <div className="bg-white w-full h-full rounded-full flex items-center justify-center">
                  <Instagram size={16} className="text-pink-600" />
                </div>
              </div>
              <div>
                <p className="font-black text-sm text-rose-950 tracking-tighter">@liliana_therapy</p>
                <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">Síguenos</p>
              </div>
            </div>
            <span className="text-[10px] font-black text-pink-600 bg-pink-50 px-3 py-1.5 rounded-full">Abrir App</span>
          </div>
        </a>
      </div>
    </div>
  )
}
