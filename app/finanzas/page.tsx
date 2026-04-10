'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Wallet, TrendingUp, AlertCircle, X, Loader2, DollarSign, Activity, CheckCircle, CreditCard, Sparkles } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import NotificationModal from '@/components/ui/NotificationModal'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export default function FinanzasPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [sesiones, setSesiones] = useState<any[]>([])
  const [pacientesDeudores, setPacientesDeudores] = useState<any[]>([])
  
  const [idSeleccionado, setIdSeleccionado] = useState('')
  const [montoAbono, setMontoAbono] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  useEffect(() => {
    const pId = searchParams.get('paciente')
    if (pId) {
      setIdSeleccionado(pId)
      setIsModalOpen(true)
    }
  }, [searchParams])

  async function loadData() {
    try {
      setLoading(true)
      const { data: todas } = await supabase.from('sesiones').select('*')
      setSesiones(todas || [])

      const { data: pendientes } = await supabase
        .from('sesiones')
        .select('paciente_id, valor, monto_pagado, pacientes(nombre)')
      
      const deudoresRaw = pendientes?.filter(s => (s.monto_pagado || 0) < s.valor) || []
      
      const agrupados: Record<string, any> = {}
      deudoresRaw.forEach(s => {
        const p = s.pacientes as any
        if (!agrupados[s.paciente_id]) {
          agrupados[s.paciente_id] = {
            id: s.paciente_id,
            nombre: p?.nombre ?? 'Desconocido',
            deudaTotal: 0,
            sesionesPendientes: 0
          }
        }
        agrupados[s.paciente_id].deudaTotal += (s.valor - (s.monto_pagado || 0))
        agrupados[s.paciente_id].sesionesPendientes += 1
      })

      setPacientesDeudores(Object.values(agrupados).sort((a: any, b: any) => b.deudaTotal - a.deudaTotal))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('finanzas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones' }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalProyectado = sesiones.reduce((a, s) => a + s.valor, 0)
  const totalCobrado = sesiones.reduce((a, s) => a + (s.monto_pagado || 0), 0)
  const porCobrar = totalProyectado - totalCobrado

  async function handleRegistrarAbono(e: React.FormEvent) {
    e.preventDefault()
    if (!idSeleccionado || !montoAbono || Number(montoAbono) <= 0) return
    
    setSaving(true)
    let montoRestante = Number(montoAbono)
    
    try {
      const { data: pendientes } = await supabase
        .from('sesiones')
        .select('id, valor, monto_pagado')
        .eq('paciente_id', idSeleccionado)
        .order('fecha', { ascending: true })

      const filtradas = pendientes?.filter(s => (s.monto_pagado || 0) < s.valor) || []

      for (const sesion of filtradas) {
        if (montoRestante <= 0) break
        const deudaSesion = sesion.valor - (sesion.monto_pagado || 0)
        const pagoParaEstaSesion = Math.min(montoRestante, deudaSesion)
        const nuevoMontoPagado = (sesion.monto_pagado || 0) + pagoParaEstaSesion
        const nuevoEstado = nuevoMontoPagado >= sesion.valor ? 'pagado' : 'pendiente'

        const { error: updateError } = await supabase
          .from('sesiones')
          .update({ 
            monto_pagado: nuevoMontoPagado, 
            estado_pago: nuevoEstado,
            metodo_pago: metodoPago
          })
          .eq('id', sesion.id)

        if (updateError) throw updateError
        montoRestante -= pagoParaEstaSesion
      }

      setIsModalOpen(false)
      setMontoAbono('')
      setNotification({
        isOpen: true,
        type: 'success',
        title: '¡Recaudo Exitoso!',
        message: 'El pago ha sido procesado y aplicado a las deudas.'
      })
    } catch (err) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Red',
        message: 'No pudimos registrar el abono. Verifica tu conexión.'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && sesiones.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
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
            <Wallet className="text-rose-400" size={36} />
            Finanzas
          </h2>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest italic">Gestión de cartera y abonos</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary !bg-rose-950 hover:!bg-rose-900 !rounded-2xl !py-3 flex items-center gap-2 shadow-xl shadow-rose-950/20 active:scale-95 transition-all text-xs font-black uppercase tracking-widest">
          <Sparkles size={18} />
          Registrar Abono
        </button>
      </header>

      <section className="metric-grid gap-6">
        <div className="card metric-card border-none shadow-lg shadow-rose-100/20">
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Total Proyectado</span>
          <div className="text-2xl font-black text-rose-950">{formatCOP(totalProyectado)}</div>
        </div>

        <div className="card metric-card bg-rose-600 border-none shadow-xl shadow-rose-200 group text-white">
          <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest block mb-1">Total Recaudado</span>
          <div className="text-2xl font-black">{formatCOP(totalCobrado)}</div>
          <TrendingUp className="absolute right-4 bottom-4 text-white/10 group-hover:scale-125 transition-transform" size={48} />
        </div>

        <div className="card metric-card bg-rose-50 border-none shadow-lg shadow-rose-100/20 group">
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Cartera Pendiente</span>
          <div className="text-2xl font-black text-rose-600">{formatCOP(porCobrar)}</div>
          <AlertCircle className="absolute right-4 bottom-4 text-rose-500/10 group-hover:scale-125 transition-transform" size={48} />
        </div>
      </section>

      <div className="mt-12">
        <div className="flex items-center gap-3 mb-8">
           <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><Activity size={20} /></div>
           <h3 className="text-rose-950 font-black uppercase text-sm tracking-widest">Pacientes con Deuda</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pacientesDeudores.map(p => (
            <div key={p.id} className="card group hover:shadow-2xl transition-all border-2 border-transparent hover:border-rose-100 border-l-rose-500 border-l-4 flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs group-hover:bg-rose-600 transition-colors uppercase">{getIniciales(p.nombre)}</div>
                  <div className="flex-1">
                    <div className="font-black text-rose-950 group-hover:text-rose-600 transition-colors uppercase tracking-tight text-lg">{p.nombre}</div>
                    <div className="text-[9px] items-center gap-1 text-rose-500 font-black uppercase tracking-tighter bg-rose-50 px-2 py-0.5 rounded-full inline-flex border border-rose-100">
                      <CreditCard size={10} />
                      {p.sesionesPendientes} sesiones
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4 pt-4 border-t border-rose-50">
                <div>
                  <div className="text-rose-300 text-[9px] uppercase font-black tracking-widest mb-1">Deuda pendiente</div>
                  <div className="text-3xl font-black text-rose-950 tracking-tighter">{formatCOP(p.deudaTotal)}</div>
                </div>
                <button 
                  onClick={() => {
                    setIdSeleccionado(p.id)
                    setIsModalOpen(true)
                  }}
                  className="w-12 h-12 bg-rose-950 text-rose-100 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-lg active:scale-90 flex items-center justify-center"
                  title="Cobrar Ahora"
                >
                  <DollarSign size={24} />
                </button>
              </div>
            </div>
          ))}
          {pacientesDeudores.length === 0 && (
            <div className="col-span-full py-24 text-center card bg-rose-50/30 border-dashed border-rose-200">
               <Sparkles className="mx-auto mb-4 text-rose-300" size={32} />
               <p className="text-rose-400 font-black text-lg uppercase tracking-widest italic">✨ Cartera al día Liliana</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-rose-950/40 backdrop-blur-md px-4 p-4">
          <div className="bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(225,29,72,0.2)] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-rose-50 flex justify-between items-center bg-rose-50/20">
              <h3 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Registrar Pago</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-rose-300 hover:text-rose-500 transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleRegistrarAbono} className="p-8 space-y-6">
              <div className="form-group">
                <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-3 block">Paciente</label>
                <select 
                  className="w-full px-5 py-4 rounded-2xl border-2 border-rose-50 focus:border-rose-400 outline-none font-bold text-rose-900 bg-rose-50/30 transition-all appearance-none cursor-pointer text-sm"
                  value={idSeleccionado}
                  onChange={(e) => setIdSeleccionado(e.target.value)}
                  required
                >
                  <option value="" disabled>Seleccionar...</option>
                  {pacientesDeudores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} — {formatCOP(p.deudaTotal)}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-3 block">Valor del abono</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-rose-200">$</span>
                  <input 
                    type="number" 
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    className="w-full pl-12 pr-6 py-5 rounded-2xl border-2 border-rose-50 focus:border-rose-400 outline-none font-black text-4xl text-rose-900 bg-rose-50/30 transition-all placeholder:text-rose-100"
                    placeholder="0"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-3 block">Medio de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  {['efectivo', 'transferencia'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPago(m)}
                      className={`py-4 px-3 rounded-2xl border-2 font-black capitalize transition-all text-xs ${metodoPago === m ? 'border-rose-500 bg-rose-600 text-white shadow-lg shadow-rose-200' : 'border-rose-50 text-rose-300 hover:border-rose-100 bg-rose-50/20'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={saving} className="w-full py-5 font-black text-xs text-white bg-rose-950 rounded-[28px] hover:bg-rose-900 disabled:opacity-50 shadow-2xl shadow-rose-950/20 transition-all active:scale-[0.95] flex items-center justify-center gap-3 uppercase tracking-[0.2em]">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  {saving ? 'Registrando...' : 'Confirmar Recaudo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
