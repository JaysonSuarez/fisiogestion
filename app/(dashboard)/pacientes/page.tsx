import Link from 'next/link'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'
export const revalidate = 0


import { 
  Search, 
  Plus, 
  ChevronRight,
  Activity
} from 'lucide-react'

const formatCOP = (valor: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

const getIniciales = (nombre: string) => {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('')
}

export default async function PacientesPage() {
  // Fetch pacientes with their sessions to calculate totals
  const { data: pacientesRaw } = await supabase
    .from('pacientes')
    .select('*, sesiones(valor, estado_pago)')
    .order('nombre')

  const pacientes = pacientesRaw?.map(p => {
    const sesiones = p.sesiones || []
    const pagado = sesiones.filter((s:any) => s.estado_pago === 'pagado').reduce((acc:number, s:any) => acc + s.valor, 0)
    const deuda = sesiones.filter((s:any) => s.estado_pago === 'pendiente').reduce((acc:number, s:any) => acc + s.valor, 0)
    
    return {
      ...p,
      numSesiones: sesiones.length,
      pagado,
      deuda
    }
  }) || []

  return (
    <div className="max-w-7xl mx-auto">
      <header className="topbar">
        <div>
          <h2 className="font-display italic text-4xl mb-1">Pacientes</h2>
          <p className="text-slate-500 font-medium">{pacientes.length} totales en tu sistema</p>
        </div>
        <Link href="/pacientes/nuevo" className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          <span className="hidden sm:inline">Nuevo Paciente</span>
        </Link>
      </header>

      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, diagnóstico o teléfono..." 
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-sm transition-all outline-none text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 md:hidden gap-4">
          {pacientes.map(p => (
            <Link key={p.id} href={`/pacientes/${p.id}`} className="card active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4 mb-4">
                <div className="avatar uppercase">{getIniciales(p.nombre)}</div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{p.nombre}</div>
                  <div className="text-xs text-slate-400 font-medium">{p.telefono || 'Sin teléfono'}</div>
                </div>
                <div className={`badge ${p.estado === 'activo' ? 'badge-success' : 'badge-warning'}`}>
                  {p.estado === 'activo' ? 'Activo' : 'Pausa'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sesiones</div>
                  <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                    <Activity size={14} className="text-indigo-400" />
                    {p.numSesiones}
                  </div>
                </div>
                <div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deuda</div>
                  <div className={`text-sm font-bold ${p.deuda > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {p.deuda > 0 ? formatCOP(p.deuda) : 'Saldado'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {pacientes.length === 0 && (
            <div className="col-span-1 py-12 text-center card bg-slate-50 border-dashed border-slate-200">
               <p className="text-slate-400 font-medium">No se encontraron pacientes registrados</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block card overflow-hidden p-0">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Paciente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Diagnóstico</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Sesiones</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Saldo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pacientes.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="avatar uppercase">{getIniciales(p.nombre)}</div>
                      <div>
                        <div className="font-bold text-slate-800">{p.nombre}</div>
                        <div className="text-xs text-slate-400 font-medium">{p.telefono || 'Sin teléfono'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-500 font-medium max-w-[200px] truncate">{p.diagnostico || 'Sin diagnóstico'}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-bold text-slate-700">{p.numSesiones}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${p.deuda > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {p.deuda > 0 ? formatCOP(p.deuda) : formatCOP(p.pagado)}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      {p.deuda > 0 ? 'Pendiente' : 'Pagado'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`badge inline-block ${p.estado === 'activo' ? 'badge-success' : 'badge-warning'}`}>
                      {p.estado === 'activo' ? 'Activo' : 'En Pausa'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/pacientes/${p.id}`} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors inline-block">
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
              {pacientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium bg-slate-50/30">
                    No hay pacientes registrados en este momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
