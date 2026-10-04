'use client'

import { useState, useEffect, useRef } from 'react'
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
import { format12h, getIniciales, getFisioDeEmail, esDuena, FISIOTERAPEUTAS } from '@/lib/utils'
import { isHolidayColombia } from '@/lib/colombian-holidays'
import { notifyFisioPush } from '@/lib/push-notifications'
import { appointmentScheduleConflict, planAppointmentSeriesReschedule, type SeriesAppointment } from '@/lib/appointment-series'
import type { Fisioterapeuta } from '@/types'

const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00']
const CONFIRMED_ATTENDANCE_KEY = 'agenda-confirmed-attendance'

function esSabado(fecha: string) {
  return new Date(`${fecha}T12:00:00`).getDay() === 6
}

function getConfirmedAttendanceIds() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONFIRMED_ATTENDANCE_KEY) || '[]')
    return new Set<string>(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function saveConfirmedAttendanceId(id: string) {
  try {
    const ids = getConfirmedAttendanceIds()
    ids.add(id)
    sessionStorage.setItem(CONFIRMED_ATTENDANCE_KEY, JSON.stringify(Array.from(ids)))
  } catch { /* La confirmación sigue dependiendo del guardado en Supabase. */ }
}

function forgetConfirmedAttendanceIds(idsToRemove: string[]) {
  try {
    const ids = getConfirmedAttendanceIds()
    idsToRemove.forEach(id => ids.delete(id))
    sessionStorage.setItem(CONFIRMED_ATTENDANCE_KEY, JSON.stringify(Array.from(ids)))
  } catch { /* La reprogramación no depende del almacenamiento del navegador. */ }
}

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
  const [fisioActiva, setFisioActiva] = useState<Fisioterapeuta>('Liliana')

  const now = new Date()
  const [startOfCurrentWeek, setStartOfCurrentWeek] = useState(startOfWeek(now, { weekStartsOn: 1 }))
  const [mobileDayPage, setMobileDayPage] = useState(0)
  const todayDateStr = format(now, 'yyyy-MM-dd')

  // Verificación de asistencia (citas pasadas)
  const [verificationCita, setVerificationCita] = useState<any>(null)
  const [dismissedVerifications, setDismissedVerifications] = useState<Set<string>>(() => getConfirmedAttendanceIds())
  const [saving, setSaving] = useState(false)
  const attendanceSavingRef = useRef(false)

  // Panel de gestión de una cita (calendario interactivo)
  const [selectedCita, setSelectedCita] = useState<any>(null)
  const [panelMode, setPanelMode] = useState<'menu' | 'reschedule'>('menu')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleHour, setRescheduleHour] = useState('')
  const [rescheduleScope, setRescheduleScope] = useState<'single' | 'series'>('single')
  const [dayCitas, setDayCitas] = useState<any[]>([]) // ocupación del día elegido al reprogramar
  const [loadingDay, setLoadingDay] = useState(false)

  // Confirmaciones de borrado
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'cita' | 'plan'; id: string; title: string; message: string } | null>(null)

  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false, type: 'success', title: '', message: ''
  })

  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const labels = { 'lun': 'L', 'mar': 'M', 'mié': 'M', 'jue': 'J', 'vie': 'V', 'dom': 'D' } as any
    const actualDay = addDays(startOfCurrentWeek, i === 5 ? 6 : i)
    const fullLabel = format(actualDay, 'eee', { locale: es }).replace('.', '').toLowerCase()
    return {
      label: fullLabel,
      shortLabel: labels[fullLabel] || fullLabel[0].toUpperCase(),
      num: format(actualDay, 'd'),
      fecha: format(actualDay, 'yyyy-MM-dd'),
      today: isSameDay(actualDay, now)
    }
  })

  const mobileDays = weekDays.slice(mobileDayPage * 2, mobileDayPage * 2 + 2)

  const renderCalendarGrid = (days: typeof weekDays, compact: boolean) => {
    const columns = compact
      ? 'grid-cols-[42px_repeat(2,minmax(0,1fr))]'
      : 'grid-cols-[60px_repeat(6,minmax(0,1fr))]'

    return (
      <>
        <div className={`grid ${columns} gap-1 lg:gap-2 mb-2 lg:mb-4 bg-white/95 backdrop-blur-md z-20 py-2 lg:py-4 px-1 lg:px-2`}>
          <div className="bg-rose-50/50 rounded-lg flex items-center justify-center text-[8px] lg:text-[10px] font-black text-rose-300 uppercase tracking-widest">H</div>
          {days.map(d => (
            <div key={d.fecha} className="text-center">
              <div className={`text-[9px] lg:text-[9px] font-black uppercase tracking-wider lg:tracking-[0.2em] mb-1 lg:mb-2 ${d.today ? 'text-rose-600' : 'text-rose-300'}`}>
                {d.label}
              </div>
              <div className={`w-8 h-8 lg:w-12 lg:h-12 mx-auto rounded-xl lg:rounded-[18px] flex items-center justify-center text-xs lg:text-lg font-black ${d.today ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-rose-50/50 text-rose-950'}`}>
                {d.num}
              </div>
            </div>
          ))}
        </div>

        <div className={`grid ${columns} gap-1 lg:gap-2 pb-3 lg:pb-4 px-1 lg:px-2`}>
          {HORAS.map(hora => (
            <div key={hora} className="contents">
              <div className="text-[8px] lg:text-[10px] font-black text-rose-300 flex items-center justify-center h-16 lg:h-20 tracking-tighter border-r border-rose-50/50 bg-white/95 pr-1 lg:pr-2">
                {compact ? format12h(hora).replace(' ', '').replace(':00', '') : format12h(hora)}
              </div>
              {days.map(d => {
                const isWorkingHour = horasLaborales(d.fecha).includes(hora)
                const citasSlot = citas.filter(c =>
                  c.fecha === d.fecha &&
                  c.hora_inicio.split(':')[0] === hora.split(':')[0] &&
                  c.estado !== 'cancelada'
                )

                if (citasSlot.length > 0) {
                  const multi = citasSlot.length > 1
                  return (
                    <div key={`${d.fecha}-${hora}`} className="h-16 lg:h-20 p-0.5 flex flex-col gap-0.5">
                      {citasSlot.map(cita => {
                        const p = cita.pacientes as any
                        const sessionInfo = cita.notas?.split('.')[0]
                        const isCompleted = esCompletada(cita.estado)
                        return (
                          <button key={cita.id} onClick={() => openPanel(cita)} className={`flex-1 min-h-0 w-full text-left rounded-lg lg:rounded-[20px] ${compact ? 'px-1 py-1' : 'p-2'} flex flex-col justify-center cursor-pointer transition-colors shadow-rose-100/20 relative overflow-hidden ${isCompleted ? 'bg-lime-50 border border-lime-100' : 'bg-rose-50 border border-rose-100 hover:bg-rose-100'}`}>
                            {!multi && (
                              <span className={`absolute top-0 right-0 p-0.5 text-[6px] lg:text-[7px] font-black uppercase tracking-wide ${isCompleted ? 'text-lime-500' : 'text-rose-500'}`}>{sessionInfo}</span>
                            )}
                            <span className={`${compact ? (multi ? 'text-[8px]' : 'text-[9px]') : (multi ? 'text-[9px]' : 'text-[10px]')} font-black truncate tracking-tight leading-tight ${isCompleted ? 'text-lime-700' : 'text-rose-950'}`}>{p?.nombre}</span>
                            <span className={`${compact ? 'text-[7px]' : 'text-[8px]'} font-bold uppercase mt-0.5 truncate ${isCompleted ? 'text-lime-600' : 'text-rose-500'}`}>
                              {format12h(cita.hora_inicio)}{!multi && ` · ${cita.duracion_minutos}m`}
                              {cita.fisioterapeuta && esDuena(fisioActiva) && ` · ${cita.fisioterapeuta}`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                }

                return (
                  <div key={`${d.fecha}-${hora}`} className={`h-16 lg:h-20 p-0.5 ${!isWorkingHour ? 'opacity-25' : ''}`}>
                    <div className={`h-full w-full rounded-lg lg:rounded-[20px] ${isWorkingHour ? 'border border-dashed border-rose-100/50' : 'bg-slate-100/50 border border-slate-200/30'}`} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </>
    )
  }

  async function loadCitas() {
    const cacheKey = `agenda-${format(startOfCurrentWeek, 'yyyy-MM-dd')}`
    const cachedData = OfflineSync.getFromCache(cacheKey)
    if (cachedData) { setCitas(cachedData); setLoading(false) }

    try {
      const user = await getCachedUser()
      const fisio = getFisioDeEmail(user?.email)
      setFisioActiva(fisio)

      let query = supabase
        .from('citas')
        .select('*, pacientes(nombre)')
        .gte('fecha', format(startOfCurrentWeek, 'yyyy-MM-dd'))
        .lte('fecha', format(addDays(startOfCurrentWeek, 6), 'yyyy-MM-dd'))
        .order('hora_inicio')

      if (!esDuena(fisio)) query = query.eq('fisioterapeuta', fisio)

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

  useEffect(() => {
    const citaId = new URLSearchParams(window.location.search).get('cita_id')
    if (!citaId) return
    let active = true
    const openLinkedAppointment = async () => {
      const { data, error } = await supabase
        .from('citas')
        .select('*, pacientes(nombre)')
        .eq('id', citaId)
        .single()
      if (!active) return
      if (error || !data) {
        setNotification({ isOpen: true, type: 'error', title: 'Cita no disponible', message: 'No pudimos encontrar esta cita.' })
        return
      }
      setStartOfCurrentWeek(startOfWeek(new Date(`${data.fecha}T12:00:00`), { weekStartsOn: 1 }))
      setSelectedCita(data)
      setPanelMode('menu')
    }
    void openLinkedAppointment()
    return () => { active = false }
  }, [])

  // Detectar citas pasadas sin verificar (que no se hayan pospuesto)
  useEffect(() => {
    if (citas.length > 0 && !verificationCita && !selectedCita && !notification.isOpen) {
      const currentTime = new Date()
      const pastDue = citas.find(c => {
        if (dismissedVerifications.has(c.id)) return false
        const citaDateTime = new Date(`${c.fecha}T${c.hora_inicio}`)
        return citaDateTime < currentTime && (c.estado === 'pendiente' || c.estado === 'confirmada' || c.estado === 'confirmado')
      })
      if (pastDue) setVerificationCita(pastDue)
    }
  }, [citas, verificationCita, selectedCita, dismissedVerifications, notification.isOpen])

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const handleConfirmAttendance = async (attended: boolean) => {
    if (!verificationCita || saving || attendanceSavingRef.current) return
    if (!attended) {
      // "No asistió / pendiente" → posponer para no bloquear la vista
      setDismissedVerifications(prev => new Set(prev).add(verificationCita.id))
      setVerificationCita(null)
      return
    }
    attendanceSavingRef.current = true
    setSaving(true)
    try {
      const citaId = verificationCita.id
      const { data: updated, error } = await supabase.from('citas')
        .update({ estado: 'completada' })
        .eq('id', citaId)
        .in('estado', ['pendiente', 'confirmada', 'confirmado'])
        .select('id,estado')
        .maybeSingle()
      if (error) throw error
      if (!updated) {
        const { data: current, error: readError } = await supabase.from('citas')
          .select('id,estado').eq('id', citaId).maybeSingle()
        if (readError) throw readError
        if (!current || !esCompletada(current.estado)) throw new Error('La cita no se guardó como completada. Recarga la agenda e inténtalo de nuevo.')
      }
      saveConfirmedAttendanceId(citaId)
      OfflineSync.clearDashboardCache()
      setDismissedVerifications(prev => new Set(prev).add(citaId))
      const updatedCitas = citas.map(c => c.id === citaId ? { ...c, estado: 'completada' } : c)
      setCitas(updatedCitas)
      OfflineSync.saveToCache(`agenda-${format(startOfCurrentWeek, 'yyyy-MM-dd')}`, updatedCitas)
      setVerificationCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Sesión Completada', message: 'La cita se marcó como completada.' })
      await loadCitas()
    } catch (err) {
      console.error(err)
      const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'No pudimos marcar la asistencia.'
      setNotification({ isOpen: true, type: 'error', title: 'Error', message })
    } finally {
      attendanceSavingRef.current = false
      setSaving(false)
    }
  }

  const handleAssignTherapist = async (id: string, fisio: string) => {
    try {
      const cita = citas.find((item: any) => item.id === id)
      const { error } = await supabase.from('citas').update({ fisioterapeuta: fisio }).eq('id', id)
      if (error) throw error
      if (cita && cita.fisioterapeuta !== fisio) {
        const fecha = String(cita.fecha || '')
        const hora = String(cita.hora_inicio || '').slice(0, 5)
        const previousFisio = (cita.fisioterapeuta || 'Liliana') as Fisioterapeuta
        const nextFisio = fisio as Fisioterapeuta
        if (previousFisio !== nextFisio) {
          await notifyFisioPush({
            targetFisio: previousFisio,
            title: 'Cambio en tu horario',
            body: `${cita.pacientes?.nombre || 'Un paciente'} ya no está asignado contigo el ${fecha} a las ${hora}.`,
            url: '/agenda',
          })
        }
        await notifyFisioPush({
          targetFisio: nextFisio,
          title: 'Te asignaron un horario',
          body: `${cita.pacientes?.nombre || 'Un paciente'}: ${fecha}${hora ? ` a las ${hora}` : ''}.`,
          url: '/agenda',
        })
      }
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
    setRescheduleScope('single')
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
      if (!esDuena(fisioActiva)) q = q.eq('fisioterapeuta', fisioActiva)
      const { data } = await q
      setDayCitas(data || [])
    } finally {
      setLoadingDay(false)
    }
  }

  // Un slot solo está ocupado si la MISMA terapeuta ya tiene cita ahí.
  // Dos fisioterapeutas distintas pueden coincidir en la misma hora.
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
    if (esSabado(rescheduleDate)) {
      setNotification({ isOpen: true, type: 'error', title: 'Día no disponible', message: 'Los sábados no hay atención. Elige otro día.' })
      return
    }
    setSaving(true)
    try {
      let planAppointments: SeriesAppointment[] = [selectedCita]
      if (selectedCita.sesion_id && rescheduleScope === 'series') {
        const { data, error } = await supabase.from('citas')
          .select('id,fecha,hora_inicio,estado,notas,duracion_minutos,fisioterapeuta')
          .eq('sesion_id', selectedCita.sesion_id)
        if (error) throw error
        planAppointments = (data || []) as SeriesAppointment[]
      }
      const changes = (rescheduleScope === 'series' && selectedCita.sesion_id
        ? planAppointmentSeriesReschedule(planAppointments, selectedCita.id, rescheduleDate, rescheduleHour)
        : [{ id: selectedCita.id, fecha: rescheduleDate, hora_inicio: rescheduleHour }])
        .map(change => ({ ...change, ...(change.id === selectedCita.id ? { estado: 'pendiente' } : {}) }))
      const targetDates = Array.from(new Set(changes.map(change => change.fecha)))
      const { data: busyAppointments, error: busyError } = await supabase.from('citas')
        .select('id,fecha,hora_inicio,estado,duracion_minutos,fisioterapeuta')
        .in('fecha', targetDates)
        .neq('estado', 'cancelada')
      if (busyError) throw busyError
      const conflict = appointmentScheduleConflict(changes, (busyAppointments || []) as SeriesAppointment[], planAppointments)
      if (conflict) throw new Error(`El horario de la sesión del ${conflict.fecha} se cruza con otra cita. Elige otra fecha u hora.`)

      const { error: updateError } = await supabase.rpc('reschedule_appointment_series', { p_updates: changes })
      if (updateError) throw updateError
      forgetConfirmedAttendanceIds(changes.map(change => change.id))
      for (const change of changes) {
        const previous = planAppointments.find(appointment => appointment.id === change.id)
        if (previous?.fecha === change.fecha && String(previous.hora_inicio).slice(0, 5) === String(change.hora_inicio).slice(0, 5)) continue
        await notifyFisioPush({
          targetFisio: (previous?.fisioterapeuta || selectedCita.fisioterapeuta || 'Liliana') as Fisioterapeuta,
          title: 'Cambio en tu horario',
          body: `${selectedCita.pacientes?.nombre || 'Un paciente'}: cita del ${previous?.fecha} a las ${String(previous?.hora_inicio || '').slice(0, 5)} cambiada al ${change.fecha} a las ${String(change.hora_inicio).slice(0, 5)}.`,
          url: `/agenda?cita_id=${change.id}`,
        })
      }
      OfflineSync.clearDashboardCache()
      setDismissedVerifications(prev => { const n = new Set(prev); n.delete(selectedCita.id); return n })
      setSelectedCita(null)
      setVerificationCita(null)
      setNotification({ isOpen: true, type: 'success', title: 'Cita Reprogramada', message: changes.length > 1 ? `Se movieron esta cita y ${changes.length - 1} sesiones posteriores. Los avisos quedaron reprogramados.` : 'Se movió correctamente y se reprogramaron los avisos.' })
      await loadCitas()
    } catch (err) {
      console.error(err)
      const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'No pudimos mover la cita.'
      setNotification({ isOpen: true, type: 'error', title: 'Error', message })
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setSaving(true)
    try {
      let deletedAppointments: any[] = []
      if (confirmDelete.type === 'cita') {
        if (selectedCita?.id === confirmDelete.id) deletedAppointments = [selectedCita]
        const { error } = await supabase.from('citas').delete().eq('id', confirmDelete.id)
        if (error) throw error
      } else {
        const { data: planCitas, error: planCitasError } = await supabase.from('citas')
          .select('fecha,hora_inicio,fisioterapeuta,pacientes(nombre)').eq('sesion_id', confirmDelete.id)
        if (planCitasError) throw planCitasError
        deletedAppointments = planCitas || []
        // Borra el plan; las citas se eliminan por ON DELETE CASCADE
        const { error } = await supabase.from('sesiones').delete().eq('id', confirmDelete.id)
        if (error) throw error
      }
      const affectedPhysios = Array.from(new Set(deletedAppointments.map(c => c.fisioterapeuta || 'Liliana'))) as Fisioterapeuta[]
      for (const targetFisio of affectedPhysios) {
        const deletedForFisio = deletedAppointments.filter(c => (c.fisioterapeuta || 'Liliana') === targetFisio)
        const appointment = deletedForFisio[0]
        await notifyFisioPush({
          targetFisio,
          title: 'Horario cancelado',
          body: `${appointment.pacientes?.nombre || 'Un paciente'}: se canceló ${deletedForFisio.length > 1 ? `${deletedForFisio.length} cita(s)` : 'la cita'} del ${appointment.fecha} a las ${String(appointment.hora_inicio).slice(0, 5)}.`,
          url: '/agenda',
        })
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
          <h2 className="font-display italic text-3xl sm:text-5xl mb-2 flex items-center gap-3 text-rose-950">
            <CalendarIcon className="text-rose-400" size={36} />
            Calendario
          </h2>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em] italic">Agenda Semanal {fisioActiva} · toca una cita para gestionarla</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-[24px] shadow-lg shadow-rose-100/20 border border-rose-50">
           <button onClick={() => { setMobileDayPage(0); setStartOfCurrentWeek(d => addDays(d, -7)) }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors">
             <ChevronLeft size={20} />
           </button>
           <span className="text-xs font-black text-rose-950 uppercase tracking-widest px-2">Semana Actual</span>
           <button onClick={() => { setMobileDayPage(0); setStartOfCurrentWeek(d => addDays(d, 7)) }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-300 transition-colors">
             <ChevronRight size={20} />
           </button>
        </div>
      </header>

      <div className="space-y-8">
        {/* Grilla semanal */}
        <div className="card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.15)] bg-white/80 backdrop-blur-md rounded-[32px] sm:rounded-[40px] p-2 sm:p-8">
          <div className="flex items-center justify-between mb-4 lg:mb-8 px-2 lg:px-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden lg:flex p-3 sm:p-4 bg-rose-600 text-white rounded-[16px] sm:rounded-[20px] shadow-lg shadow-rose-200">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-black text-base sm:text-xl lg:text-2xl text-rose-950 tracking-tight">
                {format(startOfCurrentWeek, "d", { locale: es })} al {format(addDays(startOfCurrentWeek, 6), "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            <Sparkles className="text-rose-300 animate-pulse hidden lg:block" size={24} />
          </div>

          <div className="lg:hidden rounded-[24px] border border-rose-100 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-3 bg-rose-50/70 border-b border-rose-100">
              <button
                type="button"
                aria-label="Días anteriores de esta semana"
                disabled={mobileDayPage === 0}
                onClick={() => setMobileDayPage(page => Math.max(0, page - 1))}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-600 disabled:text-rose-200 disabled:bg-transparent bg-white shadow-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <p className="text-xs font-black text-rose-950 uppercase tracking-wide">
                  {mobileDays.map(day => `${day.label} ${day.num}`).join(' · ')}
                </p>
                <p className="text-[10px] font-bold text-rose-400 mt-0.5">Bloque {mobileDayPage + 1} de 3</p>
              </div>
              <button
                type="button"
                aria-label="Días siguientes de esta semana"
                disabled={mobileDayPage === 2}
                onClick={() => setMobileDayPage(page => Math.min(2, page + 1))}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-600 disabled:text-rose-200 disabled:bg-transparent bg-white shadow-sm"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="px-1 py-2">{renderCalendarGrid(mobileDays, true)}</div>
          </div>

          <div className="hidden lg:block rounded-[28px] border border-rose-50/50 bg-white/70 overflow-hidden">
            <div className="px-2 py-2">{renderCalendarGrid(weekDays, false)}</div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 lg:hidden">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Toca una cita</span>
             </div>
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

                {esDuena(fisioActiva) && (
                  <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-100">
                    <div className="flex items-center gap-2 mb-3">
                      <UserCog size={16} className="text-rose-400" />
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Terapeuta</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {FISIOTERAPEUTAS.map(f => (
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
                {selectedCita.sesion_id && (
                  <fieldset className="space-y-2">
                    <legend className="text-[9px] font-black text-rose-300 uppercase tracking-widest">¿Qué citas quieres mover?</legend>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setRescheduleScope('single')}
                        aria-pressed={rescheduleScope === 'single'}
                        className={`rounded-xl border p-3 text-left transition-colors ${rescheduleScope === 'single' ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-rose-100 bg-white text-slate-600'}`}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest">Solo esta cita</span>
                        <span className="mt-1 block text-[10px] font-medium">Las demás sesiones conservan su fecha.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRescheduleScope('series')}
                        aria-pressed={rescheduleScope === 'series'}
                        className={`rounded-xl border p-3 text-left transition-colors ${rescheduleScope === 'series' ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-rose-100 bg-white text-slate-600'}`}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest">Esta y las siguientes</span>
                        <span className="mt-1 block text-[10px] font-medium">Mueve las sesiones pendientes posteriores del plan.</span>
                      </button>
                    </div>
                  </fieldset>
                )}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Nueva fecha</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => {
                      const fecha = e.target.value
                      if (esSabado(fecha)) {
                        setNotification({ isOpen: true, type: 'error', title: 'Día no disponible', message: 'Los sábados no hay atención. Elige otro día.' })
                        return
                      }
                      setRescheduleDate(fecha)
                      setRescheduleHour('')
                      if (fecha) void loadDayCitas(fecha)
                    }}
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
