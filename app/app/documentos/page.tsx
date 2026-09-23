'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Loader2, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateEvaluacionPDF } from '@/lib/generate-evaluacion-pdf'
import { generateEvaluacionInicialPDF } from '@/lib/generate-evaluacion-inicial-pdf'
import { PERFILES_FISIO, type Fisioterapeuta, type PerfilFisio } from '@/lib/utils'

export default function PatientDocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [patient, setPatient] = useState<any>(null)
  const [professional, setProfessional] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('patient_profiles').select('paciente_id').eq('id', user.id).single()
      if (!profile?.paciente_id) { setLoading(false); return }
      const [patientResult, evalResult, professionalResult] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', profile.paciente_id).single(),
        supabase.from('evaluaciones').select('*').eq('paciente_id', profile.paciente_id).eq('estado', 'completada').order('updated_at', { ascending: false }),
        supabase.from('ajustes_profesional').select('*').limit(1).maybeSingle(),
      ])
      if (evalResult.error) setError('No pudimos cargar tus documentos.')
      setPatient(patientResult.data)
      setEvaluaciones(evalResult.data || [])
      setProfessional(professionalResult.data || {})
      setLoading(false)
    }
    load()
  }, [])

  async function loadSignature(profile: PerfilFisio) {
    if (!profile.firma) return null
    try {
      const image = new Image()
      image.src = encodeURI(profile.firma)
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) return null
      context.drawImage(image, 0, 0)
      return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
    } catch { return null }
  }

  async function download(evaluation: any) {
    if (!patient) return
    const physio = (evaluation.fisioterapeuta || 'Liliana') as Fisioterapeuta
    const clinician = PERFILES_FISIO[physio] || PERFILES_FISIO.Liliana
    const signature = await loadSignature(clinician)
    const contact = {
      nombre_completo: professional?.nombre_completo || clinician.nombre_completo,
      registro_profesional: professional?.registro_profesional || clinician.registro_profesional,
      especialidad: professional?.especialidad || clinician.especialidad,
      telefono: professional?.telefono || '',
      email: professional?.email || '',
      direccion: professional?.direccion || '',
    }
    if (evaluation.tipo === 'inicial') {
      const data = evaluation.datos_iniciales || {}
      generateEvaluacionInicialPDF(data, patient, contact, {
        nombre_completo: clinician.nombre_completo,
        especialidad: clinician.especialidad,
        registro_profesional: clinician.registro_profesional,
        firma: signature,
      })
    } else {
      generateEvaluacionPDF({ ...evaluation, nombre: patient.nombre, edad: patient.edad, telefono: patient.telefono }, contact, {
        nombre_completo: clinician.nombre_completo,
        especialidad: clinician.especialidad,
        registro_profesional: clinician.registro_profesional,
        firma: signature,
      })
    }
  }

  if (loading) return <div className="mt-20 p-8 text-center font-bold text-rose-300"><Loader2 className="mx-auto mb-3 animate-spin" />Cargando documentos…</div>

  return <main className="px-6 py-8">
    <h1 className="font-display text-3xl italic tracking-tight text-rose-950">Mis documentos</h1>
    <p className="mt-2 text-sm text-rose-400">Aquí aparecen tu valoración y re-evaluaciones cuando estén listas.</p>
    {error && <p className="mt-5 rounded-2xl bg-rose-100 p-4 text-sm font-bold text-rose-700">{error}</p>}
    {evaluaciones.length === 0 ? <div className="mt-8 rounded-3xl border border-rose-100 bg-white p-6 text-center shadow-sm">
      <FileText className="mx-auto mb-3 text-rose-300" size={30} />
      <p className="font-bold text-rose-950">Aún no hay documentos disponibles</p>
      <p className="mt-1 text-xs text-rose-400">Te avisaremos cuando tu fisioterapeuta los finalice.</p>
    </div> : <div className="mt-6 space-y-3">{evaluaciones.map(evaluation => <article key={evaluation.id} className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-rose-50 p-3 text-rose-500"><FileText size={20} /></div>
        <div className="min-w-0 flex-1"><h2 className="font-black text-rose-950">{evaluation.tipo === 'inicial' ? 'Valoración fisioterapéutica' : 'Re-evaluación'}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-rose-400"><CalendarDays size={13} />{evaluation.fecha_valoracion || evaluation.updated_at?.slice(0, 10)}</p>
        </div></div>
      <button onClick={() => download(evaluation)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white"><Download size={15} /> Descargar PDF</button>
    </article>)}</div>}
  </main>
}
