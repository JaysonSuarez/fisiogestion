import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Devuelve el usuario autenticado a partir de las cookies de sesión, o null.
// Se usa para proteger rutas API que solo debe consumir el panel interno
// (p. ej. las rutas de IA que gastan cuota de Cohere).
export async function getApiUser() {
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
