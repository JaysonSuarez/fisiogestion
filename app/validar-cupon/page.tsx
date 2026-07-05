'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, CheckCircle2, XCircle, Clock, Loader2, Ticket, Tag, ArrowLeft } from 'lucide-react'
import { validarCupon as buscarCupon, reclamarCupon, type EstadoCupon, type ResultadoCupon } from '@/lib/cupones'

const STATUS_CONFIG: Record<EstadoCupon, { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }> = {
  valido:        { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'CUPÓN VÁLIDO' },
  expirado:      { icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'CUPÓN EXPIRADO' },
  usado:         { icon: XCircle,      color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    label: 'CUPÓN YA UTILIZADO' },
  no_encontrado: { icon: XCircle,      color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    label: 'CUPÓN NO ENCONTRADO' },
}

export default function ValidarCuponPage() {
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCupon | null>(null)

  async function handleValidar(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim() || loading) return

    setLoading(true)
    setResultado(null)
    const r = await buscarCupon(codigo)
    setResultado(r)
    setLoading(false)
  }

  async function marcarComoUsado() {
    if (!resultado?.codigo_cupon || marking) return
    setMarking(true)

    const ok = await reclamarCupon(resultado.codigo_cupon)
    // Si otro usuario lo reclamó primero, igualmente queda como usado.
    setResultado(prev => prev ? { ...prev, estado: 'usado' } : prev)
    if (!ok) {
      // no-op: el estado ya refleja "usado"
    }
    setMarking(false)
  }

  return (
    <div className="min-h-screen bg-[#fffafa] flex items-center justify-center p-4">
      {/* Botón volver */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-20 w-11 h-11 bg-white/80 backdrop-blur border border-rose-100 rounded-2xl flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-sm"
        aria-label="Volver al inicio"
      >
        <ArrowLeft size={20} />
      </Link>

      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-200/30 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center text-rose-950">
          <div className="inline-flex p-4 bg-white rounded-[32px] shadow-xl shadow-rose-200/50 mb-6">
            <Ticket size={40} className="text-rose-500" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-2">Validar Cupón</h1>
          <p className="text-rose-400 font-bold text-[10px] uppercase tracking-[0.3em]">Liliana's Therapy · FisioGestión</p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleValidar}
          className="bg-white/80 backdrop-blur-xl p-8 rounded-[48px] shadow-2xl shadow-rose-200/40 border border-white/50 space-y-5"
        >
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors"
              size={20}
            />
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="THERAPY10-XXXXX"
              className="w-full pl-12 pr-4 py-4 bg-rose-50/50 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-3xl outline-none transition-all font-medium text-rose-950 shadow-inner tracking-widest"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !codigo.trim()}
            className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-400 text-white rounded-3xl font-black tracking-[0.2em] shadow-xl shadow-rose-300/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs disabled:opacity-50 disabled:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Search size={16} /> Validar Cupón</>}
          </button>
        </form>

        {/* Resultado */}
        {resultado && (() => {
          const cfg = STATUS_CONFIG[resultado.estado]
          const Icon = cfg.icon
          return (
            <div className={`${cfg.bg} ${cfg.border} border p-6 rounded-[32px] shadow-xl space-y-4`}>
              {/* Estado */}
              <div className="flex items-center gap-3">
                <Icon size={28} className={cfg.color} />
                <span className={`font-black text-[11px] uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
              </div>

              {/* Descuento fijo */}
              {resultado.estado === 'valido' && (
                <div className="flex items-center gap-3 bg-white/60 rounded-2xl p-4">
                  <Tag size={20} className="text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-0.5">Descuento + Beneficio</div>
                    <div className="font-black text-rose-950 text-lg">Valoración Gratis · 10% OFF en planes</div>
                  </div>
                </div>
              )}

              {/* Nombre */}
              {resultado.nombre && (
                <div>
                  <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-0.5">Paciente</div>
                  <div className="font-black text-rose-950 text-lg">{resultado.nombre}</div>
                </div>
              )}

              {/* Objetivo */}
              {resultado.objetivo && (
                <div>
                  <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-0.5">Objetivo(s)</div>
                  <div className="font-medium text-rose-950 text-sm leading-relaxed">{resultado.objetivo}</div>
                </div>
              )}

              {/* Válido hasta */}
              {resultado.fecha_expiracion && (
                <div>
                  <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-0.5">
                    {resultado.estado === 'valido' ? 'Válido hasta' : 'Venció el'}
                  </div>
                  <div className="font-medium text-rose-950 text-sm">
                    {new Date(resultado.fecha_expiracion).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                  </div>
                </div>
              )}

              {/* Botón marcar como usado */}
              {resultado.estado === 'valido' && (
                <button
                  onClick={marcarComoUsado}
                  disabled={marking}
                  className="w-full py-4 bg-rose-950 text-white rounded-2xl font-black tracking-[0.15em] uppercase text-[11px] shadow-lg hover:bg-rose-900 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {marking ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Marcar como Utilizado</>}
                </button>
              )}

              {/* Botón nueva búsqueda */}
              <button
                onClick={() => { setResultado(null); setCodigo('') }}
                className="w-full py-3 border border-rose-200 text-rose-400 rounded-2xl font-bold tracking-[0.1em] uppercase text-[10px] hover:bg-rose-50 transition-all"
              >
                Nueva búsqueda
              </button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
