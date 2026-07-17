'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Clock, CheckCircle, XCircle } from 'lucide-react'
import { format, isFuture, isPast, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { format12h } from '@/lib/utils'

export default function MisCitasPage() {
  const [citas, setCitas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCitas() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('patient_profiles')
        .select('paciente_id')
        .eq('id', user.id)
        .single()

      if (profile?.paciente_id) {
        const { data } = await supabase
          .from('citas')
          .select('*')
          .eq('paciente_id', profile.paciente_id)
          .order('fecha', { ascending: false })
          .order('hora_inicio', { ascending: false })
        setCitas(data || [])
      }
      setLoading(false)
    }
    loadCitas()
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando citas...</div>
  }

  const upcoming = citas.filter(c => (isFuture(new Date(c.fecha + 'T' + c.hora_inicio)) || isSameDay(new Date(c.fecha + 'T12:00:00'), new Date())) && c.estado !== 'cancelada' && c.estado !== 'completada').reverse()
  const past = citas.filter(c => !upcoming.includes(c))

  return (
    <div className="px-6 py-8">
      <h1 className="font-display italic text-3xl text-rose-950 tracking-tighter mb-8">
        Mis Citas
      </h1>

      {citas.length === 0 ? (
        <div className="bg-white rounded-[32px] p-8 text-center shadow-xl shadow-rose-100/50 border border-rose-50">
          <CalendarDays size={48} className="text-rose-200 mx-auto mb-4" />
          <p className="text-rose-400 font-medium mb-1">Aún no tienes citas.</p>
          <p className="text-xs text-rose-300 font-bold uppercase tracking-widest">Ve a agendar tu primera sesión.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-4">Próximas</h2>
              <div className="space-y-4">
                {upcoming.map(cita => (
                  <CitaCard key={cita.id} cita={cita} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Historial</h2>
              <div className="space-y-4 opacity-70">
                {past.map(cita => (
                  <CitaCard key={cita.id} cita={cita} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function CitaCard({ cita }: { cita: any }) {
  const isCancelled = cita.estado === 'cancelada'
  const isCompleted = cita.estado === 'completada'
  
  let bgClass = 'bg-white border-rose-50'
  let icon = <Clock size={20} className="text-rose-400" />
  let statusText = 'Confirmada'
  let statusClass = 'text-emerald-500 bg-emerald-50'

  if (isCancelled) {
    bgClass = 'bg-slate-50 border-slate-100'
    icon = <XCircle size={20} className="text-slate-400" />
    statusText = 'Cancelada'
    statusClass = 'text-slate-500 bg-slate-200/50'
  } else if (isCompleted) {
    bgClass = 'bg-slate-50 border-slate-100'
    icon = <CheckCircle size={20} className="text-emerald-400" />
    statusText = 'Completada'
    statusClass = 'text-slate-500 bg-slate-200/50'
  }

  return (
    <div className={`rounded-[24px] p-5 shadow-lg shadow-rose-100/30 border flex items-center gap-4 ${bgClass}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-black text-rose-950 text-lg tracking-tighter">
          {format(new Date(cita.fecha + 'T12:00:00'), "d MMM yyyy", { locale: es })}
        </p>
        <p className="text-xs text-rose-400 font-bold uppercase tracking-widest">
          {format12h(cita.hora_inicio)}
        </p>
      </div>
      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusClass}`}>
        {statusText}
      </div>
    </div>
  )
}
