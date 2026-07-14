'use client'

import { useState, useEffect } from 'react'
import { supabase, getCachedUser } from '@/lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  ArrowUpRight,
  MoreVertical,
  Clock,
  Loader2,
  Activity,
  MessageCircle,
  Sparkles,
  Heart,
  Flower2,
  Flower,
  Sprout,
  Bell,
  BellRing,
  LogOut,
  X,
  CheckCircle,
  Save
} from 'lucide-react'
import SolicitudesWidget from '@/components/ui/SolicitudesWidget'
import NotificationModal from '@/components/ui/NotificationModal'
import PushManager from '@/components/push/PushManager'
import { OfflineSync } from '@/lib/offline-sync'
import { formatCOP, format12h, getIniciales, getMesesDisponibles, formatMes, getCurrentMonthStr, getMonthDateRange, calcularGananciaLiliana, calcularDiezmo } from '@/lib/utils'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({
    pacientesActivos: 0,
    citasHoy: [],
    porCobrar: 0,
    ingresoTotal: 0,
    diezmoTotal: 0,
    deudores: [],
    solicitudesCount: 0,
    horasClinicas: 0
  })

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr())
  const [isLuisa, setIsLuisa] = useState(false)

  // Control de recordatorios
  const [activeReminder, setActiveReminder] = useState<any>(null)
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set())

  // Verification State (Asistencia)
  const [verificationCita, setVerificationCita] = useState<any>(null)
  const [dismissedVerifications, setDismissedVerifications] = useState<Set<string>>(new Set())
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({ fecha: '', hora: '' })
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  async function loadDashboard(useCache = true) {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')

    // 1. Cargar desde caché (Offline First)
    if (useCache) {
      const cachedData = OfflineSync.getFromCache(`dashboard-${selectedMonth}`);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const isLu = user?.email?.toLowerCase().includes('luisa')
      setIsLuisa(!!isLu)

      const { startDate, endDate } = getMonthDateRange(selectedMonth)

      let pacientesActivos = 0
      
      if (isLu) {
        const { count } = await supabase
          .from('pacientes')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'activo')
          .eq('fisioterapeuta', 'Luisa')
        pacientesActivos = count || 0
      } else {
        const { count } = await supabase
          .from('pacientes')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'activo')
        pacientesActivos = count || 0
      }

      let citasHoyQuery = supabase.from('citas').select('*, pacientes(nombre, telefono)').eq('fecha', todayStr).neq('estado', 'cancelada')
      let sesionesQuery = supabase.from('sesiones').select('valor, monto_pagado, diezmo_entregado, duracion_minutos, pacientes(nombre, id), citas(fisioterapeuta, estado)').gte('fecha', startDate).lte('fecha', endDate)
      let citasMesQuery = supabase.from('citas').select('duracion_minutos').eq('estado', 'completada').gte('fecha', startDate).lte('fecha', endDate)
      
      if (isLu) {
        citasHoyQuery = citasHoyQuery.eq('fisioterapeuta', 'Luisa')
        citasMesQuery = citasMesQuery.eq('fisioterapeuta', 'Luisa')
      }

      const [
        { data: citasHoyRaw },
        { data: todasSesiones },
        { count: solicitudesCount },
        { data: citasMes }
      ] = await Promise.all([
        citasHoyQuery,
        sesionesQuery,
        supabase.from('solicitudes_cita').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        citasMesQuery
      ]);

      const porCobrar = todasSesiones?.reduce((acc, s) => acc + (s.valor - (s.monto_pagado || 0)), 0) || 0
      const ingresoGlobal = todasSesiones?.reduce((acc, s) => acc + (s.monto_pagado || 0), 0) || 0
      // Ganancia de Liliana (recaudado − comisión de Luisa) sobre los planes aún no diezmados del mes
      const gananciaDiezmable = todasSesiones?.filter(s => !s.diezmo_entregado).reduce((acc, s: any) => acc + calcularGananciaLiliana(s), 0) || 0

      const deudoresMap: Record<string, { nombre: string, deuda: number }> = {}
      todasSesiones?.forEach(s => {
        const p = s.pacientes as any
        if (!p) return
        const saldo = s.valor - (s.monto_pagado || 0)
        if (saldo <= 0) return
        if (!deudoresMap[p.id]) deudoresMap[p.id] = { nombre: p.nombre, deuda: 0 }
        deudoresMap[p.id].deuda += saldo
      })
      const deudores = Object.values(deudoresMap).sort((a, b) => b.deuda - a.deuda).slice(0, 3)

      const horasClinicas = (citasMes?.reduce((acc, c) => acc + (c.duracion_minutos || 0), 0) || 0) / 60

      const newData = {
        pacientesActivos: pacientesActivos || 0,
        citasHoy: citasHoyRaw || [],
        porCobrar,
        ingresoTotal: ingresoGlobal,
        diezmoTotal: calcularDiezmo(gananciaDiezmable),
        deudores,
        solicitudesCount: solicitudesCount || 0,
        horasClinicas: Math.round(horasClinicas * 10) / 10
      };

      setData(newData);
      OfflineSync.saveToCache(`dashboard-${selectedMonth}`, newData);
    } catch (e) {
      console.error('Error loading dashboard network data', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(true)
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => loadDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, () => loadDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_cita' }, () => loadDashboard(false))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedMonth])


  // Manejar interacciones de notificaciones PUSH
  useEffect(() => {
    // 1. Cuando la app se abre desde la notificación cerrada (vía query param)
    const params = new URLSearchParams(window.location.search)
    const citaId = params.get('cita_id')
    const phase = params.get('phase')
    
    if (params.get('trigger_wa') === 'true' && citaId && data.citasHoy.length > 0) {
      const cita = data.citasHoy.find((c: any) => c.id === citaId)
      if (cita) {
        setActiveReminder({ ...cita, phase: phase || '1h' })
        // Limpiamos la URL para no volver a dispararlo al recargar
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    // 2. Cuando la app ya estaba abierta (Background o Foreground)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_WHATSAPP') {
        const { citaId, phase } = event.data.data || {}
        if (citaId && data.citasHoy.length > 0) {
          const cita = data.citasHoy.find((c: any) => c.id === citaId)
          if (cita) {
            setActiveReminder({ ...cita, phase: phase || '1h' })
          }
        }
      }
    }
    
    navigator.serviceWorker?.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage)
  }, [data.citasHoy])

  // Funciones de Verificación (Misma lógica que en Agenda)
  const handleConfirmAttendance = async (attended: boolean) => {
    if (!verificationCita) return
    // "Ahora no" → posponer sin bloquear la vista (no reaparece hasta recargar)
    if (!attended) {
      setDismissedVerifications(prev => new Set(prev).add(verificationCita.id))
      setVerificationCita(null)
      setIsRescheduling(false)
      return
    }
    setSaving(true)
    try {
      if (attended) {
        const { error } = await supabase
          .from('citas')
          .update({ estado: 'completada' })
          .eq('id', verificationCita.id)
        
        if (error) throw error
        
        setData((prev: any) => {
          const updated = {
            ...prev,
            citasHoy: prev.citasHoy.map((c: any) => 
              c.id === verificationCita.id ? { ...c, estado: 'completada' } : c
            )
          }
          OfflineSync.saveToCache(`dashboard-${selectedMonth}`, updated)
          return updated
        })
        
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
          estado: 'pendiente',
          // Reiniciar avisos para que el cron notifique con la hora nueva
          notificado_1h: false,
          notificado_10m: false
        })
        .eq('id', verificationCita.id)
      
      if (error) throw error

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const isStillToday = rescheduleData.fecha === todayStr

      setData((prev: any) => {
        const updatedCitas = prev.citasHoy.map((c: any) => 
          c.id === verificationCita.id 
            ? { ...c, fecha: rescheduleData.fecha, hora_inicio: rescheduleData.hora, estado: 'pendiente' } 
            : c
        )
        const filteredCitas = isStillToday 
          ? updatedCitas 
          : updatedCitas.filter((c: any) => c.id !== verificationCita.id)

        const updated = {
          ...prev,
          citasHoy: filteredCitas
        }
        OfflineSync.saveToCache(`dashboard-${selectedMonth}`, updated)
        return updated
      })
      
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

  // Monitor de recordatorios (revisa cada 30 segundos)
  useEffect(() => {
    const checkReminders = () => {
      if (activeReminder) return 

      const currentTime = new Date()
      data.citasHoy.forEach((cita: any) => {
        if (cita.estado === 'completado' || cita.estado === 'cancelada') return

        const [hours, minutes] = cita.hora_inicio.split(':').map(Number)
        const citaTime = new Date()
        // Aseguramos que la fecha base sea la de la cita
        const [year, month, day] = cita.fecha.split('-').map(Number)
        citaTime.setFullYear(year, month - 1, day)
        citaTime.setHours(hours, minutes, 0, 0)

        const diff = citaTime.getTime() - currentTime.getTime()
        const minsRemaining = Math.floor(diff / 60000)

        // Verificación de citas pasadas (posponible: no reaparece si ya se cerró)
        if (minsRemaining < 0 && (cita.estado === 'pendiente' || cita.estado === 'confirmada' || cita.estado === 'confirmado')) {
          if (!verificationCita && !dismissedVerifications.has(cita.id)) {
            setVerificationCita(cita)
            setRescheduleData({ fecha: cita.fecha, hora: cita.hora_inicio.slice(0, 5) })
          }
          return
        }

        // Fase 1: Aproximadamente 1 Hora antes (entre 55 y 65 min)
        const id1h = `${cita.id}-1h`
        if (minsRemaining >= 55 && minsRemaining <= 65 && !remindedIds.has(id1h)) {
          setActiveReminder({ ...cita, phase: '1h', minsLeft: minsRemaining })
        } 
        // Fase 2: 10 Minutos antes (entre 5 y 15 min)
        else {
          const id10m = `${cita.id}-10m`
          if (minsRemaining >= 5 && minsRemaining <= 15 && !remindedIds.has(id10m)) {
            setActiveReminder({ ...cita, phase: '10m', minsLeft: minsRemaining })
          }
        }
      })
    }
    
    // Nota: las notificaciones push del sistema las envía el cron del servidor
    // (única fuente de verdad, siempre lee la hora fresca de la BD). Aquí solo
    // mostramos el recordatorio visual dentro de la app cuando está abierta.

    const interval = setInterval(checkReminders, 30000)
    return () => clearInterval(interval)
  }, [data.citasHoy, remindedIds, activeReminder, dismissedVerifications, verificationCita])

  const dismissReminder = (id: string, phase: string) => {
    setRemindedIds(prev => {
      const next = new Set(prev)
      next.add(`${id}-${phase}`)
      return next
    })
    setActiveReminder(null)
  }

  const now = new Date()

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute -top-20 -left-20 text-rose-100/30 -z-10 rotate-12">
        <Flower2 size={300} strokeWidth={0.5} />
      </div>
      <div className="absolute top-1/2 -right-20 text-rose-100/20 -z-10 -rotate-12">
        <Sprout size={250} strokeWidth={0.5} />
      </div>

      <header className="topbar mb-10 relative">
        <div className="flex flex-row items-center justify-between w-full gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between md:justify-start gap-4">
              <h2 className="font-display italic text-5xl md:text-6xl text-rose-950 flex items-center gap-3">
                <Sparkles className="text-rose-400 animate-pulse hidden md:block" size={40} />
                <Sparkles className="text-rose-400 animate-pulse md:hidden" size={28} />
                Hola, Ft. {isLuisa ? 'Luisa' : 'Liliana'}
              </h2>
              
              <div className="flex items-center gap-2">
                <PushManager mode="inline" />
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = '/login'
                  }}
                  className="p-3 bg-white text-rose-300 hover:text-rose-600 rounded-2xl border border-rose-50 shadow-sm transition-all"
                  title="Cerrar Sesión"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-rose-400 font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] italic">
                {format(now, "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <Flower size={14} className="text-rose-200" />
            </div>
            
            <div className="mt-4 flex items-center gap-2 max-w-xs">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-white border border-rose-100 text-rose-950 font-black rounded-[20px] px-4 py-2 shadow-sm uppercase tracking-widest text-xs outline-none focus:ring-2 focus:ring-rose-200"
              >
                {getMesesDisponibles().map(m => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <SolicitudesWidget />

      {/* Metrics Section */}
      <section className="metric-grid gap-8">
        <div className="card metric-card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.1)] bg-white/70 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-rose-50/50 group-hover:scale-110 transition-transform">
            <Users size={80} />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-rose-50 text-rose-400 rounded-2xl w-fit mb-6 shadow-inner"><Users size={24} /></div>
            <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Pacientes</span>
            <div className="text-3xl md:text-4xl font-black text-rose-950 tracking-tighter">{data.pacientesActivos}</div>
          </div>
        </div>

        <div className="card metric-card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.1)] bg-white/70 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-rose-50/50 group-hover:scale-110 transition-transform">
            <Calendar size={80} />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-rose-50 text-rose-400 rounded-2xl w-fit mb-6 shadow-inner"><Calendar size={24} /></div>
            <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Citas Hoy</span>
            <div className="text-3xl md:text-4xl font-black text-rose-950 tracking-tighter">{data.citasHoy.length}</div>
          </div>
        </div>

        {!isLuisa ? (
          <div className="card metric-card border-none bg-white shadow-xl shadow-rose-100/30 relative overflow-hidden group border border-rose-50">
            <div className="absolute -right-4 -top-4 text-rose-100/20 group-hover:scale-110 transition-transform">
              <TrendingUp size={100} />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-6 shadow-sm"><TrendingUp size={24} /></div>
              <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Total recaudado</span>
              <div className="text-2xl md:text-4xl font-black text-rose-950 tracking-tighter truncate" title={formatCOP(data.ingresoTotal)}>
                {formatCOP(data.ingresoTotal)}
              </div>
            </div>
          </div>
        ) : (
          <div className="card metric-card border-none bg-white shadow-xl shadow-rose-100/30 relative overflow-hidden group border border-rose-50">
            <div className="absolute -right-4 -top-4 text-rose-100/20 group-hover:scale-110 transition-transform">
              <Activity size={100} />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl w-fit mb-6 shadow-sm"><Clock size={24} /></div>
              <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Horas Clínicas</span>
              <div className="text-3xl md:text-4xl font-black text-rose-950 tracking-tighter">{data.horasClinicas}h</div>
            </div>
          </div>
        )}

        {!isLuisa && (
          <div className="card metric-card border-none bg-rose-50/50 shadow-xl shadow-rose-100/10 relative overflow-hidden group border border-rose-100/50">
            <div className="absolute -right-4 -top-4 text-rose-200/20 group-hover:scale-110 transition-transform">
              <Activity size={100} />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-white text-rose-500 rounded-2xl w-fit mb-6 shadow-sm"><Activity size={24} /></div>
              <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Solicitudes</span>
              <div className="text-3xl md:text-4xl font-black text-rose-950 tracking-tighter">{data.solicitudesCount}</div>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-12">
        <div className="card border-2 border-rose-50/50 bg-white/50 backdrop-blur-md shadow-xl shadow-rose-100/20 p-8">
          <div className="flex-between mb-8 pb-4 border-b border-rose-50">
            <h3 className="text-rose-950 font-black flex items-center gap-3 uppercase text-xs tracking-[0.2em]">
              <Clock size={16} className="text-rose-400" />
              Sesiones del Día
            </h3>
            <Link href="/agenda" className="text-[9px] font-black text-rose-400 hover:text-rose-600 flex items-center gap-1 transition-colors uppercase tracking-[0.1em] bg-rose-50 px-3 py-1 rounded-full">
              Agenda <ArrowUpRight size={12} />
            </Link>
          </div>
          
          <div className="space-y-5">
            {data.citasHoy.map((cita: any) => {
              const p = cita.pacientes as any
              if (!p) return null
              const initials = getIniciales(p.nombre)
              return (
                <div key={cita.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-white rounded-[28px] sm:rounded-[32px] transition-all border border-transparent hover:border-rose-100 hover:shadow-lg shadow-rose-100/20 group gap-4">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] sm:rounded-[22px] bg-rose-950 text-rose-100 flex items-center justify-center font-black text-xs sm:text-sm group-hover:bg-rose-600 transition-colors shadow-lg shadow-rose-950/20 uppercase shrink-0">{initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-rose-950 group-hover:text-rose-600 transition-colors uppercase tracking-tight text-base sm:text-lg truncate">{p.nombre}</div>
                      <div className="text-[9px] sm:text-[10px] text-rose-300 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} /> {format12h(cita.hora_inicio)} · {cita.duracion_minutos} MIN
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-rose-50">
                    <span className="sm:hidden text-[8px] font-black text-rose-300 uppercase tracking-widest italic">Estado:</span>
                    <div className="flex items-center gap-2">
                      {p.telefono && (
                        <a 
                          href={`https://wa.me/57${p.telefono.replace(/\s/g, '')}?text=${encodeURIComponent(
                            `Hola *${p.nombre}* 👋, te recordamos tu sesión de hoy con la Fisio Liliana González a las *${format12h(cita.hora_inicio)}*. ¡Te esperamos! ✨`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          title="Enviar recordatorio WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                      <span className="badge bg-rose-50 text-rose-500 text-[9px] font-black px-4 py-1.5 rounded-2xl uppercase italic border border-rose-100/50">
                        {cita.estado}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            {data.citasHoy.length === 0 && (
              <div className="py-16 text-center rounded-[40px] bg-rose-50/20 border-2 border-dashed border-rose-100/50">
                <Flower2 className="mx-auto mb-4 text-rose-200" size={32} />
                <p className="text-rose-300 text-[10px] font-black uppercase tracking-widest italic">Hoy tienes tiempo para ti ✨</p>
              </div>
            )}
          </div>
        </div>

        {!isLuisa && (
          <div className="flex flex-col gap-10">
            <div className="card bg-white border-2 border-rose-50 shadow-xl shadow-rose-100/20 p-8 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 text-rose-50/30">
                <Flower size={120} />
              </div>
              <div className="relative z-10">
                <div className="flex-between mb-8 pb-4 border-b border-rose-50">
                  <h3 className="text-rose-950 font-black uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                    <Heart size={14} className="text-rose-400" /> Cartera Liliana
                  </h3>
                  <Link href="/finanzas" className="text-[9px] font-black text-white bg-rose-950 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-rose-900 transition-colors">Cobrar</Link>
                </div>
                <div className="space-y-4">
                  {data.deudores.map((p: any, idx: number) => (
                    <div key={idx} className="flex-between p-5 bg-rose-50/30 rounded-[28px] border border-rose-100/50 hover:bg-rose-50 transition-colors">
                      <span className="text-sm font-black text-rose-950 tracking-tight uppercase">{p.nombre}</span>
                      <span className="text-lg font-black text-rose-600 tracking-tighter">
                        {formatCOP(p.deuda)}
                      </span>
                    </div>
                  ))}
                  {data.deudores.length === 0 && (
                    <div className="text-center py-6">
                      <Sparkles className="mx-auto mb-2 text-rose-300" size={24} />
                      <p className="text-[10px] text-rose-300 font-black uppercase tracking-[0.2em] italic">¡Todo brilla y está al día!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-white to-rose-50 border-2 border-rose-100 p-10 shadow-xl shadow-rose-100/20 overflow-hidden relative group rounded-[40px]">
              <div className="absolute -right-4 -bottom-4 w-48 h-48 bg-rose-200/20 rounded-full blur-[80px] group-hover:scale-125 transition-transform duration-1000"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-100/30 -z-0">
                 <Heart size={200} fill="currentColor" />
              </div>
              
              <div className="flex-between mb-10 relative z-10">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-white rounded-2xl text-rose-500 shadow-sm border border-rose-100">
                    <Heart size={22} fill="currentColor" />
                  </div>
                  <h3 className="text-rose-950 font-black uppercase tracking-[0.2em] text-[10px]">Diezmo Especial</h3>
                </div>
              </div>
              
              <div className="space-y-8 relative z-10">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                          Ofrenda (10%) <Sparkles size={10} />
                        </div>
                        <div className="text-3xl md:text-5xl font-black text-rose-950 tracking-tighter mb-1">{formatCOP(data.diezmoTotal)}</div>
                        <div className="text-[8px] text-rose-400 font-bold uppercase tracking-widest italic">Sincronizado con tus bendiciones</div>
                      </div>
                    </div>

                <div className="pt-6 border-t border-rose-200/50 space-y-4">
                  <div className="flex justify-between text-[10px] font-black text-rose-500 mb-1 uppercase tracking-[0.2em]">
                    <span>RECAUDO TOTAL</span>
                    <span className="text-rose-950 font-black">{formatCOP(data.ingresoTotal)}</span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden border border-rose-100">
                    <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full w-full"></div>
                  </div>
                  <div className="flex justify-center">
                     <Flower size={16} className="text-rose-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DE RECORDATORIO AUTOMÁTICO ── */}
      {activeReminder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-rose-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[48px] p-10 shadow-2xl shadow-rose-950/40 border border-rose-100 relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute -right-10 -top-10 text-rose-50/50">
              <Flower size={200} />
            </div>
            
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-emerald-100/50 animate-bounce">
                <MessageCircle size={32} fill="currentColor" />
              </div>
              
              <h2 className="text-3xl font-black text-rose-950 tracking-tighter mb-2 uppercase italic">
                {activeReminder.phase === '10m' ? '¡Ya casi empieza!' : '¡Es hora de avisar!'}
              </h2>
              <p className="text-rose-400 font-medium text-sm mb-8 leading-relaxed px-4">
                La cita con <span className="font-black text-rose-600 tracking-tight">{activeReminder.pacientes?.nombre}</span> es a las <span className="font-black text-rose-600">{format12h(activeReminder.hora_inicio)}</span> (en aproximadamente {activeReminder.minsLeft} minutos).
              </p>

              <div className="space-y-4">
                <a 
                  href={`https://wa.me/57${activeReminder.pacientes?.telefono?.replace(/\s/g, '')}?text=${encodeURIComponent(
                    activeReminder.phase === '10m' 
                      ? `Hola *${activeReminder.pacientes?.nombre}* 👋, ya estamos casi listos para tu sesión de las *${format12h(activeReminder.hora_inicio)}*. ¡Vente con cuidado!`
                      : `Hola *${activeReminder.pacientes?.nombre}* 👋, paso por aquí para recordarte tu sesión de hoy a las *${format12h(activeReminder.hora_inicio)}*. ¡Ya casi nos vemos! ✨`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => dismissReminder(activeReminder.id, activeReminder.phase)}
                  className={`block w-full py-5 ${activeReminder.phase === '10m' ? 'bg-rose-600' : 'bg-emerald-500'} hover:opacity-90 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3`}
                >
                  <Sparkles size={18} /> {activeReminder.phase === '10m' ? 'AVISAR LLEGADA' : 'ENVIAR RECORDATORIO'}
                </a>

                <button 
                  onClick={() => dismissReminder(activeReminder.id, activeReminder.phase)}
                  className="w-full py-4 bg-white border border-rose-100 text-rose-300 hover:text-rose-400 hover:bg-rose-50 rounded-[20px] font-black text-[9px] uppercase tracking-widest transition-all"
                >
                  Ya lo envié, presiona aquí
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                  onClick={() => { setDismissedVerifications(prev => new Set(prev).add(verificationCita.id)); setVerificationCita(null); setIsRescheduling(false) }}
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
                    <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed italic">Esta cita estaba programada para las {format12h(verificationCita.hora_inicio)}.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
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
