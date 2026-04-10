'use client'

import { X, AlertTriangle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  isDestructive = true
}: ConfirmModalProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setActive(true), 10)
    } else {
      setActive(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 transition-all duration-300 ${active ? 'bg-rose-950/40 backdrop-blur-md opacity-100' : 'bg-transparent backdrop-blur-none opacity-0'}`}>
      <div 
        className={`w-full max-w-sm bg-white rounded-[40px] shadow-[0_32px_80px_-16px_rgba(225,29,72,0.3)] border-4 border-white overflow-hidden transition-all duration-500 transform ${active ? 'translate-y-0 scale-100' : 'translate-y-12 scale-90'}`}
      >
        <div className="p-8">
           <div className="flex justify-between items-center mb-6">
              <div className={`p-4 rounded-[24px] ${isDestructive ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                 {isDestructive ? <AlertTriangle size={32} /> : <Trash2 size={32} />}
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
           </div>

           <div className="space-y-3 mb-8">
              <h3 className="text-2xl font-black text-rose-950 uppercase tracking-tighter leading-tight">
                {title}
              </h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">
                {message}
              </p>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onClose}
                className="py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors"
              >
                {cancelText}
              </button>
              <button 
                onClick={handleConfirm}
                className={`py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 ${isDestructive ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {confirmText}
              </button>
           </div>
        </div>
      </div>
    </div>
  )
}
