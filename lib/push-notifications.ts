import type { Fisioterapeuta } from '@/types'

type PushMessage = {
  targetFisio: Fisioterapeuta
  title: string
  body: string
  url?: string
}

/** Solicita una notificación al servidor; que falle el push no revierte el cambio guardado. */
export async function notifyFisioPush(message: PushMessage) {
  try {
    const response = await fetch('/api/push/notify-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    if (!response.ok) console.warn('No se pudo enviar el aviso push al fisioterapeuta.')
  } catch (error) {
    console.warn('No se pudo enviar el aviso push al fisioterapeuta:', error)
  }
}
