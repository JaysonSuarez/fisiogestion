'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, getCachedUser } from '@/lib/supabase'
import { ClipboardPlus, Activity, CheckCircle, Clock, AlertCircle, Loader2, Sparkles, Edit3, Plus, Minus, X, Save, Trash2, Flower2 } from 'lucide-react'
import NotificationModal from '@/components/ui/NotificationModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

import { formatCOP, getIniciales, getMesesDisponibles, formatMes, getCurrentMonthStr } from '@/lib/utils'

export default function SesionesPage() {
  const [loading, setLoading] = useState(true)
  const [sesiones, setSesiones] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr())
  const [isLuisa, setIsLuisa] = useState(false)
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [localValor, setLocalValor] = useState(0)
  const [localCitas, setLocalCitas] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error' | 'info', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  // Delete plan State
  const [planToDelete, setPlanToDelete] = useState<string | null>(null)

  async function loadSesiones() {
    try {
      setLoading(true)
      const user = await getCachedUser()
      const isLu = user?.email?.toLowerCase().includes('luisa')
      setIsLuisa(!!isLu)

      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

      // 1. Obtener IDs de sesiones con citas en el mes seleccionado
      const { data: citasEnMes } = await supabase
        .from('citas')
        .select('sesion_id')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .not('sesion_id', 'is', null)

      const sesionIds = Array.from(new Set(citasEnMes?.map(c => c.sesion_id).filter(Boolean) || []))

      // 2. Obtener sesiones que inician en el mes
      let queryBase = supabase
        .from('sesiones')
        .select('*, pacientes(nombre, valor_sesion, fisioterapeuta), citas(id, estado, fecha, hora_inicio, notas, fisioterapeuta)')
        .order('fecha', { ascending: false })

      const { data: sesionesStartMonth } = await queryBase
        .gte('fecha', startDate)
        .lte('fecha', endDate)

      let combinedSessions = sesionesStartMonth || []

      // 3. Obtener sesiones con citas en el mes que no inician en el mes
      if (sesionIds.length > 0) {
        const loadedIds = new Set(combinedSessions.map(s => s.id))
        const missingIds = sesionIds.filter(id => !loadedIds.has(id))

        if (missingIds.length > 0) {
          const { data: sesionesSpanning } = await supabase
            .from('sesiones')
            .select('*, pacientes(nombre, valor_sesion, fisioterapeuta), citas(id, estado, fecha, hora_inicio, notas, fisioterapeuta)')
            .in('id', missingIds)

          if (sesionesSpanning) {
            combinedSessions = [...combinedSessions, ...sesionesSpanning]
            // Ordenar por fecha descendente
            combinedSessions.sort((a, b) => b.fecha.localeCompare(a.fecha))
          }
        }
      }
        
      let filteredData = combinedSessions
      if (isLu) {
        filteredData = filteredData.filter((s: any) => s.pacientes?.fisioterapeuta === 'Luisa')
      }
      setSesiones(filteredData)
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
  }, [selectedMonth])

  const totalHoras = sesiones.reduce((a, s) => a + (s.duracion_minutos || 0), 0) / 60
  
  const planesProcesados = sesiones.map(s => {
    const citas = s.citas || []
    const completadas = citas.filter((c: any) => {
      const st = (c.estado || '').toLowerCase().trim()
      return st === 'completado' || st === 'completada'
    }).length
    const total = citas.length
    const esCompletado = total > 0 && completadas >= total
    return { ...s, completadas, total, esCompletado }
  })

  const completadasCount = planesProcesados.filter(p => p.esCompletado).length || 0
  const pendientesCount = planesProcesados.filter(p => !p.esCompletado).length || 0
  
  const filtradas = planesProcesados.filter(p => showHistory ? p.esCompletado : !p.esCompletado)

  const openEditModal = (plan: any) => {
    setSelectedPlan(plan)
    setLocalValor(plan.valor)
    const sortedCitas = [...(plan.citas || [])]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(c => ({ ...c, hora_inicio: (c.hora_inicio || '08:00').slice(0, 5) }))
    setLocalCitas(sortedCitas)
    setIsEditModalOpen(true)
  }

  const handleAddLocalSession = () => {
    const lastCita = localCitas[localCitas.length - 1]
    const nextDate = new Date(lastCita?.fecha || new Date())
    nextDate.setDate(nextDate.getDate() + 7)
    
    const newCita = {
      id: 'temp-' + Math.random(),
      fecha: nextDate.toISOString().split('T')[0],
      hora_inicio: lastCita?.hora_inicio || '08:00',
      estado: 'pendiente',
      isNew: true
    }
    
    setLocalCitas([...localCitas, newCita])
    if (localCitas.length > 0) {
      const perSession = localValor / localCitas.length
      setLocalValor(Math.round(localValor + perSession))
    } else if (selectedPlan.pacientes?.valor_sesion) {
      setLocalValor(selectedPlan.pacientes.valor_sesion)
    }
  }

  const handleRemoveLocalSession = (id: string) => {
    if (localCitas.length <= 1) return
    const perSession = localValor / localCitas.length
    setLocalCitas(localCitas.filter(c => c.id !== id))
    setLocalValor(Math.max(0, Math.round(localValor - perSession)))
  }

  const handleUpdateCitaDate = (id: string, newDate: string) => {
    setLocalCitas(localCitas.map(c => c.id === id ? { ...c, fecha: newDate } : c))
  }

  const handleUpdateCitaHora = (id: string, hora: string) => {
    setLocalCitas(localCitas.map(c => c.id === id ? { ...c, hora_inicio: hora } : c))
  }

  const handleUpdateCitaFisioterapeuta = (id: string, fisio: string) => {
    setLocalCitas(localCitas.map(c => c.id === id ? { ...c, fisioterapeuta: fisio } : c))
  }

  const handleCompleteLocalSession = (id: string) => {
    setLocalCitas(localCitas.map(c => c.id === id ? { ...c, estado: 'completada' } : c))
  }

  // Revertir una sesión marcada como completada por error (vuelve a pendiente).
  const handleUncompleteLocalSession = (id: string) => {
    setLocalCitas(localCitas.map(c => c.id === id ? { ...c, estado: 'pendiente' } : c))
  }

  const handleDeletePlan = async () => {
    if (!planToDelete) return
    const { error } = await supabase.from('sesiones').delete().eq('id', planToDelete)
    setPlanToDelete(null)
    setIsEditModalOpen(false)
    if (error) {
      setNotification({ isOpen: true, type: 'error', title: 'Error al Eliminar', message: 'No se pudo eliminar el plan. Intenta de nuevo.' })
    } else {
      setNotification({ isOpen: true, type: 'success', title: 'Plan Eliminado', message: 'El plan y todas sus sesiones han sido eliminados.' })
      loadSesiones()
    }
  }

  const savePlanChanges = async () => {
    setSaving(true)
    try {
      // Mantener duracion_minutos sincronizado con el nº real de citas del plan
      // (se usa como nº de sesiones para repartir el valor y calcular comisiones/horas).
      const { error: sessionError } = await supabase
        .from('sesiones')
        .update({ valor: localValor, duracion_minutos: Math.max(60, localCitas.length * 60) })
        .eq('id', selectedPlan.id)

      if (sessionError) throw sessionError

      const originalIds = selectedPlan.citas.map((c: any) => c.id)
      const currentIds = localCitas.filter(c => !c.isNew).map(c => c.id)
      const toDelete = originalIds.filter((id: string) => !currentIds.includes(id))

      if (toDelete.length > 0) {
        const { error: delError } = await supabase.from('citas').delete().in('id', toDelete)
        if (delError) throw delError
      }

      const toUpdate = localCitas.filter(c => !c.isNew)
      for (const c of toUpdate) {
        await supabase.from('citas').update({
          fecha: c.fecha,
          hora_inicio: c.hora_inicio,
          estado: c.estado,
          fisioterapeuta: c.fisioterapeuta || 'Liliana',
          // Reiniciar avisos para que el cron notifique con la fecha/hora nueva
          notificado_1h: false,
          notificado_10m: false
        }).eq('id', c.id)
      }

      const toInsert = localCitas.filter(c => c.isNew).map(c => ({
        sesion_id: selectedPlan.id,
        paciente_id: selectedPlan.paciente_id,
        fecha: c.fecha,
        hora_inicio: c.hora_inicio,
        duracion_minutos: 60,
        estado: 'pendiente',
        fisioterapeuta: c.fisioterapeuta || 'Liliana'
      }))

      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('citas').insert(toInsert)
        if (insError) throw insError
      }

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Cambios Guardados',
        message: 'El plan y sus sesiones se han actualizado correctamente.'
      })
      setIsEditModalOpen(false)
      loadSesiones()
    } catch (err: any) {
      console.error(err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error al Guardar',
        message: 'Hubo un problema al actualizar el plan.'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && sesiones.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <ConfirmModal
        isOpen={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={handleDeletePlan}
        title="¿Eliminar plan completo?"
        message="Se eliminará el plan y todas sus sesiones programadas. Esta acción no se puede deshacer."
      />

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="font-display italic text-5xl mb-2 text-rose-950 flex items-center gap-3">
            <ClipboardPlus className="text-rose-400" size={36} />
            Planes
          </h2>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest italic">Tratamientos y Gestión de Sesiones</p>
          
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
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showHistory ? 'bg-rose-950 text-white shadow-xl shadow-rose-950/20' : 'bg-white text-rose-400 border border-rose-100 hover:bg-rose-50 shadow-sm'}`}
          >
            <Clock size={16} />
            {showHistory ? 'Ver Activos' : 'Ver Historial'}
          </button>
          <Link href="/sesiones/nueva" className="w-full sm:w-auto p-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={18} />
            <span>Nuevo Plan</span>
          </Link>
        </div>
      </header>

      <section className="metric-grid gap-4 sm:gap-6 mb-12">
        <div className="card metric-card border-none shadow-lg shadow-rose-100/20 bg-white/80 backdrop-blur-sm">
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Total Planes</span>
          <div className="text-xl font-black text-rose-950">{sesiones.length}</div>
        </div>
        
        <div className="card metric-card border-none shadow-lg shadow-rose-100/20 bg-white/80 backdrop-blur-sm">
          <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest block mb-1">Horas Clínicas</span>
          <div className="text-xl font-black text-rose-950">{totalHoras.toFixed(1)} h</div>
        </div>

        <div className="card metric-card border-none bg-emerald-50 text-emerald-600 shadow-xl shadow-rose-100/10">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Completadas</span>
          <div className="text-xl font-black">{completadasCount}</div>
        </div>

        <div className="card metric-card border-none bg-rose-50 text-rose-600 shadow-lg shadow-rose-100/10">
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">Pendientes</span>
          <div className="text-xl font-black">{pendientesCount}</div>
        </div>
      </section>

      <div className="space-y-4">
        {filtradas.map(s => {
          const p = s.pacientes as any
          const { completadas, total, esCompletado } = s
          
          return (
            <div key={s.id} className={`card group hover:shadow-xl transition-all border-2 border-transparent border-l-4 ${esCompletado ? 'hover:border-slate-100 border-l-slate-400 bg-slate-50/30' : 'hover:border-rose-100 border-l-rose-500'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs uppercase transition-colors ${esCompletado ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white group-hover:bg-rose-600'}`}>
                    {p ? getIniciales(p.nombre) : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-rose-950 text-xl tracking-tighter uppercase group-hover:text-rose-600 transition-colors">
                      {p?.nombre ?? 'Paciente eliminado'}
                    </div>
                    {total > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border transition-colors ${esCompletado ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                          {esCompletado ? 'Tratamiento Finalizado' : `Sesión ${completadas}/${total}`}
                        </span>
                        <div className="flex-1 w-24 h-1.5 bg-rose-50 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${esCompletado ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${(completadas/total)*100}%` }}></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sin citas enlazadas</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">{s.fecha}</span>
                       <span className="text-rose-100">/</span>
                       {!isLuisa ? (
                         <span className="text-sm font-black text-rose-900">{formatCOP(s.valor)}</span>
                       ) : (
                         <span className="text-sm font-black text-rose-400 uppercase tracking-widest text-[10px]">Plan Activo</span>
                       )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 self-end sm:self-center">
                  <span className={`badge !rounded-full !px-4 !py-1 !text-[10px] !italic ${s.estado_pago === 'pagado' ? 'badge-success !bg-emerald-50 !text-emerald-500' : 'badge-warning !bg-rose-50 !text-rose-500'}`}>
                    {s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openEditModal(s)}
                      className="text-[10px] font-black text-rose-400 hover:text-rose-600 bg-rose-50 px-4 py-2 rounded-xl transition-all uppercase tracking-[0.2em] border border-rose-100"
                    >
                      Editar
                    </button>
                    {!isLuisa && s.estado_pago === 'pendiente' && (
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
            </div>
          )
        })}
        {filtradas.length === 0 && (
          <div className="py-20 text-center rounded-[40px] bg-rose-50/50 border-2 border-dashed border-rose-100">
            <p className="text-rose-300 font-black text-xs uppercase tracking-widest italic">{showHistory ? 'No hay planes en el historial' : '✨ Empieza creando tu primer plan de tratamiento'}</p>
          </div>
        )}
      </div>

      {/* Expanded Edit Plan Modal */}
      {isEditModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-rose-950/40 backdrop-blur-md px-4 p-4">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
              <div className="px-8 py-6 border-b border-rose-50 flex justify-between items-center bg-rose-50/20">
                <div>
                   <h3 className="font-black text-xl text-rose-950 uppercase tracking-tighter">Gestionar Tratamiento</h3>
                   <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest">Paciente: {selectedPlan.pacientes?.nombre}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white shadow-sm text-rose-300 hover:text-rose-500 transition-colors"><X size={20} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                 {!isLuisa && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="bg-rose-50/50 p-6 rounded-[32px] border-4 border-white shadow-inner">
                        <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-3 block">Precio Total del Plan</label>
                        <div className="relative">
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-rose-200 font-black text-xl">$</span>
                          <input 
                            type="number"
                            value={localValor}
                            onChange={(e) => setLocalValor(Number(e.target.value))}
                            className="w-full bg-transparent border-none focus:ring-0 text-3xl font-black text-rose-600 tracking-tighter pl-6"
                          />
                        </div>
                      </div>
                      <div className="text-center md:text-left px-4">
                         <span className="text-[10px] font-black text-rose-950 uppercase block mb-1">Resumen</span>
                         <p className="text-xs text-rose-400 font-medium leading-relaxed">Puedes ajustar el precio libremente o según el número de sesiones.</p>
                      </div>
                   </div>
                 )}

                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-[10px] font-black text-rose-950 uppercase tracking-[0.2em]">Sesiones del Plan ({localCitas.length})</h4>
                       <button 
                         onClick={handleAddLocalSession}
                         className="flex items-center gap-2 text-[9px] font-black text-rose-600 bg-rose-50 px-4 py-2 rounded-full hover:bg-rose-100 transition-colors uppercase"
                       >
                          <Plus size={14} /> Agregar Sesión
                       </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                       {localCitas.map((cita, idx) => (
                         <div key={cita.id} className="flex items-center gap-4 p-4 bg-rose-50/30 rounded-[24px] border border-rose-100/50 group">
                            <div className="w-10 h-10 rounded-xl bg-white text-rose-500 flex items-center justify-center font-black text-xs shadow-sm">
                               {idx + 1}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-4">
                               <input
                                 type="date"
                                 value={cita.fecha}
                                 onChange={(e) => handleUpdateCitaDate(cita.id, e.target.value)}
                                 className="bg-white px-3 py-2 rounded-xl text-xs font-black text-rose-950 border border-rose-100 outline-none focus:border-rose-300 w-full"
                               />
                               <input
                                 type="time"
                                 value={cita.hora_inicio}
                                 onChange={(e) => handleUpdateCitaHora(cita.id, e.target.value)}
                                 className="bg-white px-3 py-2 rounded-xl text-xs font-black text-rose-950 border border-rose-100 outline-none focus:border-rose-300 w-full"
                               />
                               <select
                                 value={cita.fisioterapeuta || 'Liliana'}
                                 onChange={(e) => handleUpdateCitaFisioterapeuta(cita.id, e.target.value)}
                                 className="bg-white px-3 py-2 rounded-xl text-xs font-black text-rose-950 border border-rose-100 outline-none focus:border-rose-300 w-full cursor-pointer uppercase tracking-widest text-[9px]"
                               >
                                 <option value="Liliana">Liliana</option>
                                 <option value="Luisa">Luisa</option>
                               </select>
                               <div className="flex items-center justify-between gap-4">
                                 <div className="flex items-center gap-2">
                                   <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${cita.estado === 'completada' || cita.estado === 'completado' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-100 text-rose-500'}`}>
                                      {cita.estado}
                                   </span>
                                   {cita.estado !== 'completada' && cita.estado !== 'completado' ? (
                                      <button
                                        onClick={() => handleCompleteLocalSession(cita.id)}
                                        className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1"
                                      >
                                         <CheckCircle size={10} /> Completar
                                      </button>
                                   ) : (
                                      <button
                                        onClick={() => handleUncompleteLocalSession(cita.id)}
                                        className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors flex items-center gap-1"
                                      >
                                         <Minus size={10} /> Reabrir
                                      </button>
                                   )}
                                 </div>
                                 <button
                                   onClick={() => handleRemoveLocalSession(cita.id)}
                                   className="p-2 text-rose-200 hover:text-rose-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="p-8 bg-rose-50/30 border-t border-rose-50 space-y-3">
                 <div className="flex gap-4">
                    <button
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 py-4 bg-white text-rose-300 border border-rose-100 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-50 transition-all active:scale-95"
                    >
                       Cancelar
                    </button>
                    <button
                      onClick={savePlanChanges}
                      disabled={saving}
                      className="flex-[2] py-4 bg-rose-950 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-950/10 hover:bg-rose-900 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                       {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                       {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                 </div>
                 <button
                   onClick={() => setPlanToDelete(selectedPlan.id)}
                   className="w-full py-3 bg-red-50 text-red-400 border border-red-100 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-100 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                    <Trash2 size={14} /> Eliminar Plan Completo
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
