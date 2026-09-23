import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { esDuena, getFisioDeEmail } from '@/lib/utils'

export async function POST() {
  const staff = await getApiUser()
  if (!staff) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  if (!esDuena(getFisioDeEmail(staff.email))) return NextResponse.json({ error: 'Solo la administradora puede habilitar todos los accesos.' }, { status: 403 })
  try {
    const admin = getSupabaseAdmin()
    const { data: isPatient } = await admin.from('patient_profiles').select('id').eq('id', staff.id).maybeSingle()
    if (isPatient) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })

    const { data: patients, error: patientError } = await admin.from('pacientes')
      .select('id,nombre,telefono,diagnostico,edad,sexo,documento_identidad').order('nombre')
    if (patientError) throw patientError
    const { data: profiles, error: profilesError } = await admin.from('patient_profiles')
      .select('id,paciente_id,nombre,telefono,cuenta_preparada')
    if (profilesError) throw profilesError

    let created = 0
    let linked = 0
    let refreshed = 0
    let alreadyReady = 0
    let skipped = 0
    const linkedProfiles = new Set<string>()
    const loginIdentityCounts = new Map<string, number>()
    for (const patient of patients || []) {
      const phone = String(patient.telefono || '').replace(/\D/g, '')
      if (phone.length < 8) continue
      const firstName = patient.nombre.trim().split(/\s+/)[0].toLocaleLowerCase('es-CO')
      const key = `${firstName}:${phone}`
      loginIdentityCounts.set(key, (loginIdentityCounts.get(key) || 0) + 1)
    }

    for (const patient of patients || []) {
      const existing = (profiles || []).find((profile: any) => profile.paciente_id === patient.id)
      const normalizedPhone = String(patient.telefono || '').replace(/\D/g, '')
      const firstName = patient.nombre.trim().split(/\s+/)[0]
      if (normalizedPhone.length < 8) { skipped++; continue }

      if (existing) {
        if (existing.cuenta_preparada) { alreadyReady++; continue }
        const { error } = await admin.auth.admin.updateUserById(existing.id, {
          password: normalizedPhone,
          app_metadata: { role: 'patient', must_change_password: true },
        })
        if (error) { console.error(`No se pudo preparar el acceso de ${patient.id}:`, error); skipped++; continue }
        const { error: profileUpdateError } = await admin.from('patient_profiles').update({ cuenta_preparada: true }).eq('id', existing.id)
        if (profileUpdateError) { console.error(`No se pudo marcar la cuenta preparada de ${patient.id}:`, profileUpdateError); skipped++; continue }
        refreshed++
        continue
      }

      const identityKey = `${firstName.toLocaleLowerCase('es-CO')}:${normalizedPhone}`
      if ((loginIdentityCounts.get(identityKey) || 0) > 1) { skipped++; continue }

      const legacy = (profiles || []).find((profile: any) =>
        !profile.paciente_id && !linkedProfiles.has(profile.id) && profile.nombre.trim().split(/\s+/)[0].toLocaleLowerCase('es-CO') === firstName.toLocaleLowerCase('es-CO') &&
        String(profile.telefono || '').replace(/\D/g, '') === normalizedPhone
      )
      if (legacy) {
        const { error: authError } = await admin.auth.admin.updateUserById(legacy.id, {
          password: normalizedPhone,
          app_metadata: { role: 'patient', must_change_password: true },
        })
        if (authError) { console.error(`No se pudo activar la cuenta de ${patient.id}:`, authError); skipped++; continue }
        const { error } = await admin.from('patient_profiles').update({ paciente_id: patient.id, cuenta_preparada: true }).eq('id', legacy.id)
        if (error) throw error
        linkedProfiles.add(legacy.id)
        linked++
        continue
      }

      const { data: auth, error: authError } = await admin.auth.admin.createUser({
        email: `paciente-${patient.id}@cuentas.fisiogestion.invalid`,
        email_confirm: true,
        password: normalizedPhone,
        user_metadata: { role: 'patient' },
        app_metadata: { role: 'patient', must_change_password: true },
      })
      if (authError || !auth.user) {
        console.error(`No se pudo crear el acceso de ${patient.id}:`, authError)
        skipped++
        continue
      }
      const [nombre, ...apellidos] = patient.nombre.trim().split(/\s+/)
      const code = `LILO-${patient.id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
      const { error: insertError } = await admin.from('patient_profiles').insert({
        id: auth.user.id,
        paciente_id: patient.id,
        nombre,
        apellido: apellidos.join(' ') || nombre,
        telefono: patient.telefono,
        diagnostico: patient.diagnostico,
        edad: patient.edad,
        sexo: patient.sexo || 'No especificado',
        documento_numero: patient.documento_identidad || 'Pendiente',
        codigo_referido: code,
        cuenta_preparada: true,
      })
      if (insertError) {
        await admin.auth.admin.deleteUser(auth.user.id)
        console.error(`No se pudo guardar el perfil de ${patient.id}:`, insertError)
        skipped++
        continue
      }
      created++
    }

    return NextResponse.json({ created, linked, refreshed, alreadyReady, skipped })
  } catch (error: any) {
    console.error('No se pudieron habilitar accesos existentes:', error)
    return NextResponse.json({ error: error.message || 'No se pudieron habilitar los accesos.' }, { status: 500 })
  }
}
