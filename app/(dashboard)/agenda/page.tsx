'use client'

import { useState, useEffect } from 'react'
import { supabase, getCachedUser } from '@/lib/supabase'
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
  Calendar,
  Trash2,
  Repeat,
  UserCog,
} from 'lucide-react'
import NotificationModal from '@/components/ui/NotificationModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { OfflineSync } from '@/lib/offline-sync'
import { format12h, getIniciales } from '@/lib/utils'
import { isHolidayColombia } from '@/lib/colombian-holidays'

const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00']

// Horas laborales según el día (domingo/festivo reducido, sábado cerrado)
function horasLaborales(fecha: string): string[] {
  const date = new Date(fecha + 'T12:00:00')
  const dow = date.getDay()
  const isHol = isHolidayColombia(fecha)
  if (dow === 0 || isHol) return ['08:00', '09:00', '10:00', '11:00']
  if (dow === 6) return []
  return HORAS
}

const esCompletada = (estado?: string) => {
  const s = (estado || '').toLowerCase().trim()
  return s === 'completada' || s === 'completado'
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<any[]>([])
  const [isLuisa, setIsLuisa] = useState(false)

  const now = new Date()
  const [startOfCurrentWeek, setStartOfCurrentWeek] = useState(startOfWeek(now, { weekStartsOn: 1 }))
  const todayDateStr = format(now, 'yyyy-MM-dd')

  // Verificación de asistencia (citas pasadas)
  const [verificationCita, setVerificationCita] = useState<any>(null)
  const [dismissedVerifications, setDismissedVerifications] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Panel de gestión de una cita (calendario interactivo)
  const [selectedCita, setSelectedCita] = useState<any>(null)
  const [panelMode, setPanelMode] = useState<'menu' | 'reschedule'>('menu')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleHour, setRescheduleHour] = useState('')
  const [dayCitas, setDayCitas] = useState<any[]>([]) // ocupación del día elegido al reprogramar
  const [loadingDay, setLoadingDay] = useState(false)

  // Confirmaciones de borrado
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'cita' | 'plan'; id: string; title: string; message: string } | null>(null)

  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false, type: 'success', title: '', message: ''
  })

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(startOfCurrentWeek, i)
    const labels = { 'lun': 'L', 'mar': 'M', 'mié': 'M', 'jue': 'J', 'vie': 'V', 'sáb': 'S', 'dom': 'D' } as any
    const fullLabel = format(day, 'eee', { locale: es }).replace('.', '').toLowerCase()
    return {
      label: fullLabel,
      shortLabel: labels[fullLabel] || fullLabel[0].toUpperCase(),
      num: format(day, 'd'),
      fecha: format(day, 'yyyy-MM-dd'),
      today: isSameDay(day, now)
    }
  })

  async function loadCitas() {
    const cacheKey = `agenda-${format(startOfCurrentWeek, 'yyyy-MM-dd')}`
    const cachedData = OfflineSync.getFromCache(cacheKey)
    if (cachedData) { setCitas(cachedData); setLoading(false) }

    try {
      const user = await getCachedUser()
      const isLu = user?.email?.toLowerCase().includes('luisa')
      setIsLuisa(!!isLu)

      let query = supabase
        .from('citas')
        .select('*, pacientes(nombre)')
        .gte('fecha', format(startOfCurrentWeek, 'yyyy-MM-dd'))
        .lte('fecha', format(addDays(startOfCurrentWeek, 6), 'yyyy-MM-dd'))
        .order('hora_inicio')

      if (isLu) query = query.eq('fisioterapeuta', 'Luisa')

      const { data } = await query
      if (data) { setCitas(data); OfflineSync.saveToCache(cacheKey, data) }
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
    return () => { supabase.removeChannel(channel) }
  }, [startOfCurrentWeek])

  // Detectar citas pasadas sin verificar (que no se hayan pospuesto)
  useEffect(() => {
    if (citas.length > 0 && !verificationCita && !selectedCita) {
      const currentTime = new Date()
      const pastDue = citas.find(c => {
        if (dismissedVerifications.has(c.id)) return false
        const citaDateTime = new Date(`${c.fecha}T${c.hora_inicio}`)
        return citaDateTime < currentTime && (c.estado === 'pendiente' || c.estado === 'confirmada' || c.estado === 'confirmado')
      })
      if (pastDue) setVerificationCita(pastDue)
    }
  }, [citas, verificationCita, selectedCita, dismissedVerifications])

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const handleConfirmAttendance = async (attended: boolean) => {
    if (!verificationCita) return
    if (!attended) {
      // "No asistió / pendiente" → posponer para no bloquear la vista
      setDismissedVerifications(prev => new Set(prev).add(verificationCita.id))
      setVerificationCita(null)
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('citas').update({ estado: 'completada' }).eq('id', verificationCita.id)
      if (error) throw error
      OfflineSync.clearDashboardCache()
      setCitas(prev => prev.map(c => c.id === verificationCita.id ? { ...c, estado: 'completada' } : c))
      setVerificationCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Sesión Completada', message: 'La cita se marcó como completada.' })
      await loadCitas()
    } catch (err) {
      console.error(err)
      setNotification({ isOpen: true, type: 'error', title: 'Error', message: 'No pudimos marcar la asistencia.' })
    } finally {
      setSaving(false)
    }
  }

  const handleAssignTherapist = async (id: string, fisio: string) => {
    try {
      const { error } = await supabase.from('citas').update({ fisioterapeuta: fisio }).eq('id', id)
      if (error) throw error
      setCitas(prev => prev.map(c => c.id === id ? { ...c, fisioterapeuta: fisio } : c))
      setSelectedCita((prev: any) => prev ? { ...prev, fisioterapeuta: fisio } : prev)
    } catch (e) { console.error(e) }
  }

  const handleToggleCompletada = async (cita: any) => {
    const nuevoEstado = esCompletada(cita.estado) ? 'pendiente' : 'completada'
    setSaving(true)
    try {
      const { error } = await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', cita.id)
      if (error) throw error
      OfflineSync.clearDashboardCache()
      setSelectedCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Actualizada', message: `Cita marcada como ${nuevoEstado}.` })
      await loadCitas()
    } catch (e) {
      console.error(e)
      setNotification({ isOpen: true, type: 'error', title: 'Error', message: 'No pudimos actualizar la cita.' })
    } finally {
      setSaving(false)
    }
  }

  // Abrir el modo reprogramar: precarga fecha/hora y la ocupación de ese día
  const openReschedule = async (cita: any) => {
    setPanelMode('reschedule')
    const fecha = cita.fecha
    const hora = cita.hora_inicio.slice(0, 5)
    setRescheduleDate(fecha)
    setRescheduleHour(hora)
    await loadDayCitas(fecha)
  }

  async function loadDayCitas(fecha: string) {
    setLoadingDay(true)
    try {
      let q = supabase.from('citas').select('id, hora_inicio, estado, fisioterapeuta').eq('fecha', fecha).neq('estado', 'cancelada')
      if (isLuisa) q = q.eq('fisioterapeuta', 'Luisa')
      const { data } = await q
      setDayCitas(data || [])
    } finally {
      setLoadingDay(false)
    }
  }

  // Un slot solo está ocupado si la MISMA terapeuta ya tiene cita ahí.
  // Liliana y Luisa pueden coincidir en la misma hora.
  const slotOcupado = (hora: string) => {
    const fisio = selectedCita?.fisioterapeuta || 'Liliana'
    return dayCitas.some(c =>
      c.id !== selectedCita?.id &&
      c.hora_inicio.split(':')[0] === hora.split(':')[0] &&
      (c.fisioterapeuta || 'Liliana') === fisio
    )
  }

  // Reprogramar: reinicia banderas de notificación para que el cron avise con la hora nueva
  const applyReschedule = async () => {
    if (!selectedCita || !rescheduleDate || !rescheduleHour) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('citas')
        .update({
          fecha: rescheduleDate,
          hora_inicio: rescheduleHour,
          estado: 'pendiente',
          notificado_1h: false,
          notificado_10m: false,
        })
        .eq('id', selectedCita.id)
      if (error) throw error
      OfflineSync.clearDashboardCache()
      setDismissedVerifications(prev => { const n = new Set(prev); n.delete(selectedCita.id); return n })
      setSelectedCita(null)
      setVerificationCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Cita Reprogramada', message: 'Se movió correctamente y se reprogramaron los avisos.' })
      await loadCitas()
    } catch (err) {
      console.error(err)
      setNotification({ isOpen: true, type: 'error', title: 'Error', message: 'No pudimos mover la cita.' })
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setSaving(true)
    try {
      if (confirmDelete.type === 'cita') {
        const { error } = await supabase.from('citas').delete().eq('id', confirmDelete.id)
        if (error) throw error
      } else {
        // Borra el plan; las citas se eliminan por ON DELETE CASCADE
        const { error } = await supabase.from('sesiones').delete().eq('id', confirmDelete.id)
        if (error) throw error
      }
      OfflineSync.clearDashboardCache()
      setConfirmDelete(null)
      setSelectedCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Eliminado', message: confirmDelete.type === 'cita' ? 'La cita fue eliminada.' : 'El plan completo fue eliminado.' })
      await loadCitas()
    } catch (err) {
      console.error(err)
      setNotification({ isOpen: true, type: 'error', title: 'Error', message: 'No pudimos eliminar.' })
    } finally {
      setSaving(false)
    }
  }

  const openPanel = (cita: any) => { setSelectedCita(cita); setPanelMode('menu') }

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
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em] italic">Agenda Semanal {isLuisa ? 'Luisa' : 'Liliana'} · toca una cita para gestionarla</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-[24px] shadow-lg shadow-rose-100/20 border border-rose-50">
           <button onClick={() => setStartOfCurrentWeek(d => addDays(d, -7))} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors">
             <ChevronLeft size={20} />
           </button>
           <span className="text-xs font-black text-rose-950 uppercase tracking-widest px-2">Semana Actual</span>
           <button onClick={() => setStartOfCurrentWeek(d => addDays(d, 7))} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors">
             <ChevronRight size={20} />
           </button>
        </div>
      </header>

      <div className="space-y-8">
        {/* Grilla semanal */}
        <div className="card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)] bg-white/80 backdrop-blur-md rounded-[32px] sm:rounded-[40px] p-2 sm:p-8">
          <div className="flex items-center justify-between mb-6 sm:mb-8 px-2 sm:px-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex p-3 sm:p-4 bg-rose-600 text-white rounded-[16px] sm:rounded-[20px] shadow-lg shadow-rose-200">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-black text-lg sm:text-2xl text-rose-950 capitalize tracking-tighter">
                {format(startOfCurrentWeek, "d", { locale: es })} al {format(addDays(startOfCurrentWeek, 6), "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            <Sparkles className="text-rose-300 animate-pulse hidden sm:block" size={24} />
          </div>

          <div className="relative overflow-x-auto scrollbar-hide rounded-[24px] sm:rounded-[30px] border border-rose-50/50 -mx-2 sm:mx-0">
            <div className="min-w-[850px] sm:min-w-full">
              <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] gap-0.5 sm:gap-2 mb-2 sm:mb-4 sticky top-0 bg-white/95 backdrop-blur-md z-20 py-2 sm:py-4 px-1 sm:px-2">
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

              <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] gap-0.5 sm:gap-2 pb-4 px-1 sm:px-2">
                {HORAS.map(hora => (
                  <div key={hora} className="contents">
                    <div className="text-[8px] sm:text-[10px] font-black text-rose-300 flex items-center justify-center h-12 sm:h-20 tracking-tighter border-r border-rose-50/50 sticky left-0 bg-white/95 backdrop-blur-sm z-10 pr-1 sm:pr-2">
                      <span className="hidden sm:inline">{format12h(hora)}</span>
                      <span className="inline sm:hidden">{format12h(hora).replace(' ', '').replace(':00', '')}</span>
                    </div>
                    {weekDays.map(d => {
                      const laborales = horasLaborales(d.fecha)
                      const isWorkingHour = laborales.includes(hora)

                      // Todas las citas de la franja: si Liliana y Luisa coinciden en la
                      // misma hora, se muestran ambas apiladas en la celda.
                      const citasSlot = citas.filter(c =>
                        c.fecha === d.fecha &&
                        c.hora_inicio.split(':')[0] === hora.split(':')[0] &&
                        c.estado !== 'cancelada'
                      )
                      if (citasSlot.length > 0) {
                        const multi = citasSlot.length > 1
                        return (
                          <div key={`${d.fecha}-${hora}`} className="h-12 sm:h-20 p-[1px] sm:p-0.5 flex flex-col gap-0.5">
                            {citasSlot.map(cita => {
                              const p = cita.pacientes as any
                              const sessionInfo = cita.notas?.split('.')[0]
                              const isCompleted = esCompletada(cita.estado)
                              return (
                                <button key={cita.id} onClick={() => openPanel(cita)} className={`flex-1 min-h-0 w-full text-left rounded-[8px] sm:rounded-[20px] ${multi ? 'px-1 py-0.5 sm:px-2 sm:py-1' : 'p-0.5 sm:p-2'} flex flex-col justify-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg shadow-rose-100/20 group relative overflow-hidden ${isCompleted ? 'bg-lime-50 border border-lime-100 shadow-lime-100/30' : 'bg-rose-50 border border-rose-100 hover:bg-rose-100'}`}>
                                  {!multi && (
                                    <div className="absolute top-0 right-0 p-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                      <span className={`text-[5px] sm:text-[7px] font-black uppercase tracking-widest ${isCompleted ? 'text-lime-400' : 'text-rose-500'}`}>{sessionInfo}</span>
                                    </div>
                                  )}
                                  <div className={`${multi ? 'text-[6px] sm:text-[9px]' : 'text-[7px] sm:text-[10px]'} font-black truncate tracking-tight leading-none ${isCompleted ? 'text-lime-700' : 'text-rose-950'}`}>{p?.nombre}</div>
                                  <div className={`${multi ? 'text-[5px] sm:text-[7px]' : 'text-[6px] sm:text-[8px]'} font-bold tracking-widest uppercase mt-0.5 truncate ${isCompleted ? 'text-lime-600' : 'text-rose-400'}`}>
                                    {format12h(cita.hora_inicio)}{!multi && ` · ${cita.duracion_minutos}m`}
                                    {cita.fisioterapeuta && !isLuisa && ` · ${cita.fisioterapeuta}`}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      }
                      if (!isWorkingHour) {
                        return (
                          <div key={`${d.fecha}-${hora}`} className="h-12 sm:h-20 p-[1px] sm:p-0.5 opacity-25">
                            <div className="h-full w-full rounded-[8px] sm:rounded-[20px] bg-slate-100/40 border border-slate-200/20 cursor-not-allowed" />
                          </div>
                        )
                      }
                      return (
                        <div key={`${d.fecha}-${hora}`} className="h-12 sm:h-20 p-[1px] sm:p-0.5">
                          <div className="h-full w-full rounded-[8px] sm:rounded-[20px] border border-dashed border-rose-50/20 hover:border-rose-100 transition-colors" />
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
             <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-black">← Desliza →</span>
          </div>
        </div>

        {/* Citas de hoy */}
        <div className="card shadow-xl shadow-rose-100/20 border-2 border-rose-50/50 bg-white/60 backdrop-blur-md rounded-[35px] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 text-rose-50/40"><Flower2 size={150} /></div>
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
                  <button key={cita.id} onClick={() => openPanel(cita)} className="w-full text-left p-4 bg-white rounded-[24px] hover:bg-rose-50 transition-all cursor-pointer group flex items-center justify-between border border-rose-50 shadow-sm">
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
                      esCompletada(cita.estado) ? '!bg-lime-50 !text-lime-600 border border-lime-100'
                      : cita.estado === 'confirmada' || cita.estado === 'confirmado' ? '!bg-emerald-50 !text-emerald-500'
                      : '!bg-rose-100 !text-rose-600'
                    }`}>
                      {cita.estado}
                    </span>
                  </button>
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

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={runDelete}
        title={confirmDelete?.title || ''}
        message={confirmDelete?.message || ''}
      />

      {/* ── PANEL DE GESTIÓN DE CITA ── */}
      {selectedCita && (
        <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-rose-950/40 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-rose-50 flex justify-between items-start bg-rose-50/20">
              <div>
                <h3 className="font-black text-xl text-rose-950 uppercase tracking-tighter">{selectedCita.pacientes?.nombre}</h3>
                <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mt-1">
                  {new Date(selectedCita.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} · {format12h(selectedCita.hora_inicio)}
                </p>
              </div>
              <button onClick={() => setSelectedCita(null)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-rose-300 hover:text-rose-500 transition-colors"><X size={20} /></button>
            </div>

            {panelMode === 'menu' ? (
              <div className="p-6 space-y-3">
                <button
                  onClick={() => handleToggleCompletada(selectedCita)}
                  disabled={saving}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${esCompletada(selectedCita.estado) ? 'bg-slate-50 text-slate-500 hover:bg-slate-100' : 'bg-lime-50 text-lime-700 border border-lime-100 hover:bg-lime-100'}`}
                >
                  <CheckCircle size={18} />
                  {esCompletada(selectedCita.estado) ? 'Marcar como pendiente' : 'Marcar como completada'}
                </button>

                <button
                  onClick={() => openReschedule(selectedCita)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                >
                  <Repeat size={18} />
                  Reprogramar (fecha / hora)
                </button>

                {!isLuisa && (
                  <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-100">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCog size={16} className="text-rose-400" />
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Terapeuta</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Liliana', 'Luisa'].map(f => (
                        <button
                          key={f}
                          onClick={() => handleAssignTherapist(selectedCita.id, f)}
                          className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${(selectedCita.fisioterapeuta || 'Liliana') === f ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white text-rose-400 border border-rose-100 hover:border-rose-300'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setConfirmDelete({ type: 'cita', id: selectedCita.id, title: '¿Eliminar esta cita?', message: 'Se eliminará solo esta sesión del calendario. Esta acción no se puede deshacer.' })}
                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-white text-rose-500 border-2 border-rose-100 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-95"
                  >
                    <Trash2 size={16} /> Eliminar esta cita
                  </button>
                  {selectedCita.sesion_id && (
                    <button
                      onClick={() => setConfirmDelete({ type: 'plan', id: selectedCita.sesion_id, title: '¿Eliminar el plan completo?', message: `Se eliminarán TODAS las citas del tratamiento de ${selectedCita.pacientes?.nombre}, incluidas las completadas. Esta acción no se puede deshacer.` })}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-rose-950 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-900 transition-all active:scale-95"
                    >
                      <Trash2 size={16} /> Eliminar plan completo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Nueva fecha</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleHour(''); loadDayCitas(e.target.value) }}
                    className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-3 text-sm font-black text-rose-950 focus:ring-2 focus:ring-rose-200 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Elige la hora</label>
                    <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest">
                      <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-100 border border-rose-200"></span>Libre</span>
                      <span className="flex items-center gap-1 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-300"></span>Ocupado</span>
                    </div>
                  </div>

                  {loadingDay ? (
                    <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-rose-400" size={24} /></div>
                  ) : horasLaborales(rescheduleDate).length === 0 ? (
                    <p className="py-6 text-center text-rose-300 font-black text-[10px] uppercase tracking-widest italic">Ese día no hay horario de atención</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {horasLaborales(rescheduleDate).map(h => {
                        const ocupado = slotOcupado(h)
                        const selected = rescheduleHour === h
                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={ocupado}
                            onClick={() => setRescheduleHour(h)}
                            className={`py-3 rounded-xl font-black text-[11px] transition-all ${
                              ocupado ? 'bg-rose-200/60 text-white cursor-not-allowed line-through'
                              : selected ? 'bg-rose-600 text-white shadow-lg shadow-rose-200 scale-105'
                              : 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                            }`}
                          >
                            {format12h(h)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => setPanelMode('menu')} className="py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Atrás</button>
                  <button
                    onClick={applyReschedule}
                    disabled={saving || !rescheduleHour}
                    className="py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VERIFICACIÓN DE CITA PASADA (posponible) ── */}
      {verificationCita && !selectedCita && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-rose-950/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300 border-4 border-white">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl"><AlertCircle size={24} /></div>
                <button onClick={() => { setDismissedVerifications(prev => new Set(prev).add(verificationCita.id)); setVerificationCita(null) }} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><X size={20} /></button>
              </div>

              <div>
                <h3 className="text-2xl font-black text-rose-950 uppercase tracking-tighter leading-tight">¿Fue atendido?</h3>
                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Paciente: {verificationCita.pacientes?.nombre}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed italic">Estaba programada para el {verificationCita.fecha} a las {format12h(verificationCita.hora_inicio)}.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleConfirmAttendance(false)}
                  className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Ahora no
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

              <button
                onClick={() => { const c = verificationCita; setVerificationCita(null); openPanel(c); openReschedule(c) }}
                className="w-full py-3 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:text-rose-700 flex items-center justify-center gap-2"
              >
                <Repeat size={14} /> Reprogramar esta cita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
