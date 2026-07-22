import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const { plan, slots, motivo, user_id, esDomicilio, usarSesionGratis, usoDescuento, activePromo } = await req.json()
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Usamos service role para saltar RLS en inserciones complejas
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // 1. Obtener perfil del paciente
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('id', user_id)
      .single()

    if (!profile) throw new Error('Perfil no encontrado')

    let pacienteId = profile.paciente_id

    // 2. Si no tiene paciente_id, crearlo en la tabla pacientes (Dashboard)
    if (!pacienteId) {
      const { data: newPaciente, error: pacError } = await supabase
        .from('pacientes')
        .insert({
          nombre: `${profile.nombre} ${profile.apellido}`,
          telefono: profile.telefono,
          diagnostico: motivo || profile.diagnostico,
          estado: 'activo'
        })
        .select('id')
        .single()
      
      if (pacError) throw pacError
      pacienteId = newPaciente.id

      // Actualizar perfil con el paciente_id
      await supabase.from('patient_profiles').update({ paciente_id: pacienteId }).eq('id', user_id)
    }

    // 3. Aplicar descuento o sesión gratis
    let precioTotal = plan.precio
    let notasPromo = ''

    if (activePromo && activePromo.porcentaje_descuento) {
      const ratio = 1 - (activePromo.porcentaje_descuento / 100)
      precioTotal = Math.round(plan.precio * ratio)
      notasPromo = `Aplicó Promo: ${activePromo.titulo}. `
    } else if (usarSesionGratis && profile.sesiones_gratis > 0) {
      const precioPorSesion = Math.round(plan.precio / plan.sesiones)
      precioTotal = plan.precio - precioPorSesion
    } else if (usoDescuento && profile.descuentos_disponibles > 0) {
      precioTotal = Math.round(plan.precio * 0.85)
    }

    // Sumar domicilio si aplica
    if (esDomicilio) {
      precioTotal += plan.sesiones * 10000
    }

    // 4. Crear la Sesión (Plan)
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .insert({
        paciente_id: pacienteId,
        fecha: slots[0].fecha,
        duracion_minutos: plan.sesiones * 60,
        valor: precioTotal,
        metodo_pago: 'pendiente',
        estado_pago: 'pendiente',
        nota_clinica: motivo
      })
      .select('id')
      .single()

    if (sesionError) throw sesionError

    // 5. Crear las Citas
    const citasToInsert = slots.map((s: any) => ({
      paciente_id: pacienteId,
      sesion_id: sesion.id,
      fecha: s.fecha,
      hora_inicio: s.hora,
      duracion_minutos: 60,
      estado: 'confirmada', // ¡Directamente confirmada!
      notas: notasPromo + (usoDescuento && !activePromo ? 'Aplicó descuento 15% por referido. ' : '') + (esDomicilio ? 'DOMICILIO.' : '')
    }))

    const { error: citasError } = await supabase.from('citas').insert(citasToInsert)
    if (citasError) throw citasError

    // 6. Restar descuento o sesión gratis si se usó
    if (usoDescuento && !activePromo) {
      await supabase
        .from('patient_profiles')
        .update({ descuentos_disponibles: profile.descuentos_disponibles - 1 })
        .eq('id', user_id)
    } else if (usarSesionGratis) {
      await supabase
        .from('patient_profiles')
        .update({ sesiones_gratis: profile.sesiones_gratis - 1 })
        .eq('id', user_id)
    }

    // 7. Lógica de recompensas para referidor (Solo se activa una vez por referido)
    if (profile.referido_por && !profile.ya_dio_recompensa_referido) {
      const { data: referrer } = await supabase
        .from('patient_profiles')
        .select('descuentos_disponibles, referidos_completados, sesiones_gratis')
        .eq('id', profile.referido_por)
        .single()
      
      if (referrer) {
        const nuevosReferidos = (referrer.referidos_completados || 0) + 1
        const updates: any = { referidos_completados: nuevosReferidos }
        let pushMessage = '¡Alguien usó tu código! Tienes un 15% de descuento.'
        
        // Si es múltiplo de 7 (ej. 7mo referido), dar sesión gratis. Si no, dar 15% desc (máximo acumulado de 1 para simplificar, o simplemente +1 a descuentos_disponibles)
        if (nuevosReferidos % 7 === 0) {
          updates.sesiones_gratis = (referrer.sesiones_gratis || 0) + 1
          pushMessage = '¡Felicidades! Lograste tu 7mo referido. ¡Tienes una sesión GRATIS!'
        } else {
          updates.descuentos_disponibles = (referrer.descuentos_disponibles || 0) + 1
        }

        await supabase.from('patient_profiles').update(updates).eq('id', profile.referido_por)
        await supabase.from('patient_profiles').update({ ya_dio_recompensa_referido: true }).eq('id', user_id)

        // Notificar al referidor
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              target_user_id: profile.referido_por,
              title: '¡Recompensa de Referido! 🎁',
              body: pushMessage,
              url: '/app/perfil'
            }),
          })
        } catch (e) {
          console.error('Error notificando al referidor', e)
        }
      }
    }

    // 8. Notificar a Liliana
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          target_role: 'profesional',
          title: '¡Nueva Cita Confirmada! 🎉',
          body: `${profile.nombre} agendó ${plan.sesiones} sesiones${esDomicilio ? ' a DOMICILIO' : ''}.`,
          url: '/'
        }),
      })
    } catch(e) {
      console.error('Error notificando a Liliana', e)
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
