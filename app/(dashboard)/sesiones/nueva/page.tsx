'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ClipboardPlus, ArrowLeft, User, Calendar, Package, DollarSign, Wallet, CheckCircle, FileText, Info, Loader2, Clock, Check, AlertCircle, Sparkles, Flower2, Heart } from 'lucide-react'
import { addDays, isSunday, getDay } from 'date-fns'
import NotificationModal from '@/components/ui/NotificationModal'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'L', full: 'Lunes' },
  { id: 2, label: 'M', full: 'Martes' },
  { id: 3, label: 'M', full: 'Miércoles' },
  { id: 4, label: 'J', full: 'Jueves' },
  { id: 5, label: 'V', full: 'Viernes' },
  { id: 6, label: 'S', full: 'Sábado' },
]

export default function NuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string }>
}) {
  const router = useRouter()
  const resolvedParams = use(searchParams)
  
  const [loading, setLoading] = useState(false)
  const [fetchingPacientes, setFetchingPacientes] = useState(true)
  const [pacientes, setPacientes] = useState<any[]>([])
  
  const [pacienteId, setPacienteId] = useState(resolvedParams.paciente ?? '')
  const [cantidadSesiones, setCantidadSesiones] = useState<number>(1)
  const [valorPorSesion, setValorPorSesion] = useState<number>(80000)

  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error' | 'info', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  // Scheduling State
  const [frecuencia, setFrecuencia] = useState('todos_los_dias')
  const [diasCustom, setDiasCustom] = useState<number[]>([1, 3, 5]) // Default L-M-V

  // Payment State
  const [hizoAbono, setHizoAbono] = useState(false)
  const [montoAbono, setMontoAbono] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  // Cargar pacientes reales de Supabase
  useEffect(() => {
    async function loadPacientes() {
      try {
        const { data, error } = await supabase.from('pacientes').select('id, nombre').order('nombre')
        if (error) throw error
        setPacientes(data || [])
      } catch (err) {
        console.error('Error al cargar pacientes:', err)
      } finally {
        setFetchingPacientes(false)
      }
    }
    loadPacientes()
  }, [])

  const opcionesSesiones = [
    { value: 1, label: '1 Sesión Fisioterapia', type: 'fisioterapia' },
    { value: 1, label: '1 Descarga Muscular', type: 'descarga' },
    { value: 5, label: '5 Sesiones', type: 'fisioterapia' },
    { value: 10, label: '10 Sesiones', type: 'fisioterapia' },
    { value: 15, label: '15 Sesiones', type: 'fisioterapia' },
    { value: 20, label: '20 Sesiones', type: 'fisioterapia' },
    { value: 25, label: '25 Sesiones', type: 'fisioterapia' },
    { value: 30, label: '30 Sesiones', type: 'fisioterapia' },
  ]

  const [tipoPlan, setTipoPlan] = useState('fisioterapia')

  const getMinPrice = (cantidad: number, type: string) => {
    if (type === 'descarga') return 70000
    if (cantidad === 1) return 80000
    if (cantidad === 5) return 50000
    return 40000 
  }

  const handleCambioSesiones = (val: number, type: string) => {
    setCantidadSesiones(val)
    setTipoPlan(type)
    const minPrice = getMinPrice(val, type)
    setValorPorSesion(minPrice)
  }

  const handleCambioValor = (val: number) => {
    setValorPorSesion(val)
  }

  const toggleDiaCustom = (id: number) => {
    setDiasCustom(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const valorTotal = cantidadSesiones * (valorPorSesion || 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!pacienteId) {
       setNotification({
         isOpen: true,
         type: 'error',
         title: 'Dato faltante',
         message: 'Por favor selecciona un paciente para el plan.'
       })
       return
    }
    if (frecuencia === 'custom' && diasCustom.length === 0) {
       setNotification({
         isOpen: true,
         type: 'error',
         title: 'Días no seleccionados',
         message: 'Selecciona al menos un día para la frecuencia personalizada.'
       })
       return
    }
    
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const fechaInicioStr = formData.get('fecha') as string
    const horaCita = formData.get('hora_cita') as string
    const nota_clinica = formData.get('nota_clinica') as string

    try {      
      let currentCitaDate = new Date(fechaInicioStr + 'T12:00:00')
      let abonoRestante = hizoAbono ? Number(montoAbono) : 0

      // Crear solo un registro de "Plan" (sesion) primero para obtener su ID
      const { data: planData, error: planError } = await supabase.from('sesiones').insert([{
        paciente_id: pacienteId,
        fecha: fechaInicioStr,
        valor: valorTotal,
        monto_pagado: hizoAbono ? abonoRestante : 0,
        metodo_pago: hizoAbono ? metodoPago : null,
        estado_pago: (hizoAbono && abonoRestante >= valorTotal) ? 'pagado' : 'pendiente',
        nota_clinica: `[Plan de ${tipoPlan === 'descarga' ? 'Descarga Muscular' : cantidadSesiones + ' sesiones'}] ${nota_clinica}`,
        duracion_minutos: 60 * cantidadSesiones
      }]).select('id').single()

      if (planError) throw planError

      const sesionId = planData.id

      // Generar las citas individuales para la agenda
      const citasToInsert = []
      for (let i = 0; i < cantidadSesiones; i++) {
        while (true) {
          const day = getDay(currentCitaDate)
          if (isSunday(currentCitaDate)) {
            currentCitaDate = addDays(currentCitaDate, 1)
            continue
          }
          if (frecuencia === 'custom' && !diasCustom.includes(day)) {
            currentCitaDate = addDays(currentCitaDate, 1)
            continue
          }
          break
        }

        const dateStr = currentCitaDate.toISOString().split('T')[0]

        citasToInsert.push({
          sesion_id: sesionId,
          paciente_id: pacienteId,
          fecha: dateStr,
          hora_inicio: horaCita,
          duracion_minutos: 60,
          estado: 'pendiente', 
          notas: `Sesión ${i+1}/${cantidadSesiones}. ${nota_clinica}`
        })

        if (frecuencia === 'todos_los_dias') {
          currentCitaDate = addDays(currentCitaDate, 1)
        } else if (frecuencia === 'dia_de_por_medio') {
          currentCitaDate = addDays(currentCitaDate, 2)
        } else if (frecuencia === 'custom') {
          currentCitaDate = addDays(currentCitaDate, 1)
        } else if (frecuencia === 'lunes_miercoles_viernes') {
          const day = getDay(currentCitaDate)
          if (day === 1 || day === 3) currentCitaDate = addDays(currentCitaDate, 2)
          else if (day === 5) currentCitaDate = addDays(currentCitaDate, 3)
          else currentCitaDate = addDays(currentCitaDate, 1)
        } else if (frecuencia === 'martes_jueves_sabado') {
          const day = getDay(currentCitaDate)
          if (day === 2 || day === 4) currentCitaDate = addDays(currentCitaDate, 2)
          else if (day === 6) currentCitaDate = addDays(currentCitaDate, 2)
          else currentCitaDate = addDays(currentCitaDate, 1)
        }
      }

      await supabase.from('citas').insert(citasToInsert)

      setNotification({
        isOpen: true,
        type: 'success',
        title: '¡Plan Generado!',
        message: 'Las sesiones y citas están listas para comenzar.'
      })
      setTimeout(() => router.push('/sesiones'), 2000)
    } catch (err: any) {
      console.error('Error al registrar plan:', err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Red',
        message: err.message || 'No pudimos guardar el plan.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto pb-12 relative">
      <div className="absolute top-0 -left-10 text-rose-100/30 -z-10 rotate-12">
        <Flower2 size={120} />
      </div>

      <NotificationModal 
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <header className="topbar mb-8">
        <div>
          <h2 className="font-display italic text-4xl mb-1 flex items-center gap-3 text-rose-950">
            <Sparkles className="text-rose-400" size={32} />
            Crear Plan
          </h2>
          <p className="text-rose-300 font-black text-[9px] uppercase tracking-[0.3em]">Tratamiento especializado Liliana</p>
        </div>
        <Link href="/sesiones" className="w-10 h-10 border border-rose-100 rounded-2xl hover:bg-rose-50 transition-colors text-rose-300 flex items-center justify-center">
          <ArrowLeft size={20} />
        </Link>
      </header>

      <div className="card shadow-[0_32px_80px_-16px_rgba(225,29,72,0.15)] p-10 bg-white/80 backdrop-blur-md rounded-[48px] border-4 border-white">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div className="form-group">
              <label className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                 <Heart size={12} fill="currentColor" /> Paciente a tratar
              </label>
              <select 
                className="w-full px-6 py-4 rounded-[24px] border-2 border-rose-50 focus:border-rose-400 outline-none bg-rose-50/20 font-black text-rose-900 appearance-none cursor-pointer" 
                value={pacienteId}
                onChange={e => setPacienteId(e.target.value)}
                required
                disabled={fetchingPacientes}
              >
                <option value="" disabled>{fetchingPacientes ? 'Cargando...' : 'Seleccionar...'}</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                 <Calendar size={12} /> Fecha de Inicio
              </label>
              <input name="fecha" className="w-full px-6 py-4 rounded-[24px] border-2 border-rose-50 focus:border-rose-400 outline-none bg-rose-50/20 text-rose-900 font-black" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
            </div>
          </div>

          <div className="pt-8 border-t border-rose-50 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="form-group">
                <label className="text-[10px] font-black text-rose-300 uppercase mb-3 block">Sesiones</label>
                <select 
                  className="w-full px-6 py-4 rounded-[24px] border-2 border-rose-50 focus:border-rose-400 outline-none bg-white font-black text-rose-600 shadow-sm appearance-none"
                  value={`${cantidadSesiones}-${tipoPlan}`}
                  onChange={(e) => {
                    const [val, type] = e.target.value.split('-')
                    handleCambioSesiones(Number(val), type)
                  }}
                  required
                >
                  {opcionesSesiones.map((opt, idx) => (
                    <option key={idx} value={`${opt.value}-${opt.type}`}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-black text-rose-300 uppercase mb-3 block">Precio P/S</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-100 font-black">$</span>
                  <input 
                    className="w-full pl-10 pr-6 py-4 rounded-[24px] border-2 border-rose-50 focus:ring-4 outline-none font-black text-rose-900 transition-all focus:border-rose-400 focus:ring-rose-50 bg-white"
                    type="number" 
                    value={valorPorSesion || ''} 
                    onChange={e => handleCambioValor(Number(e.target.value))}
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="bg-rose-600 rounded-[35px] p-8 flex flex-col items-center shadow-2xl shadow-rose-200 relative overflow-hidden group">
               <div className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-125 transition-transform duration-700">
                  <Flower2 size={100} />
               </div>
              <span className="text-[10px] font-black text-rose-200 uppercase tracking-[0.3em] mb-2 relative z-10">Total Inversión</span>
              <span className="text-4xl font-black text-white tracking-tighter relative z-10">{formatCOP(valorTotal)}</span>
            </div>
          </div>

          <div className="pt-8 border-t border-rose-50 space-y-6">
            <div className="grid grid-cols-2 gap-6">
               <div className="form-group">
                  <label className="text-[10px] font-black text-rose-300 uppercase mb-3 block">Hora</label>
                  <input name="hora_cita" className="w-full px-6 py-4 rounded-[24px] border-2 border-rose-50 focus:border-rose-400 outline-none font-black text-rose-900 bg-rose-50/20 text-center" type="time" defaultValue="08:00" required />
               </div>
               <div className="form-group">
                  <label className="text-[10px] font-black text-rose-300 uppercase mb-3 block">Frecuencia</label>
                  <select 
                    className="w-full px-6 py-4 rounded-[24px] border-2 border-rose-50 focus:border-rose-400 outline-none bg-white font-black text-rose-700 shadow-sm text-center appearance-none"
                    value={frecuencia}
                    onChange={e => setFrecuencia(e.target.value)}
                  >
                    <option value="todos_los_dias">Diario</option>
                    <option value="dia_de_por_medio">Interdiario</option>
                    <option value="lunes_miercoles_viernes">L-M-V</option>
                    <option value="martes_jueves_sabado">M-J-S</option>
                    <option value="custom">Manual</option>
                  </select>
               </div>
            </div>

            {frecuencia === 'custom' && (
              <div className="p-6 bg-rose-950 rounded-[35px] border-4 border-white animate-in fade-in duration-500 shadow-2xl">
                <div className="flex justify-center gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDiaCustom(day.id)}
                      className={`w-10 h-10 rounded-xl border-2 font-black transition-all flex items-center justify-center text-[10px] ${diasCustom.includes(day.id) ? 'border-rose-400 bg-rose-500 text-white shadow-lg' : 'border-rose-900 bg-rose-900 text-rose-700 hover:border-rose-700'}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-rose-50">
            <div className="bg-rose-50/50 p-8 rounded-[40px] border-4 border-white shadow-inner relative overflow-hidden group">
               <div className="absolute -left-6 -bottom-6 text-rose-100/50 group-hover:scale-110 transition-transform">
                  <Heart size={80} />
               </div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <span className="font-black text-rose-950 text-[10px] uppercase tracking-[0.2em]">¿Registrar Abono?</span>
                <label className="relative inline-flex items-center cursor-pointer scale-110">
                  <input type="checkbox" className="sr-only peer" checked={hizoAbono} onChange={e => setHizoAbono(e.target.checked)} />
                  <div className="w-12 h-6 bg-rose-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-rose-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                </label>
              </div>

              {hizoAbono && (
                <div className="animate-in slide-in-from-top-4 duration-500 relative z-10">
                  <div className="form-group">
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-200 font-black text-2xl">$</span>
                      <input 
                        type="number" 
                        value={montoAbono}
                        onChange={(e) => setMontoAbono(e.target.value)}
                        className="w-full pl-12 pr-6 py-5 rounded-[24px] border-2 border-rose-100 focus:border-rose-500 outline-none font-black text-3xl text-rose-900 bg-white text-center"
                        placeholder="0"
                        required={hizoAbono}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!hizoAbono && (
                <div className="p-4 bg-white/50 rounded-2xl border border-rose-100/30 flex items-center justify-center gap-3 relative z-10">
                   <AlertCircle size={14} className="text-rose-400" />
                   <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest italic leading-none">Deuda proyectada: {formatCOP(valorTotal)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-6 bg-rose-950 hover:bg-rose-900 text-white font-black rounded-[35px] shadow-[0_20px_50px_-12px_rgba(225,29,72,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 transition-all active:scale-[0.97] uppercase tracking-[0.3em] text-[10px]"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? 'Generando...' : 'Guardar Tratamiento'}
            </button>
            <div className="flex justify-center">
               <div className="w-12 h-1 bg-rose-100 rounded-full mb-2"></div>
            </div>
          </div>
        </form>
      </div>
      
      <div className="mt-10 mb-8 text-center opacity-30">
         <Flower2 size={20} className="text-rose-200 mx-auto" />
      </div>
    </div>
  )
}
