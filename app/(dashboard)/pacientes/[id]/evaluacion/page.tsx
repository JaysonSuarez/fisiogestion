'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { generateEvaluacionPDF } from '@/lib/generate-evaluacion-pdf'
import {
  ArrowLeft, Save, Loader2, FileText, User, Stethoscope,
  Activity, ClipboardList, Target, Lightbulb, Heart, Download,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { AITextarea } from '@/components/ui/AITextarea'

// Collapsible section component
function Section({
  number, title, icon: Icon, children, defaultOpen = false
}: {
  number: number; title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-rose-50 rounded-[28px] overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 bg-white hover:bg-rose-50/30 transition-all"
      >
        <div className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-rose-200 flex-shrink-0">
          {number}
        </div>
        <div className="flex items-center gap-2 flex-1 text-left">
          <Icon size={18} className="text-rose-400" />
          <span className="font-black text-sm text-rose-950 uppercase tracking-tighter">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-rose-300" /> : <ChevronDown size={18} className="text-rose-300" />}
      </button>
      {open && (
        <div className="px-5 pb-6 pt-2 space-y-4 bg-white border-t border-rose-50">
          {children}
        </div>
      )}
    </div>
  )
}

function FormField({
  label, name, value, onChange, type = 'text', placeholder, multiline = false, required = false, options = []
}: {
  label: string; name: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; multiline?: boolean; required?: boolean; options?: {value: string; label: string}[]
}) {
  if (multiline) {
    return (
      <AITextarea
        label={label}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">{label} {required && '*'}</label>
      {options.length > 0 ? (
        <select
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all cursor-pointer"
          required={required}
        >
          <option value="" disabled>{placeholder || 'Seleccione...'}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
          placeholder={placeholder}
          required={required}
        />
      )}
    </div>
  )
}

export default function EvaluacionPage() {
  const router = useRouter()
  const params = useParams()
  const pacienteId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patient, setPatient] = useState<any>(null)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [profesional, setProfesional] = useState<any>(null)

  // All form fields
  const [form, setForm] = useState({
    sexo: '',
    documento_identidad: '',
    fecha_valoracion: new Date().toISOString().split('T')[0],
    ocupacion: '',
    motivo_consulta: '',
    inicio_problema: '',
    mecanismo_lesion: '',
    escala_eva: '',
    factores_empeoran: '',
    factores_alivian: '',
    antecedentes_medicos: '',
    postura_estatica: '',
    alteraciones_visibles: '',
    analisis_marcha: '',
    rango_movimiento: '',
    limitaciones_movimiento: '',
    dolor_movimiento: '',
    fuerza_muscular: '',
    tono_muscular: '',
    desequilibrios: '',
    test_ortopedicos: '',
    evaluacion_neurologica: '',
    pruebas_funcionales: '',
    hallazgos: '',
    diagnostico_fisio: '',
    objetivos_corto_plazo: '',
    objetivos_mediano_plazo: '',
    objetivos_largo_plazo: '',
    tipo_intervencion: '',
    frecuencia_tratamiento: '',
    ejercicios_casa: '',
    cambios_posturales: '',
    actividades_evitar: '',
    mapa_dolor: [] as string[],
  })

  const updateField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    loadData()
  }, [pacienteId])

  async function loadData() {
    try {
      // Load patient
      const { data: pData } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', pacienteId)
        .single()
      setPatient(pData)

      // Load existing evaluation if any
      const { data: eData } = await supabase
        .from('evaluaciones')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const newForm: any = { ...form }
      
      // Auto-fill patient data
      if (pData?.documento_identidad) newForm.documento_identidad = pData.documento_identidad
      if (pData?.sexo) newForm.sexo = pData.sexo

      if (eData) {
        setEvaluacion(eData)
        // Populate form
        Object.keys(newForm).forEach(key => {
          if (eData[key] !== undefined && eData[key] !== null) {
            if (key === 'mapa_dolor') {
              newForm[key] = Array.isArray(eData[key]) ? eData[key] : []
            } else if (String(eData[key]).trim() !== '') {
              newForm[key] = String(eData[key])
            }
          }
        })
      }
      setForm(newForm)

      // Load professional settings
      const { data: profData } = await supabase
        .from('ajustes_profesional')
        .select('*')
        .limit(1)
        .single()
      setProfesional(profData)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Sync doc and sex to patient if they were added
      if (form.documento_identidad || form.sexo) {
        await supabase
          .from('pacientes')
          .update({
            ...(form.documento_identidad ? { documento_identidad: form.documento_identidad } : {}),
            ...(form.sexo ? { sexo: form.sexo } : {})
          })
          .eq('id', pacienteId)
      }

      const payload = {
        paciente_id: pacienteId,
        ...form,
        escala_eva: form.escala_eva ? parseInt(form.escala_eva) : null,
        updated_at: new Date().toISOString(),
      }

      if (evaluacion?.id) {
        const { error } = await supabase
          .from('evaluaciones')
          .update(payload)
          .eq('id', evaluacion.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('evaluaciones')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setEvaluacion(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadPDF() {
    if (!patient || !profesional) return
    generateEvaluacionPDF(
      {
        nombre: patient.nombre,
        edad: patient.edad,
        telefono: patient.telefono,
        ...form,
        escala_eva: form.escala_eva ? parseInt(form.escala_eva) : undefined,
      },
      profesional
    )
  }

  const toggleZonaDolor = (zona: string) => {
    setForm(prev => {
      const current = prev.mapa_dolor || []
      const next = current.includes(zona)
        ? current.filter(z => z !== zona)
        : [...current, zona]
      return { ...prev, mapa_dolor: next }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-rose-500 mb-4" size={40} />
        <p className="text-rose-300 font-bold text-xs uppercase tracking-widest">Cargando evaluación…</p>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-rose-500 font-bold mb-4">Paciente no encontrado</p>
        <Link href="/pacientes" className="text-rose-600 underline font-bold">Volver</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4">
      <header className="mb-10">
        <div className="flex items-center gap-4">
          <Link href={`/pacientes/${pacienteId}`} className="p-3 bg-white border border-rose-50 rounded-2xl hover:bg-rose-50 transition-all shadow-sm group">
            <ArrowLeft size={20} className="text-rose-300 group-hover:text-rose-600" />
          </Link>
          <div className="flex-1">
            <h2 className="font-display italic text-4xl sm:text-5xl text-rose-950 tracking-tighter mb-1">Evaluación</h2>
            <p className="text-rose-400 font-bold text-xs uppercase tracking-widest">{patient.nombre}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={!profesional}
              className="px-5 py-3 bg-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-200 transition-all flex items-center gap-2 disabled:opacity-40"
              title={!profesional ? 'Configura los ajustes del profesional primero' : 'Descargar PDF'}
            >
              <Download size={16} /> PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {/* 1. Datos del paciente */}
        <Section number={1} title="Datos del Paciente" icon={User} defaultOpen={true}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Sexo" name="sexo" value={form.sexo} onChange={v => updateField('sexo', v)} placeholder="Seleccionar..." options={[{value: 'M', label: 'Masculino (M)'}, {value: 'F', label: 'Femenino (F)'}]} />
            <FormField label="Documento de identidad" name="documento_identidad" value={form.documento_identidad} onChange={v => updateField('documento_identidad', v)} placeholder="Ej: CC 123456789" />
            <FormField label="Fecha de valoración" name="fecha_valoracion" value={form.fecha_valoracion} onChange={v => updateField('fecha_valoracion', v)} type="date" />
          </div>
          <FormField label="Ocupación" name="ocupacion" value={form.ocupacion} onChange={v => updateField('ocupacion', v)} placeholder="Ej: Oficinista, deportista, ama de casa…" />
        </Section>

        {/* 2. Motivo de consulta */}
        <Section number={2} title="Motivo de Consulta" icon={Stethoscope}>
          <FormField label="¿Por qué viene el paciente?" name="motivo_consulta" value={form.motivo_consulta} onChange={v => updateField('motivo_consulta', v)} placeholder="Ej: dolor lumbar, lesión deportiva, postquirúrgico…" multiline />
          <div className="flex flex-wrap gap-2 mt-3 pl-1">
            {['Dolor Lumbar', 'Lesión Deportiva', 'Postquirúrgico', 'Rehabilitación Integral', 'Descarga Muscular', 'Manejo de Dolor'].map(chip => (
              <button
                type="button"
                key={chip}
                onClick={() => updateField('motivo_consulta', form.motivo_consulta ? `${form.motivo_consulta}, ${chip}` : chip)}
                className="px-3 py-1.5 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-rose-100 hover:text-rose-600 transition-all border border-rose-100/50 active:scale-95 flex items-center gap-1"
              >
                + {chip}
              </button>
            ))}
          </div>
        </Section>

        {/* 3. Anamnesis */}
        <Section number={3} title="Anamnesis (Historia Clínica)" icon={ClipboardList}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Inicio del problema" name="inicio_problema" value={form.inicio_problema} onChange={v => updateField('inicio_problema', v)} placeholder="Agudo / Crónico" />
            <FormField label="Mecanismo de lesión" name="mecanismo_lesion" value={form.mecanismo_lesion} onChange={v => updateField('mecanismo_lesion', v)} placeholder="Describir cómo ocurrió" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Escala EVA (Dolor 0–10)</label>
            <div className="flex gap-1.5">
              {Array.from({ length: 11 }, (_, i) => {
                const selected = form.escala_eva === String(i)
                const r = Math.min(255, Math.round(i * 25.5))
                const g = Math.max(0, Math.round(255 - i * 25.5))
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateField('escala_eva', String(i))}
                    className={`flex-1 h-10 rounded-xl font-black text-sm transition-all border-2 ${
                      selected
                        ? 'text-white shadow-lg -translate-y-1 border-transparent'
                        : 'bg-rose-50 text-rose-300 border-rose-100 hover:border-rose-200'
                    }`}
                    style={selected ? { backgroundColor: `rgb(${r},${g},0)`, borderColor: `rgb(${r},${g},0)` } : {}}
                  >
                    {i}
                  </button>
                )
              })}
            </div>
          </div>
          <FormField label="Factores que empeoran" name="factores_empeoran" value={form.factores_empeoran} onChange={v => updateField('factores_empeoran', v)} multiline placeholder="Ej: estar sentado mucho tiempo, cargar peso…" />
          <FormField label="Factores que alivian" name="factores_alivian" value={form.factores_alivian} onChange={v => updateField('factores_alivian', v)} multiline placeholder="Ej: reposo, calor local, cambio de posición…" />
          <FormField label="Antecedentes médicos" name="antecedentes_medicos" value={form.antecedentes_medicos} onChange={v => updateField('antecedentes_medicos', v)} multiline placeholder="Cirugías, enfermedades, medicamentos…" />
        </Section>

        {/* 4. Mapa del Dolor Analógico */}
        <Section number={4} title="Mapa Anatómico del Dolor" icon={Target} defaultOpen={true}>
          <div className="bg-white rounded-[40px] p-6 border border-rose-100/50 shadow-inner overflow-hidden relative">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] text-center mb-6 italic">Selecciona los músculos o articulaciones afectadas</p>
            
            <div className="relative w-full max-w-2xl mx-auto flex justify-center">
              {/* Imagen de Referencia Humana real */}
              <img 
                src="/referencia.jpeg" 
                alt="Mapa Anatómico Muscular" 
                className="w-full h-auto object-contain rounded-3xl opacity-90 shadow-sm"
                draggable="false"
              />

              {/* Botones de Superposición (Hotspots Clínicos Afinados) */}
              <div className="absolute inset-0">
                {[
                  // --- FRENTE (Anterior) Center ~ 26.5% ---
                  { id: 'frente-cabeza', name: 'Cabeza', x: 26.5, y: 8.3, w: 7.8, h: 11.4 },
                  { id: 'frente-cuello', name: 'Cuello', x: 26.5, y: 15.8, w: 4.6, h: 3.5 },
                  { id: 'frente-pectoral-der', name: 'Pectoral Derecho', x: 23.4, y: 22.9, w: 6.2, h: 7.9 }, // Der del paciente = Izq img
                  { id: 'frente-pectoral-izq', name: 'Pectoral Izquierdo', x: 29.6, y: 22.9, w: 6.2, h: 7.9 },
                  { id: 'frente-abdominal', name: 'Abdomen / Core', x: 26.5, y: 34.0, w: 9.3, h: 15.0 },
                  { id: 'frente-cadera', name: 'Cadera / Pelvis', x: 26.5, y: 49.3, w: 10.9, h: 8.0 },
                  
                  { id: 'frente-hombro-der', name: 'Hombro Derecho', x: 17.1, y: 20.2, w: 5.4, h: 7.9 },
                  { id: 'frente-hombro-izq', name: 'Hombro Izquierdo', x: 35.9, y: 20.2, w: 5.4, h: 7.9 },
                  { id: 'frente-biceps-der', name: 'Bíceps Derecho', x: 14.0, y: 29.9, w: 3.9, h: 11.4 },
                  { id: 'frente-biceps-izq', name: 'Bíceps Izquierdo', x: 39.0, y: 29.9, w: 3.9, h: 11.4 },
                  { id: 'frente-codo-der', name: 'Codo Derecho', x: 12.5, y: 38.0, w: 3.0, h: 4.0 },
                  { id: 'frente-codo-izq', name: 'Codo Izquierdo', x: 40.5, y: 38.0, w: 3.0, h: 4.0 },
                  { id: 'frente-antebrazo-der', name: 'Antebrazo Derecho', x: 10.5, y: 44.0, w: 3.5, h: 8.0 },
                  { id: 'frente-antebrazo-izq', name: 'Antebrazo Izquierdo', x: 42.5, y: 44.0, w: 3.5, h: 8.0 },
                  { id: 'frente-muneca-der', name: 'Muñeca Derecha', x: 9.0, y: 49.0, w: 3.0, h: 3.0 },
                  { id: 'frente-muneca-izq', name: 'Muñeca Izquierda', x: 44.0, y: 49.0, w: 3.0, h: 3.0 },
                  { id: 'frente-mano-der', name: 'Mano Derecha', x: 7.5, y: 54.0, w: 4.0, h: 6.0 },
                  { id: 'frente-mano-izq', name: 'Mano Izquierda', x: 45.5, y: 54.0, w: 4.0, h: 6.0 },

                  { id: 'frente-cuadriceps-der', name: 'Cuádriceps Derecho', x: 21.0, y: 61.6, w: 7.8, h: 16.0 },
                  { id: 'frente-cuadriceps-izq', name: 'Cuádriceps Izquierdo', x: 32.0, y: 61.6, w: 7.8, h: 16.0 },
                  { id: 'frente-rodilla-der', name: 'Rodilla Derecha', x: 21.0, y: 72.2, w: 4.6, h: 5.0 },
                  { id: 'frente-rodilla-izq', name: 'Rodilla Izquierda', x: 32.0, y: 72.2, w: 4.6, h: 5.0 },
                  { id: 'frente-tibial-der', name: 'Tibial Anterior Derecho', x: 20.7, y: 82.8, w: 4.6, h: 13.0 },
                  { id: 'frente-tibial-izq', name: 'Tibial Anterior Izquierdo', x: 32.4, y: 82.8, w: 4.6, h: 13.0 },
                  { id: 'frente-tobillo-der', name: 'Tobillo Derecho', x: 19.5, y: 91.6, w: 4.0, h: 3.0 },
                  { id: 'frente-tobillo-izq', name: 'Tobillo Izquierdo', x: 33.5, y: 91.6, w: 4.0, h: 3.0 },
                  { id: 'frente-pie-der', name: 'Pie Derecho', x: 19.5, y: 95.1, w: 6.0, h: 4.0 },
                  { id: 'frente-pie-izq', name: 'Pie Izquierdo', x: 33.5, y: 95.1, w: 6.0, h: 4.0 },

                  // --- ESPALDA (Posterior) Center ~ 72.6% ---
                  { id: 'espalda-cabeza', name: 'Cabeza / Occipital', x: 72.6, y: 8.3, w: 7.8, h: 11.4 },
                  { id: 'espalda-cuello', name: 'Cervical Posterior', x: 72.6, y: 15.8, w: 4.6, h: 3.5 },
                  { id: 'espalda-trapecio', name: 'Trapecios', x: 72.6, y: 20.0, w: 15.0, h: 7.0 },
                  { id: 'espalda-dorsal-izq', name: 'Dorsal Izquierdo', x: 66.4, y: 29.9, w: 6.2, h: 15.0 }, // Izq del paciente = Izq img en espalda
                  { id: 'espalda-dorsal-der', name: 'Dorsal Derecho', x: 78.9, y: 29.9, w: 6.2, h: 15.0 },
                  { id: 'espalda-lumbar', name: 'Zona Lumbar', x: 72.6, y: 40.5, w: 9.3, h: 8.0 },
                  { id: 'espalda-gluteo-izq', name: 'Glúteo Izquierdo', x: 67.1, y: 48.4, w: 7.8, h: 10.0 },
                  { id: 'espalda-gluteo-der', name: 'Glúteo Derecho', x: 78.1, y: 48.4, w: 7.8, h: 10.0 },

                  { id: 'espalda-hombro-izq', name: 'Hombro Post. Izquierdo', x: 60.1, y: 20.2, w: 5.4, h: 7.9 },
                  { id: 'espalda-hombro-der', name: 'Hombro Post. Derecho', x: 85.1, y: 20.2, w: 5.4, h: 7.9 },
                  { id: 'espalda-triceps-izq', name: 'Tríceps Izquierdo', x: 58.5, y: 29.9, w: 3.9, h: 11.4 },
                  { id: 'espalda-triceps-der', name: 'Tríceps Derecho', x: 86.7, y: 29.9, w: 3.9, h: 11.4 },
                  { id: 'espalda-codo-izq', name: 'Codo Post. Izquierdo', x: 57.0, y: 38.0, w: 3.0, h: 4.0 },
                  { id: 'espalda-codo-der', name: 'Codo Post. Derecho', x: 88.2, y: 38.0, w: 3.0, h: 4.0 },
                  { id: 'espalda-antebrazo-izq', name: 'Antebrazo Post. Izq.', x: 55.0, y: 44.0, w: 3.5, h: 8.0 },
                  { id: 'espalda-antebrazo-der', name: 'Antebrazo Post. Der.', x: 90.2, y: 44.0, w: 3.5, h: 8.0 },
                  { id: 'espalda-muneca-izq', name: 'Muñeca Izquierda', x: 53.5, y: 49.0, w: 3.0, h: 3.0 },
                  { id: 'espalda-muneca-der', name: 'Muñeca Derecha', x: 91.7, y: 49.0, w: 3.0, h: 3.0 },
                  { id: 'espalda-mano-izq', name: 'Mano Izquierda', x: 52.0, y: 54.0, w: 4.0, h: 6.0 },
                  { id: 'espalda-mano-der', name: 'Mano Derecha', x: 93.2, y: 54.0, w: 4.0, h: 6.0 },

                  { id: 'espalda-isquio-izq', name: 'Isquiotibial Izquierdo', x: 67.1, y: 64.0, w: 7.0, h: 14.0 },
                  { id: 'espalda-isquio-der', name: 'Isquiotibial Derecho', x: 78.1, y: 64.0, w: 7.0, h: 14.0 },
                  { id: 'espalda-corva-izq', name: 'Hueco Poplíteo Izquierdo', x: 66.4, y: 74.0, w: 5.0, h: 4.0 },
                  { id: 'espalda-corva-der', name: 'Hueco Poplíteo Derecho', x: 78.9, y: 74.0, w: 5.0, h: 4.0 },
                  { id: 'espalda-gemelo-izq', name: 'Gemelos / Batata Izquierda', x: 65.6, y: 84.0, w: 6.0, h: 12.0 },
                  { id: 'espalda-gemelo-der', name: 'Gemelos / Batata Derecha', x: 79.6, y: 84.0, w: 6.0, h: 12.0 },
                  { id: 'espalda-talon-izq', name: 'Talón / Tobillo Post. Izquierdo', x: 63.2, y: 94.0, w: 4.0, h: 3.0 },
                  { id: 'espalda-talon-der', name: 'Talón / Tobillo Post. Derecho', x: 82.0, y: 94.0, w: 4.0, h: 3.0 },
                  { id: 'espalda-pie-izq', name: 'Talón Izquierdo', x: 63.2, y: 96.0, w: 4.0, h: 3.0 },
                  { id: 'espalda-pie-der', name: 'Talón Derecho', x: 82.0, y: 96.0, w: 4.0, h: 3.0 },
                ].map(zona => {
                  const isSelected = form.mapa_dolor.includes(zona.id)
                  return (
                    <button
                      key={zona.id}
                      type="button"
                      title={zona.name}
                      onClick={() => toggleZonaDolor(zona.id)}
                      className={`absolute rounded-[50%] transition-all duration-200 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair border-2 ${
                        isSelected 
                          ? 'bg-rose-500/50 border-rose-600/90 shadow-[0_0_15px_rgba(244,63,94,0.7)] scale-110 z-10' 
                          : 'bg-transparent border-transparent hover:bg-rose-300/30 hover:border-rose-400/50 z-0'
                      }`}
                      style={{
                        left: `${zona.x}%`,
                        top: `${zona.y}%`,
                        width: `${zona.w}%`,
                        height: `${zona.h}%`,
                        mixBlendMode: isSelected ? 'multiply' : 'normal'
                      }}
                    />
                  )
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-rose-100 pt-6 px-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                <span className="text-[10px] font-black text-rose-950 uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                  {form.mapa_dolor.length} Zonas Musculares Afectadas
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => updateField('mapa_dolor', [] as any)} 
                className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors px-4 py-2 hover:bg-rose-50 rounded-xl"
              >
                Ocultar / Limpiar Mapa
              </button>
            </div>
          </div>
        </Section>

        {/* 5. Observación postural */}
        <Section number={5} title="Observación y Análisis Postural" icon={Activity}>
          <FormField label="Postura estática (de pie/sentado)" name="postura_estatica" value={form.postura_estatica} onChange={v => updateField('postura_estatica', v)} multiline />
          <FormField label="Alteraciones visibles" name="alteraciones_visibles" value={form.alteraciones_visibles} onChange={v => updateField('alteraciones_visibles', v)} multiline placeholder="Escoliosis, hiperlordosis, etc." />
          <FormField label="Análisis de la marcha" name="analisis_marcha" value={form.analisis_marcha} onChange={v => updateField('analisis_marcha', v)} multiline />
        </Section>

        {/* 5. Evaluación del movimiento */}
        <Section number={5} title="Evaluación del Movimiento" icon={Activity}>
          <FormField label="Rango de movimiento (activo y pasivo)" name="rango_movimiento" value={form.rango_movimiento} onChange={v => updateField('rango_movimiento', v)} multiline />
          <FormField label="Limitaciones" name="limitaciones_movimiento" value={form.limitaciones_movimiento} onChange={v => updateField('limitaciones_movimiento', v)} multiline />
          <FormField label="Dolor durante el movimiento" name="dolor_movimiento" value={form.dolor_movimiento} onChange={v => updateField('dolor_movimiento', v)} multiline />
        </Section>

        {/* 6. Evaluación muscular */}
        <Section number={6} title="Evaluación Muscular" icon={Activity}>
          <FormField label="Fuerza muscular (escala 0–5)" name="fuerza_muscular" value={form.fuerza_muscular} onChange={v => updateField('fuerza_muscular', v)} multiline />
          <FormField label="Tono muscular" name="tono_muscular" value={form.tono_muscular} onChange={v => updateField('tono_muscular', v)} multiline />
          <FormField label="Desequilibrios entre lados" name="desequilibrios" value={form.desequilibrios} onChange={v => updateField('desequilibrios', v)} multiline />
        </Section>

        {/* 7. Pruebas específicas */}
        <Section number={7} title="Pruebas Específicas" icon={ClipboardList}>
          <FormField label="Test ortopédicos" name="test_ortopedicos" value={form.test_ortopedicos} onChange={v => updateField('test_ortopedicos', v)} multiline placeholder="Ej: rodilla, hombro, columna…" />
          <FormField label="Evaluación neurológica" name="evaluacion_neurologica" value={form.evaluacion_neurologica} onChange={v => updateField('evaluacion_neurologica', v)} multiline placeholder="Reflejos, sensibilidad…" />
          <FormField label="Pruebas funcionales" name="pruebas_funcionales" value={form.pruebas_funcionales} onChange={v => updateField('pruebas_funcionales', v)} multiline placeholder="Equilibrio, coordinación…" />
        </Section>

        {/* 8. Resultados / hallazgos */}
        <Section number={8} title="Resultados / Hallazgos" icon={FileText}>
          <FormField label="Resumen de hallazgos" name="hallazgos" value={form.hallazgos} onChange={v => updateField('hallazgos', v)} multiline placeholder="Ej: Disminución de movilidad lumbar, debilidad en glúteo medio, dolor a la palpación…" />
        </Section>

        {/* 9. Diagnóstico fisioterapéutico */}
        <Section number={9} title="Diagnóstico Fisioterapéutico" icon={Stethoscope}>
          <FormField label="Interpretación funcional" name="diagnostico_fisio" value={form.diagnostico_fisio} onChange={v => updateField('diagnostico_fisio', v)} multiline placeholder="Ej: disfunción mecánica lumbar, síndrome de dolor miofascial…" />
        </Section>

        {/* 10. Objetivos del tratamiento */}
        <Section number={10} title="Objetivos del Tratamiento" icon={Target}>
          <FormField label="Corto plazo (disminuir dolor)" name="objetivos_corto_plazo" value={form.objetivos_corto_plazo} onChange={v => updateField('objetivos_corto_plazo', v)} multiline />
          <FormField label="Mediano plazo (mejorar movilidad)" name="objetivos_mediano_plazo" value={form.objetivos_mediano_plazo} onChange={v => updateField('objetivos_mediano_plazo', v)} multiline />
          <FormField label="Largo plazo (recuperar función)" name="objetivos_largo_plazo" value={form.objetivos_largo_plazo} onChange={v => updateField('objetivos_largo_plazo', v)} multiline />
        </Section>

        {/* 11. Plan de tratamiento */}
        <Section number={11} title="Plan de Tratamiento" icon={ClipboardList}>
          <FormField label="Tipo de intervención" name="tipo_intervencion" value={form.tipo_intervencion} onChange={v => updateField('tipo_intervencion', v)} multiline placeholder="Ejercicio terapéutico, terapia manual, electroterapia…" />
          <FormField label="Frecuencia" name="frecuencia_tratamiento" value={form.frecuencia_tratamiento} onChange={v => updateField('frecuencia_tratamiento', v)} placeholder="Ej: 2–3 veces por semana" />
        </Section>

        {/* 12. Recomendaciones */}
        <Section number={12} title="Recomendaciones" icon={Lightbulb}>
          <FormField label="Ejercicios en casa" name="ejercicios_casa" value={form.ejercicios_casa} onChange={v => updateField('ejercicios_casa', v)} multiline />
          <FormField label="Cambios posturales" name="cambios_posturales" value={form.cambios_posturales} onChange={v => updateField('cambios_posturales', v)} multiline />
          <FormField label="Actividades a evitar" name="actividades_evitar" value={form.actividades_evitar} onChange={v => updateField('actividades_evitar', v)} multiline />
        </Section>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-rose-100 py-4 px-6 z-50 flex items-center justify-between gap-4 md:pl-[280px]">
        <Link href={`/pacientes/${pacienteId}`} className="text-rose-300 font-black text-[10px] uppercase tracking-widest hover:text-rose-500">
          ← Volver al paciente
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={!profesional}
            className="px-5 py-3 bg-rose-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-200 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Download size={14} /> Descargar PDF
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando…' : 'Guardar Evaluación'}
          </button>
        </div>
      </div>
    </div>
  )
}
