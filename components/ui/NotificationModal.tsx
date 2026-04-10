'use client'

import { X, CheckCircle, AlertCircle, Info, Sparkles, Flower2, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

export default function NotificationModal({ isOpen, onClose, type, title, message }: NotificationModalProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActive(true)
      const timer = setTimeout(() => {
        handleClose()
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = () => {
    setActive(false)
    setTimeout(onClose, 300)
  }

  if (!isOpen) return null

  const config = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: <CheckCircle className="text-emerald-500" size={32} />,
      titleColor: 'text-emerald-900',
      accent: <Flower2 className="text-emerald-100/50 absolute -right-4 -bottom-4" size={100} />
    },
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      icon: <AlertCircle className="text-rose-500" size={32} />,
      titleColor: 'text-rose-900',
      accent: <Heart className="text-rose-100/50 absolute -right-4 -bottom-4" size={100} />
    },
    info: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      icon: <Sparkles className="text-indigo-500" size={32} />,
      titleColor: 'text-indigo-900',
      accent: <Info className="text-indigo-100/50 absolute -right-4 -bottom-4" size={100} />
    }
  }

  const { bg, border, icon, titleColor, accent } = config[type]

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4 transition-all duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-full max-w-sm bg-white rounded-[40px] shadow-[0_32px_80px_-16px_rgba(225,29,72,0.25)] border-4 border-white overflow-hidden pointer-events-auto transition-all duration-500 transform ${active ? 'translate-y-0 scale-100' : 'translate-y-12 scale-90'}`}>
        <div className={`p-8 relative ${bg}`}>
          {accent}
          <div className="relative z-10 flex flex-col items-center text-center">
             <div className="mb-6 bg-white p-4 rounded-[28px] shadow-sm animate-bounce">
                {icon}
             </div>
             <h3 className={`text-2xl font-black mb-2 tracking-tighter uppercase ${titleColor}`}>
               {title}
             </h3>
             <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-[240px]">
               {message}
             </p>
          </div>
          <button 
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/50 rounded-full transition-colors text-slate-400"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-2 bg-white relative">
           <div className={`h-full bg-rose-500 transition-all duration-[3500ms] ease-linear ${active ? 'w-0' : 'w-full'}`}></div>
        </div>
      </div>
    </div>
  )
}
