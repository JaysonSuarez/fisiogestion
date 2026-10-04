import test from 'node:test'
import assert from 'node:assert/strict'
import { planAppointmentSeriesReschedule } from './appointment-series.ts'

test('mueve solo las sesiones posteriores pendientes y evita que una fecha caiga sábado', () => {
  const appointments = [
    { id: 'a', fecha: '2026-10-05', hora_inicio: '09:00', notas: 'Sesión 1/4' },
    { id: 'b', fecha: '2026-10-13', hora_inicio: '09:00', notas: 'Sesión 2/4' },
    { id: 'c', fecha: '2026-10-17', hora_inicio: '09:00', notas: 'Sesión 3/4', estado: 'completada' },
    { id: 'd', fecha: '2026-10-20', hora_inicio: '09:00', notas: 'Sesión 4/4' },
  ]

  assert.deepEqual(
    planAppointmentSeriesReschedule(appointments, 'a', '2026-10-09', '10:00'),
    [
      { id: 'a', fecha: '2026-10-09', hora_inicio: '10:00' },
      { id: 'b', fecha: '2026-10-19', hora_inicio: '10:00' },
      { id: 'd', fecha: '2026-10-26', hora_inicio: '10:00' },
    ],
  )
})

test('no cambia una fecha nueva que ya es domingo', () => {
  const appointments = [
    { id: 'a', fecha: '2026-10-05', hora_inicio: '09:00', notas: 'Sesión 1/2' },
    { id: 'b', fecha: '2026-10-12', hora_inicio: '09:00', notas: 'Sesión 2/2' },
  ]

  assert.deepEqual(
    planAppointmentSeriesReschedule(appointments, 'a', '2026-10-11', '09:00'),
    [
      { id: 'a', fecha: '2026-10-11', hora_inicio: '09:00' },
      { id: 'b', fecha: '2026-10-18', hora_inicio: '09:00' },
    ],
  )
})
