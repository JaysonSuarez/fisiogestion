'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Ticket } from 'lucide-react'
import { format } from 'date-fns'
import { formatCOP } from '@/lib/utils'
import { SERVICIOS_CUPON } from '@/lib/descuentos'

export default function PromocionesPage() {
  const [promociones, setPromociones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [currentPromo, setCurrentPromo] = useState<any>(null)
  const [reglasCupon, setReglasCupon] = useState<any[]>([])
  const [currentRule, setCurrentRule] = useState<any>(null)
  const [ruleError, setRuleError] = useState('')

  useEffect(() => {
    loadPromos()
  }, [])

  async function loadPromos() {
    const [{ data: promos }, { data: reglas, error }] = await Promise.all([
      supabase.from('promociones').select('*').order('created_at', { ascending: false }),
      supabase.from('reglas_cupones').select('*').order('created_at', { ascending: false }),
    ])
    setPromociones(promos || [])
    setReglasCupon(reglas || [])
    setRuleError(error ? 'Activa la migración de reglas de cupones en Supabase para administrar estas condiciones.' : '')
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const promo = {
      ...currentPromo,
      servicios_aplicables: currentPromo.servicios_aplicables || [],
      sesiones_minimas: currentPromo.sesiones_minimas ? Number(currentPromo.sesiones_minimas) : null,
    }
    const result = currentPromo.id
      ? await supabase.from('promociones').update(promo).eq('id', currentPromo.id)
      : await supabase.from('promociones').insert(promo)
    if (result.error) {
      setRuleError('No se pudo guardar la promoción. Confirma que la migración esté aplicada y vuelve a intentarlo.')
      return
    }
    setIsEditing(false)
    setCurrentPromo(null)
    setRuleError('')
    loadPromos()
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('promociones').update({ activa: !currentStatus }).eq('id', id)
    loadPromos()
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta promoción?')) {
      await supabase.from('promociones').delete().eq('id', id)
      loadPromos()
    }
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    const rule = {
      codigo_cupon: String(currentRule.codigo_cupon || '').trim().toUpperCase(),
      porcentaje_descuento: Number(currentRule.porcentaje_descuento),
      servicios_aplicables: currentRule.servicios_aplicables || [],
      sesiones_minimas: currentRule.sesiones_minimas ? Number(currentRule.sesiones_minimas) : null,
    }
    const query = currentRule.id
      ? supabase.from('reglas_cupones').update(rule).eq('id', currentRule.id)
      : supabase.from('reglas_cupones').insert(rule)
    const { error } = await query
    if (error) {
      setRuleError(error.code === '23505' ? 'Ya existe una regla para ese código de cupón.' : 'No se pudo guardar. Revisa que la migración esté aplicada y vuelve a intentarlo.')
      return
    }
    setCurrentRule(null)
    setRuleError('')
    loadPromos()
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Eliminar la condición de este cupón? El código conservará el descuento estándar.')) return
    const { error } = await supabase.from('reglas_cupones').delete().eq('id', id)
    if (error) setRuleError('No se pudo eliminar la regla.')
    else loadPromos()
  }

  if (loading) return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display italic text-4xl text-rose-950 tracking-tighter">Promociones</h1>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest mt-1">Gestiona los descuentos de la app</p>
        </div>
        <button 
          onClick={() => { setCurrentPromo({ titulo: '', descripcion: '', activa: true, servicios_aplicables: [], sesiones_minimas: null }); setIsEditing(true) }}
          className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200 flex items-center gap-2 hover:bg-rose-700 transition-colors"
        >
          <Plus size={16} /> Nueva Promo
        </button>
      </div>

      {isEditing && (
        <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-rose-100/50 border border-rose-50 mb-8">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="font-black text-xl text-rose-950 tracking-tighter">{currentPromo.id ? 'Editar Promo' : 'Nueva Promo'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input 
                value={currentPromo.titulo} 
                onChange={e => setCurrentPromo({...currentPromo, titulo: e.target.value})} 
                placeholder="Título (Ej: Descuento Madres)" 
                className="w-full px-4 py-3 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-rose-950 text-sm" 
                required 
              />
              <input 
                value={currentPromo.descripcion || ''} 
                onChange={e => setCurrentPromo({...currentPromo, descripcion: e.target.value})} 
                placeholder="Descripción corta" 
                className="w-full px-4 py-3 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-rose-950 text-sm" 
              />
              <div className="flex items-center gap-2 w-full">
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={currentPromo.porcentaje_descuento || ''} 
                  onChange={e => setCurrentPromo({...currentPromo, porcentaje_descuento: e.target.value ? parseInt(e.target.value) : null})} 
                  placeholder="Porcentaje de Descuento (Ej: 15)" 
                  className="w-full px-4 py-3 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-rose-950 text-sm" 
                  required
                />
                <span className="text-rose-400 font-black text-xl">%</span>
              </div>
            </div>
            <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest">Mínimo de sesiones (opcional)
              <input type="number" min="1" value={currentPromo.sesiones_minimas ?? ''} onChange={e => setCurrentPromo({ ...currentPromo, sesiones_minimas: e.target.value ? Number(e.target.value) : null })} placeholder="Ej: 10" className="mt-2 w-full px-4 py-3 rounded-2xl bg-rose-50/50 text-sm font-bold text-rose-950 outline-none focus:ring-2 focus:ring-rose-200" />
              <span className="block mt-1 text-[10px] tracking-normal text-slate-500">La promoción se aplicará cuando el plan tenga esta cantidad de sesiones o más.</span>
            </label>
            <fieldset>
              <legend className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Servicios donde aplica</legend>
              <p className="text-xs text-slate-500 mb-3">Sin selección, la promoción aplica a todos los servicios.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SERVICIOS_CUPON.map(servicio => {
                  const selected = (currentPromo.servicios_aplicables || []).includes(servicio.id)
                  return <label key={servicio.id} className="flex items-center gap-2 rounded-xl bg-rose-50/60 p-3 text-xs font-bold text-rose-950 cursor-pointer">
                    <input type="checkbox" checked={selected} onChange={e => setCurrentPromo({ ...currentPromo, servicios_aplicables: e.target.checked ? [...(currentPromo.servicios_aplicables || []), servicio.id] : (currentPromo.servicios_aplicables || []).filter((id: string) => id !== servicio.id) })} className="accent-rose-600" />
                    {servicio.label}
                  </label>
                })}
              </div>
            </fieldset>
            <div className="flex gap-3 justify-end mt-4">
              <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 text-rose-400 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-colors">Cancelar</button>
              <button type="submit" className="px-6 py-3 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-900 transition-colors">Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {promociones.map(promo => (
          <div key={promo.id} className={`bg-white rounded-[32px] p-6 shadow-xl border ${promo.activa ? 'border-rose-100 shadow-rose-100/50' : 'border-slate-100 shadow-slate-100/50 opacity-60'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <Ticket size={24} className="text-rose-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(promo.id, promo.activa)} className={`p-2 rounded-xl transition-colors ${promo.activa ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                  {promo.activa ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </button>
                <button onClick={() => { setCurrentPromo(promo); setIsEditing(true) }} className="p-2 text-rose-400 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"><Edit2 size={18} /></button>
                <button onClick={() => handleDelete(promo.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"><Trash2 size={18} /></button>
              </div>
            </div>
            <h3 className="font-black text-xl text-rose-950 tracking-tighter mb-1">{promo.titulo}</h3>
            <p className="text-sm text-rose-400 font-medium mb-4">{promo.descripcion}</p>
            <p className="text-xs text-slate-500 mb-4">Aplica a: {(promo.servicios_aplicables || []).length ? promo.servicios_aplicables.map((id: string) => SERVICIOS_CUPON.find(s => s.id === id)?.label || id).join(', ') : 'Todos los servicios'}{promo.sesiones_minimas ? ` · Desde ${promo.sesiones_minimas} sesiones` : ''}</p>
            {promo.porcentaje_descuento && (
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-rose-600">{promo.porcentaje_descuento}% DTO</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div>
            <h2 className="font-display italic text-3xl text-rose-950 tracking-tighter">Reglas de cupones</h2>
            <p className="text-rose-400 font-bold text-xs mt-1">Define el descuento y los servicios válidos para cada código.</p>
          </div>
          <button
            onClick={() => { setRuleError(''); setCurrentRule({ codigo_cupon: '', porcentaje_descuento: 10, servicios_aplicables: [], sesiones_minimas: null }) }}
            className="bg-rose-950 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
          ><Plus size={15} /> Nueva regla</button>
        </div>

        {ruleError && <p role="alert" className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-bold text-amber-800">{ruleError}</p>}

        {currentRule && (
          <form onSubmit={handleSaveRule} className="bg-white rounded-[28px] p-6 shadow-lg border border-rose-100 mb-6 space-y-4">
            <h3 className="font-black text-lg text-rose-950">{currentRule.id ? 'Editar regla' : 'Configurar cupón'}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Código del cupón
                <input required maxLength={80} value={currentRule.codigo_cupon} onChange={e => setCurrentRule({ ...currentRule, codigo_cupon: e.target.value.toUpperCase() })} placeholder="THERAPY10-XXXXX" className="mt-2 w-full px-4 py-3 rounded-2xl bg-rose-50/50 text-sm font-bold text-rose-950 outline-none focus:ring-2 focus:ring-rose-200" />
              </label>
              <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Porcentaje de descuento
                <div className="flex items-center gap-2 mt-2">
                  <input required type="number" min="0" max="100" value={currentRule.porcentaje_descuento} onChange={e => setCurrentRule({ ...currentRule, porcentaje_descuento: Number(e.target.value) })} className="w-full px-4 py-3 rounded-2xl bg-rose-50/50 text-sm font-bold text-rose-950 outline-none focus:ring-2 focus:ring-rose-200" />
                  <span className="font-black text-rose-400">%</span>
                </div>
              </label>
              <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Mínimo de sesiones (opcional)
                <input type="number" min="1" value={currentRule.sesiones_minimas ?? ''} onChange={e => setCurrentRule({ ...currentRule, sesiones_minimas: e.target.value ? Number(e.target.value) : null })} placeholder="Ej: 10" className="mt-2 w-full px-4 py-3 rounded-2xl bg-rose-50/50 text-sm font-bold text-rose-950 outline-none focus:ring-2 focus:ring-rose-200" />
                <span className="block mt-1 text-[10px] tracking-normal text-slate-500">Se aplicará cuando el plan tenga esta cantidad o más.</span>
              </label>
            </div>
            <fieldset>
              <legend className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Servicios donde aplica</legend>
              <p className="text-xs text-slate-500 mb-3">Si no seleccionas ninguno, el cupón aplica a todos los servicios.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SERVICIOS_CUPON.map(servicio => {
                  const checked = currentRule.servicios_aplicables.includes(servicio.id)
                  return <label key={servicio.id} className="flex items-center gap-2 rounded-xl bg-rose-50/60 p-3 text-xs font-bold text-rose-950 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={e => setCurrentRule({ ...currentRule, servicios_aplicables: e.target.checked ? [...currentRule.servicios_aplicables, servicio.id] : currentRule.servicios_aplicables.filter((id: string) => id !== servicio.id) })} className="accent-rose-600" />
                    {servicio.label}
                  </label>
                })}
              </div>
            </fieldset>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setCurrentRule(null)} className="px-5 py-3 text-rose-400 font-bold text-xs">Cancelar</button>
              <button type="submit" className="px-6 py-3 bg-rose-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Guardar regla</button>
            </div>
          </form>
        )}

        {reglasCupon.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reglasCupon.map(regla => {
            const nombres = (regla.servicios_aplicables || []).map((id: string) => SERVICIOS_CUPON.find(s => s.id === id)?.label || id)
            return <article key={regla.id} className="bg-white rounded-[24px] p-5 border border-rose-100 shadow-sm flex justify-between gap-4">
              <div><h3 className="font-black text-rose-950 tracking-wide">{regla.codigo_cupon}</h3><p className="text-rose-600 font-black mt-1">{regla.porcentaje_descuento}% de descuento</p><p className="text-xs text-slate-500 mt-2">Aplica a: {nombres.length ? nombres.join(', ') : 'Todos los servicios'}{regla.sesiones_minimas ? ` · Desde ${regla.sesiones_minimas} sesiones` : ''}</p></div>
              <div className="flex gap-2 shrink-0"><button aria-label="Editar regla" onClick={() => setCurrentRule({ ...regla, servicios_aplicables: regla.servicios_aplicables || [], sesiones_minimas: regla.sesiones_minimas ?? null })} className="p-2 text-rose-400 bg-rose-50 rounded-xl"><Edit2 size={17} /></button><button aria-label="Eliminar regla" onClick={() => handleDeleteRule(regla.id)} className="p-2 text-rose-500 bg-rose-50 rounded-xl"><Trash2 size={17} /></button></div>
            </article>
          })}
        </div> : <div className="rounded-[24px] border border-dashed border-rose-200 p-8 text-center text-sm font-medium text-rose-400">Aún no hay condiciones para cupones. Los códigos sin regla usan el descuento estándar actual.</div>}
      </section>
    </div>
  )
}
