'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User, Phone, Stethoscope, DollarSign, Activity, FileText, ArrowLeft, Save, Loader2, Trash2, Calendar, CheckCircle2, Clock } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export default function EditarPacientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patient, setPatient] = useState<any>(null)
  const [sesiones, setSesiones] = useState<any[]>([])
  
  // Confirm Modal State
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: pData, error: pError } = await supabase
          .from('pacientes')
          .select('*')
          .eq('id', id)
          .single()

        if (pError) throw pError
        setPatient(pData)

        const { data: sData, error: sError } = await supabase
          .from('sesiones')
          .select('*')
          .eq('paciente_id', id)
          .order('fecha', { ascending: false })

        if (sError) throw sError
        setSesiones(sData || [])

      } catch (err: any) {
        console.error('Error al cargar datos:', err)
        setError('No se pudo encontrar el paciente o su historial')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const updates = {
      nombre: formData.get('nombre') as string,
      telefono: formData.get('telefono') as string,
      diagnostico: formData.get('diagnostico') as string,
      estado: formData.get('estado') as string,
      notas_iniciales: formData.get('notas_iniciales') as string,
    }

    try {
      const { error: updateError } = await supabase
        .from('pacientes')
        .update(updates)
        .eq('id', id)

      if (updateError) throw updateError

      router.push('/pacientes')
      router.refresh()
    } catch (err: any) {
      console.error('Error al actualizar:', err)
      setError(err.message || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const { error: deleteError } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      window.location.href = '/pacientes'
    } catch (err: any) {
      setError('No se pudo eliminar el paciente')
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
      
      // Update local state
      setSesiones(prev => prev.filter(s => s.id !== sessionId))
    } catch (err: any) {
      console.error('Error al eliminar sesión:', err)
      setError('No se pudo eliminar la sesión')
    }
  }

  // Session deletion state
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Cargando datos del paciente...</p>
      </div>
    )
  }

  if (error && !patient) {
    return (
      <div className="text-center py-20">
        <p className="text-rose-500 font-bold mb-4">{error}</p>
        <Link href="/pacientes" className="btn-primary inline-flex items-center gap-2">
           <ArrowLeft size={20} /> Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4">
      <header className="topbar mb-10">
        <div className="flex items-center gap-4">
          <Link href="/pacientes" className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm group">
            <ArrowLeft size={20} className="text-slate-400 group-hover:text-indigo-600" />
          </Link>
          <div>
            <h2 className="font-display italic text-5xl mb-1 text-slate-900">Perfil del Paciente</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">Gestión exhaustiva de paciente</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Edit Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card shadow-2xl shadow-slate-200/50 p-8">
             <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-50">
               <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl"><User size={20} /></div>
               <h3 className="text-slate-900 font-black uppercase text-sm tracking-widest">Información Personal</h3>
             </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nombre completo</label>
                  <input 
                    name="nombre" 
                    defaultValue={patient.nombre}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none font-bold text-slate-900 bg-slate-50/30 transition-all placeholder:text-slate-200"
                    type="text" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Teléfono</label>
                  <input 
                    name="telefono" 
                    defaultValue={patient.telefono}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none font-bold text-slate-900 bg-slate-50/30 transition-all"
                    type="tel" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Diagnóstico Inicial</label>
                <input 
                  name="diagnostico" 
                  defaultValue={patient.diagnostico}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none font-bold text-slate-900 bg-slate-50/30 transition-all" 
                  type="text" 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Estado</label>
                  <select 
                    name="estado" 
                    defaultValue={patient.estado}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none bg-white text-slate-700 font-bold appearance-none cursor-pointer"
                  >
                    <option value="activo">Activo</option>
                    <option value="en_pausa">En pausa</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Antecedentes Médicos</label>
                <textarea 
                  name="notas_iniciales" 
                  defaultValue={patient.notas_iniciales}
                  className="w-full px-5 py-4 rounded-[24px] border-2 border-slate-50 focus:border-indigo-500 outline-none bg-slate-50/30 text-slate-700 font-medium min-h-[140px]" 
                ></textarea>
              </div>

              <div className="flex justify-between items-center pt-8 border-t border-slate-50">
                <button 
                  type="button" 
                  onClick={() => setConfirmDelete(true)}
                  className="text-[10px] font-black text-rose-300 hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-2 group"
                >
                  <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                  Eliminar Paciente
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-3xl shadow-xl shadow-slate-100 flex items-center gap-3 disabled:opacity-50 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Sessions History */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl"><Calendar size={20} /></div>
            <h3 className="text-slate-900 font-black uppercase text-sm tracking-widest">Historial de Sesiones</h3>
          </div>
          
          <div className="space-y-3 pb-8 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
            {sesiones.map(s => (
              <div key={s.id} className="card p-5 hover:shadow-xl transition-all border border-slate-50 bg-white group relative">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.estado_pago === 'pagado' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {s.estado_pago === 'pagado' ? <CheckCircle2 size={24} /> : <DollarSign size={24} />}
                      </div>
                      <div>
                          <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{new Date(s.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatCOP(s.valor)} — <span className={s.estado_pago === 'pagado' ? 'text-emerald-600' : 'text-rose-500'}>{s.estado_pago}</span></div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSessionToDelete(s.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Eliminar sesión"
                    >
                      <Trash2 size={18} />
                    </button>
                </div>
              </div>
            ))}
            {sesiones.length === 0 && (
              <div className="py-24 text-center card bg-slate-50/50 border-dashed border-slate-200">
                  <Activity className="mx-auto mb-4 text-slate-200" size={40} />
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Sin sesiones registradas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar Paciente?"
        message={`¿Estás seguro de que deseas eliminar a ${patient.nombre}? Esta acción borrará todo su historial médico y financiero de forma permanente.`}
        confirmText="Sí, Eliminar"
      />

      <ConfirmModal 
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
        title="¿Eliminar Sesión?"
        message="¿Estás seguro de que deseas eliminar este registro de sesión? El balance financiero del paciente se actualizará automáticamente."
        confirmText="Sí, Eliminar Sesión"
      />
    </div>
  )
}
