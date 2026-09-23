'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, getCachedUser } from '@/lib/supabase'
import { FileText, Plus, Search, Loader2, ArrowRight, Trash2, RefreshCw } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useRouter } from 'next/navigation'
import { getFisioDeEmail, esDuena } from '@/lib/utils'

export default function EvaluacionesIndexPage() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [evalDeleting, setEvalDeleting] = useState<string | null>(null)
  const router = useRouter()
  const routeFor = (evaluation: any) => evaluation.tipo === 'inicial'
    ? `/pacientes/${evaluation.paciente_id}/evaluacion-inicial`
    : `/pacientes/${evaluation.paciente_id}/evaluacion`

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const user = await getCachedUser()
      const fisio = getFisioDeEmail(user?.email)

      let query = supabase
        .from('evaluaciones')
        .select('*, pacientes(nombre)')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!esDuena(fisio)) {
        query = query.eq('fisioterapeuta', fisio)
      }

      let pacQuery = supabase
        .from('pacientes')
        .select('id, nombre, documento_identidad')
        .eq('estado', 'activo')
        .order('nombre')

      if (!esDuena(fisio)) {
        pacQuery = pacQuery.eq('fisioterapeuta', fisio)
      }

      const [evalRes, pacRes] = await Promise.all([
        query,
        pacQuery
      ])

      if (evalRes.data) setEvaluaciones(evalRes.data)
      if (pacRes.data) setPacientes(pacRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteEvaluation() {
    if (!evalDeleting) return
    try {
      const { error } = await supabase
        .from('evaluaciones')
        .delete()
        .eq('id', evalDeleting)
      
      if (error) throw error
      
      setEvaluaciones(prev => prev.filter(e => e.id !== evalDeleting))
      setEvalDeleting(null)
    } catch (err) {
      console.error(err)
      alert('Error al eliminar evaluación')
    }
  }

  const pacientesFiltrados = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.documento_identidad && p.documento_identidad.includes(searchTerm))
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-rose-500 mb-4" size={40} />
        <p className="text-rose-300 font-bold text-xs uppercase tracking-widest">Cargando evaluaciones…</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-rose-600 rounded-[22px] flex items-center justify-center shadow-xl shadow-rose-200">
            <FileText size={28} className="text-white" />
          </div>
          <div>
            <h2 className="font-display italic text-5xl text-rose-950 tracking-tighter mb-1">Evaluaciones</h2>
            <p className="text-rose-400 font-bold text-xs uppercase tracking-widest italic">Historia Clínica Fisioterapéutica</p>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Create New / Select Patient */}
        <div className="min-w-0 lg:col-span-1 space-y-8">
          <div className="bg-white/70 backdrop-blur-md rounded-[40px] p-8 shadow-xl shadow-rose-100/20 border border-rose-50 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xs font-black text-rose-950 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Plus size={16} className="text-rose-400" />
                Nueva Evaluación
              </h3>
              
              <div className="relative mb-6 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-rose-50/50 border border-rose-100 rounded-[20px] pl-12 pr-4 py-4 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                />
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {pacientesFiltrados.length === 0 ? (
                  <p className="text-center text-rose-300 text-[10px] font-black uppercase tracking-widest py-8 italic">No hay resultados ✨</p>
                ) : (
                  pacientesFiltrados.map(paciente => (
                    <div
                      key={paciente.id}
                      className="p-5 rounded-[24px] border border-rose-50 hover:border-rose-200 hover:bg-white hover:shadow-lg hover:shadow-rose-100/50 transition-all group"
                    >
                      <div>
                        <div className="font-black text-rose-950 text-sm uppercase tracking-tight">{paciente.nombre}</div>
                        {paciente.documento_identidad && (
                          <div className="text-[9px] text-rose-300 font-black uppercase tracking-widest mt-1">
                            CC: {paciente.documento_identidad}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Link href={`/pacientes/${paciente.id}/evaluacion-inicial`} className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2.5 text-[8px] font-black uppercase tracking-wider text-white transition hover:bg-rose-700">
                          <ArrowRight size={13} /> Inicial
                        </Link>
                        <Link href={`/pacientes/${paciente.id}/evaluacion`} className="flex items-center justify-center gap-1 rounded-xl bg-rose-50 px-3 py-2.5 text-[8px] font-black uppercase tracking-wider text-rose-600 transition hover:bg-rose-100">
                          <RefreshCw size={12} /> Re-evaluación
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Evaluations */}
        <div className="min-w-0 lg:col-span-2">
          <div className="bg-white/80 backdrop-blur-md rounded-[40px] p-8 sm:p-10 shadow-xl shadow-rose-100/20 border border-rose-50">
            <h3 className="text-xs font-black text-rose-400 uppercase tracking-[0.2em] mb-8">
              Evaluaciones Recientes
            </h3>
            
            <div className="space-y-5">
              {evaluaciones.length === 0 ? (
                <div className="text-center py-20 bg-rose-50/20 rounded-[32px] border-2 border-dashed border-rose-100">
                  <FileText className="mx-auto text-rose-100 mb-4" size={56} />
                  <p className="text-rose-300 font-black text-xs uppercase tracking-widest italic">El historial está impecable ✨</p>
                </div>
              ) : (
                evaluaciones.map(ev => (
                  <div
                    key={ev.id}
                    className="flex min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-[32px] border border-rose-50 hover:border-rose-200 hover:bg-white hover:shadow-xl hover:shadow-rose-100/30 transition-all bg-white/50 group"
                  >
                    <div 
                      className="flex min-w-0 flex-1 items-center gap-5 cursor-pointer"
                      onClick={() => router.push(routeFor(ev))}
                    >
                      <div className="w-14 h-14 bg-rose-950 text-rose-100 rounded-2xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all shrink-0 shadow-lg">
                        <FileText size={22} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-rose-950 truncate uppercase tracking-tight text-lg">{ev.pacientes?.nombre || 'Paciente Desconocido'}</h4>
                        <div className="mt-2 min-w-0 space-y-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-rose-300 font-black uppercase tracking-widest">
                            <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600">{ev.tipo === 'inicial' ? 'Evaluación inicial' : 'Re-evaluación'}</span>
                            {ev.estado === 'borrador' && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-600">Borrador</span>}
                            <span className="text-rose-500">{new Date(ev.fecha_valoracion + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</span>
                          </div>
                          {ev.motivo_consulta && (
                            <p className="min-w-0 max-w-full break-words text-xs leading-relaxed text-slate-500 italic line-clamp-2">
                              {ev.motivo_consulta}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-rose-50">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setEvalDeleting(ev.id)
                        }}
                        className="w-12 h-12 flex items-center justify-center text-rose-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Eliminar evaluación"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button 
                        onClick={() => router.push(routeFor(ev))}
                        className="px-6 py-3 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-950 hover:text-white transition-all active:scale-95"
                      >
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal 
        isOpen={!!evalDeleting}
        onClose={() => setEvalDeleting(null)}
        onConfirm={handleDeleteEvaluation}
        title="¿Eliminar Evaluación?"
        message="Esta acción no se puede deshacer. Se borrará permanentemente la evaluación seleccionada de la historia clínica."
      />
    </div>
  )
}
