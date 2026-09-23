'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Activity, ArrowLeft, CheckCircle2, ClipboardList, Download,
  FileText, HeartPulse, Loader2, Save, Stethoscope, User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AITextarea } from '@/components/ui/AITextarea'
import { supabase, getCachedUser } from '@/lib/supabase'
import { esDuena, FISIOTERAPEUTAS, getFisioDeEmail, PERFILES_FISIO, ENTIDAD } from '@/lib/utils'
import type { Fisioterapeuta, Paciente } from '@/types'
import type { PerfilFisio } from '@/lib/utils'
import {
  CLASIFICACIONES_FUNCIONALES,
  createEmptyEvaluacionInicial,
  splitPatientName,
  getDatosProfesional,
  type EvaluacionInicialForm,
} from '@/lib/evaluacion-inicial'
import { generateEvaluacionInicialPDF } from '@/lib/generate-evaluacion-inicial-pdf'
import { notifyPatientEvaluationReady } from '@/lib/notify-patient-evaluation'

async function loadFirma(perfil: PerfilFisio) {
  if (!perfil.firma) return null
  try {
    const img = new Image()
    img.src = encodeURI(perfil.firma)
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

function Section({ number, title, icon: Icon, children }: {
  number: number
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[30px] border border-rose-100 bg-white p-5 sm:p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b border-rose-50 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600 text-sm font-black text-white shadow-lg shadow-rose-200">{number}</span>
        <Icon size={18} className="text-rose-400" />
        <h3 className="text-sm font-black uppercase tracking-wider text-rose-950">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, value, onChange, type = 'text', options, placeholder, readOnly = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  options?: { value: string; label: string }[]
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">{label}</span>
      {options ? (
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={readOnly}
          className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm font-bold text-rose-950 outline-none transition focus:border-rose-300 disabled:opacity-60"
        >
          <option value="">Seleccione…</option>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full rounded-2xl border border-rose-100 px-4 py-3 text-sm font-bold text-rose-950 outline-none transition ${
            readOnly ? 'bg-rose-100/40 text-rose-900 cursor-not-allowed select-none' : 'bg-rose-50/50 focus:border-rose-300'
          }`}
        />
      )}
    </label>
  )
}

export default function EvaluacionInicialPage() {
  const params = useParams()
  const pacienteId = params.id as string
  const draftKey = `fisiogestion:evaluacion:${pacienteId}:inicial`
  const hydratedRef = useRef(false)
  const dirtyRef = useRef(false)
  const autosaveTimeoutRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patient, setPatient] = useState<Paciente | null>(null)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [profesional, setProfesional] = useState<any>(null)
  const [fisioActiva, setFisioActiva] = useState<Fisioterapeuta>('Liliana')
  const [selectedFisio, setSelectedFisio] = useState<Fisioterapeuta>('Liliana')
  const [form, setForm] = useState<EvaluacionInicialForm>(createEmptyEvaluacionInicial)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const update = (field: keyof EvaluacionInicialForm, value: string) => {
    dirtyRef.current = true
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const handleFisioChange = (newFisio: Fisioterapeuta) => {
    dirtyRef.current = true
    setSelectedFisio(newFisio)
    const prof = getDatosProfesional(newFisio)
    setForm(previous => ({
      ...previous,
      ...prof,
      organismo_elaborador: ENTIDAD,
    }))
  }

  useEffect(() => {
    async function loadData() {
      try {
        const user = await getCachedUser()
        const fisio = getFisioDeEmail(user?.email)
        setFisioActiva(fisio)

        const [patientResult, evaluationResult, professionalResult] = await Promise.all([
          supabase.from('pacientes').select('*').eq('id', pacienteId).single(),
          supabase.from('evaluaciones').select('*').eq('paciente_id', pacienteId).eq('tipo', 'inicial').maybeSingle(),
          supabase.from('ajustes_profesional').select('*').limit(1).maybeSingle(),
        ])

        const currentPatient = patientResult.data as Paciente | null
        const remote = evaluationResult.data
        setPatient(currentPatient)
        setEvaluacion(remote)
        setProfesional(professionalResult.data)

        let targetFisio: Fisioterapeuta = fisio
        if (remote?.datos_iniciales && typeof remote.datos_iniciales === 'object') {
          if (FISIOTERAPEUTAS.includes(remote.fisioterapeuta)) {
            targetFisio = remote.fisioterapeuta
          }
        }
        setSelectedFisio(targetFisio)

        let nextForm = createEmptyEvaluacionInicial(targetFisio)
        if (currentPatient) {
          nextForm = {
            ...nextForm,
            ...splitPatientName(currentPatient.nombre),
            edad: currentPatient.edad ? String(currentPatient.edad) : '',
            documento_identidad: currentPatient.documento_identidad || '',
            sexo: currentPatient.sexo || '',
          }
        }
        if (remote?.datos_iniciales && typeof remote.datos_iniciales === 'object') {
          nextForm = { ...nextForm, ...remote.datos_iniciales }
          if (!nextForm.medico_primer_nombre) {
            const prof = getDatosProfesional(targetFisio)
            nextForm = { ...nextForm, ...prof }
          }
          nextForm.organismo_elaborador = ENTIDAD
        }

        const local = localStorage.getItem(draftKey)
        if (local) {
          try {
            const parsed = JSON.parse(local)
            const remoteDate = remote?.autosave_at || remote?.updated_at || ''
            if (parsed?.form && (!remoteDate || parsed.savedAt > remoteDate)) {
              nextForm = { ...nextForm, ...parsed.form }
              dirtyRef.current = true
              if (FISIOTERAPEUTAS.includes(parsed.selectedFisio)) {
                targetFisio = parsed.selectedFisio
                setSelectedFisio(targetFisio)
              }
              if (!nextForm.medico_primer_nombre) {
                const prof = getDatosProfesional(targetFisio)
                nextForm = { ...nextForm, ...prof }
              }
              nextForm.organismo_elaborador = ENTIDAD
            }
          } catch {
            localStorage.removeItem(draftKey)
          }
        }

        setForm(nextForm)
        hydratedRef.current = true
      } catch (error) {
        console.error('No se pudo cargar la evaluación inicial:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [draftKey, pacienteId])

  useEffect(() => {
    if (!hydratedRef.current || loading || !dirtyRef.current) return
    const savedAt = new Date().toISOString()
    localStorage.setItem(draftKey, JSON.stringify({ form, selectedFisio, savedAt }))
    setDraftStatus('saving')

    autosaveTimeoutRef.current = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('evaluaciones')
        .upsert({
          paciente_id: pacienteId,
          tipo: 'inicial',
          estado: 'borrador',
          fisioterapeuta: selectedFisio,
          fecha_valoracion: form.fecha_valoracion,
          documento_identidad: form.documento_identidad || null,
          sexo: form.sexo || null,
          motivo_consulta: form.objetivo || null,
          tipo_intervencion: form.plan_tratamiento || null,
          datos_iniciales: { ...form, organismo_elaborador: ENTIDAD },
          autosave_at: savedAt,
          updated_at: savedAt,
        }, { onConflict: 'paciente_id,tipo' })
        .select()
        .single()

      if (error) {
        console.error('No se pudo sincronizar el borrador de evaluación inicial:', error)
        setDraftStatus('error')
        return
      }
      setEvaluacion(data)
      dirtyRef.current = false
      setDraftStatus('saved')
    }, 900)

    return () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current)
    }
  }, [draftKey, form, loading, pacienteId, selectedFisio])

  useEffect(() => {
    const receiveDraft = (event: StorageEvent) => {
      if (event.key !== draftKey || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue)
        if (parsed?.form) {
          dirtyRef.current = true
          setForm(previous => ({ ...previous, ...parsed.form }))
        }
      } catch {
        // Otra pestaña puede escribir mientras el valor cambia; se conserva el estado actual.
      }
    }
    window.addEventListener('storage', receiveDraft)
    return () => window.removeEventListener('storage', receiveDraft)
  }, [draftKey])

  async function handleSave() {
    if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current)
    setSaving(true)
    try {
      const wasCompleted = evaluacion?.estado === 'completada'
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('evaluaciones')
        .upsert({
          paciente_id: pacienteId,
          tipo: 'inicial',
          estado: 'completada',
          fisioterapeuta: selectedFisio,
          fecha_valoracion: form.fecha_valoracion,
          documento_identidad: form.documento_identidad || null,
          sexo: form.sexo || null,
          motivo_consulta: form.objetivo || null,
          tipo_intervencion: form.plan_tratamiento || null,
          datos_iniciales: { ...form, organismo_elaborador: ENTIDAD },
          autosave_at: now,
          updated_at: now,
        }, { onConflict: 'paciente_id,tipo' })
        .select()
        .single()
      if (error) throw error

      await supabase.from('pacientes').update({
        documento_identidad: form.documento_identidad || null,
        sexo: form.sexo || null,
        edad: form.edad ? Number(form.edad) : null,
      }).eq('id', pacienteId)

      setEvaluacion(data)
      localStorage.removeItem(draftKey)
      dirtyRef.current = false
      setDraftStatus('saved')
      if (!wasCompleted) await notifyPatientEvaluationReady(pacienteId, 'inicial')
    } catch (error) {
      console.error('No se pudo finalizar la evaluación inicial:', error)
      setDraftStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePDF() {
    if (!patient || !profesional) return
    const perfil = PERFILES_FISIO[selectedFisio]
    generateEvaluacionInicialPDF(
      { ...form, organismo_elaborador: ENTIDAD },
      patient,
      profesional,
      {
        nombre_completo: perfil.nombre_completo,
        especialidad: perfil.especialidad,
        registro_profesional: perfil.registro_profesional,
        firma: await loadFirma(perfil),
      }
    )
  }

  if (loading) {
    return <div className="flex flex-col items-center justify-center py-24"><Loader2 className="mb-4 animate-spin text-rose-500" size={40} /><p className="text-xs font-bold uppercase tracking-widest text-rose-300">Cargando evaluación inicial…</p></div>
  }

  if (!patient) {
    return <div className="py-24 text-center"><p className="mb-4 font-bold text-rose-500">Paciente no encontrado</p><Link href="/pacientes" className="font-bold text-rose-600 underline">Volver</Link></div>
  }

  const classificationFields: { field: keyof EvaluacionInicialForm; label: string }[] = [
    { field: 'funcion_mental', label: 'Función mental intelectual o psicológica' },
    { field: 'funcion_sensorial', label: 'Sensorial auditiva visual voz y habla' },
    { field: 'funcion_neuromusculoesqueletica', label: 'Neuromusculoesquelética y movimiento' },
    { field: 'actividad_aprendizaje', label: 'Aprendizaje' },
    { field: 'actividad_conocimiento', label: 'Aplicación del conocimiento' },
    { field: 'actividad_movilidad_relaciones', label: 'Movilidad y relaciones interpersonales' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32">
      <header className="mb-8 rounded-[34px] bg-rose-950 p-6 text-white shadow-2xl shadow-rose-200/60 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Link href={`/pacientes/${pacienteId}`} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-rose-100 transition hover:bg-white/20"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.25em] text-rose-300">Clasificación del funcionamiento y discapacidad</p>
            <h2 className="font-display text-4xl italic tracking-tight sm:text-5xl">Evaluación Inicial</h2>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-rose-200">{patient.nombre}</p>
            <p className={`mt-3 text-[9px] font-black uppercase tracking-widest ${draftStatus === 'error' ? 'text-amber-300' : 'text-emerald-300'}`}>
              {draftStatus === 'saving' ? 'Guardando borrador…' : draftStatus === 'error' ? 'Borrador local guardado · falta sincronizar' : draftStatus === 'saved' ? 'Borrador guardado' : 'Guardado automático activo'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/pacientes/${pacienteId}/evaluacion`} className="rounded-2xl bg-white/10 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-white/20">Ir a re-evaluación</Link>
            <button onClick={handlePDF} disabled={!profesional} className="flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-rose-700 disabled:opacity-40"><Download size={15} /> PDF</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Finalizar</button>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <Section number={1} title="Datos del paciente" icon={User}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Primer apellido" value={form.primer_apellido} onChange={value => update('primer_apellido', value)} />
            <Field label="Segundo apellido" value={form.segundo_apellido} onChange={value => update('segundo_apellido', value)} />
            <Field label="Primer nombre" value={form.primer_nombre} onChange={value => update('primer_nombre', value)} />
            <Field label="Segundo nombre" value={form.segundo_nombre} onChange={value => update('segundo_nombre', value)} />
            <Field label="Edad" type="number" value={form.edad} onChange={value => update('edad', value)} />
            <Field label="Identificación o pasaporte" value={form.documento_identidad} onChange={value => update('documento_identidad', value)} />
            <Field label="Fecha de valoración" type="date" value={form.fecha_valoracion} onChange={value => update('fecha_valoracion', value)} />
            <Field label="Sexo" value={form.sexo} onChange={value => update('sexo', value)} options={[{ value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }, { value: 'Otro', label: 'Otro' }]} />
          </div>
        </Section>

        <Section number={2} title="Toma de signos vitales" icon={Activity}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="FR (Frecuencia respiratoria)" placeholder="Ej. 18 rpm" value={form.fr} onChange={value => update('fr', value)} />
            <Field label="FC (Frecuencia cardíaca)" placeholder="Ej. 75 lpm" value={form.fc} onChange={value => update('fc', value)} />
            <Field label="TA (Tensión arterial)" placeholder="Ej. 120/80 mmHg" value={form.ta} onChange={value => update('ta', value)} />
            <div className="sm:col-span-3">
              <Field label="Auscultación" placeholder="Hallazgos de auscultación (respiratoria / cardíaca)…" value={form.auscultacion} onChange={value => update('auscultacion', value)} />
            </div>
          </div>
        </Section>

        <Section number={3} title="Discapacidad y clasificación" icon={HeartPulse}>
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Selecciona la clasificación funcional registrada durante la valoración. Usa “No aplica” cuando no exista limitación.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {classificationFields.map(item => <Field key={item.field} label={item.label} value={form[item.field] || 'No aplica'} onChange={value => update(item.field, value)} options={CLASIFICACIONES_FUNCIONALES} />)}
          </div>
        </Section>

        <Section number={4} title="Datos del profesional" icon={Stethoscope}>
          {esDuena(fisioActiva) && (
            <div className="max-w-sm">
              <Field
                label="Fisioterapeuta que evalúa"
                value={selectedFisio}
                onChange={value => handleFisioChange(value as Fisioterapeuta)}
                options={FISIOTERAPEUTAS.map(value => ({ value, label: value }))}
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Primer apellido" value={form.medico_primer_apellido} onChange={value => update('medico_primer_apellido', value)} />
            <Field label="Segundo apellido" value={form.medico_segundo_apellido} onChange={value => update('medico_segundo_apellido', value)} />
            <Field label="Primer nombre" value={form.medico_primer_nombre} onChange={value => update('medico_primer_nombre', value)} />
            <Field label="Segundo nombre" value={form.medico_segundo_nombre} onChange={value => update('medico_segundo_nombre', value)} />
            <Field label="Número de identidad" value={form.medico_identificacion} onChange={value => update('medico_identificacion', value)} />
            <Field label="Tipo de empleado" value={form.tipo_empleado} onChange={value => update('tipo_empleado', value)} />
            <div className="sm:col-span-2">
              <Field
                label="Organismo que elabora"
                value={ENTIDAD}
                readOnly
                onChange={() => {}}
              />
            </div>
          </div>
        </Section>

        <Section number={5} title="Descripción clínica" icon={ClipboardList}>
          <p className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-700"><CheckCircle2 size={15} /> Cada campo incluye mejora de escritura clínica con Cohere</p>
          <AITextarea label="Descripción de la enfermedad y o discapacidad" name="descripcion_enfermedad_discapacidad" value={form.descripcion_enfermedad_discapacidad} onChange={value => update('descripcion_enfermedad_discapacidad', value)} placeholder="Describe diagnóstico, evolución, limitaciones y contexto clínico…" />
          <AITextarea label="Objetivo" name="objetivo" value={form.objetivo} onChange={value => update('objetivo', value)} placeholder="Objetivo principal de la intervención fisioterapéutica…" />
          <AITextarea label="Detalle de la visita" name="detalle_visita" value={form.detalle_visita} onChange={value => update('detalle_visita', value)} placeholder="Hallazgos, procedimientos, educación y respuesta del paciente…" />
          <AITextarea label="Plan de tratamiento" name="plan_tratamiento" value={form.plan_tratamiento} onChange={value => update('plan_tratamiento', value)} placeholder="Intervenciones, frecuencia, metas y seguimiento…" />
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-t border-rose-100 bg-white/90 px-5 py-4 backdrop-blur-xl md:pl-[280px]">
        <Link href={`/pacientes/${pacienteId}`} className="text-[9px] font-black uppercase tracking-widest text-rose-300">← Volver al paciente</Link>
        <div className="flex gap-2">
          <button onClick={handlePDF} disabled={!profesional} className="flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-rose-700 disabled:opacity-40"><FileText size={14} /> PDF inicial</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-[9px] font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Finalizar evaluación</button>
        </div>
      </div>
    </div>
  )
}
