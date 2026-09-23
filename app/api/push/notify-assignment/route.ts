import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { FISIOTERAPEUTAS, getFisioDeEmail } from '@/lib/utils'
import type { Fisioterapeuta } from '@/types'

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
    if (targetFisio === callerFisio) return NextResponse.json({ success: true, skipped: true })

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ target_fisio: targetFisio, title, body, url }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.warn('No se pudo enviar la notificación push:', result)
      return NextResponse.json({ success: false }, { status: 200 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error enviando notificación push de asignación:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
