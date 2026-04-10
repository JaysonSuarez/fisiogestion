'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, X, Check, Calendar, User, Phone, Stethoscope, Loader2, Heart, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import NotificationModal from '@/components/ui/NotificationModal'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

const format12h = (h: string) => {
  if (!h) return ''
  const [hh, mm] = h.split(':').map(Number)
  const p = hh < 12 ? 'AM' : 'PM'
  return `${hh % 12 || 12}:${mm.toString().padStart(2, '0')} ${p}`
}

export default function SolicitudesWidget() {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false, type: 'success', title: '', message: ''
  })

  async function loadSolicitudes() {
    const { data } = await supabase
      .from('solicitudes_cita')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
  }

  useEffect(() => {
    loadSolicitudes()
    const channel = supabase
      .channel('solicitudes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitudes_cita' }, () => loadSolicitudes())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitudes_cita' }, () => loadSolicitudes())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function aceptarSolicitud(solicitud: any) {
    setAccepting(solicitud.id)
    try {
      // 1. Crear el paciente
      const { data: paciente, error: pErr } = await supabase
        .from('pacientes')
        .insert([{
          nombre: `${solicitud.nombre} ${solicitud.apellido}`,
          telefono: solicitud.telefono,
          diagnostico: solicitud.diagnostico,
          estado: 'activo',
          notas_iniciales: `Paciente agendó en línea. Edad: ${solicitud.edad} años.`,
          total_sesiones: solicitud.num_sesiones,
          valor_sesion: solicitud.precio_sesion,
        }])
        .select()
        .single()

      if (pErr) throw pErr

      // 2. Calcular fecha del plan (la primera sesión)
      const fechas: { fecha: string; hora: string }[] = solicitud.fechas_solicitadas || []
      const sorted = [...fechas].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primeraFecha = sorted[0]?.fecha || format(new Date(), 'yyyy-MM-dd')

      // 3. Crear la sesión (plan de tratamiento)
      const { data: sesion, error: sErr } = await supabase
        .from('sesiones')
        .insert([{
          paciente_id: paciente.id,
          fecha: primeraFecha,
          duracion_minutos: 60,
          valor: solicitud.precio_total,
          estado_pago: 'pendiente',
        }])
        .select()
        .single()

      if (sErr) throw sErr

      // 4. Crear las citas en el calendario
      const citas = sorted.map(slot => ({
        paciente_id: paciente.id,
        sesion_id: sesion.id,
        fecha: slot.fecha,
        hora_inicio: slot.hora,
        duracion_minutos: 60,
        estado: 'confirmada',
        notas: `Sesión agendada en línea. Diagnóstico: ${solicitud.diagnostico}`,
      }))

      const { error: cErr } = await supabase.from('citas').insert(citas)
      if (cErr) throw cErr

      // 5. Marcar solicitud como aceptada
      await supabase.from('solicitudes_cita').update({ estado: 'aceptada' }).eq('id', solicitud.id)

      setNotification({
        isOpen: true,
        type: 'success',
        title: '¡Cita Confirmada!',
        message: `${solicitud.nombre} ha sido registrado y sus ${solicitud.num_sesiones} citas han sido creadas.`
      })
      setOpen(null)
    } catch (err: any) {
      console.error(err)
      setNotification({ isOpen: true, type: 'error', title: 'Error', message: err.message || 'No se pudo procesar la solicitud.' })
    } finally {
      setAccepting(null)
    }
  }

  async function rechazarSolicitud(id: string) {
    await supabase.from('solicitudes_cita').update({ estado: 'rechazada' }).eq('id', id)
    setOpen(null)
  }

  if (solicitudes.length === 0) return null

  return (
    <>
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <div className="mb-8">
        {/* Header badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <Bell size={18} className="text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border-2 border-rose-600 shadow-sm">
              <span className="text-[9px] font-black text-rose-600">{solicitudes.length}</span>
            </div>
          </div>
          <div>
            <h3 className="font-black text-rose-950 uppercase tracking-tighter text-sm flex items-center gap-2">
              ¡Ey! Alguien agendó contigo
              <span className="animate-pulse text-rose-400">✨</span>
            </h3>
            <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest">
              {solicitudes.length} solicitud{solicitudes.length > 1 ? 'es' : ''} pendiente{solicitudes.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Solicitudes list */}
        <div className="space-y-3">
          {solicitudes.map(s => (
            <div key={s.id} className="bg-white rounded-[28px] border-2 border-rose-100 shadow-lg shadow-rose-100/30 overflow-hidden">
              {/* Summary row */}
              <button
                className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-rose-50/50 transition-colors"
                onClick={() => setOpen(open === s.id ? null : s.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950 text-white flex items-center justify-center font-black text-sm uppercase shadow-lg shadow-rose-950/20">
                    {s.nombre[0]}{s.apellido[0]}
                  </div>
                  <div>
                    <div className="font-black text-rose-950 text-base tracking-tight">{s.nombre} {s.apellido}</div>
                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-0.5">
                      {s.num_sesiones} sesiones · {formatCOP(s.precio_total)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-black text-rose-300 uppercase tracking-widest hidden sm:block">
                    {format(new Date(s.created_at), "d MMM", { locale: es })}
                  </span>
                  {open === s.id ? <ChevronUp size={18} className="text-rose-300" /> : <ChevronDown size={18} className="text-rose-300" />}
                </div>
              </button>

              {/* Expanded detail */}
              {open === s.id && (
                <div className="border-t border-rose-50 p-5 space-y-5 bg-rose-50/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-rose-400" />
                        <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Paciente</span>
                      </div>
                      <div className="text-sm font-black text-rose-950">{s.nombre} {s.apellido}, {s.edad} años</div>

                      <div className="flex items-center gap-2 mt-4">
                        <Phone size={12} className="text-rose-400" />
                        <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Teléfono</span>
                      </div>
                      <div className="text-sm font-black text-rose-950">{s.telefono}</div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={12} className="text-rose-400" />
                        <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Diagnóstico</span>
                      </div>
                      <div className="text-sm font-medium text-rose-700 leading-relaxed">{s.diagnostico}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={12} className="text-rose-400" />
                      <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Horarios solicitados</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(s.fechas_solicitadas as { fecha: string; hora: string }[])
                        .sort((a, b) => a.fecha.localeCompare(b.fecha))
                        .map((slot, i) => (
                          <span key={i} className="bg-white border border-rose-100 text-rose-700 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                            {format(new Date(slot.fecha + 'T12:00'), "d MMM", { locale: es })} · {format12h(slot.hora)}
                          </span>
                        ))
                      }
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => rechazarSolicitud(s.id)}
                      className="py-3 border border-rose-100 text-rose-300 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-50 transition-all"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => aceptarSolicitud(s)}
                      disabled={accepting === s.id}
                      className="py-3 bg-rose-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {accepting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} fill="white" />}
                      {accepting === s.id ? 'Procesando...' : 'Aceptar y Crear'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
