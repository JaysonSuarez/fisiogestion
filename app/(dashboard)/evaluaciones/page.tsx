'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, Search, Loader2, ArrowRight, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useRouter } from 'next/navigation'

export default function EvaluacionesIndexPage() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [evalDeleting, setEvalDeleting] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [evalRes, pacRes] = await Promise.all([
        supabase
          .from('evaluaciones')
          .select('*, pacientes(nombre)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('pacientes')
          .select('id, nombre, documento_identidad')
          .eq('estado', 'activo')
          .order('nombre')
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
    <div className="max-w-6xl mx-auto pb-20 px-4">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-rose-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-rose-200">
            <FileText size={28} className="text-white" />
          </div>
          <div>
            <h2 className="font-display italic text-4xl sm:text-5xl text-rose-950 tracking-tighter mb-1">Evaluaciones</h2>
            <p className="text-rose-400 font-bold text-xs uppercase tracking-widest">Historia Clínica Fisioterapéutica</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Create New / Select Patient */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-rose-100/40 border border-rose-50">
            <h3 className="text-sm font-black text-rose-950 uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Plus size={16} className="text-rose-500" />
              Nueva Evaluación
            </h3>
            
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={16} />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
              />
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {pacientesFiltrados.length === 0 ? (
                <p className="text-center text-rose-300 text-xs py-4">No se encontraron pacientes activos.</p>
              ) : (
                pacientesFiltrados.map(paciente => (
                  <Link
                    key={paciente.id}
                    href={`/pacientes/${paciente.id}/evaluacion`}
                    className="flex justify-between items-center p-4 rounded-2xl border border-rose-50 hover:border-rose-200 hover:bg-rose-50 transition-all group"
                  >
                    <div>
                      <div className="font-bold text-rose-950 text-sm">{paciente.nombre}</div>
                      {paciente.documento_identidad && (
                        <div className="text-[10px] text-rose-400 font-black uppercase tracking-widest mt-1">
                          CC: {paciente.documento_identidad}
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-rose-300 group-hover:text-rose-600 group-hover:bg-rose-100 transition-all">
                      <ArrowRight size={14} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Evaluations */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-rose-100/40 border border-rose-50">
            <h3 className="text-sm font-black text-rose-950 uppercase tracking-tighter mb-6">
              Evaluaciones Recientes
            </h3>
            
            <div className="space-y-4">
              {evaluaciones.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto text-rose-200 mb-3" size={48} />
                  <p className="text-rose-400 font-bold">No hay evaluaciones registradas aún.</p>
                </div>
              ) : (
                evaluaciones.map(ev => (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[24px] border border-rose-100 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-100 transition-all bg-white group relative overflow-hidden"
                  >
                    <div 
                      className="flex items-center gap-4 flex-1 cursor-pointer"
                      onClick={() => router.push(`/pacientes/${ev.paciente_id}/evaluacion`)}
                    >
                      <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-rose-950 truncate">{ev.pacientes?.nombre || 'Paciente Desconocido'}</h4>
                        <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                          <span>{new Date(ev.fecha_valoracion + 'T12:00').toLocaleDateString('es-CO')}</span>
                          {ev.motivo_consulta && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-rose-200"></span>
                              <span className="truncate max-w-[150px] sm:max-w-[200px]">{ev.motivo_consulta}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setEvalDeleting(ev.id)
                        }}
                        className="p-3 text-rose-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Eliminar evaluación"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => router.push(`/pacientes/${ev.paciente_id}/evaluacion`)}
                        className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 hidden sm:block"
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
