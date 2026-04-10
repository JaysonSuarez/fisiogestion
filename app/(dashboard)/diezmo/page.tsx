'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, CheckCircle, AlertCircle, Wallet, Info, Loader2, Heart, Sparkles, Check } from 'lucide-react'
import NotificationModal from '@/components/ui/NotificationModal'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export default function DiezmoPage() {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [totalIngreso, setTotalIngreso] = useState(0)
  const [totalDiezmo, setTotalDiezmo] = useState(0)
  
  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error' | 'info', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  async function loadTotals() {
    try {
      const { data } = await supabase
        .from('sesiones')
        .select('monto_pagado')
        .eq('diezmo_entregado', false)
      
      const ingreso = data?.reduce((acc, s) => acc + (s.monto_pagado || 0), 0) || 0
      setTotalIngreso(ingreso)
      setTotalDiezmo(Math.round(ingreso * 0.1))
    } finally {
      setLoading(false)
    }
  }

  async function handleEntregarDiezmo() {
    if (totalDiezmo <= 0) {
      setNotification({
        isOpen: true,
        type: 'info',
        title: 'Diezmo en zero',
        message: 'No hay diezmo acumulado para entregar en este momento.'
      })
      return
    }

    try {
      setActionLoading(true)
      const { error } = await supabase
        .from('sesiones')
        .update({ diezmo_entregado: true })
        .eq('diezmo_entregado', false)
        .gt('monto_pagado', 0)

      if (error) throw error

      setNotification({
        isOpen: true,
        type: 'success',
        title: '¡Diezmo Entregado!',
        message: 'El contador se ha reiniciado. ¡Gracias por tu fidelidad!'
      })
      
      loadTotals()
    } catch (err: any) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'No pudimos registrar la entrega. Intenta de nuevo.'
      })
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    loadTotals()

    const channel = supabase
      .channel('diezmo-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sesiones' },
        () => {
          loadTotals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-rose-500" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4">
      <NotificationModal 
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <header className="topbar mb-10">
        <div>
          <h2 className="font-display italic text-5xl mb-2 flex items-center gap-3 text-rose-950">
            <Sparkles className="text-rose-400" size={36} />
            Diezmo
          </h2>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-[0.2em]">Fruto de tu bendecido trabajo</p>
        </div>
      </header>

      {/* Main Metrics Organised */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="card bg-white border-2 border-rose-50 p-8 relative overflow-hidden group shadow-xl shadow-rose-100/20">
          <div className="absolute -right-6 -bottom-6 text-rose-50 opacity-50 group-hover:scale-110 transition-transform duration-500">
             <TrendingUp size={140} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-2">Ingresos Consolidados</span>
            <div className="text-4xl font-black text-rose-950 tracking-tighter">{formatCOP(totalIngreso)}</div>
          </div>
        </div>

        <div className="card bg-rose-600 border-none p-8 relative overflow-hidden group shadow-xl shadow-rose-200">
          <div className="absolute -right-6 -bottom-6 text-rose-500 opacity-30 group-hover:scale-110 transition-transform duration-500">
             <Heart size={140} fill="currentColor" />
          </div>
          <div className="relative z-10 text-white">
            <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest block mb-2">Diezmo Acumulado (10%)</span>
            <div className="text-5xl font-black text-white tracking-tighter">{formatCOP(totalDiezmo)}</div>
          </div>
        </div>
      </section>

      {/* Detailed Info organised in a clean Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-8 bg-white border-2 border-rose-50">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><Info size={20} /></div>
            <h3 className="text-rose-900 font-black uppercase tracking-widest text-sm">Resumen de Contribución</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-rose-400 font-bold text-xs">10%</div>
                <span className="text-sm font-bold text-rose-800">Porcentaje establecido</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Base Gravable</span>
                <span className="text-lg font-bold text-slate-800">{formatCOP(totalIngreso)}</span>
              </div>
              <div className="p-6 rounded-3xl bg-rose-50/50 border border-rose-100">
                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-2">Total a Apartar</span>
                <span className="text-lg font-black text-rose-600">{formatCOP(totalDiezmo)}</span>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleEntregarDiezmo}
                disabled={actionLoading || totalDiezmo <= 0}
                className="w-full py-5 bg-rose-950 hover:bg-rose-900 text-white font-black rounded-3xl shadow-xl shadow-rose-950/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 uppercase tracking-[0.2em] text-xs"
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {actionLoading ? 'Registrando Entrega...' : 'Diezmo Entregado'}
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-slate-950 border-none p-8 flex flex-col justify-between text-center relative overflow-hidden group">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-rose-500/20 rounded-full blur-[60px]"></div>
          
          <div className="relative z-10 pt-4">
            <Heart className="mx-auto mb-6 text-rose-500 animate-pulse" fill="none" size={48} />
            <h3 className="text-rose-100 font-black text-xl mb-4 leading-tight">“Dando con alegría el fruto de mi labor.”</h3>
          </div>

          <div className="relative z-10 mt-8 mb-4">
            <div className="inline-block px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-4">
              Compromiso Fiel
            </div>
            <p className="text-slate-500 text-[10px] leading-relaxed italic">
              "Malaquías 3:10"
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
