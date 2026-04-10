'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User, Phone, Stethoscope, DollarSign, Activity, FileText, ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'

export default function EditarPacientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patient, setPatient] = useState<any>(null)

  useEffect(() => {
    async function loadPatient() {
      try {
        const { data, error } = await supabase
          .from('pacientes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        setPatient(data)
      } catch (err: any) {
        console.error('Error al cargar paciente:', err)
        setError('No se pudo encontrar el paciente')
      } finally {
        setLoading(false)
      }
    }
    loadPatient()
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
    if (!confirm('¿Estás seguro de eliminar este paciente? Esta acción no se puede deshacer.')) return
    
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
    <div className="max-w-3xl mx-auto pb-12">
      <header className="topbar mb-6">
        <div>
          <h2 className="font-display italic text-4xl mb-1 flex items-center gap-3">
             <User className="text-indigo-500" size={32} />
             Editar Paciente
          </h2>
          <p className="text-slate-500 font-medium">Modifica la información de {patient.nombre}</p>
        </div>
        <Link href="/pacientes" className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 flex items-center gap-2">
          <ArrowLeft size={20} />
          <span className="hidden sm:inline font-bold text-sm">Cancelar</span>
        </Link>
      </header>

      <div className="card">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid-2">
            <div className="form-group">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <User size={16} className="text-indigo-400" />
                Nombre completo <span className="text-rose-500">*</span>
              </label>
              <input 
                name="nombre" 
                defaultValue={patient.nombre}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none text-slate-700" 
                type="text" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <Phone size={16} className="text-indigo-400" />
                Teléfono
              </label>
              <input 
                name="telefono" 
                defaultValue={patient.telefono}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none text-slate-700" 
                type="tel" 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
              <Stethoscope size={16} className="text-indigo-400" />
              Diagnóstico / Motivo de consulta <span className="text-rose-500">*</span>
            </label>
            <input 
              name="diagnostico" 
              defaultValue={patient.diagnostico}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none text-slate-700" 
              type="text" 
              required 
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <Activity size={16} className="text-indigo-400" />
                Estado del paciente
              </label>
              <select 
                name="estado" 
                defaultValue={patient.estado}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none bg-white text-slate-700 font-medium"
              >
                <option value="activo">Activo</option>
                <option value="en_pausa">En pausa</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
              <FileText size={16} className="text-indigo-400" />
              Notas de evolución y antecedentes
            </label>
            <textarea 
              name="notas_iniciales" 
              defaultValue={patient.notas_iniciales}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none bg-white text-slate-700 font-medium min-h-[120px]" 
              placeholder="Ej: Paciente con dolor lumbar crónico..."
            ></textarea>
          </div>

          <div className="flex justify-between items-center pt-8 mt-6 border-t border-slate-100">
            <button 
              type="button" 
              onClick={handleDelete}
              className="px-4 py-2 text-rose-500 font-bold hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} />
              Eliminar Paciente
            </button>
            <div className="flex gap-3">
              <Link href="/pacientes" className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</Link>
              <button 
                type="submit" 
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
