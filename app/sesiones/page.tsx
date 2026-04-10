'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ClipboardPlus, Activity, CheckCircle, Clock, AlertCircle, Loader2, Sparkles } from 'lucide-react'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export default function SesionesPage() {
  const [loading, setLoading] = useState(true)
  const [sesiones, setSesiones] = useState<any[]>([])

  async function loadSesiones() {
    try {
      const { data } = await supabase
        .from('sesiones')
        .select('*, pacientes(nombre), citas(id, estado)')
        .order('fecha', { ascending: false })
      setSesiones(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSesiones()

    const channel = supabase
      .channel('sesiones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => loadSesiones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadSesiones())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalHoras = sesiones.reduce((a, s) => a + (s.duracion_minutos || 0), 0) / 60
  const pagadasCount = sesiones.filter(s => s.estado_pago === 'pagado').length
  const pendientesCount = sesiones.filter(s => s.estado_pago === 'pendiente').length

  if (loading && sesiones.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <header className="topbar mb-10">
        <div>
          <h2 className="font-display italic text-5xl mb-2 text-rose-950 flex items-center gap-3">
            <ClipboardPlus className="text-rose-400" size={32} />
            Planes
          </h2>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest leading-none">Historial de tratamientos y sesiones</p>
        </div>
        <Link href="/sesiones/nueva" className="btn-primary !bg-rose-600 hover:!bg-rose-700 !shadow-rose-100 flex items-center gap-2 !rounded-2xl !py-3">
          <Sparkles size={18} />
          <span className="hidden sm:inline text-xs font-black uppercase">Crear Nuevo Plan</span>
        </Link>
      </header>

      <section className="metric-grid gap-6 mb-12">
        <div className="card metric-card border-none shadow-lg shadow-rose-100/20">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl w-fit mb-4">
             <Activity size={20} />
          </div>
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Total Planes</span>
          <div className="text-2xl font-black text-rose-950">{sesiones.length}</div>
        </div>
        
        <div className="card metric-card border-none shadow-lg shadow-rose-100/20">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl w-fit mb-4">
             <Clock size={20} />
          </div>
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Horas Clínicas</span>
          <div className="text-2xl font-black text-rose-950">{totalHoras.toFixed(1)} h</div>
        </div>

        <div className="card metric-card border-none bg-rose-600 text-white shadow-xl shadow-rose-200">
          <div className="p-3 bg-white/20 text-white rounded-2xl w-fit mb-4 backdrop-blur-md">
             <CheckCircle size={20} />
          </div>
          <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest block mb-1">Completadas</span>
          <div className="text-2xl font-black">{pagadasCount}</div>
        </div>

        <div className="card metric-card border-none bg-rose-50 text-rose-600 shadow-lg shadow-rose-100/20">
          <div className="p-3 bg-white text-rose-500 rounded-2xl w-fit mb-4 shadow-sm">
             <AlertCircle size={20} />
          </div>
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Pendientes</span>
          <div className="text-2xl font-black">{pendientesCount}</div>
        </div>
      </section>

      <div className="space-y-4">
        {sesiones.map(s => {
          const p = s.pacientes as any
          const citasDelPlan = s.citas || []
          const totalCitas = citasDelPlan.length
          const citasCompletadas = citasDelPlan.filter((c: any) => c.estado === 'completado' || c.estado === 'completada').length
          
          return (
            <div key={s.id} className="card group hover:shadow-xl transition-all border-2 border-transparent hover:border-rose-100 border-l-rose-500 border-l-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase group-hover:bg-rose-600 transition-colors">
                    {p ? getIniciales(p.nombre) : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-rose-950 text-xl tracking-tighter uppercase group-hover:text-rose-600 transition-colors">
                      {p?.nombre ?? 'Paciente eliminado'}
                    </div>
                    {totalCitas > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                          Sesión {citasCompletadas}/{totalCitas}
                        </span>
                        <div className="flex-1 w-24 h-1.5 bg-rose-50 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400" style={{ width: `${(citasCompletadas/totalCitas)*100}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sin citas enlazadas</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">{s.fecha}</span>
                       <span className="text-rose-100">/</span>
                       <span className="text-sm font-black text-rose-900">{formatCOP(s.valor)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 self-end sm:self-center">
                  <span className={`badge !rounded-full !px-4 !py-1 !text-[10px] !italic ${s.estado_pago === 'pagado' ? 'badge-success !bg-emerald-50 !text-emerald-500' : 'badge-warning !bg-rose-50 !text-rose-500'}`}>
                    {s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                  </span>
                  {s.estado_pago === 'pendiente' && (
                    <Link 
                      href={`/finanzas?paciente=${s.paciente_id}`}
                      className="text-[10px] font-black text-white bg-rose-950 hover:bg-rose-900 px-5 py-2 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-rose-950/20"
                    >
                      Cobrar
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {sesiones.length === 0 && (
          <div className="py-20 text-center rounded-[40px] bg-rose-50/50 border-2 border-dashed border-rose-100">
            <p className="text-rose-300 font-black text-xs uppercase tracking-widest italic">✨ Empieza creando tu primer plan de tratamiento</p>
          </div>
        )}
      </div>
    </div>
  )
}
