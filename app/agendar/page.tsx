'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addDays, startOfWeek, isBefore, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Heart, Flower2, CheckCircle, Loader2, Calendar, Clock, User,
  Phone, Stethoscope, ChevronRight, ChevronLeft, Sparkles, Info
} from 'lucide-react'

// ─── Precios estáticos según número de sesiones ───────────────────────────────
const PLANES_PRECIOS = [
  { id: 'evaluacion', sesiones: 1, precio: 30000,  label: 'Evaluación' },
  { id: 'descarga', sesiones: 1,  precio: 70000,   label: 'Descarga Muscular' },
  { id: 'fisio-1',  sesiones: 1,  precio: 80000,   label: '1 sesión fisioterapia' },
  { id: 'fisio-3',  sesiones: 3,  precio: 150000,  label: '3 sesiones' },
  { id: 'fisio-4',  sesiones: 4,  precio: 200000,  label: '4 sesiones' },
  { id: 'fisio-5',  sesiones: 5,  precio: 250000,  label: '5 sesiones' },
  { id: 'fisio-10', sesiones: 10, precio: 500000,  label: '10 sesiones' },
  { id: 'fisio-15', sesiones: 15, precio: 750000,  label: '15 sesiones' },
  { id: 'fisio-20', sesiones: 20, precio: 1000000, label: '20 sesiones' },
  { id: 'fisio-25', sesiones: 25, precio: 1250000, label: '25 sesiones' },
  { id: 'fisio-30', sesiones: 30, precio: 1500000, label: '30 sesiones' },
]

const HORARIOS_DISPONIBLES = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '14:00', '15:00', '16:00', '17:00'
]

import { format12h, formatCOP } from '@/lib/utils'

// ─── Steps ────────────────────────────────────────────────────────────────────
type Step = 'datos' | 'plan' | 'fechas' | 'confirmar' | 'enviado'

