'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addDays, startOfWeek, isBefore, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Heart, Flower2, CheckCircle, Loader2, Calendar, Clock, ChevronRight, ChevronLeft, Info
} from 'lucide-react'
import { isHolidayColombia } from '@/lib/colombian-holidays'
import { format12h, formatCOP } from '@/lib/utils'

const PLANES_PRECIOS = [
  { id: 'evaluacion', sesiones: 1, precio: 30000,  label: 'Valoración' },
  { id: 'descarga-muscular',  sesiones: 1,  precio: 100000,  label: 'Descarga Muscular' },
  { id: 'recovery-premium',   sesiones: 1,  precio: 100000,  label: 'Recovery Premium' },
  { id: 'recovery-star',      sesiones: 5,  precio: 350000,  label: 'RECOVERY STAR (5)' },
  { id: 'recovery-balance',   sesiones: 10, precio: 700000,  label: 'RECOVERY BALANCE (10)' },
  { id: 'personalizado',      sesiones: 2,  precio: 160000,  label: 'Personalizado' }, // Precio base
]

const HORARIOS_DISPONIBLES = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '14:00', '15:00', '16:00', '17:00'
]

type Step = 'plan' | 'fechas' | 'confirmar' | 'enviado'

export default function PatientAgendarPage() {
  const [step, setStep] = useState<Step>('plan')
  const [isLoading, setIsLoading] = useState(false)
  const [citasExistentes, setCitasExistentes] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [motivo, setMotivo] = useState('')
  const [esDomicilio, setEsDomicilio] = useState(false)
  const [customSessionsCount, setCustomSessionsCount] = useState(2)
  const [usarSesionGratis, setUsarSesionGratis] = useState(false)

  const [planSeleccionado, setPlanSeleccionado] = useState<typeof PLANES_PRECIOS[0] | null>(null)
  
  const getCustomPrice = (sessions: number) => {
    if (sessions === 1) return 80000 // Fallback, aunque no debería permitirse 1 aquí
    if (sessions <= 3) return sessions * 80000
    if (sessions === 4) return sessions * 75000
    return sessions * 70000
  }

  // Update plan's sessions and price dynamically if custom
  const currentPlan = planSeleccionado?.id === 'personalizado' 
    ? { ...planSeleccionado, sesiones: customSessionsCount, precio: getCustomPrice(customSessionsCount) }
    : planSeleccionado

  const [weekStart, setWeekStart] = useState(() => {
    let d = startOfDay(new Date())
    if (d.getDay() === 0) d = addDays(d, 1)
    else if (d.getDay() === 6) d = addDays(d, 2)
    return d
  })
  const [slotsSeleccionados, setSlotsSeleccionados] = useState<{ fecha: string; hora: string }[]>([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data } = await supabase.from('patient_profiles').select('*').eq('id', user.id).single()
        setPerfil(data)
      }
      const { data: citas } = await supabase.from('citas').select('fecha, hora_inicio').neq('estado', 'cancelada')
      setCitasExistentes(citas || [])
    }
    init()
  }, [])

  const isSlotRealmenteOcupado = (fecha: string, hora: string) => {
    const isOcupado = citasExistentes.some(c => c.fecha === fecha && c.hora_inicio.split(':')[0] === hora.split(':')[0])
    const date = new Date(fecha + 'T12:00:00')
    const isSun = date.getDay() === 0
    const isSat = date.getDay() === 6
    const isHol = isHolidayColombia(fecha)
    
    let isHourAllowed = true
    if (isSun || isHol) isHourAllowed = ['08:00', '09:00', '10:00', '11:00'].includes(hora)
    else if (isSat) isHourAllowed = false
    else isHourAllowed = ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].includes(hora)
    
    return isOcupado || !isHourAllowed
  }

  const toggleSlot = (fecha: string, hora: string) => {
    if (isSlotRealmenteOcupado(fecha, hora)) return
    const isPast = isBefore(new Date(`${fecha}T${hora}`), new Date())
    if (isPast) return

    if (slotsSeleccionados.some(s => s.fecha === fecha && s.hora === hora)) {
      setSlotsSeleccionados(prev => prev.filter(s => !(s.fecha === fecha && s.hora === hora)))
    } else {
      if (!currentPlan) return
      if (slotsSeleccionados.length >= currentPlan.sesiones) return
      setSlotsSeleccionados(prev => [...prev, { fecha, hora }])
    }
  }

  const weekDays = (() => {
    const days = []
    let current = startOfDay(weekStart)
    while (days.length < 6) {
      if (current.getDay() !== 6) {
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

  // Lógica de Descuentos
  // Solo se permite usar O sesión gratis O descuento del 15% (No acumulables)
  const tieneDescuento = (perfil?.descuentos_disponibles || 0) > 0
  const tieneSesionGratis = (perfil?.sesiones_gratis || 0) > 0

  const usoDescuento = tieneDescuento && !usarSesionGratis
  
  let basePrice = currentPlan ? currentPlan.precio : 0
  let discountPrice = basePrice

  if (usarSesionGratis && currentPlan) {
    const precioPorSesion = Math.round(basePrice / currentPlan.sesiones)
    discountPrice = basePrice - precioPorSesion
  } else if (usoDescuento) {
    discountPrice = Math.round(basePrice * 0.85)
  }

  const totalDomicilio = esDomicilio && currentPlan ? currentPlan.sesiones * 10000 : 0
  const precioFinal = discountPrice + totalDomicilio

  async function handleSubmit() {
    if (!currentPlan || !user) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/patient/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: currentPlan,
          slots: slotsSeleccionados,
          motivo,
          user_id: user.id,
          esDomicilio,
          usarSesionGratis,
          usoDescuento
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      
      setStep('enviado')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="py-8 px-4">
      {step !== 'enviado' && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center gap-2 justify-center">
            {(['plan', 'fechas', 'confirmar'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                  step === s ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' :
                  (['plan', 'fechas', 'confirmar'].indexOf(step) > i) ? 'bg-rose-100 text-rose-500' :
                  'bg-rose-50 text-rose-200'
                }`}>
                  {['plan', 'fechas', 'confirmar'].indexOf(step) > i ? <CheckCircle size={14} /> : i + 1}
                </div>
                {i < 2 && <div className={`h-0.5 w-8 sm:w-16 rounded-full transition-all ${['plan', 'fechas', 'confirmar'].indexOf(step) > i ? 'bg-rose-300' : 'bg-rose-100'}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {step === 'plan' && (
          <div className="bg-white rounded-[40px] shadow-xl shadow-rose-100/40 p-6 space-y-6">
            <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Elige tu Plan</h2>
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Motivo de consulta</label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all min-h-[80px] resize-none"
                placeholder="Ej: Dolor en la espalda baja..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANES_PRECIOS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => { setPlanSeleccionado(plan); setSlotsSeleccionados([]) }}
                  className={`p-5 rounded-[24px] border-2 text-left transition-all active:scale-95 ${
                    planSeleccionado?.id === plan.id ? 'border-rose-400 bg-rose-50 shadow-lg shadow-rose-100' : 'border-rose-50 bg-rose-50/30 hover:border-rose-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-black text-rose-950 text-lg tracking-tighter uppercase">{plan.label}</div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${planSeleccionado?.id === plan.id ? 'border-rose-500 bg-rose-500' : 'border-rose-200'}`}>
                      {planSeleccionado?.id === plan.id && <CheckCircle size={14} className="text-white" />}
                    </div>
                  </div>
                  <div className="font-black text-2xl text-rose-600 tracking-tighter mt-2">{formatCOP(plan.precio)}</div>
                </button>
              ))}
            </div>
            
            {planSeleccionado?.id === 'personalizado' && (
              <div className="bg-rose-50 rounded-2xl p-4 flex flex-col gap-2">
                <label className="text-[10px] font-black text-rose-950 uppercase tracking-widest">¿Cuántas sesiones necesitas?</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="number" 
                    min={2} 
                    max={20}
                    value={customSessionsCount}
                    onChange={(e) => setCustomSessionsCount(parseInt(e.target.value) || 2)}
                    className="w-20 px-4 py-2 bg-white rounded-xl border border-rose-100 text-rose-950 font-black text-center outline-none focus:border-rose-300"
                  />
                  <div className="text-sm font-bold text-rose-600">{formatCOP(getCustomPrice(customSessionsCount))}</div>
                </div>
              </div>
            )}

            <div className="bg-white border-2 border-rose-50 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-rose-950">Servicio a Domicilio</p>
                {esDomicilio && <p className="text-xs text-rose-500 font-bold">Se aplican +$10.000 por sesión</p>}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={esDomicilio} onChange={(e) => setEsDomicilio(e.target.checked)} />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>

            {tieneSesionGratis && planSeleccionado && (
              <div className="bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-amber-900">¡Tienes Sesiones Gratis!</p>
                  <p className="text-xs text-amber-700 font-bold">Usa 1 sesión gratis en este plan</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={usarSesionGratis} onChange={(e) => setUsarSesionGratis(e.target.checked)} />
                  <div className="w-11 h-6 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            )}

            {(usoDescuento || usarSesionGratis) && planSeleccionado && (
              <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-bold flex justify-between items-center">
                <span>{usarSesionGratis ? 'Sesión Gratis Aplicada' : 'Aplicando 15% Dto Referido'}</span>
                <span className="font-black">{formatCOP(precioFinal)}</span>
              </div>
            )}

            <button
              onClick={() => setStep('fechas')}
              disabled={!planSeleccionado}
              className="w-full py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-rose-900 transition-all disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}

        {step === 'fechas' && planSeleccionado && (
          <div className="bg-white rounded-[40px] shadow-xl shadow-rose-100/40 p-6 space-y-6">
            <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Elige {planSeleccionado.sesiones} Fechas</h2>
            
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={isBefore(addDays(weekStart, -7), startOfWeek(new Date(), { weekStartsOn: 1 }))} className="p-3 text-rose-300 disabled:opacity-0"><ChevronLeft size={24} /></button>
              <div className="text-center">
                <div className="font-black text-rose-950 text-sm uppercase tracking-tighter">{format(weekDays[0].fecha + 'T12:00', "d MMM", { locale: es })} – {format(weekDays[5].fecha + 'T12:00', "d MMM", { locale: es })}</div>
              </div>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-3 text-rose-300"><ChevronRight size={24} /></button>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="min-w-[440px]">
                <div className="grid grid-cols-[52px_repeat(6,1fr)] gap-2 mb-3">
                  <div className="text-[8px] font-black text-rose-300 uppercase tracking-widest flex items-center justify-center">Hora</div>
                  {weekDays.map(d => (
                    <div key={d.fecha} className={`text-center py-2 ${d.isPast ? 'opacity-30' : ''}`}>
                      <div className="text-[8px] font-black uppercase text-rose-400 tracking-widest">{d.label}</div>
                      <div className={`w-8 h-8 mx-auto mt-1 rounded-xl flex items-center justify-center text-xs font-black ${d.isToday ? 'bg-rose-600 text-white shadow-lg' : 'bg-rose-100 text-rose-950'}`}>{d.num}</div>
                    </div>
                  ))}
                </div>

                {HORARIOS_DISPONIBLES.map(hora => (
                  <div key={hora} className="grid grid-cols-[52px_repeat(6,1fr)] gap-2 mb-2">
                    <div className="text-[9px] font-black text-rose-400 flex items-center justify-center h-12 bg-rose-50/50 rounded-xl">{format12h(hora)}</div>
                    {weekDays.map(d => {
                      const ocupado = isSlotRealmenteOcupado(d.fecha, hora)
                      const seleccionado = slotsSeleccionados.some(s => s.fecha === d.fecha && s.hora === hora)
                      const lleno = slotsSeleccionados.length >= planSeleccionado.sesiones && !seleccionado
                      const pasado = d.isPast || isBefore(new Date(`${d.fecha}T${hora}`), new Date())

                      return (
                        <button
                          key={d.fecha}
                          onClick={() => toggleSlot(d.fecha, hora)}
                          disabled={ocupado || pasado || lleno}
                          className={`h-12 rounded-xl text-[8px] font-black transition-all border-2 ${
                            seleccionado ? 'bg-rose-600 border-rose-700 text-white shadow-xl -translate-y-0.5' :
                            ocupado ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' :
                            pasado ? 'opacity-20 bg-rose-50 border-transparent' :
                            lleno ? 'bg-rose-50 border-rose-100 text-rose-200' :
                            'bg-white border-rose-100 text-rose-500 hover:bg-rose-600 hover:text-white active:scale-95'
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

            <div className="flex gap-3">
              <button onClick={() => setStep('plan')} className="flex-1 py-4 border border-rose-100 text-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50">Atrás</button>
              <button
                onClick={() => setStep('confirmar')}
                disabled={slotsSeleccionados.length !== planSeleccionado.sesiones}
                className="flex-[2] py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-rose-900 transition-all disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 'confirmar' && planSeleccionado && (
          <div className="bg-white rounded-[40px] shadow-xl shadow-rose-100/40 p-6 space-y-6">
            <h2 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Confirma tu Cita</h2>
            
            <div className="bg-rose-50/50 rounded-[24px] p-5 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-rose-400 font-bold">Plan</span>
                <span className="text-xs font-black text-rose-950">{planSeleccionado.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-rose-400 font-bold">Valor Total</span>
                <span className="text-sm font-black text-rose-600">
                  {usoDescuento && <span className="line-through text-rose-300 text-xs mr-2">{formatCOP(planSeleccionado.precio)}</span>}
                  {formatCOP(precioFinal)}
                </span>
              </div>
              {motivo && (
                <div className="flex justify-between">
                  <span className="text-xs text-rose-400 font-bold">Motivo</span>
                  <span className="text-xs font-black text-rose-950 max-w-[180px] text-right">{motivo}</span>
                </div>
              )}
            </div>

            <div className="bg-rose-50/50 rounded-[24px] p-5 space-y-2">
              <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Calendar size={10} /> Fechas
              </p>
              {slotsSeleccionados.sort((a, b) => a.fecha.localeCompare(b.fecha)).map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-rose-400 font-bold">Sesión {i + 1}</span>
                  <span className="text-xs font-black text-rose-950">
                    {format(new Date(s.fecha + 'T12:00'), "d MMM", { locale: es })} · {format12h(s.hora)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('fechas')} className="flex-1 py-4 border border-rose-100 text-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50">Atrás</button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-300 hover:bg-rose-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'AGENDAR'}
              </button>
            </div>
          </div>
        )}

        {step === 'enviado' && (
          <div className="bg-white rounded-[40px] shadow-xl shadow-rose-100/40 p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-[28px] mx-auto flex items-center justify-center">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-black text-2xl text-rose-950 uppercase tracking-tighter">¡Cita Confirmada!</h2>
              <p className="text-sm text-rose-400 font-medium mt-2 leading-relaxed">
                Tu cita ha sido agendada exitosamente en el calendario de Liliana.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
