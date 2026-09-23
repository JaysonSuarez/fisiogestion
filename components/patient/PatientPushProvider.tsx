'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { BellRing, CheckCircle2, X } from 'lucide-react'
import { subscribeUser } from '@/lib/push-subscription'
import { getCachedUser, supabase } from '@/lib/supabase'

const PROMPT_SEEN_KEY = 'patient-notifications-prompt-seen'

type PatientPushContextValue = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isActivating: boolean
  message: string
  activate: () => Promise<boolean>
}

const PatientPushContext = createContext<PatientPushContextValue | null>(null)

export function usePatientPush() {
  const context = useContext(PatientPushContext)
  if (!context) throw new Error('usePatientPush debe usarse dentro de PatientPushProvider')
  return context
}

export default function PatientPushProvider({ children }: { children: ReactNode }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(canPush)
    if (!canPush) {
      setPermission('unsupported')
      return
    }

    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function prepare(hasSession = false) {
      const user = hasSession || await getCachedUser()
      if (!active || !user) return

      const currentPermission = Notification.permission
      setPermission(currentPermission)

      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (active) setIsSubscribed(!!subscription)
      } catch (error) {
        console.error('No se pudo consultar la suscripción de notificaciones:', error)
      }

      if (currentPermission === 'default' && !localStorage.getItem(PROMPT_SEEN_KEY)) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          if (!active) return
          localStorage.setItem(PROMPT_SEEN_KEY, '1')
          setShowPrompt(true)
        }, 1200)
      }
    }

    prepare()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) window.setTimeout(() => { void prepare(true) }, 0)
    })
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const activate = useCallback(async () => {
    setMessage('')
    if (!supported) {
      setMessage('Este navegador no admite notificaciones para la app.')
      return false
    }
    if (permission === 'denied') {
      setMessage('Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador y vuelve a intentarlo.')
      return false
    }

    setIsActivating(true)
    try {
      const success = await subscribeUser('paciente')
      const currentPermission = Notification.permission
      setPermission(currentPermission)
      setIsSubscribed(success)
      if (success) {
        localStorage.setItem(PROMPT_SEEN_KEY, '1')
        setShowPrompt(false)
        setMessage('Notificaciones activadas en este dispositivo.')
      } else if (currentPermission === 'denied') {
        setMessage('Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador y vuelve a intentarlo.')
      } else {
        setMessage('No se pudieron activar. Revisa tu conexión e inténtalo de nuevo.')
      }
      return success
    } finally {
      setIsActivating(false)
    }
  }, [permission, supported])

  const closePrompt = () => {
    localStorage.setItem(PROMPT_SEEN_KEY, '1')
    setShowPrompt(false)
  }

  return (
    <PatientPushContext.Provider value={{ supported, permission, isSubscribed, isActivating, message, activate }}>
      {children}
      {showPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-rose-950/30 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="patient-notifications-title" className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center relative">
            <button onClick={closePrompt} aria-label="Cerrar" className="absolute top-4 right-4 p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full"><X size={20} /></button>
            <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><BellRing size={32} className="text-rose-500" /></div>
            <h3 id="patient-notifications-title" className="text-xl font-black text-rose-950 mb-2 tracking-tighter">Recibe recordatorios de tus citas</h3>
            <p className="text-sm text-rose-400 font-medium mb-7 leading-relaxed">Activa las notificaciones para recibir avisos importantes y novedades de la clínica en este dispositivo.</p>
            <button onClick={activate} disabled={isActivating} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-rose-700 disabled:opacity-50">
              {isActivating ? 'Activando…' : 'Activar notificaciones'}
            </button>
            <button onClick={closePrompt} className="w-full mt-3 py-3 text-rose-400 font-bold text-xs hover:text-rose-600">Quizás más tarde</button>
          </div>
        </div>
      )}
    </PatientPushContext.Provider>
  )
}

export function PatientNotificationCard() {
  const { supported, permission, isSubscribed, isActivating, message, activate } = usePatientPush()

  return (
    <section className="mb-7 rounded-3xl border border-rose-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-2xl p-3 ${isSubscribed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
          {isSubscribed ? <CheckCircle2 size={20} /> : <BellRing size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-rose-950">{isSubscribed ? 'Notificaciones activadas' : 'Activa tus notificaciones'}</h2>
          <p className="mt-1 text-xs text-rose-400">Recibe recordatorios para no olvidar tus citas.</p>
        </div>
      </div>
      {!isSubscribed && (
        <button onClick={activate} disabled={!supported || isActivating} className="mt-3 w-full rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700 disabled:opacity-50">
          {isActivating ? 'Activando…' : permission === 'denied' ? 'Revisar ajustes del navegador' : 'Activar notificaciones'}
        </button>
      )}
      {!supported && <p className="mt-3 text-xs text-amber-700">Este navegador no admite notificaciones push.</p>}
      {message && <p role="status" className="mt-3 text-xs font-bold text-rose-500">{message}</p>}
    </section>
  )
}
