'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  Calendar as CalendarIcon, 
  Clock,
  Loader2,
  Sparkles,
  Flower2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<any[]>([])
  
  // Para navegación móvil (ver un día a la vez si es necesario o scroll mejorado)
  const now = new Date()
  const [startOfCurrentWeek, setStartOfCurrentWeek] = useState(startOfWeek(now, { weekStartsOn: 1 }))
  const todayDateStr = format(now, 'yyyy-MM-dd')

  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const day = addDays(startOfCurrentWeek, i)
    return {
      label: format(day, 'eee', { locale: es }),
      num: format(day, 'd'),
      fecha: format(day, 'yyyy-MM-dd'),
      today: isSameDay(day, now)
    }
  })

  async function loadCitas() {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('citas')
        .select('*, pacientes(nombre)')
        .gte('fecha', format(startOfCurrentWeek, 'yyyy-MM-dd'))
        .lte('fecha', format(addDays(startOfCurrentWeek, 5), 'yyyy-MM-dd'))
        .order('hora_inicio')
      setCitas(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCitas()

    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadCitas())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [startOfCurrentWeek])

  const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00']

  if (loading && citas.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20 relative">
      <div className="absolute top-20 right-0 text-rose-100/30 -z-10 rotate-12">
        <Flower2 size={200} />
      </div>

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="font-display italic text-5xl mb-2 flex items-center gap-3 text-rose-950">
            <CalendarIcon className="text-rose-400" size={36} />
            Calendario
          </h2>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em] italic">Agenda Semanal Liliana</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-[24px] shadow-lg shadow-rose-100/20 border border-rose-50">
           <button 
             onClick={() => setStartOfCurrentWeek(d => addDays(d, -7))}
             className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors"
           >
             <ChevronLeft size={20} />
           </button>
           <span className="text-xs font-black text-rose-950 uppercase tracking-widest px-2">Semana Actual</span>
           <button 
             onClick={() => setStartOfCurrentWeek(d => addDays(d, 7))}
             className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors"
           >
             <ChevronRight size={20} />
           </button>
        </div>
      </header>

      <div className="space-y-8">
        {/* Weekly Grid - Fully Responsive with Horizontal Scroll and Sticky Time */}
        <div className="card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)] bg-white/80 backdrop-blur-md rounded-[40px] p-4 sm:p-8">
          <div className="flex items-center justify-between mb-8 sm:px-0 px-4">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex p-4 bg-rose-600 text-white rounded-[20px] shadow-lg shadow-rose-200">
                <CalendarIcon size={24} />
              </div>
              <h3 className="font-black text-xl sm:text-2xl text-rose-950 capitalize tracking-tighter">
                {format(startOfCurrentWeek, "d", { locale: es })} al {format(addDays(startOfCurrentWeek, 5), "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            <Sparkles className="text-rose-300 animate-pulse hidden sm:block" size={32} />
          </div>

          {/* Wrapper for the scrollable area */}
          <div className="relative overflow-x-auto scrollbar-hide rounded-[30px] border border-rose-50/50">
            <div className="min-w-[700px] sm:min-w-full">
              {/* Header: Days */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)] gap-2 mb-4 sticky top-0 bg-white/90 backdrop-blur-md z-20 py-4 px-2">
                <div className="bg-rose-50/50 rounded-xl flex items-center justify-center text-[10px] font-black text-rose-300 uppercase tracking-widest">Hora</div>
                {weekDays.map(d => (
                  <div key={d.fecha} className="text-center group">
                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${d.today ? 'text-rose-600' : 'text-rose-300 transition-colors'}`}>
                      {d.label}
                    </div>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-[16px] sm:rounded-[18px] flex items-center justify-center text-sm sm:text-lg font-black transition-all ${d.today ? 'bg-rose-600 text-white shadow-xl shadow-rose-300' : 'bg-rose-50/30 text-rose-950'}`}>
                      {d.num}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid: Hours x Days */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)] gap-2 pb-4 px-2">
                {HORAS.map(hora => (
                  <div key={hora} className="contents">
                    <div className="text-[10px] font-black text-rose-300 flex items-center justify-center h-20 tracking-tighter border-r border-rose-50/50 sticky left-0 bg-white/90 backdrop-blur-sm z-10 pr-2">
                      {hora}
                    </div>
                    {weekDays.map(d => {
                      const cita = citas.find(c =>
                        c.fecha === d.fecha &&
                        c.hora_inicio.startsWith(hora) &&
                        c.estado !== 'cancelada'
                      )
                      if (cita) {
                        const p = cita.pacientes as any
                        const sessionInfo = cita.notas?.split('.')[0]
                        return (
                          <div key={`${d.fecha}-${hora}`} className="h-20 p-0.5">
                            <div className="h-full w-full rounded-[16px] sm:rounded-[20px] bg-rose-50 border border-rose-100 p-2 flex flex-col justify-center cursor-pointer hover:bg-rose-100 transition-all hover:scale-[1.02] hover:shadow-lg shadow-rose-100/20 group relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                <span className="text-[7px] font-black text-rose-500 uppercase tracking-widest">{sessionInfo}</span>
                              </div>
                              <div className="text-[9px] sm:text-[10px] font-black text-rose-950 truncate tracking-tight">{p?.nombre}</div>
                              <div className="text-[8px] text-rose-400 font-bold tracking-widest uppercase mt-0.5">{cita.duracion_minutos} min</div>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={`${d.fecha}-${hora}`} className="h-20 p-0.5">
                          <div className="h-full w-full rounded-[16px] sm:rounded-[20px] border-2 border-dashed border-rose-50/30 hover:border-rose-100 transition-colors cursor-pointer" />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-4 sm:hidden">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Toca una cita</span>
             </div>
             <div className="w-[1px] h-4 bg-rose-100"></div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-black">← Desliza →</span>
             </div>
          </div>
        </div>

        {/* Daily Details - This part is already very mobile friendly */}
        <div className="card shadow-xl shadow-rose-100/20 border-2 border-rose-50/50 bg-white/60 backdrop-blur-md rounded-[35px] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 text-rose-50/40">
             <Flower2 size={150} />
          </div>
          <div className="flex-between mb-8 relative z-10">
            <h3 className="font-black text-rose-950 uppercase tracking-[0.2em] text-[10px] sm:text-xs flex items-center gap-3">
              <Clock size={16} className="text-rose-400" />
              Citas del {format(now, "EEEE d", { locale: es })}
            </h3>
          </div>
          
          <div className="space-y-4 relative z-10">
            {citas.filter(c => c.fecha === todayDateStr).length > 0 ? (
              citas.filter(c => c.fecha === todayDateStr).map(cita => {
                const p = cita.pacientes as any
                return (
                  <div key={cita.id} className="p-4 bg-white rounded-[24px] hover:bg-rose-50 transition-all cursor-pointer group flex items-center justify-between border border-rose-50 shadow-sm">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] bg-rose-950 text-rose-100 font-black text-[10px] sm:text-sm flex items-center justify-center shadow-lg">
                        {p ? getIniciales(p.nombre) : '?'}
                      </div>
                      <div>
                        <div className="font-black text-rose-950 text-sm sm:text-lg tracking-tight uppercase">{p?.nombre}</div>
                        <div className="text-[8px] sm:text-[10px] font-black text-rose-400 uppercase tracking-widest mt-0.5">
                          {cita.hora_inicio.slice(0,5)} · {cita.duracion_minutos} MIN
                        </div>
                      </div>
                    </div>
                    <span className={`badge !text-[8px] !font-black !px-3 !py-1.5 !rounded-full !uppercase ${cita.estado === 'confirmada' ? '!bg-emerald-50 !text-emerald-500' : '!bg-rose-100 !text-rose-600'}`}>
                      {cita.estado}
                    </span>
                  </div>
                )
              })
            ) : (
               <div className="py-12 text-center bg-rose-50/30 rounded-[28px] border-2 border-dashed border-rose-100">
                <Flower2 className="mx-auto mb-3 text-rose-200" size={24} />
                <p className="text-rose-300 text-[9px] font-black uppercase tracking-widest italic leading-none">Hoy todo gira a tu ritmo ✨</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
