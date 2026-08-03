'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { Wallet, TrendingUp, AlertCircle, X, Loader2, DollarSign, Activity, CheckCircle, CreditCard, Sparkles, Trash2, Calendar, Heart, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import NotificationModal from '@/components/ui/NotificationModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

import {
  formatCOP,
  getIniciales,
  getMesesDisponibles,
  formatMes,
  getCurrentMonthStr,
  getMonthDateRange,
  getValorPorSesion,
  calcularDiezmo,
  getTasaComision,
  EMPLEADAS,
} from '@/lib/utils'


function FinanzasContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sesiones, setSesiones] = useState<any[]>([])
  const [pacientesDeudores, setPacientesDeudores] = useState<any[]>([])
  const [pacientesPagados, setPacientesPagados] = useState<any[]>([])
  const [citasFisios, setCitasFisios] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr())
  const [showIngresos, setShowIngresos] = useState(false)

  const [idSeleccionado, setIdSeleccionado] = useState('')
  const [montoAbono, setMontoAbono] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')

  // Confirmation State
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error' | 'info', title: string, message: string}>({
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
      const { startDate, endDate } = getMonthDateRange(selectedMonth)

      // Planes que inician en el mes seleccionado (unidad de contabilidad del recaudo)
      const { data: todas } = await supabase
        .from('sesiones')
        .select('*, pacientes(nombre)')
        .gte('fecha', startDate)
        .lte('fecha', endDate)

      setSesiones(todas || [])

      // Pacientes que pagaron algo este mes (ingresos recibidos)
      const pagadosRaw = (todas || []).filter(s => (s.monto_pagado || 0) > 0);
      const agrupadosPagos: Record<string, any> = {}
      pagadosRaw.forEach(s => {
        const p = s.pacientes as any
        if (!agrupadosPagos[s.paciente_id]) {
          agrupadosPagos[s.paciente_id] = {
            id: s.paciente_id,
            nombre: p?.nombre ?? 'Desconocido',
            totalPagado: 0,
            sesiones: 0
          }
        }
        agrupadosPagos[s.paciente_id].totalPagado += (s.monto_pagado || 0)
        agrupadosPagos[s.paciente_id].sesiones += 1
      })
      setPacientesPagados(Object.values(agrupadosPagos).sort((a: any, b: any) => b.totalPagado - a.totalPagado))

      // Deuda: TODAS las sesiones pendientes (independiente del mes). Los planes de
      // cortesía/deuda se excluyen: no son cobrables al paciente.
      const { data: pendientes } = await supabase
        .from('sesiones')
        .select('id, paciente_id, valor, monto_pagado, fecha, cortesia, pacientes(nombre)')

      const deudoresRaw = pendientes?.filter(s => !(s as any).cortesia && (s.monto_pagado || 0) < s.valor) || []

      // Citas que las empleadas realizaron (completadas) en el mes → comisión del
      // 25%, o del 30% si fue esa fisio quien trajo al paciente. La comisión sale
      // SOLO de lo pagado (salvo cortesía): se reparte el recaudo del plan entre
      // sus sesiones por orden cronológico.
      const { data: citasEmp } = await supabase
        .from('citas')
        .select('id, fecha, hora_inicio, fisioterapeuta, pago_terapeuta_control, sesion_id, sesiones(valor, monto_pagado, duracion_minutos, cortesia, pacientes(nombre, fisioterapeuta, traido_por_fisio))')
        .in('fisioterapeuta', EMPLEADAS)
        .eq('estado', 'completada')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: false })

      const mesCitas = (citasEmp || []) as any[]
      const sesionIdsEmpleadas = Array.from(new Set(mesCitas.map(c => c.sesion_id).filter(Boolean)))

      // Todas las citas completadas de empleadas en esos planes (incluye otros
      // meses), para repartir el pago del plan en orden cronológico.
      let todasEmpleadasPlan: any[] = []
      if (sesionIdsEmpleadas.length > 0) {
        const { data: allEmp } = await supabase
          .from('citas')
          .select('id, fecha, hora_inicio, fisioterapeuta, sesion_id')
          .in('fisioterapeuta', EMPLEADAS)
          .eq('estado', 'completada')
          .in('sesion_id', sesionIdsEmpleadas)
        todasEmpleadasPlan = allEmp || []
      }

      const planInfo: Record<string, any> = {}
      mesCitas.forEach(c => { if (c.sesion_id) planInfo[c.sesion_id] = c.sesiones })

      const porPlan = todasEmpleadasPlan.reduce((acc: Record<string, any[]>, c) => {
        (acc[c.sesion_id] = acc[c.sesion_id] || []).push(c); return acc
      }, {})

      const comisionPorCita: Record<string, number> = {}
      Object.entries(porPlan).forEach(([sid, lista]) => {
        const info = planInfo[sid]
        if (!info) return
        const vps = getValorPorSesion({ valor: info.valor, duracion_minutos: info.duracion_minutos })
        const ordenadas = (lista as any[]).slice().sort((a, b) =>
          (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
        let acumulado = 0
        ordenadas.forEach(c => {
          const base = info.cortesia
            ? vps
            : Math.max(0, Math.min(vps, (info.monto_pagado || 0) - acumulado))
          comisionPorCita[c.id] = Math.round(base * getTasaComision(c.fisioterapeuta, info.pacientes))
          acumulado += vps
        })
      })

      const procesadas = mesCitas.map(c => ({
        id: c.id,
        fecha: c.fecha,
        nombre: c.sesiones?.pacientes?.nombre,
        fisioterapeuta: c.fisioterapeuta,
        tasa: getTasaComision(c.fisioterapeuta, c.sesiones?.pacientes),
        comision: comisionPorCita[c.id] ?? 0,
        pagado: c.pago_terapeuta_control === 'pagado',
        cortesia: !!c.sesiones?.cortesia,
      }))

      setCitasFisios(procesadas)

      const agrupados: Record<string, any> = {}
      deudoresRaw.forEach(s => {
        const p = s.pacientes as any
        if (!agrupados[s.paciente_id]) {
          agrupados[s.paciente_id] = {
            id: s.paciente_id,
            nombre: p?.nombre ?? 'Desconocido',
            deudaTotal: 0,
            sesionesPendientes: 0,
            detalleSesiones: []
          }
        }
        agrupados[s.paciente_id].deudaTotal += (s.valor - (s.monto_pagado || 0))
        agrupados[s.paciente_id].sesionesPendientes += 1
        agrupados[s.paciente_id].detalleSesiones.push({
          id: s.id,
          fecha: s.fecha,
          valor: s.valor,
          pagado: s.monto_pagado || 0
        })
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedMonth])

  // ─── Comisiones del mes — ya calculadas en loadData, capadas por lo pagado ────
  const citasFisiosProcesadas = citasFisios as any[]
  const totalComisionFisios = citasFisiosProcesadas.reduce((a, c) => a + c.comision, 0)
  const comisionPendienteFisios = citasFisiosProcesadas.filter(c => !c.pagado).reduce((a, c) => a + c.comision, 0)
  // Desglose por fisioterapeuta, para saber a quién se le debe qué.
  const comisionPorFisio = citasFisiosProcesadas.reduce((acc: Record<string, number>, c) => {
    if (!c.pagado) acc[c.fisioterapeuta] = (acc[c.fisioterapeuta] || 0) + c.comision
    return acc
  }, {})

  // ─── Flujo de dinero del mes (los planes de cortesía no son ingreso real) ─────
  const recaudadoBruto = sesiones.filter((s: any) => !s.cortesia).reduce((a, s) => a + (s.monto_pagado || 0), 0)
  const comisionParaGanancia = citasFisiosProcesadas.filter(c => !c.cortesia).reduce((a, c) => a + c.comision, 0)
  const gananciaLiliana = Math.max(0, recaudadoBruto - comisionParaGanancia)
  const diezmoEstimado = calcularDiezmo(gananciaLiliana)
  const carteraPorCobrar = pacientesDeudores.reduce((a, p) => a + p.deudaTotal, 0)

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

  async function handlePagarLuisa() {
    const idsPendientes = citasFisiosProcesadas.filter(c => !c.pagado).map(c => c.id)
    if (idsPendientes.length === 0) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('citas')
        .update({ pago_terapeuta_control: 'pagado' })
        .in('id', idsPendientes)

      if (error) throw error

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Pago Registrado',
        message: 'Se han marcado las comisiones de Luisa como pagadas.'
      })
      loadData()
    } catch (err) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Red',
        message: 'No pudimos registrar el pago.'
      })
    } finally {
      setSaving(false)
    }
  }

  // Alterna el estado de pago de una comisión (pagado ↔ pendiente).
  // Permite corregir cuando se marcó como pagado sin haberse pagado.
  async function handleToggleComisionLuisa(citaId: string, currentlyPaid: boolean) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('citas')
        .update({ pago_terapeuta_control: currentlyPaid ? 'pendiente' : 'pagado' })
        .eq('id', citaId)

      if (error) throw error
      loadData()
    } catch (err) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Red',
        message: 'No pudimos actualizar el estado de la comisión.'
      })
    } finally {
      setSaving(false)
    }
  }

  // Revierte todas las comisiones pagadas del mes a "pendiente".
  async function handleRevertirLuisa() {
    const idsPagados = citasFisiosProcesadas.filter(c => c.pagado).map(c => c.id)
    if (idsPagados.length === 0) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('citas')
        .update({ pago_terapeuta_control: 'pendiente' })
        .in('id', idsPagados)

      if (error) throw error

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Pagos Revertidos',
        message: 'Las comisiones de Luisa volvieron a estado pendiente.'
      })
      loadData()
    } catch (err) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Red',
        message: 'No pudimos revertir los pagos.'
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const { error: deleteError } = await supabase
        .from('sesiones')
        .delete()
        .eq('id', sessionId)

      if (deleteError) throw deleteError

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Sesión Eliminada',
        message: 'La sesión ha sido eliminada del historial.'
      })
    } catch (err: any) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error al Eliminar',
        message: 'No pudimos eliminar la sesión.'
      })
    }
  }

  if (loading && sesiones.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <ConfirmModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
        title="¿Eliminar Sesión?"
        message="¿Estás seguro de que deseas eliminar este registro? Esto cancelará la deuda asociada a esta sesión."
      />

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display italic text-5xl mb-2 flex items-center gap-3 text-rose-950">
            <Wallet className="text-rose-400" size={36} />
            Finanzas
          </h2>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest italic">Ganancia real, cartera y comisiones</p>

          <div className="mt-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto bg-white border border-rose-100 text-rose-950 font-black rounded-[20px] px-4 py-2 shadow-sm uppercase tracking-widest text-xs outline-none focus:ring-2 focus:ring-rose-200"
            >
              {getMesesDisponibles().map(m => (
                <option key={m} value={m}>{formatMes(m)}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => { setIdSeleccionado(''); setIsModalOpen(true) }} className="shrink-0 w-full sm:w-auto p-4 bg-rose-950 text-white rounded-2xl shadow-xl shadow-rose-950/20 hover:bg-rose-900 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <Sparkles size={18} />
          Registrar Abono
        </button>
      </header>

      {/* ── TARJETA HÉROE: FLUJO DE DINERO DEL MES ── */}
      <section className="card border-none shadow-[0_24px_60px_-16px_rgba(225,29,72,0.25)] !bg-rose-950 text-white p-8 sm:p-10 relative overflow-hidden mb-8 rounded-[36px]">
        <div className="absolute -right-8 -bottom-8 text-white/5">
          <Heart size={200} fill="currentColor" />
        </div>
        <div className="relative z-10">
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-[0.3em] block mb-6">Ganancia de Liliana · {formatMes(selectedMonth)}</span>

          <div className="space-y-3 mb-8 max-w-md">
            <div className="flex items-center justify-between text-rose-100/80">
              <span className="text-xs font-bold uppercase tracking-widest">Recaudado (bruto)</span>
              <span className="text-lg font-black">{formatCOP(recaudadoBruto)}</span>
            </div>
            <div className="flex items-center justify-between text-amber-300">
              <span className="text-xs font-bold uppercase tracking-widest">− Comisiones de fisioterapeutas</span>
              <span className="text-lg font-black">−{formatCOP(comisionParaGanancia)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest text-white">= Tu ganancia</span>
              <span className="text-3xl sm:text-4xl font-black tracking-tighter text-white">{formatCOP(gananciaLiliana)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest block mb-1 flex items-center gap-1">Diezmo (10%) <Sparkles size={10} /></span>
              <span className="text-lg font-black text-white">{formatCOP(diezmoEstimado)}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest block mb-1">Por cobrar (cartera)</span>
              <span className="text-lg font-black text-white">{formatCOP(carteraPorCobrar)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARTERA POR COBRAR ── */}
      <div className="mb-14">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><AlertCircle size={20} /></div>
            <h3 className="text-rose-950 font-black uppercase text-sm tracking-widest">Cartera por Cobrar</h3>
          </div>
          <span className="text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full uppercase tracking-widest">{formatCOP(carteraPorCobrar)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

              <div className="flex justify-between items-end mt-4 pt-4 border-t border-rose-50/50">
                <div>
                   <div className="text-rose-300 text-[9px] uppercase font-black tracking-widest mb-1">Deuda pendiente</div>
                   <div className="text-2xl font-black text-rose-950 tracking-tighter">{formatCOP(p.deudaTotal)}</div>
                </div>
                <div className="flex gap-2">
                   <button
                    onClick={() => {
                      setSelectedPatient(p)
                      setIsDetailModalOpen(true)
                    }}
                    className="w-10 h-10 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-90 flex items-center justify-center border border-rose-100"
                    title="Ver/Eliminar Sesiones"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIdSeleccionado(p.id)
                      setIsModalOpen(true)
                    }}
                    className="w-10 h-10 bg-rose-950 text-rose-100 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg active:scale-90 flex items-center justify-center"
                    title="Cobrar Ahora"
                  >
                    <DollarSign size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {pacientesDeudores.length === 0 && (
            <div className="col-span-full py-20 text-center card bg-rose-50/30 border-dashed border-rose-200">
               <Sparkles className="mx-auto mb-4 text-rose-300" size={32} />
               <p className="text-rose-400 font-black text-lg uppercase tracking-widest italic">✨ Cartera al día</p>
            </div>
          )}
        </div>
      </div>

      {/* ── COMISIONES DE LUISA ── */}
      <div className="mb-14">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl"><Activity size={20} /></div>
            <h3 className="text-rose-950 font-black uppercase text-sm tracking-widest">Comisiones de fisioterapeutas · {formatMes(selectedMonth)}</h3>
          </div>
          {comisionPendienteFisios > 0 ? (
            <button
              onClick={handlePagarLuisa}
              disabled={saving}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Pagar {formatCOP(comisionPendienteFisios)}
            </button>
          ) : citasFisiosProcesadas.some(c => c.pagado) ? (
            <button
              onClick={handleRevertirLuisa}
              disabled={saving}
              className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Revertir pagos
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-5 border-none shadow-lg shadow-rose-100/20">
            <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Sesiones (mes)</span>
            <div className="text-xl font-black text-rose-950">{citasFisios.length}</div>
          </div>
          <div className="card p-5 border-none shadow-lg shadow-amber-100/20 bg-amber-50/50">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">Comisión total</span>
            <div className="text-xl font-black text-amber-600">{formatCOP(totalComisionFisios)}</div>
          </div>
          <div className="card p-5 border-none shadow-lg shadow-rose-100/20 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">Por pagar</span>
            <div className="text-xl font-black text-rose-600">{formatCOP(comisionPendienteFisios)}</div>
            {Object.keys(comisionPorFisio).length > 1 && (
              <div className="text-[9px] font-bold text-rose-300 uppercase tracking-widest mt-1">
                {Object.entries(comisionPorFisio).map(([f, m]) => `${f}: ${formatCOP(m as number)}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6 shadow-xl shadow-rose-100/20 border-2 border-rose-50">
           <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
              {citasFisiosProcesadas.map((c) => (
                <div key={c.id} className="p-4 bg-rose-50/30 rounded-[20px] border border-rose-100 flex items-center justify-between group hover:bg-rose-50 transition-colors">
                   <div>
                      <div className="text-xs font-black text-rose-950 uppercase tracking-tight">{c.nombre}</div>
                      <div className="text-[10px] font-bold text-rose-400 mt-1">{c.fecha} · {c.fisioterapeuta}</div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="text-right">
                         <div className="text-xs font-black text-amber-600">{formatCOP(c.comision)}</div>
                         <div className="text-[8px] font-bold text-rose-300 uppercase tracking-widest">
                           {Math.round(c.tasa * 100)}% comisión{c.tasa > 0.25 ? ' · trajo al paciente' : ''}
                         </div>
                      </div>
                      <button
                        onClick={() => handleToggleComisionLuisa(c.id, c.pagado)}
                        disabled={saving}
                        title={c.pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
                        className={`badge !text-[8px] !font-black !px-2 !py-1 !rounded-md uppercase cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-50 ${c.pagado ? '!bg-emerald-50 !text-emerald-500 border border-emerald-100' : '!bg-rose-100 !text-rose-600 border border-rose-200'}`}
                      >
                         {c.pagado ? 'Pagado' : 'Pendiente'}
                      </button>
                   </div>
                </div>
              ))}
              {citasFisiosProcesadas.length === 0 && (
                <div className="py-12 text-center opacity-50">
                  <Calendar className="mx-auto mb-3 text-rose-300" size={32} />
                  <p className="text-rose-400 font-black text-[10px] uppercase tracking-[0.2em]">Ninguna fisioterapeuta realizó sesiones este mes.</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* ── INGRESOS RECIBIDOS (colapsable) ── */}
      <div className="mb-8">
        <button
          onClick={() => setShowIngresos(v => !v)}
          className="w-full flex items-center justify-between gap-3 mb-2 p-2 rounded-xl hover:bg-emerald-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl"><TrendingUp size={20} /></div>
            <h3 className="text-emerald-950 font-black uppercase text-sm tracking-widest">Ingresos Recibidos · {formatMes(selectedMonth)}</h3>
          </div>
          <ChevronDown size={20} className={`text-emerald-400 transition-transform ${showIngresos ? 'rotate-180' : ''}`} />
        </button>

        {showIngresos && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {pacientesPagados.map(p => (
              <div key={`pago-${p.id}`} className="card group hover:shadow-2xl transition-all border-2 border-transparent hover:border-emerald-100 border-l-emerald-500 border-l-4 flex flex-col justify-between p-6">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs group-hover:bg-emerald-600 transition-colors uppercase">{getIniciales(p.nombre)}</div>
                   <div className="flex-1">
                     <div className="font-black text-emerald-950 group-hover:text-emerald-600 transition-colors uppercase tracking-tight text-lg">{p.nombre}</div>
                     <div className="text-[9px] items-center gap-1 text-emerald-500 font-black uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded-full inline-flex border border-emerald-100">
                       <CreditCard size={10} />
                       {p.sesiones} pagos
                     </div>
                   </div>
                </div>
                <div className="pt-4 border-t border-emerald-50/50">
                   <div className="text-emerald-300 text-[9px] uppercase font-black tracking-widest mb-1">Total Recaudado</div>
                   <div className="text-2xl font-black text-emerald-950 tracking-tighter">{formatCOP(p.totalPagado)}</div>
                </div>
              </div>
            ))}
            {pacientesPagados.length === 0 && (
              <div className="col-span-full py-16 text-center card bg-emerald-50/30 border-dashed border-emerald-200">
                 <Sparkles className="mx-auto mb-4 text-emerald-300" size={32} />
                 <p className="text-emerald-400 font-black text-lg uppercase tracking-widest italic">Aún no hay ingresos este mes</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Registrar Pago */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-rose-950/40 backdrop-blur-md px-4 p-4 transition-all">
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

      {/* Modal Detalle/Eliminar Sesiones */}
      {isDetailModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-rose-950/40 backdrop-blur-md px-4 p-4">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="px-8 py-6 border-b border-rose-50 flex justify-between items-center bg-rose-50/20">
                <div>
                   <h3 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Sesiones Pendientes</h3>
                   <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest">{selectedPatient.nombre}</p>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-rose-300 hover:text-rose-500 transition-colors"><X size={20} /></button>
              </div>

              <div className="p-8 max-h-[400px] overflow-y-auto space-y-4 custom-scrollbar">
                 {selectedPatient.detalleSesiones.map((s: any) => (
                    <div key={s.id} className="card p-5 border border-rose-50 hover:border-rose-200 transition-all group">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                                <Calendar size={20} />
                             </div>
                             <div>
                                <div className="text-xs font-black text-rose-950 uppercase tracking-tight">{new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                                <div className="text-[10px] font-black text-rose-300 uppercase tracking-widest">{formatCOP(s.valor)} — Pendiente</div>
                             </div>
                          </div>
                          <button
                            onClick={() => setSessionToDelete(s.id)}
                            className="p-3 text-rose-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Eliminar esta sesión"
                          >
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                 ))}
                 {selectedPatient.detalleSesiones.length === 0 && (
                   <p className="text-center py-10 text-rose-300 font-bold text-sm">No hay sesiones pendientes.</p>
                 )}
              </div>

              <div className="p-8 border-t border-rose-50 bg-rose-50/10">
                 <button
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    setIdSeleccionado(selectedPatient.id)
                    setIsModalOpen(true)
                  }}
                  className="w-full py-4 bg-rose-950 text-white font-black rounded-2xl hover:bg-rose-600 transition-all text-xs uppercase tracking-[0.2em]"
                >
                    Ir a Cobrar Todo
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

export default function FinanzasPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>}>
      <FinanzasContent />
    </Suspense>
  )
}
