import 'server-only'
import type { Fisioterapeuta } from '@/types'

type PushResult = { delivered: boolean; status?: number; error?: string }

export async function sendPushToFisio(
  targetFisio: Fisioterapeuta,
  title: string,
  body: string,
  url: string,
): Promise<PushResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Push no enviado: falta configuración administrativa de Supabase.')
    return { delivered: false, error: 'Configuración push incompleta.' }
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ target_fisio: targetFisio, title, body, url }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result?.success !== true) {
      const error = String(result?.error || `Respuesta ${response.status}`)
      console.error(`Push para ${targetFisio} no entregado:`, error)
      return { delivered: false, status: response.status, error }
    }
    return { delivered: true }
  } catch (error: any) {
    console.error(`Error enviando push a ${targetFisio}:`, error?.message || error)
    return { delivered: false, error: error?.message || 'Error de conexión.' }
  }
}
