import { createBrowserClient } from '@supabase/ssr'

// Cliente hacia el Supabase de QR Encuesta (Liliana's Therapy).
// Se crea de forma perezosa y SOLO en el navegador (dentro de los handlers),
// para no romper el build de Next.js durante el prerender del servidor,
// cuando las variables de entorno podrían no estar disponibles todavía.
let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseEncuesta() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_ANON_KEY!
    )
  }
  return client
}
