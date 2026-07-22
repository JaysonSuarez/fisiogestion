'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Ticket } from 'lucide-react'
import { format } from 'date-fns'
import { formatCOP } from '@/lib/utils'

export default function PromocionesPage() {
  const [promociones, setPromociones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [currentPromo, setCurrentPromo] = useState<any>(null)

  useEffect(() => {
    loadPromos()
  }, [])

  async function loadPromos() {
    const { data } = await supabase.from('promociones').select('*').order('created_at', { ascending: false })
    setPromociones(data || [])
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentPromo.id) {
      await supabase.from('promociones').update(currentPromo).eq('id', currentPromo.id)
    } else {
      await supabase.from('promociones').insert(currentPromo)
    }
    setIsEditing(false)
    setCurrentPromo(null)
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

  if (loading) return <div className="p-8 text-center text-rose-300 font-bold animate-pulse mt-20">Cargando...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display italic text-4xl text-rose-950 tracking-tighter">Promociones</h1>
          <p className="text-rose-400 font-bold text-xs uppercase tracking-widest mt-1">Gestiona los descuentos de la app</p>
        </div>
        <button 
          onClick={() => { setCurrentPromo({ titulo: '', descripcion: '', activa: true }); setIsEditing(true) }}
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
            {promo.porcentaje_descuento && (
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-rose-600">{promo.porcentaje_descuento}% DTO</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
