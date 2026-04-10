'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Settings, Save, Loader2, User, Hash, Stethoscope,
  Phone, Mail, MapPin, CheckCircle, Sparkles
} from 'lucide-react'

export default function AjustesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [id, setId] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre_completo: '',
    registro_profesional: '',
    especialidad: 'Fisioterapia',
    telefono: '',
    email: '',
    direccion: '',
  })

  const updateField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const { data } = await supabase
        .from('ajustes_profesional')
        .select('*')
        .limit(1)
        .single()

      if (data) {
        setId(data.id)
        setForm({
          nombre_completo: data.nombre_completo || '',
          registro_profesional: data.registro_profesional || '',
          especialidad: data.especialidad || 'Fisioterapia',
          telefono: data.telefono || '',
          email: data.email || '',
          direccion: data.direccion || '',
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        ...form,
        updated_at: new Date().toISOString(),
      }

      if (id) {
        const { error } = await supabase
          .from('ajustes_profesional')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('ajustes_profesional')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        if (data) setId(data.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-rose-500 mb-4" size={40} />
        <p className="text-rose-300 font-bold text-xs uppercase tracking-widest">Cargando ajustes…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4">
      <header className="mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-rose-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-rose-200">
            <Settings size={28} className="text-white" />
          </div>
          <div>
            <h2 className="font-display italic text-4xl sm:text-5xl text-rose-950 tracking-tighter mb-1">Ajustes</h2>
            <p className="text-rose-400 font-bold text-xs uppercase tracking-widest">Datos del profesional</p>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[40px] shadow-2xl shadow-rose-100/40 border border-rose-50 p-8 space-y-8">
        {/* Info banner */}
        <div className="bg-rose-50/60 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-rose-400 font-medium leading-relaxed">
            Estos datos aparecerán en los <strong className="text-rose-600">PDF de evaluaciones</strong> que generes para tus pacientes. Asegúrate de completar tu nombre y número de registro profesional.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-rose-50">
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
              <User size={18} />
            </div>
            <h3 className="text-rose-950 font-black uppercase text-sm tracking-tighter">Información Personal</h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
              <User size={10} /> Nombre completo *
            </label>
            <input
              value={form.nombre_completo}
              onChange={e => updateField('nombre_completo', e.target.value)}
              className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
              placeholder="Ej: Liliana González"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
                <Hash size={10} /> Registro profesional
              </label>
              <input
                value={form.registro_profesional}
                onChange={e => updateField('registro_profesional', e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                placeholder="Ej: TP-12345"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
                <Stethoscope size={10} /> Especialidad
              </label>
              <input
                value={form.especialidad}
                onChange={e => updateField('especialidad', e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                placeholder="Fisioterapia"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pb-4 border-b border-rose-50 pt-4">
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
              <Phone size={18} />
            </div>
            <h3 className="text-rose-950 font-black uppercase text-sm tracking-tighter">Contacto</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
                <Phone size={10} /> Teléfono
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => updateField('telefono', e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                placeholder="300 000 0000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
                <Mail size={10} /> Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1">
              <MapPin size={10} /> Dirección del consultorio
            </label>
            <input
              value={form.direccion}
              onChange={e => updateField('direccion', e.target.value)}
              className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all"
              placeholder="Ej: Calle 100 #15-20, Consultorio 301, Bogotá"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="pt-4 border-t border-rose-50">
          <button
            onClick={handleSave}
            disabled={saving || !form.nombre_completo}
            className="w-full py-4 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-950/20 hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Guardando…
              </>
            ) : saved ? (
              <>
                <CheckCircle size={16} /> ¡Guardado Exitosamente!
              </>
            ) : (
              <>
                <Save size={16} /> Guardar Ajustes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
