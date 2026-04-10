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
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Calendar
} from 'lucide-react'
import NotificationModal from '@/components/ui/NotificationModal'

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

const format12h = (hora24: string) => {
  if (!hora24) return ''
  const [h, m] = hora24.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<any[]>([])
  
  // Para navegación móvil (ver un día a la vez si es necesario o scroll mejorado)
  const now = new Date()
  const [startOfCurrentWeek, setStartOfCurrentWeek] = useState(startOfWeek(now, { weekStartsOn: 1 }))
  const todayDateStr = format(now, 'yyyy-MM-dd')

  // Verification State
  const [verificationCita, setVerificationCita] = useState<any>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({ fecha: '', hora: '' })
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const day = addDays(startOfCurrentWeek, i)
    const labels = {
      'lun': 'L', 'mar': 'M', 'mié': 'm', 'jue': 'J', 'vie': 'V', 'sáb': 'S'
    } as any
    const fullLabel = format(day, 'eee', { locale: es }).replace('.', '')
    return {
      label: fullLabel,
      shortLabel: labels[fullLabel] || fullLabel[0].toUpperCase(),
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

  useEffect(() => {
    if (citas.length > 0 && !verificationCita) {
      const currentTime = new Date()
      // We check for any past appointment that is still 'pendiente' or 'confirmada'
      const pastDue = citas.find(c => {
        const citaDateTime = new Date(`${c.fecha}T${c.hora_inicio}`)
        return citaDateTime < currentTime && (c.estado === 'pendiente' || c.estado === 'confirmada' || c.estado === 'confirmado')
      })
      
      if (pastDue) {
        setVerificationCita(pastDue)
        setRescheduleData({ fecha: pastDue.fecha, hora: pastDue.hora_inicio.slice(0, 5) })
      }
    }
  }, [citas, verificationCita])

  const handleConfirmAttendance = async (attended: boolean) => {
    if (!verificationCita) return
    setSaving(true)
    try {
      if (attended) {
        const { error } = await supabase
          .from('citas')
          .update({ estado: 'completada' })
          .eq('id', verificationCita.id)
        if (error) throw error
        setVerificationCita(null)
        setNotification({
          isOpen: true,
          type: 'success',
          title: 'Sesión Completada',
          message: 'La cita ha sido marcada como completada correctamente.'
        })
      } else {
        setIsRescheduling(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReschedule = async () => {
    if (!verificationCita) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('citas')
        .update({ 
          fecha: rescheduleData.fecha, 
          hora_inicio: rescheduleData.hora,
          estado: 'pendiente' // Regresa a pendiente al ser reprogramada
        })
        .eq('id', verificationCita.id)
      
      if (error) throw error
      
      setVerificationCita(null)
      setIsRescheduling(false)
      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Cita Reprogramada',
        message: 'La cita se ha movido exitosamente.'
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

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
        <div className="card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)] bg-white/80 backdrop-blur-md rounded-[32px] sm:rounded-[40px] p-2 sm:p-8">
          <div className="flex items-center justify-between mb-6 sm:mb-8 px-2 sm:px-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex p-3 sm:p-4 bg-rose-600 text-white rounded-[16px] sm:rounded-[20px] shadow-lg shadow-rose-200">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-black text-lg sm:text-2xl text-rose-950 capitalize tracking-tighter">
                {format(startOfCurrentWeek, "d", { locale: es })} al {format(addDays(startOfCurrentWeek, 5), "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            <Sparkles className="text-rose-300 animate-pulse hidden sm:block" size={24} />
          </div>

          {/* Wrapper for the scrollable area */}
          <div className="relative overflow-x-auto scrollbar-hide rounded-[24px] sm:rounded-[30px] border border-rose-50/50 -mx-2 sm:mx-0">
            <div className="min-w-[480px] sm:min-w-full">
              {/* Header: Days */}
              <div className="grid grid-cols-[40px_repeat(6,1fr)] sm:grid-cols-[60px_repeat(6,1fr)] gap-0.5 sm:gap-2 mb-2 sm:mb-4 sticky top-0 bg-white/95 backdrop-blur-md z-20 py-2 sm:py-4 px-1 sm:px-2">
                <div className="bg-rose-50/50 rounded-lg flex items-center justify-center text-[7px] sm:text-[10px] font-black text-rose-300 uppercase tracking-widest">H</div>
                {weekDays.map(d => (
                  <div key={d.fecha} className="text-center group">
                    <div className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mb-1 sm:mb-2 ${d.today ? 'text-rose-600' : 'text-rose-300 transition-colors'}`}>
                      <span className="hidden sm:inline">{d.label}</span>
                      <span className="inline sm:hidden">{d.shortLabel}</span>
                    </div>
                    <div className={`w-7 h-7 sm:w-12 sm:h-12 mx-auto rounded-[10px] sm:rounded-[18px] flex items-center justify-center text-[10px] sm:text-lg font-black transition-all ${d.today ? 'bg-rose-600 text-white shadow-xl shadow-rose-300' : 'bg-rose-50/30 text-rose-950'}`}>
                      {d.num}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid: Hours x Days */}
              <div className="grid grid-cols-[40px_repeat(6,1fr)] sm:grid-cols-[60px_repeat(6,1fr)] gap-0.5 sm:gap-2 pb-4 px-1 sm:px-2">
                {HORAS.map(hora => (
                  <div key={hora} className="contents">
                    <div className="text-[8px] sm:text-[10px] font-black text-rose-300 flex items-center justify-center h-12 sm:h-20 tracking-tighter border-r border-rose-50/50 sticky left-0 bg-white/95 backdrop-blur-sm z-10 pr-1 sm:pr-2">
                      <span className="hidden sm:inline">{format12h(hora)}</span>
                      <span className="inline sm:hidden">{format12h(hora).replace(' ', '').replace(':00', '')}</span>
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
                        const isCompleted = cita.estado === 'completada' || cita.estado === 'completado'
                        
                        return (
                          <div key={`${d.fecha}-${hora}`} className="h-12 sm:h-20 p-[1px] sm:p-0.5">
                            <div className={`h-full w-full rounded-[8px] sm:rounded-[20px] p-0.5 sm:p-2 flex flex-col justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg shadow-rose-100/20 group relative overflow-hidden ${isCompleted ? 'bg-lime-50 border border-lime-100 shadow-lime-100/30' : 'bg-rose-50 border border-rose-100 hover:bg-rose-100'}`}>
                              <div className="absolute top-0 right-0 p-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                <span className={`text-[5px] sm:text-[7px] font-black uppercase tracking-widest ${isCompleted ? 'text-lime-400' : 'text-rose-500'}`}>{sessionInfo}</span>
                              </div>
                              <div className={`text-[7px] sm:text-[10px] font-black truncate tracking-tight leading-none ${isCompleted ? 'text-lime-700' : 'text-rose-950'}`}>{p?.nombre}</div>
                              <div className={`text-[6px] sm:text-[8px] font-bold tracking-widest uppercase mt-0.5 ${isCompleted ? 'text-lime-600' : 'text-rose-400'}`}>{cita.duracion_minutos}m</div>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={`${d.fecha}-${hora}`} className="h-12 sm:h-20 p-[1px] sm:p-0.5">
                          <div className="h-full w-full rounded-[8px] sm:rounded-[20px] border border-dashed border-rose-50/20 hover:border-rose-100 transition-colors cursor-pointer" />
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
                          {format12h(cita.hora_inicio)} · {cita.duracion_minutos} MIN
                        </div>
                      </div>
                    </div>
                    <span className={`badge !text-[8px] !font-black !px-3 !py-1.5 !rounded-full !uppercase ${
                      cita.estado === 'completada' || cita.estado === 'completado' 
                        ? '!bg-lime-50 !text-lime-600 border border-lime-100' 
                        : cita.estado === 'confirmada' || cita.estado === 'confirmado'
                          ? '!bg-emerald-50 !text-emerald-500' 
                          : '!bg-rose-100 !text-rose-600'
                    }`}>
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

      <NotificationModal 
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Verification Modal */}
      {verificationCita && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-rose-950/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300 border-4 border-white">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
                  {isRescheduling ? <Calendar size={24} /> : <AlertCircle size={24} />}
                </div>
                <button 
                  onClick={() => setVerificationCita(null)} 
                  className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!isRescheduling ? (
                <>
                  <div>
                    <h3 className="text-2xl font-black text-rose-950 uppercase tracking-tighter leading-tight">¿Fue atendido?</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Paciente: {verificationCita.pacientes?.nombre}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed italic">Esta cita estaba programada para el {verificationCita.fecha} a las {format12h(verificationCita.hora_inicio)}.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button 
                      onClick={() => handleConfirmAttendance(false)}
                      className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                    >
                      No, pendiente
                    </button>
                    <button 
                      onClick={() => handleConfirmAttendance(true)}
                      disabled={saving}
                      className="py-4 bg-lime-50 text-lime-700 border border-lime-200 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-lime-100 hover:bg-lime-100 transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Sí, asistió
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-2xl font-black text-rose-950 uppercase tracking-tighter leading-tight">Reprogramar cita</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Elige la nueva fecha y hora para {verificationCita.pacientes?.nombre}</p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Nueva Fecha</label>
                      <input 
                        type="date"
                        value={rescheduleData.fecha}
                        onChange={(e) => setRescheduleData({...rescheduleData, fecha: e.target.value})}
                        className="w-full bg-rose-50/50 border-none rounded-xl px-4 py-3 text-sm font-black text-rose-950 focus:ring-2 focus:ring-rose-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Nueva Hora</label>
                      <input 
                        type="time"
                        value={rescheduleData.hora}
                        onChange={(e) => setRescheduleData({...rescheduleData, hora: e.target.value})}
                        className="w-full bg-rose-50/50 border-none rounded-xl px-4 py-3 text-sm font-black text-rose-950 focus:ring-2 focus:ring-rose-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button 
                      onClick={() => setIsRescheduling(false)}
                      className="py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest"
                    >
                      Atrás
                    </button>
                    <button 
                      onClick={handleReschedule}
                      disabled={saving}
                      className="py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Confirmar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
