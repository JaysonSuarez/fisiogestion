import { createBrowserClient } from '@supabase/ssr'

// Cliente que apunta al Supabase de QR Encuesta (Liliana's Therapy)
// Permite validar y marcar como usados los cupones generados en la encuesta
export const supabaseEncuesta = createBrowserClient(
  process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_ENCUESTA_SUPABASE_ANON_KEY!
)
