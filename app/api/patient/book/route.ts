import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isHolidayColombia } from '@/lib/colombian-holidays'

const FIXED_PLANS: Record<string, { sesiones: number; precio: number; label: string }> = {
  evaluacion: { sesiones: 1, precio: 30000, label: 'Valoración' },
  'descarga-muscular': { sesiones: 1, precio: 100000, label: 'Descarga Muscular' },
  'recovery-premium': { sesiones: 1, precio: 100000, label: 'Recovery Premium' },
  'recovery-star': { sesiones: 5, precio: 350000, label: 'Recovery Star' },
  'recovery-balance': { sesiones: 10, precio: 700000, label: 'Recovery Balance' },
}

function customPrice(count: number) {
  return count <= 3 ? count * 80000 : count === 4 ? count * 75000 : count * 70000
}

function isAllowedSlot(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false
  const day = new Date(`${date}T12:00:00`).getDay()
  if (day === 6) return false
  const allowed = day === 0 || isHolidayColombia(date)
    ? ['08:00', '09:00', '10:00', '11:00']
    : ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
  return allowed.includes(time)
}

function isFutureInBogota(date: string, time: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).reduce((all: Record<string, string>, part) => {
    all[part.type] = part.value
    return all
  }, {})
  const today = `${parts.year}-${parts.month}-${parts.day}`
  if (date > today) return true
  if (date < today) return false
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute > Number(parts.hour) * 60 + Number(parts.minute)
}

