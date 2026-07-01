import { createBrowserClient } from '@supabase/ssr'
import { User } from '@supabase/supabase-js'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let activeUserPromise: Promise<User | null> | null = null

export function getCachedUser(): Promise<User | null> {
  if (typeof window === 'undefined') {
    return supabase.auth.getUser().then(({ data: { user } }) => user)
  }
  
  if (!activeUserPromise) {
    activeUserPromise = supabase.auth.getUser().then(({ data: { user } }) => {
      return user
    }).catch(() => null)
  }
  return activeUserPromise
}

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange(() => {
    activeUserPromise = null
  })
}
