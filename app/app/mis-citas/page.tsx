'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Clock, CheckCircle, XCircle, Wallet, Loader2 } from 'lucide-react'
import { format, isFuture, isSameDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { format12h, formatCOP } from '@/lib/utils'
import { isHolidayColombia } from '@/lib/colombian-holidays'

type Cita = {
  id: string
  sesion_id: string | null
  fecha: string
  hora_inicio: string
  estado: string
  duracion_minutos?: number | null
}

type SesionPaquete = {
  id: string
  fecha: string
  valor: number
  monto_pagado: number | null
  estado_pago: string | null
  metodo_pago: string | null
  duracion_minutos: number | null
  cortesia: boolean | null
}

type PagoSesion = {
  id: string
  sesion_id: string
  monto: number
  metodo_pago: string | null
  fecha_pago: string | null
  es_historico: boolean
  creado_en: string
}

const methodLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  otro: 'Otro método',
}

export default function MisCitasPage() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [sesiones, setSesiones] = useState<SesionPaquete[]>([])
  const [pagos, setPagos] = useState<PagoSesion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadCitas() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('patient_profiles')
        .select('paciente_id')
        .eq('id', user.id)
        .single()

      if (profile?.paciente_id) {
        const [appointmentsResult, sessionsResult] = await Promise.all([
          supabase.from('citas').select('id,sesion_id,fecha,hora_inicio,estado,duracion_minutos')
            .eq('paciente_id', profile.paciente_id)
            .order('fecha', { ascending: false })
            .order('hora_inicio', { ascending: false }),
          supabase.from('sesiones').select('id,fecha,valor,monto_pagado,estado_pago,metodo_pago,duracion_minutos,cortesia')
            .eq('paciente_id', profile.paciente_id)
            .order('fecha', { ascending: false }),
        ])

        if (appointmentsResult.error) console.error('No se pudieron cargar las citas:', appointmentsResult.error)
        if (sessionsResult.error) console.error('No se pudieron cargar los paquetes:', sessionsResult.error)

        const appointments = appointmentsResult.data || []
        const packages = sessionsResult.data || []
        let paymentEvents: PagoSesion[] = []

        if (packages.length) {
          const { data, error } = await supabase.from('pagos_sesiones')
            .select('id,sesion_id,monto,metodo_pago,fecha_pago,es_historico,creado_en')
            .in('sesion_id', packages.map(session => session.id))
            .order('fecha_pago', { ascending: false, nullsFirst: false })
            .order('creado_en', { ascending: false })
          if (error) console.error('No se pudo cargar el historial de pagos:', error)
          paymentEvents = (data || []) as PagoSesion[]
        }

        if (active) {
          setCitas(appointments as Cita[])
          setSesiones(packages as SesionPaquete[])
          setPagos(paymentEvents)
        }
      }
      if (active) setLoading(false)
    }

    void loadCitas()
    return () => { active = false }
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando citas...</div>
  }

  const upcoming = citas.filter(c =>
    (isFuture(new Date(`${c.fecha}T${c.hora_inicio}`)) || isSameDay(new Date(`${c.fecha}T12:00:00`), new Date())) &&
    c.estado !== 'cancelada' && c.estado !== 'completada'
  ).reverse()
  const past = citas.filter(c => !upcoming.includes(c))

  return (
    <div className="px-6 py-8">
      <h1 className="font-display italic text-3xl text-rose-950 tracking-tighter mb-8">Mis Citas</h1>

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
              <h2 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">Próximas</h2>
              <div className="space-y-4">
                {upcoming.map(cita => <CitaCard key={cita.id} cita={cita} citas={citas} sesiones={sesiones} onRescheduled={updated => setCitas(current => current.map(item => { const change = updated.find(candidate => candidate.id === item.id); return change ? { ...item, ...change } : item }))} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Historial de citas</h2>
              <div className="space-y-4">
                {past.map(cita => <CitaCard key={cita.id} cita={cita} citas={citas} sesiones={sesiones} onRescheduled={updated => setCitas(current => current.map(item => { const change = updated.find(candidate => candidate.id === item.id); return change ? { ...item, ...change } : item }))} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {sesiones.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[10px] font-black text-rose-950 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wallet size={14} className="text-rose-500" /> Pagos y saldos de tus paquetes
          </h2>
          <div className="space-y-4">
            {sesiones.map(session => {
              const sessionAppointments = citas.filter(cita => cita.sesion_id === session.id && cita.estado !== 'cancelada')
              const expectedVisits = Math.max(sessionAppointments.length, Math.floor((session.duracion_minutos || 60) / 60))
              const attendedVisits = sessionAppointments.filter(cita => cita.estado === 'completada').length
              const amountPaid = Math.max(0, session.monto_pagado || 0)
              const remaining = Math.max(0, session.valor - amountPaid)
              const paymentEvents = pagos.filter(payment => payment.sesion_id === session.id)

              return (
                <article key={session.id} className="rounded-[24px] border border-rose-100 bg-white p-5 shadow-lg shadow-rose-100/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-rose-950">Paquete · {attendedVisits}/{expectedVisits} citas atendidas</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">Inició el {format(new Date(`${session.fecha}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase ${remaining === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {remaining === 0 ? 'Pagado' : 'Saldo pendiente'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-rose-50/70 p-3 text-center">
                    <AmountSummary label="Total" amount={session.valor} />
                    <AmountSummary label="Pagado" amount={amountPaid} />
                    <AmountSummary label="Restante" amount={remaining} emphasis />
                  </div>

                  {sessionAppointments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Fechas de atención</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sessionAppointments.filter(cita => cita.estado === 'completada').map(cita => (
                          <span key={cita.id} className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">
                            {format(new Date(`${cita.fecha}T12:00:00`), "EEEE d MMM", { locale: es })}
                          </span>
                        ))}
                        {attendedVisits === 0 && <span className="text-[10px] font-medium text-slate-500">Aún no hay citas marcadas como atendidas.</span>}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border-t border-rose-100 pt-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Abonos y pagos</p>
                    {paymentEvents.length ? (
                      <div className="mt-2 space-y-2">
                        {paymentEvents.map(payment => (
                          <div key={payment.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-600">
                              {payment.es_historico || !payment.fecha_pago
                                ? 'Pago previo (fecha no registrada)'
                                : format(new Date(payment.fecha_pago), "d 'de' MMM yyyy · h:mm a", { locale: es })}
                              {payment.metodo_pago && ` · ${methodLabel[payment.metodo_pago] || payment.metodo_pago}`}
                            </span>
                            <span className={`shrink-0 font-black ${payment.monto < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {payment.monto < 0 ? '−' : '+'}{formatCOP(Math.abs(payment.monto))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-slate-500">Todavía no se registran pagos para este paquete.</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function AmountSummary({ label, amount, emphasis = false }: { label: string; amount: number; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-[10px] font-black sm:text-xs ${emphasis ? 'text-rose-700' : 'text-slate-800'}`}>{formatCOP(amount)}</p>
    </div>
  )
}

function CitaCard({ cita, citas, sesiones, onRescheduled }: { cita: Cita; citas: Cita[]; sesiones: SesionPaquete[]; onRescheduled: (citas: Array<Partial<Cita> & { id: string }>) => void }) {
  const isCancelled = cita.estado === 'cancelada'
  const isCompleted = cita.estado === 'completada'
  const session = sesiones.find(item => item.id === cita.sesion_id)
  const packageVisits = citas
    .filter(item => item.sesion_id === cita.sesion_id)
    .sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`))
  const visitIndex = packageVisits.findIndex(item => item.id === cita.id)
  const packageSize = Math.max(packageVisits.length, Math.floor((session?.duracion_minutos || 0) / 60))

  let bgClass = 'bg-white border-rose-50'
  let icon = <Clock size={20} className="text-rose-400" />
  let statusText = 'Confirmada'
  let statusClass = 'text-emerald-700 bg-emerald-50'

  if (isCancelled) {
    bgClass = 'bg-slate-50 border-slate-200'
    icon = <XCircle size={20} className="text-slate-500" />
    statusText = 'Cancelada'
    statusClass = 'text-slate-700 bg-slate-200/70'
  } else if (isCompleted) {
    bgClass = 'bg-emerald-50 border-emerald-100'
    icon = <CheckCircle size={20} className="text-emerald-600" />
    statusText = 'Atendida'
    statusClass = 'text-emerald-800 bg-emerald-100'
  }

  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  return (
    <div className={`rounded-[24px] border p-5 shadow-lg shadow-rose-100/30 ${bgClass}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-rose-950">
            {format(new Date(`${cita.fecha}T12:00:00`), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">{format12h(cita.hora_inicio)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass}`}>{statusText}</span>
      </div>
      {session && visitIndex >= 0 && packageSize > 1 && (
        <p className="ml-16 mt-2 text-[10px] font-black uppercase tracking-wider text-rose-600">Cita {visitIndex + 1}/{packageSize}</p>
      )}
      {!isCancelled && !isCompleted && (
        <button type="button" onClick={() => setRescheduleOpen(true)} className="mt-4 ml-16 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50">
          Reagendar cita
        </button>
      )}
      {rescheduleOpen && <RescheduleDialog cita={cita} onClose={() => setRescheduleOpen(false)} onRescheduled={updated => { onRescheduled(updated); setRescheduleOpen(false) }} />}
    </div>
  )
}

const RESCHEDULE_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function RescheduleDialog({ cita, onClose, onRescheduled }: { cita: Cita; onClose: () => void; onRescheduled: (citas: Array<Partial<Cita> & { id: string }>) => void }) {
  const today = localDateString(new Date())
  const [fecha, setFecha] = useState(cita.fecha >= today ? cita.fecha : today)
  const [busy, setBusy] = useState<{ hora_inicio: string; duracion_minutos: number | null }[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [selectedTime, setSelectedTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoadingAvailability(true)
    setSelectedTime('')
    setError('')
    fetch(`/api/patient/availability?from=${fecha}&to=${fecha}&citaId=${cita.id}`, { cache: 'no-store' })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudieron consultar los horarios.')
        if (active) setBusy(result.citas || [])
      })
      .catch(reason => { if (active) setError(reason.message || 'No se pudieron consultar los horarios.') })
      .finally(() => { if (active) setLoadingAvailability(false) })
    return () => { active = false }
  }, [fecha, cita.id])

  const day = new Date(`${fecha}T12:00:00`).getDay()
  const isHoliday = isHolidayColombia(fecha)
  const slots = day === 0 || isHoliday ? ['08:00', '09:00', '10:00', '11:00'] : day === 6 ? [] : RESCHEDULE_SLOTS
  const duration = cita.duracion_minutos || 60
  const isUnavailable = (time: string) => {
    if (cita.fecha === fecha && cita.hora_inicio.slice(0, 5) === time) return true
    const [hour, minute] = time.split(':').map(Number)
    const start = hour * 60 + minute
    const overlap = busy.some(appointment => {
      const [busyHour, busyMinute] = appointment.hora_inicio.slice(0, 5).split(':').map(Number)
      const busyStart = busyHour * 60 + busyMinute
      return start < busyStart + (appointment.duracion_minutos || 60) && busyStart < start + duration
    })
    return overlap || `${fecha}T${time}` <= `${today}T${new Date().toTimeString().slice(0, 5)}`
  }

  async function save() {
    if (!selectedTime) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/patient/reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citaId: cita.id, fecha, hora: selectedTime }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo reagendar la cita.')
      onRescheduled(result.citas || [result.cita])
    } catch (reason: any) {
      setError(reason.message || 'No se pudo reagendar la cita.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`reschedule-title-${cita.id}`}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`reschedule-title-${cita.id}`} className="text-xl font-black text-rose-950">Reagendar cita</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Elige otro día y uno de los horarios disponibles.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Cerrar</button>
        </div>

        <label className="mt-6 block text-[10px] font-black uppercase tracking-widest text-rose-600" htmlFor={`reschedule-date-${cita.id}`}>Fecha</label>
        <input id={`reschedule-date-${cita.id}`} type="date" value={fecha} min={today} max={localDateString(addDays(new Date(), 30))} onChange={event => setFecha(event.target.value)} className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 font-bold text-rose-950 outline-none focus:border-rose-300" />

        <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-rose-600">Horarios disponibles</p>
        {loadingAvailability ? <div className="py-8 text-center text-sm font-bold text-rose-400">Consultando agenda…</div> : slots.length === 0 ? <p className="py-6 text-sm font-medium text-slate-500">No hay atención disponible ese día. Prueba con otra fecha.</p> : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {slots.map(time => {
              const disabled = isUnavailable(time)
              const selected = selectedTime === time
              return <button key={time} type="button" disabled={disabled} onClick={() => setSelectedTime(time)} className={`rounded-xl border px-2 py-3 text-xs font-black transition ${selected ? 'border-rose-600 bg-rose-600 text-white' : disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through' : 'border-rose-100 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50'}`}>{format12h(time)}</button>
            })}
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
        <button type="button" disabled={!selectedTime || saving || loadingAvailability} onClick={save} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Reagendando…' : 'Confirmar nuevo horario'}
        </button>
        <p className="mt-3 text-center text-[10px] font-medium text-slate-400">Avisaremos a la clínica cuando se confirme el cambio.</p>
      </div>
    </div>
  )
}