export default function AgendarPage() {
  const [step, setStep] = useState<Step>('datos')
  const [isLoading, setIsLoading] = useState(false)

  // Appointment data already in calendar (to block slots)
  const [citasExistentes, setCitasExistentes] = useState<any[]>([])

  // Form fields
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('CC')
  const [documentoNumero, setDocumentoNumero] = useState('')
  const [sexo, setSexo] = useState('Femenino')
  const [edad, setEdad] = useState('')
  const [telefono, setTelefono] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [planSeleccionado, setPlanSeleccionado] = useState<typeof PLANES_PRECIOS[0] | null>(null)

  // Date picker state
  const [weekStart, setWeekStart] = useState(() => {
    let d = startOfDay(new Date())
    // Si es sábado o domingo, empezar en el próximo lunes
    if (d.getDay() === 0) d = addDays(d, 1)
    else if (d.getDay() === 6) d = addDays(d, 2)
    return d
  })
  const [slotsSeleccionados, setSlotsSeleccionados] = useState<{ fecha: string; hora: string }[]>([])

  useEffect(() => {
    loadCitasExistentes()
  }, [])

  async function loadCitasExistentes() {
    const { data } = await supabase
      .from('citas')
      .select('fecha, hora_inicio')
      .neq('estado', 'cancelada')
    setCitasExistentes(data || [])
  }

  const isSlotOcupado = (fecha: string, hora: string) =>
    citasExistentes.some(c => c.fecha === fecha && c.hora_inicio.startsWith(hora))

  const isSlotSeleccionado = (fecha: string, hora: string) =>
    slotsSeleccionados.some(s => s.fecha === fecha && s.hora === hora)

  const toggleSlot = (fecha: string, hora: string) => {
    if (isSlotOcupado(fecha, hora)) return
    const isPast = isBefore(new Date(`${fecha}T${hora}`), new Date())
    if (isPast) return

    if (isSlotSeleccionado(fecha, hora)) {
      setSlotsSeleccionados(prev => prev.filter(s => !(s.fecha === fecha && s.hora === hora)))
    } else {
      if (!planSeleccionado) return
      if (slotsSeleccionados.length >= planSeleccionado.sesiones) return
      setSlotsSeleccionados(prev => [...prev, { fecha, hora }])
    }
  }

  const weekDays = (() => {
    const days = []
    let current = startOfDay(weekStart)
    while (days.length < 5) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        days.push({
          label: format(current, 'eee', { locale: es }),
          num: format(current, 'd'),
          fecha: format(current, 'yyyy-MM-dd'),
          isPast: isBefore(current, startOfDay(new Date())),
          isToday: isSameDay(current, new Date()),
        })
      }
      current = addDays(current, 1)
    }
    return days
  })()

  async function handleSubmit() {
    if (!planSeleccionado) return
    setIsLoading(true)
    try {
      // 1. Guardar la solicitud en la base de datos
      const { error } = await supabase
        .from('solicitudes_cita')
        .insert([{
          nombre,
          apellido,
          tipo_documento: tipoDocumento,
          documento_numero: documentoNumero,
          sexo,
          edad: parseInt(edad),
          telefono,
          diagnostico,
          num_sesiones: planSeleccionado.sesiones,
          precio_sesion: Math.round(planSeleccionado.precio / planSeleccionado.sesiones),
          precio_total: planSeleccionado.precio,
          fechas_solicitadas: slotsSeleccionados,
          hora_preferida: slotsSeleccionados[0]?.hora || '08:00',
          estado: 'pendiente',
        }])
      
      if (error) throw error

      // 2. Disparar notificación push al profesional (Liliana)
      try {
        await fetch('/api/push/request-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            nombre: `${nombre} ${apellido}`,
            num_sesiones: planSeleccionado.sesiones
          })
        });
      } catch (pushErr) {
        console.error('Error enviando notificación push:', pushErr);
        // No lanzamos error para que el usuario vea su confirmación de todas formas
      }

      setStep('enviado')
    } catch (err: any) {
      console.error('Error al enviar solicitud:', err)
      alert('Tuvimos un problema al enviar tu solicitud: ' + (err.message || 'Error desconocido'))
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Renders ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Heart size={22} className="text-white" fill="white" />
          </div>
        </div>
        <h1 className="font-display italic text-4xl sm:text-5xl text-rose-950 tracking-tighter mb-2">
          Agenda tu Cita
        </h1>
        <p className="text-rose-400 font-bold text-xs uppercase tracking-widest">
          Fisioterapeuta · Liliana González
        </p>
      </div>

      {/* Step Progress */}
      {step !== 'enviado' && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center gap-2 justify-center">
            {(['datos', 'plan', 'fechas', 'confirmar'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  step === s ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' :
                  (['datos', 'plan', 'fechas', 'confirmar'].indexOf(step) > i) ? 'bg-rose-100 text-rose-500' :
                  'bg-rose-50 text-rose-200'
                }`}>
                  {['datos', 'plan', 'fechas', 'confirmar'].indexOf(step) > i ? <CheckCircle size={14} /> : i + 1}
                </div>
                {i < 3 && <div className={`h-0.5 w-8 sm:w-16 rounded-full transition-all ${['datos', 'plan', 'fechas', 'confirmar'].indexOf(step) > i ? 'bg-rose-300' : 'bg-rose-100'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-12 sm:gap-20 mt-2">
            {['Datos', 'Plan', 'Fechas', 'Confirmar'].map((label, i) => (
              <span key={label} className="text-[8px] font-black uppercase tracking-widest text-rose-300">{label}</span>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">

        {/* ── STEP 1: DATOS PERSONALES ── */}
        {step === 'datos' && (
          <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-8 space-y-6">
            <div>
              <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Tus Datos</h2>
              <p className="text-xs text-rose-400 font-medium mt-1">Cuéntanos un poco sobre ti para preparar tu sesión.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1"><User size={10} /> Nombre *</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                  placeholder="Ej: María"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Apellido *</label>
                <input
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                  placeholder="Ej: García"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Tipo Doc. *</label>
                <select
                  value={tipoDocumento}
                  onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all appearance-none"
                >
                  <option value="CC">C.C.</option>
                  <option value="TI">T.I.</option>
                  <option value="RC">R.C.</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="CE">C.E.</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Número de documento *</label>
                <input
                  value={documentoNumero}
                  onChange={e => setDocumentoNumero(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                  placeholder="Ej: 1010..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Sexo *</label>
                <select
                  value={sexo}
                  onChange={e => setSexo(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all appearance-none"
                >
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Edad *</label>
                <input
                  type="number"
                  value={edad}
                  onChange={e => setEdad(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                  placeholder="Ej: 35"
                  min={1} max={110}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1"><Phone size={10} /> Teléfono *</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                  placeholder="300 000 0000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1"><Stethoscope size={10} /> Diagnóstico o motivo de consulta *</label>
              <textarea
                value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all min-h-[90px] resize-none"
                placeholder="Ej: Dolor en la espalda baja, cervicalgia, pie plano..."
              />
            </div>

            <button
              onClick={() => setStep('plan')}
              disabled={!nombre || !apellido || !edad || !telefono || !diagnostico || !documentoNumero}
              className="w-full py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP 2: PLAN DE SESIONES ── */}
        {step === 'plan' && (
          <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-8 space-y-6">
            <div>
              <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Elige tu Plan</h2>
              <p className="text-xs text-rose-400 font-medium mt-1">Elige el número de sesiones que necesitas. Los precios son fijos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANES_PRECIOS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => { setPlanSeleccionado(plan); setSlotsSeleccionados([]) }}
                  className={`p-5 rounded-[24px] border-2 text-left transition-all active:scale-95 ${
                    planSeleccionado?.id === plan.id
                      ? 'border-rose-400 bg-rose-50 shadow-lg shadow-rose-100'
                      : 'border-rose-50 bg-rose-50/30 hover:border-rose-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-rose-950 text-lg tracking-tighter uppercase">{plan.label}</div>
                      {plan.sesiones > 1 && (
                        <div className="text-[9px] text-rose-400 font-black uppercase tracking-widest mt-0.5">
                          {formatCOP(Math.round(plan.precio / plan.sesiones))} / sesión
                        </div>
                      )}
                      {plan.id === 'fisio-1' && (
                        <div className="text-[9px] text-rose-400 font-black uppercase tracking-widest mt-0.5">
                          {formatCOP(plan.precio)} / sesión
                        </div>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      planSeleccionado?.id === plan.id ? 'border-rose-500 bg-rose-500' : 'border-rose-200'
                    }`}>
                      {planSeleccionado?.id === plan.id && <CheckCircle size={14} className="text-white" />}
                    </div>
                  </div>
                  <div className="font-black text-2xl text-rose-600 tracking-tighter mt-2">{formatCOP(plan.precio)}</div>
                </button>
              ))}
            </div>

            <div className="bg-rose-50/60 rounded-2xl p-4 flex items-start gap-3">
              <Info size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-rose-400 font-medium leading-relaxed">
                El pago se realizará directamente con la fisioterapeuta. Puedes pagar en efectivo o transferencia.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('datos')} className="flex-1 py-4 border border-rose-100 text-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all">
                Atrás
              </button>
              <button
                onClick={() => setStep('fechas')}
                disabled={!planSeleccionado}
                className="flex-[2] py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: SELECCIÓN DE FECHAS ── */}
        {step === 'fechas' && planSeleccionado && (
          <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Elige tus Fechas</h2>
              <p className="text-xs text-rose-400 font-medium mt-1">
                Selecciona <span className="font-black text-rose-600">{planSeleccionado.sesiones} horarios</span> disponibles.
                {slotsSeleccionados.length > 0 && (
                  <span className="ml-1 text-rose-500 font-black">{slotsSeleccionados.length}/{planSeleccionado.sesiones} elegidos</span>
                )}
              </p>
            </div>

            {/* Week nav */}
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                disabled={isBefore(addDays(weekStart, -7), startOfWeek(new Date(), { weekStartsOn: 1 }))}
                className="p-3 rounded-2xl hover:bg-rose-50 text-rose-300 disabled:opacity-0 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="text-center">
                <div className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">Citas Disponibles</div>
                <div className="font-black text-rose-950 text-sm uppercase tracking-tighter">
                  {format(weekDays[0].fecha + 'T12:00', "d MMM", { locale: es })} – {format(weekDays[4].fecha + 'T12:00', "d MMM yyyy", { locale: es })}
                </div>
              </div>
              <button
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="p-3 rounded-2xl hover:bg-rose-50 text-rose-300 transition-all"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="overflow-x-auto -mx-2 px-2 pb-2">
              <div className="min-w-[440px]">
                {/* Days header */}
                <div className="grid grid-cols-[52px_repeat(5,1fr)] gap-2 mb-3">
                  <div className="text-[8px] font-black text-rose-300 uppercase tracking-widest flex items-center justify-center">Hora</div>
                  {weekDays.map(d => (
                    <div key={d.fecha} className={`text-center py-2 ${d.isPast ? 'opacity-30' : ''}`}>
                      <div className="text-[8px] font-black uppercase text-rose-400 tracking-widest">{d.label}</div>
                      <div className={`w-8 h-8 mx-auto mt-1 rounded-xl flex items-center justify-center text-xs font-black ${d.isToday ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-rose-100 text-rose-950'}`}>
                        {d.num}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time slots */}
                {HORARIOS_DISPONIBLES.map(hora => (
                  <div key={hora} className="grid grid-cols-[52px_repeat(5,1fr)] gap-2 mb-2">
                    <div className="text-[9px] font-black text-rose-400 flex items-center justify-center h-12 bg-rose-50/50 rounded-xl">
                      {format12h(hora)}
                    </div>
                    {weekDays.map(d => {
                      const ocupado = isSlotOcupado(d.fecha, hora)
                      const seleccionado = isSlotSeleccionado(d.fecha, hora)
                      const lleno = slotsSeleccionados.length >= planSeleccionado.sesiones && !seleccionado
                      const pasado = d.isPast || isBefore(new Date(`${d.fecha}T${hora}`), new Date())

                      return (
                        <button
                          key={d.fecha}
                          onClick={() => toggleSlot(d.fecha, hora)}
                          disabled={ocupado || pasado || (lleno && !seleccionado)}
                          className={`h-12 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border-2 ${
                            seleccionado ? 'bg-rose-600 border-rose-700 text-white shadow-xl shadow-rose-300 -translate-y-0.5' :
                            ocupado ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' :
                            pasado ? 'opacity-20 cursor-not-allowed bg-rose-50 border-transparent' :
                            lleno ? 'bg-rose-50 border-rose-100 text-rose-200 cursor-not-allowed' :
                            'bg-white border-rose-100 text-rose-500 hover:bg-rose-600 hover:border-rose-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 cursor-pointer active:scale-95'
                          }`}
                        >
                          {seleccionado ? '✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-[9px] font-black text-rose-500 uppercase tracking-widest pt-4 border-t border-rose-50">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-lg bg-rose-600 shadow-md"></span> Seleccionado
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-lg bg-slate-100 border border-slate-200"></span> Ocupado
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-lg bg-white border-2 border-rose-100"></span> Disponible
              </span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('plan')} className="flex-1 py-4 border border-rose-100 text-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all">
                Atrás
              </button>
              <button
                onClick={() => setStep('confirmar')}
                disabled={slotsSeleccionados.length !== planSeleccionado.sesiones}
                className="flex-[2] py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: CONFIRMACIÓN ── */}
        {step === 'confirmar' && planSeleccionado && (
          <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-8 space-y-6">
            <div>
              <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Confirma tu Cita</h2>
              <p className="text-xs text-rose-400 font-medium mt-1">Revisa que todo esté correcto antes de enviar.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-50/50 rounded-[24px] p-5 space-y-3">
                <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-3">Datos del Paciente</p>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Nombre</span>
                  <span className="text-xs font-black text-rose-950">{nombre} {apellido}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Edad</span>
                  <span className="text-xs font-black text-rose-950">{edad} años</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Teléfono</span>
                  <span className="text-xs font-black text-rose-950">{telefono}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Diagnóstico</span>
                  <span className="text-xs font-black text-rose-950 text-right max-w-[180px]">{diagnostico}</span>
                </div>
              </div>

              <div className="bg-rose-50/50 rounded-[24px] p-5 space-y-3">
                <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-3">Plan Contratado</p>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Sesiones</span>
                  <span className="text-xs font-black text-rose-950">{planSeleccionado.sesiones} sesiones</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Valor Total</span>
                  <span className="text-sm font-black text-rose-600">{formatCOP(planSeleccionado.precio)}</span>
                </div>
              </div>

              <div className="bg-rose-50/50 rounded-[24px] p-5 space-y-2">
                <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <Calendar size={10} /> Horarios Seleccionados
                </p>
                {slotsSeleccionados
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((s, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-xs text-rose-400 font-bold">Sesión {i + 1}</span>
                      <span className="text-xs font-black text-rose-950">
                        {format(new Date(s.fecha + 'T12:00'), "d 'de' MMMM", { locale: es })} · {format12h(s.hora)}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('fechas')} className="flex-1 py-4 border border-rose-100 text-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all">
                Atrás
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-300 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} fill="white" />}
                {isLoading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: ENVIADO ── */}
        {step === 'enviado' && (
          <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-100 to-pink-100 rounded-[28px] mx-auto flex items-center justify-center">
              <Flower2 size={40} className="text-rose-400" />
            </div>
            <div>
              <h2 className="font-black text-2xl text-rose-950 uppercase tracking-tighter">¡Solicitud Enviada!</h2>
              <p className="text-sm text-rose-400 font-medium mt-2 leading-relaxed">
                Tu solicitud fue recibida. La fisioterapeuta revisará tu caso y te contactará pronto al número <strong className="text-rose-600">{telefono}</strong> para confirmar.
              </p>
            </div>
            <div className="bg-rose-50/60 rounded-2xl p-4">
              <p className="text-xs text-rose-400 font-medium">
                <Sparkles className="inline mr-1 text-rose-300" size={12} />
                Recuerda que el tiempo de respuesta es de máximo <strong className="text-rose-600">24 horas hábiles</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-10">
        <div className="flex items-center justify-center gap-2 text-rose-200">
          <Heart size={12} fill="currentColor" />
          <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">· FisioGestión ·</span>
          <Heart size={12} fill="currentColor" />
        </div>
      </div>
    </div>
  )
}
