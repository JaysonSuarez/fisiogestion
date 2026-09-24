import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Devuelve el usuario autenticado a partir de las cookies de sesión, o null.
// Se usa para proteger rutas API que solo debe consumir el panel interno
// (p. ej. las rutas de IA que gastan cuota de Cohere).
export async function getApiUser(request?: Request) {
  const accessToken = request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (accessToken) {
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: { user } } = await authClient.auth.getUser(accessToken)
    return user
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
