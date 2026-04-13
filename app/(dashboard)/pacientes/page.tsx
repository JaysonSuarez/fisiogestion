'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { OfflineSync } from '@/lib/offline-sync'
import { 
  Search, 
  Plus, 
  ChevronRight,
  Activity,
  Loader2
} from 'lucide-react'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export default function PacientesPage() {
  const [loading, setLoading] = useState(true)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  async function loadPacientes() {
    // 1. Cargar desde caché (Offline First)
    const cachedData = OfflineSync.getFromCache('pacientes');
    if (cachedData) {
      setPacientes(cachedData);
      setLoading(false);
    }

    try {
      const { data: pacientesRaw } = await supabase
        .from('pacientes')
        .select('*, sesiones(valor, estado_pago)')
        .order('nombre')

      if (pacientesRaw) {
        const processed = pacientesRaw.map(p => {
          const sesiones = p.sesiones || []
          const pagado = sesiones.filter((s:any) => s.estado_pago === 'pagado').reduce((acc:number, s:any) => acc + s.valor, 0)
          const deuda = sesiones.filter((s:any) => s.estado_pago === 'pendiente').reduce((acc:number, s:any) => acc + s.valor, 0)
          
          return {
            ...p,
            numSesiones: sesiones.length,
            pagado,
            deuda
          }
        })
        setPacientes(processed)
        OfflineSync.saveToCache('pacientes', processed)
      }
    } catch (err) {
      console.error('Error cargando pacientes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPacientes()
  }, [])

  const filteredPacientes = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.diagnostico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.telefono?.includes(searchTerm)
  )

  if (loading && pacientes.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-rose-500" size={40} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display italic text-4xl mb-1 text-rose-950">Pacientes</h2>
          <p className="text-rose-400 font-medium text-xs uppercase tracking-widest">{pacientes.length} totales en tu sistema</p>
        </div>
        <Link href="/pacientes/nuevo" className="p-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-200 hover:scale-105 transition-all flex items-center gap-2">
          <Plus size={20} />
          <span className="hidden sm:inline font-black text-[10px] uppercase tracking-widest">Nuevo Paciente</span>
        </Link>
      </header>

      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, diagnóstico..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-[24px] border border-rose-50 focus:border-rose-200 focus:ring-4 focus:ring-rose-50/50 shadow-sm transition-all outline-none text-rose-950 bg-white/80 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 md:hidden gap-6">
          {filteredPacientes.map(p => (
            <Link key={p.id} href={`/pacientes/${p.id}`} className="p-6 bg-white rounded-[32px] border border-rose-50 shadow-xl shadow-rose-100/10 active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-950 text-rose-100 font-black flex items-center justify-center shadow-lg">{getIniciales(p.nombre)}</div>
                <div className="flex-1">
                  <div className="font-black text-rose-950 uppercase tracking-tight">{p.nombre}</div>
                  <div className="text-[10px] text-rose-300 font-bold uppercase tracking-widest">{p.telefono || 'Sin teléfono'}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-400'}`}>
                  {p.estado === 'activo' ? 'Activo' : 'Pausa'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-rose-50/50">
                <div>
                  <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-1">Sesiones</div>
                  <div className="text-sm font-black text-rose-950 flex items-center gap-1">
                    <Activity size={14} className="text-rose-400" />
                    {p.numSesiones}
                  </div>
                </div>
                <div>
                   <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-1">Deuda</div>
                  <div className={`text-sm font-black ${p.deuda > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                    {p.deuda > 0 ? formatCOP(p.deuda) : 'Saldado'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {filteredPacientes.length === 0 && (
            <div className="col-span-1 py-12 text-center rounded-[32px] border-2 border-dashed border-rose-100 bg-rose-50/20">
               <p className="text-rose-300 font-black text-[10px] uppercase tracking-widest italic">No hay pacientes con ese nombre ✨</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block bg-white/80 backdrop-blur-sm rounded-[40px] shadow-xl shadow-rose-100/10 border border-rose-50 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-rose-50/30 border-b border-rose-50/50">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-rose-300 uppercase tracking-widest">Paciente</th>
                <th className="px-8 py-5 text-[10px] font-black text-rose-300 uppercase tracking-widest">Diagnóstico</th>
                <th className="px-8 py-5 text-[10px] font-black text-rose-300 uppercase tracking-widest text-center">Sesiones</th>
                <th className="px-8 py-5 text-[10px] font-black text-rose-300 uppercase tracking-widest text-right">Saldo</th>
                <th className="px-8 py-5 text-[10px] font-black text-rose-300 uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50/50">
              {filteredPacientes.map(p => (
                <tr key={p.id} className="hover:bg-rose-50/20 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-rose-950 text-rose-100 font-black flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">{getIniciales(p.nombre)}</div>
                      <div>
                        <div className="font-black text-rose-950 uppercase tracking-tight text-sm">{p.nombre}</div>
                        <div className="text-[9px] text-rose-300 font-bold uppercase tracking-widest">{p.telefono || 'Sin teléfono'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs text-rose-400 font-medium max-w-[200px] truncate">{p.diagnostico || '—'}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="text-sm font-black text-rose-950">{p.numSesiones}</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className={`text-sm font-black ${p.deuda > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                      {p.deuda > 0 ? formatCOP(p.deuda) : formatCOP(p.pagado)}
                    </div>
                    <div className="text-[8px] font-black text-rose-300 uppercase tracking-widest">
                      {p.deuda > 0 ? 'PENDIENTE' : 'PAGADO'}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`px-4 py-1.5 rounded-full inline-block text-[9px] font-black uppercase tracking-widest ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-400'}`}>
                      {p.estado === 'activo' ? 'Activo' : 'Pausa'}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Link href={`/pacientes/${p.id}`} className="p-3 text-rose-200 hover:text-rose-600 transition-colors inline-block">
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
