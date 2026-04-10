'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserPlus, ArrowLeft, User, Phone, Stethoscope, Activity, FileText, Loader2, CheckCircle } from 'lucide-react'
import NotificationModal from '@/components/ui/NotificationModal'

export default function NuevoPacientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Notification State
  const [notification, setNotification] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string}>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const nombre = formData.get('nombre') as string
    const telefono = formData.get('telefono') as string
    const diagnostico = formData.get('diagnostico') as string
    const edad = parseInt(formData.get('edad') as string)
    const estado = formData.get('estado') as string
    const notas_iniciales = formData.get('notas_iniciales') as string
    
    const tipoDoc = formData.get('tipo_documento') as string
    const numDoc = formData.get('documento_numero') as string
    const documento_identidad = numDoc ? `${tipoDoc} ${numDoc}` : ''
    
    const sexo = formData.get('sexo') as string

    try {
      const { error: insertError } = await supabase
        .from('pacientes')
        .insert([{ 
          nombre, 
          telefono, 
          edad,
          diagnostico, 
          estado,
          notas_iniciales,
          documento_identidad,
          sexo
        }])

      if (insertError) throw insertError

      setNotification({
        isOpen: true,
        type: 'success',
        title: '¡Paciente Registrado!',
        message: 'El nuevo paciente ha sido agregado exitosamente.'
      })
      
      setTimeout(() => {
        router.push('/pacientes')
        router.refresh()
      }, 2000)
    } catch (err: any) {
      console.error('Error al crear paciente:', err)
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Error de Registro',
        message: err.message || 'No pudimos guardar el paciente.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <NotificationModal 
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({...prev, isOpen: false}))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      <header className="topbar">
        <div>
          <h2 className="font-display italic text-4xl mb-1 flex items-center gap-3">
            <UserPlus className="text-indigo-500" size={32} />
            Nuevo Paciente
          </h2>
          <p className="text-slate-500 font-medium">Registra un paciente en el sistema</p>
        </div>
        <Link href="/pacientes" className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500 flex items-center gap-2">
          <ArrowLeft size={20} />
          <span className="hidden sm:inline font-bold text-sm">Volver</span>
        </Link>
      </header>

      <div className="card shadow-2xl shadow-indigo-50/50">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8 pb-6 border-b border-slate-50 flex items-center gap-2">
          Información básica del paciente
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Nombre completo <span className="text-rose-500">*</span>
              </label>
              <input name="nombre" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-bold" type="text" placeholder="Ej: Duvan" required />
            </div>
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Teléfono de contacto
              </label>
              <input name="telefono" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-bold" type="tel" placeholder="300 000 0000" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Documento de identidad
              </label>
              <div className="flex gap-2">
                <select name="tipo_documento" className="w-[100px] px-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-white text-slate-700 font-bold shadow-sm">
                  <option value="CC">CC</option>
                  <option value="TI">TI</option>
                  <option value="RC">RC</option>
                  <option value="CE">CE</option>
                </select>
                <input name="documento_numero" className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-bold" type="text" placeholder="123456789" />
              </div>
            </div>
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Sexo
              </label>
              <select name="sexo" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-white text-slate-700 font-bold shadow-sm">
                <option value="">Seleccionar...</option>
                <option value="M">Masculino (M)</option>
                <option value="F">Femenino (F)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
              Diagnóstico principal <span className="text-rose-500">*</span>
            </label>
            <input name="diagnostico" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-bold" type="text" placeholder="Ej: Dolor lumbar crónico" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Estado inicial
              </label>
              <select name="estado" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-white text-slate-700 font-bold shadow-sm">
                <option value="activo">Activo</option>
                <option value="en_pausa">En pausa</option>
              </select>
            </div>
            <div className="form-group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                Edad (Años)
              </label>
              <input name="edad" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-800 font-bold" type="number" placeholder="Ej: 25" />
            </div>
          </div>

          <div className="form-group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
              Observaciones y Antecedentes
            </label>
            <textarea 
              name="notas_iniciales" 
              className="w-full px-6 py-4 rounded-[28px] border-2 border-slate-100 focus:border-indigo-500 outline-none bg-slate-50 text-slate-700 font-medium min-h-[140px]" 
              placeholder="Ej: Paciente con antecedentes de cirugía previa..."
            ></textarea>
          </div>

          <div className="flex justify-end items-center gap-6 pt-10 border-t border-slate-100">
            <Link href="/pacientes" className="font-black text-xs text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-widest">Cancelar</Link>
            <button 
              type="submit" 
              disabled={loading}
              className="px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-3xl shadow-xl shadow-slate-100 flex items-center gap-3 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
              {loading ? 'REGISTRANDO...' : 'REGISTRAR PACIENTE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
