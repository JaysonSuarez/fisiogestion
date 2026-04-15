'use client'

import React, { useState, useEffect } from 'react'
import { Heart, Sparkles } from 'lucide-react'

export default function SplashScreen() {
  const [show, setShow] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Verificar si ya mostramos el splash recientemente en esta sesión
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash')
    
    if (hasSeenSplash) {
      setShow(false)
      return
    }

    // Duración de carga entre 6 y 10 segundos
    // Usaremos 6 segundos para que no sea desesperante
    const splashDuration = 6000 
    
    // Iniciar el desvanecimiento un poco antes
    const fadeTimer = setTimeout(() => {
      setFadeOut(true)
    }, splashDuration - 1000)

    // Ocultar completamente
    const hideTimer = setTimeout(() => {
      setShow(false)
      sessionStorage.setItem('hasSeenSplash', 'true')
    }, splashDuration)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-[#fffafa] flex flex-col items-center justify-center transition-opacity duration-1000 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-100/40 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-200/30 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center animate-bounce-subtle">
        <div className="inline-flex p-6 bg-white rounded-[40px] shadow-2xl shadow-rose-200/60 mb-8 mt-[-10vh]">
          <Heart size={64} className="text-rose-500 animate-pulse" fill="currentColor" />
        </div>
        
        <h1 className="text-5xl font-black italic tracking-tighter text-rose-950 mb-3 flex items-center gap-2">
          FisioGestión <Sparkles className="text-rose-400" size={32} />
        </h1>
        
        <p className="text-rose-400 font-bold text-xs uppercase tracking-[0.4em] mb-12">
          Software de Bendición
        </p>

        <div className="w-48 h-2 bg-rose-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full animate-progress" />
        </div>
        <p className="mt-4 text-rose-300 text-xs font-medium animate-pulse">
          Preparando tu agenda...
        </p>
      </div>

      <p className="absolute bottom-10 text-center text-rose-300 text-[10px] font-bold uppercase tracking-widest italic">
         Hecho con ❤️ para la Fisio Liliana
      </p>

      <style jsx global>{`
        @keyframes progress {
          0% { width: 0%; }
          20% { width: 30%; }
          50% { width: 45%; }
          80% { width: 80%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 6s ease-in-out forwards;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8,0,1,1); }
          50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite;
        }
      `}</style>
    </div>
  )
}
