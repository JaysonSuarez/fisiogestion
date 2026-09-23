import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 })
  try {
    const { password } = await req.json()
    if (typeof password !== 'string' || password.length < 10) {
      return NextResponse.json({ error: 'Usa una contraseña de al menos 10 caracteres.' }, { status: 400 })
    }
    const admin = getSupabaseAdmin()
    const { data: profile } = await admin.from('patient_profiles').select('id').eq('id', user.id).maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Esta opción es para cuentas de pacientes.' }, { status: 403 })

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: { role: 'patient', must_change_password: false },
    })
    if (error) throw error
    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(user.id)
    if (authUserError || !authUser.user?.email) throw authUserError || new Error('No se pudo renovar la sesión.')
    const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email: authUser.user.email, password })
    if (signInError || !signedIn.session) throw signInError || new Error('No se pudo renovar la sesión.')
    return NextResponse.json({ success: true, access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'No se pudo actualizar la contraseña.' }, { status: 500 })
  }
}
