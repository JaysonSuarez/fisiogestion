'use client'

import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

export default function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt()
      setInstallPrompt(null)
      return
    }
    if (ios) {
      window.alert('En Safari, toca Compartir y elige “Agregar a pantalla de inicio”.')
      return
    }
    window.alert('Abre el menú del navegador y selecciona “Instalar app” o “Agregar a pantalla de inicio”.')
  }

  if (installed) return null
  return <section className="mb-7 rounded-3xl border border-rose-100 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-rose-50 p-3 text-rose-500">{ios ? <Share size={19} /> : <Download size={19} />}</div>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-rose-950">Lleva la app en tu celular</h2><p className="mt-1 text-xs text-rose-400">Agrégala a tu pantalla de inicio para abrirla fácilmente.</p></div>
    </div>
    <button onClick={install} className="mt-3 w-full rounded-2xl bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-600">{ios ? 'Cómo agregarla' : 'Instalar app'}</button>
  </section>
}
