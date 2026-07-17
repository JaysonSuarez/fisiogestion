'use client'

import { useEffect, useState } from 'react'
import { subscribeUser } from '@/lib/push-subscription'
import { BellRing, X } from 'lucide-react'

export default function PatientPushProvider() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Verificar si ya se pidió el permiso
    const permission = Notification.permission
    if (permission === 'default') {
      // Mostrar el pop-up después de 2 segundos de entrar a la app
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleActivar = async () => {
    const success = await subscribeUser('paciente')
    if (success) {
      setShowPrompt(false)
    } else {
      if (Notification.permission === 'denied') {
        alert('Por favor habilita las notificaciones en la configuración de tu navegador.')
      }
      setShowPrompt(false)
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-rose-950/20 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl shadow-rose-900/20 text-center relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-4 right-4 p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BellRing size={32} className="text-rose-500" />
        </div>
        
        <h3 className="text-xl font-black text-rose-950 mb-2 tracking-tighter">
          No te pierdas de nada
        </h3>
        <p className="text-sm text-rose-400 font-medium mb-8 leading-relaxed">
          Activa las notificaciones para recibir recordatorios de tus citas y sorpresas personalizadas de Liliana.
        </p>
        
        <button 
          onClick={handleActivar}
          className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-300 hover:bg-rose-700 transition-all active:scale-95"
        >
          Activar Notificaciones
        </button>
        <button 
          onClick={() => setShowPrompt(false)}
          className="w-full mt-3 py-3 text-rose-400 font-bold text-xs hover:text-rose-600 transition-colors"
        >
          Quizás más tarde
        </button>
      </div>
    </div>
  )
}
