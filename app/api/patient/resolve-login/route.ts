import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    const normalizeName = (value: string) => value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-CO')
    const firstName = normalizeName(String(username || '').trim().split(/\s+/)[0] || '')
    if (firstName.length < 2 || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Nombre o teléfono incorrecto.' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: profiles, error } = await admin.from('patient_profiles')
      .select('id,nombre,telefono').eq('cuenta_activa', true).limit(2000)
    if (error) throw error
    const matches = (profiles || []).filter((profile: any) =>
      normalizeName(profile.nombre.trim().split(/\s+/)[0] || '') === firstName
    )
    if (!matches.length) return NextResponse.json({ error: 'Nombre o contraseña incorrectos.' }, { status: 401 })

    const passwordDigits = password.replace(/\D/g, '')
    const initialPasswordMatches = /^\+?[\d\s().-]+$/.test(password)
      ? matches.filter((profile: any) => String(profile.telefono || '').replace(/\D/g, '') === passwordDigits)
      : []
    const candidates = initialPasswordMatches.length ? initialPasswordMatches : matches

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) throw new Error('Falta configurar Supabase.')
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    for (const profile of candidates) {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
      if (!authUser.user?.email) continue
      const { data, error: authError } = await authClient.auth.signInWithPassword({ email: authUser.user.email, password })
      if (!authError && data.session) {
        return NextResponse.json({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
    }
    return NextResponse.json({ error: 'Nombre o contraseña incorrectos.' }, { status: 401 })
  } catch (error: any) {
    console.error('Error al resolver acceso de paciente:', error)
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 })
  }
}
