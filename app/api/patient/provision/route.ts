import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  try {
    const staff = await getApiUser()
    if (!staff) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data: existingPatientProfile } = await admin
      .from('patient_profiles').select('id').eq('id', staff.id).maybeSingle()
    if (existingPatientProfile) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

    const { patientId, referralCode, password: requestedPassword } = await req.json()
    if (typeof patientId !== 'string') return NextResponse.json({ error: 'Paciente inválido.' }, { status: 400 })

    const { data: patient, error: patientError } = await admin
      .from('pacientes')
      .select('id,nombre,telefono,diagnostico,edad,sexo,documento_identidad')
      .eq('id', patientId)
      .single()
    if (patientError || !patient) return NextResponse.json({ error: 'No encontramos al paciente.' }, { status: 404 })

    const { data: linkedProfile } = await admin
      .from('patient_profiles').select('id').eq('paciente_id', patient.id).maybeSingle()
    if (linkedProfile) return NextResponse.json({ created: false, username: patient.nombre.trim().split(/\s+/)[0] })

    const [nombre, ...apellidos] = patient.nombre.trim().split(/\s+/)
    const digits = (patient.telefono || '').replace(/\D/g, '')
    const hasValidPhone = /^\+?[\d\s().-]+$/.test(String(patient.telefono || '').trim()) && digits.length >= 8
    const password = typeof requestedPassword === 'string' && requestedPassword.trim()
      ? requestedPassword.trim()
      : hasValidPhone ? digits : ''
    if (!nombre || password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'Ingresa una contraseña inicial de 8 a 72 caracteres, o registra un teléfono válido.' }, { status: 400 })
    }

    const { data: activeProfiles, error: profileLookupError } = await admin.from('patient_profiles')
      .select('nombre,telefono').eq('cuenta_activa', true)
    if (profileLookupError) throw profileLookupError
    const firstNameKey = nombre.toLocaleLowerCase('es-CO')
    const hasAmbiguousLogin = (activeProfiles || []).some((profile: any) =>
      profile.nombre.trim().split(/\s+/)[0].toLocaleLowerCase('es-CO') === firstNameKey &&
      hasValidPhone && String(profile.telefono || '').replace(/\D/g, '') === digits
    )
    if (hasAmbiguousLogin) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese primer nombre y teléfono. Revisa la ficha antes de habilitar el acceso.' }, { status: 409 })
    }

    let referredBy: string | null = null
    if (typeof referralCode === 'string' && referralCode.trim()) {
      const { data: referrer } = await admin.from('patient_profiles').select('id')
        .eq('codigo_referido', referralCode.trim().toUpperCase()).maybeSingle()
      if (!referrer) return NextResponse.json({ error: 'El código de referido no existe. Revisa el código y vuelve a intentarlo.' }, { status: 400 })
      referredBy = referrer.id
    }

    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email: `paciente-${patient.id}@cuentas.fisiogestion.invalid`,
      email_confirm: true,
      password,
      user_metadata: { role: 'patient' },
      app_metadata: { role: 'patient', must_change_password: false },
    })
    if (authError || !auth.user) throw authError || new Error('No se pudo crear el acceso del paciente.')

    const code = `LILO-${patient.id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
    const { error: profileError } = await admin.from('patient_profiles').insert({
      id: auth.user.id,
      paciente_id: patient.id,
      nombre,
      apellido: apellidos.join(' ') || nombre,
      telefono: hasValidPhone ? patient.telefono : '',
      diagnostico: patient.diagnostico,
      edad: patient.edad,
      sexo: patient.sexo || 'No especificado',
      documento_numero: patient.documento_identidad || 'Pendiente',
      codigo_referido: code,
      referido_por: referredBy,
      cuenta_activa: true,
      cuenta_preparada: true,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(auth.user.id)
      throw profileError
    }

    if (!hasValidPhone && patient.telefono) {
      const { error: phoneError } = await admin.from('pacientes').update({ telefono: '' }).eq('id', patient.id)
      if (phoneError) {
        await admin.auth.admin.deleteUser(auth.user.id)
        throw phoneError
      }
    }

    return NextResponse.json({ created: true, username: nombre, initialPassword: password })
  } catch (error: any) {
    console.error('No se pudo habilitar el acceso del paciente:', error)
    return NextResponse.json({ error: error.message || 'No se pudo crear el acceso.' }, { status: 500 })
  }
}
