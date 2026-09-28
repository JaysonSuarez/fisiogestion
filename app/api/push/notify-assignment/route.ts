import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { FISIOTERAPEUTAS, getFisioDeEmail } from '@/lib/utils'
import type { Fisioterapeuta } from '@/types'
import { sendPushToFisio } from '@/lib/server/push'

export async function POST(req: Request) {
  const user = await getApiUser()
  if (!user?.email) return NextResponse.json({ error: 'Inicia sesión para enviar notificaciones.' }, { status: 401 })

  const email = user.email.toLowerCase()
  const isOwner = email.includes('liliana')
  const isTherapist = email.includes('jeniffer') || isOwner
  if (!isTherapist) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

  try {
    const input = await req.json()
    const targetFisio = input.targetFisio as Fisioterapeuta
    const title = String(input.title || '').slice(0, 120)
    const body = String(input.body || '').slice(0, 300)
    const url = String(input.url || '/agenda').slice(0, 200)

    if (!FISIOTERAPEUTAS.includes(targetFisio) || !title || !body || !url.startsWith('/')) {
      return NextResponse.json({ error: 'La notificación no es válida.' }, { status: 400 })
    }

    const callerFisio = getFisioDeEmail(email)
    if (!isOwner && targetFisio !== callerFisio) {
      return NextResponse.json({ error: 'No puedes notificar a otra fisioterapeuta.' }, { status: 403 })
    }
    if (targetFisio === callerFisio && targetFisio !== 'Jeniffer') return NextResponse.json({ success: true, skipped: true })

    const result = await sendPushToFisio(targetFisio, title, body, url)
    if (!result.delivered) {
      console.warn('No se pudo entregar la notificación push:', result)
      return NextResponse.json({ success: false, error: result.error || 'No se pudo entregar la notificación.' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error enviando notificación push de asignación:', error)
    return NextResponse.json({ success: false, error: 'No se pudo entregar la notificación.' }, { status: 502 })
  }
}
