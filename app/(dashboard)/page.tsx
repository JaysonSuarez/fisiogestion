'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
  Sparkles,
  Heart,
  Flower2,
  Flower,
  Sprout
} from 'lucide-react'
import SolicitudesWidget from '@/components/ui/SolicitudesWidget'
import { formatCOP, format12h, getIniciales } from '@/lib/utils'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({
    pacientesActivos: 0,
    citasHoy: [],
    porCobrar: 0,
    ingresoTotal: 0,
    diezmoTotal: 0,
    deudores: []
  })

  async function loadDashboard() {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')

    const { count: pacientesActivos } = await supabase
      .from('pacientes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'activo')

    const { data: citasHoyRaw } = await supabase
      .from('citas')
      .select('*, pacientes(nombre)')
      .eq('fecha', todayStr)
      .neq('estado', 'cancelada')

    const { data: todasSesiones } = await supabase
      .from('sesiones')
      .select('valor, monto_pagado, diezmo_entregado, pacientes(nombre, id)')

    const porCobrar = todasSesiones?.reduce((acc, s) => acc + (s.valor - (s.monto_pagado || 0)), 0) || 0
    const ingresoGlobal = todasSesiones?.reduce((acc, s) => acc + (s.monto_pagado || 0), 0) || 0
    
    // Solo ingresos para el diezmo actual (los que NO se han entregado aún)
    const ingresoDiezmoActual = todasSesiones?.filter(s => !s.diezmo_entregado).reduce((acc, s) => acc + (s.monto_pagado || 0), 0) || 0

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

    setData({
      pacientesActivos: pacientesActivos || 0,
      citasHoy: citasHoyRaw || [],
      porCobrar,
      ingresoTotal: ingresoGlobal,
      diezmoTotal: Math.round(ingresoDiezmoActual * 0.1),
      deudores
    })
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacientes' }, () => loadDashboard())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

      <header className="topbar mb-10">
        <div>
          <h2 className="font-display italic text-6xl mb-2 text-rose-950 flex items-center gap-4">
            <Sparkles className="text-rose-400 animate-pulse" size={40} />
            Hola, Liliana
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em] italic">
              {format(now, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <Flower size={14} className="text-rose-200" />
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
            <div className="text-4xl font-black text-rose-950 tracking-tighter">{data.pacientesActivos}</div>
          </div>
        </div>

        <div className="card metric-card border-none shadow-[0_20px_50px_-12px_rgba(225,29,72,0.1)] bg-white/70 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-rose-50/50 group-hover:scale-110 transition-transform">
            <Calendar size={80} />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-rose-50 text-rose-400 rounded-2xl w-fit mb-6 shadow-inner"><Calendar size={24} /></div>
            <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Citas Hoy</span>
            <div className="text-4xl font-black text-rose-950 tracking-tighter">{data.citasHoy.length}</div>
          </div>
        </div>

        <div className="card metric-card border-none bg-rose-600 text-white shadow-2xl shadow-rose-200 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-white/5 group-hover:scale-110 transition-transform">
            <Sparkles size={100} />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl w-fit mb-6 backdrop-blur-md border border-white/10"><AlertCircle size={24} /></div>
            <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest block mb-1">Por cobrar</span>
            <div className="text-3xl font-black">{formatCOP(data.porCobrar)}</div>
          </div>
        </div>

        <div className="card metric-card border-none bg-rose-950 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-white/5 group-hover:scale-110 transition-transform">
            <TrendingUp size={100} />
          </div>
          <div className="relative z-10">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl w-fit mb-6 backdrop-blur-md border border-rose-500/10"><TrendingUp size={24} /></div>
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Total recaudado</span>
            <div className="text-3xl font-black">{formatCOP(data.ingresoTotal)}</div>
          </div>
        </div>
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
                <div key={cita.id} className="flex items-center justify-between p-5 hover:bg-white rounded-[32px] transition-all border border-transparent hover:border-rose-100 hover:shadow-lg shadow-rose-100/20 group">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-[22px] bg-rose-950 text-rose-100 flex items-center justify-center font-black text-sm group-hover:bg-rose-600 transition-colors shadow-lg shadow-rose-950/20 uppercase">{initials}</div>
                    <div>
                      <div className="font-black text-rose-950 group-hover:text-rose-600 transition-colors uppercase tracking-tight text-lg">{p.nombre}</div>
                      <div className="text-[10px] text-rose-300 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} /> {format12h(cita.hora_inicio)} · {cita.duracion_minutos} MIN
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-rose-50 text-rose-500 text-[9px] font-black px-4 py-1.5 rounded-2xl uppercase italic border border-rose-100/50">
                    {cita.estado}
                  </span>
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

          <div className="card bg-rose-950 border-none p-10 text-white shadow-2xl overflow-hidden relative group rounded-[40px]">
            <div className="absolute -right-4 -bottom-4 w-48 h-48 bg-rose-600/30 rounded-full blur-[80px] group-hover:scale-125 transition-transform duration-1000"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 -z-0">
               <Heart size={200} fill="currentColor" />
            </div>
            
            <div className="flex-between mb-10 relative z-10">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-400 backdrop-blur-md border border-rose-500/20">
                  <Heart size={22} fill="currentColor" />
                </div>
                <h3 className="text-rose-100 font-black uppercase tracking-[0.2em] text-[10px]">Diezmo Especial</h3>
              </div>
            </div>
            
            <div className="space-y-8 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-rose-400/60 text-[9px] font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                    Ofrenda (10%) <Sparkles size={10} />
                  </div>
                  <div className="text-5xl font-black text-white tracking-tighter mb-1">{formatCOP(data.diezmoTotal)}</div>
                  <div className="text-[8px] text-rose-500 font-bold uppercase tracking-widest italic opacity-80">Sincronizado con tus bendiciones</div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between text-[10px] font-black text-rose-400 mb-1 uppercase tracking-[0.2em]">
                  <span>RECAUDO TOTAL</span>
                  <span className="text-white">{formatCOP(data.ingresoTotal)}</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full w-full opacity-80"></div>
                </div>
                <div className="flex justify-center">
                   <Flower size={16} className="text-rose-900/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
