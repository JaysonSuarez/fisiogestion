'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'

export default function ServiceWorkerUpdateManager() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const acceptedUpdate = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    let active = true
    let currentRegistration: ServiceWorkerRegistration | null = null
    let updateInterval: number | undefined

    const showWaitingUpdate = () => {
      if (active && currentRegistration?.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
      }
    }

    const onControllerChange = () => {
      if (acceptedUpdate.current) window.location.reload()
    }

    const onFocus = () => {
      void currentRegistration?.update().catch(error => {
        console.error('No se pudo revisar si hay una actualización de la app:', error)
      })
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('focus', onFocus)

    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(nextRegistration => {
        if (!active) return
        currentRegistration = nextRegistration
        setRegistration(nextRegistration)
        showWaitingUpdate()

        nextRegistration.addEventListener('updatefound', () => {
          const worker = nextRegistration.installing
          if (!worker) return

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
              setInstallingUpdate(false)
            }
          })
        })

        updateInterval = window.setInterval(onFocus, 60 * 1000)
        onFocus()
      })
      .catch(error => console.error('No se pudo registrar la app instalable:', error))

    return () => {
      active = false
      if (updateInterval) window.clearInterval(updateInterval)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const installUpdate = () => {
    const waitingWorker = registration?.waiting
    if (!waitingWorker || installingUpdate) return

    acceptedUpdate.current = true
    setInstallingUpdate(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-20 left-4 z-[120] max-w-[calc(100vw-2rem)] rounded-2xl border border-rose-100 bg-white p-3 shadow-xl shadow-rose-950/15 sm:bottom-5 sm:left-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          {installingUpdate ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-900">Hay una actualización disponible</p>
          <p className="mt-0.5 text-[10px] font-medium text-slate-500">Descárgala para usar la versión nueva.</p>
        </div>
        <button
          type="button"
          onClick={installUpdate}
          disabled={installingUpdate}
          className="shrink-0 rounded-xl bg-rose-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-rose-700 disabled:opacity-70"
        >
          {installingUpdate ? 'ACTUALIZANDO…' : 'ACTUALIZAR'}
        </button>
      </div>
    </div>
  )
}