function todayInBogota() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((all: Record<string, string>, part) => {
    all[part.type] = part.value
    return all
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

export async function POST(req: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para reservar.' }, { status: 401 })

  try {
    const input = await req.json()
    const admin = getSupabaseAdmin()
    const { data: profile, error: profileError } = await admin.from('patient_profiles')
      .select('*').eq('id', user.id).single()
    if (profileError || !profile) return NextResponse.json({ error: 'Perfil de paciente no encontrado.' }, { status: 403 })
    if (profile.cuenta_activa === false) return NextResponse.json({ error: 'Tu acceso está pausado. Comunícate con la clínica.' }, { status: 403 })

    const planId = String(input.plan?.id || '')
    const customCount = Number(input.plan?.sesiones)
    const plan = planId === 'personalizado'
      ? (Number.isInteger(customCount) && customCount >= 2 && customCount <= 20
        ? { sesiones: customCount, precio: customPrice(customCount), label: 'Personalizado' }
        : null)
      : FIXED_PLANS[planId]
    if (!plan) return NextResponse.json({ error: 'El paquete seleccionado no es válido.' }, { status: 400 })

    const slots = input.slots
    if (!Array.isArray(slots) || slots.length !== plan.sesiones) {
      return NextResponse.json({ error: `Selecciona exactamente ${plan.sesiones} horario(s).` }, { status: 400 })
    }
    const uniqueSlots = new Set<string>()
    for (const slot of slots) {
      if (!slot || !isAllowedSlot(String(slot.fecha), String(slot.hora))) {
        return NextResponse.json({ error: 'Uno de los horarios ya no está disponible.' }, { status: 400 })
      }
      const stamp = `${slot.fecha}T${slot.hora}`
      if (uniqueSlots.has(stamp) || !isFutureInBogota(String(slot.fecha), String(slot.hora))) {
        return NextResponse.json({ error: 'Revisa las fechas y horas seleccionadas.' }, { status: 400 })
      }
      uniqueSlots.add(stamp)
    }

    const orderedSlots = [...slots].sort((a: any, b: any) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
    const dates = Array.from(new Set(orderedSlots.map((s: any) => s.fecha)))
    const { data: busy, error: busyError } = await admin.from('citas')
      .select('fecha,hora_inicio,duracion_minutos')
      .in('fecha', dates).neq('estado', 'cancelada')
    if (busyError) throw busyError
    for (const slot of orderedSlots) {
      const start = slot.hora.split(':').map(Number).reduce((h: number, n: number, i: number) => h + n * (i === 0 ? 60 : 1), 0)
      const overlap = (busy || []).some((c: any) => {
        if (c.fecha !== slot.fecha) return false
        const [h, m] = c.hora_inicio.slice(0, 5).split(':').map(Number)
        const occupiedStart = h * 60 + m
        const occupiedEnd = occupiedStart + (c.duracion_minutos || 60)
        return start < occupiedEnd && occupiedStart < start + 60
      })
      if (overlap) return NextResponse.json({ error: 'Ese horario acaba de ocuparse. Elige otro.' }, { status: 409 })
    }

    let promo: any = null
    if (input.activePromo?.id) {
      const { data } = await admin.from('promociones').select('id,titulo,porcentaje_descuento,fecha_inicio,fecha_fin')
        .eq('id', input.activePromo.id).eq('activa', true).maybeSingle()
      const today = todayInBogota()
      if (data && (!data.fecha_inicio || data.fecha_inicio <= today) && (!data.fecha_fin || data.fecha_fin >= today)) promo = data
      if (!promo) return NextResponse.json({ error: 'Esta promoción ya no está disponible. Actualiza la página y revisa las promociones vigentes.' }, { status: 409 })
    }

    const useFree = input.usarSesionGratis === true && !promo && (profile.sesiones_gratis || 0) > 0
    const useReferral = !promo && !useFree && (profile.descuentos_disponibles || 0) > 0
    const requestedDiscount = promo ? Number(promo.porcentaje_descuento || 0) : (useReferral ? 15 : 0)
    const discountPercent = Math.min(100, Math.max(0, requestedDiscount))
    let total = Math.round(plan.precio * (1 - discountPercent / 100))
    if (useFree) total = plan.precio - Math.round(plan.precio / plan.sesiones)
    const home = input.esDomicilio === true
    if (home) total += plan.sesiones * 10000

    let patientId = profile.paciente_id
    if (!patientId) {
      const { data: patient, error } = await admin.from('pacientes').insert({
        nombre: `${profile.nombre} ${profile.apellido}`,
        telefono: profile.telefono,
        diagnostico: input.motivo || profile.diagnostico,
        estado: 'activo',
      }).select('id').single()
      if (error) throw error
      patientId = patient.id
      await admin.from('patient_profiles').update({ paciente_id: patientId }).eq('id', user.id)
    }

    const { data: session, error: sessionError } = await admin.from('sesiones').insert({
      paciente_id: patientId,
      fecha: orderedSlots[0].fecha,
      duracion_minutos: plan.sesiones * 60,
      valor: total,
      metodo_pago: 'pendiente',
      estado_pago: 'pendiente',
      nota_clinica: input.motivo || null,
    }).select('id').single()
    if (sessionError) throw sessionError

    const notes = [
      promo ? `Promoción: ${promo.titulo}.` : useReferral ? 'Descuento de referido del 15%.' : '',
      home ? 'DOMICILIO.' : '',
    ].filter(Boolean).join(' ')
    const { error: appointmentsError } = await admin.from('citas').insert(orderedSlots.map((slot: any) => ({
      paciente_id: patientId,
      sesion_id: session.id,
      fecha: slot.fecha,
      hora_inicio: slot.hora,
      duracion_minutos: 60,
      estado: 'confirmada',
      notas: notes,
      paciente_notificado_1h: false,
      paciente_notificado_15m: false,
    })))
    if (appointmentsError) {
      await admin.from('sesiones').delete().eq('id', session.id)
      if (appointmentsError.code === '23P01' || appointmentsError.code === '23505') {
        return NextResponse.json({ error: 'Uno de los horarios acaba de ocuparse. Elige otro.' }, { status: 409 })
      }
      throw appointmentsError
    }

    if (useReferral) await admin.from('patient_profiles').update({ descuentos_disponibles: profile.descuentos_disponibles - 1 }).eq('id', user.id)
    if (useFree) await admin.from('patient_profiles').update({ sesiones_gratis: profile.sesiones_gratis - 1 }).eq('id', user.id)

    if (profile.referido_por && !profile.ya_dio_recompensa_referido) {
      const { data: referrer } = await admin.from('patient_profiles')
        .select('descuentos_disponibles,referidos_completados,sesiones_gratis')
        .eq('id', profile.referido_por).maybeSingle()
      if (referrer) {
        const referrals = (referrer.referidos_completados || 0) + 1
        const isSeventh = referrals % 7 === 0
        await admin.from('patient_profiles').update({
          referidos_completados: referrals,
          ...(isSeventh
            ? { sesiones_gratis: (referrer.sesiones_gratis || 0) + 1 }
            : { descuentos_disponibles: (referrer.descuentos_disponibles || 0) + 1 }),
        }).eq('id', profile.referido_por)
        await admin.from('patient_profiles').update({ ya_dio_recompensa_referido: true }).eq('id', user.id)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              target_user_id: profile.referido_por,
              title: 'Tienes una nueva recompensa',
              body: isSeventh ? 'Completaste 7 referidos: tienes una sesión gratis.' : 'Tienes un nuevo descuento disponible.',
              url: '/app/perfil',
            }),
          })
        } catch { /* La recompensa ya quedó guardada; el aviso se puede omitir. */ }
      }
    }

    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          target_role: 'profesional', title: 'Nueva reserva de paciente',
          body: `${profile.nombre} reservó ${plan.sesiones} sesión(es).`, url: '/agenda',
        }),
      })
    } catch { /* La reserva no debe fallar si el aviso al personal falla. */ }

    return NextResponse.json({ success: true, total, currency: 'COP' })
  } catch (error: any) {
    console.error('No se pudo completar la reserva:', error)
    return NextResponse.json({ error: error.message || 'No se pudo completar la reserva.' }, { status: 500 })
  }
}
