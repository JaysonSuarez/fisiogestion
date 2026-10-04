import test from 'node:test'
import assert from 'node:assert/strict'
import { planSessionDates } from './session-schedule.ts'

test('interdiario pasa del sábado al lunes y continúa desde ahí cuando no acepta domingos', () => {
  assert.deepEqual(
    planSessionDates('2026-10-08', 5, 'dia_de_por_medio', [], false, '09:00'),
    ['2026-10-08', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19'],
  )
})

test('si acepta domingos, una sesión que cae sábado pasa al domingo y la frecuencia sigue desde ese día', () => {
  assert.deepEqual(
    planSessionDates('2026-10-08', 5, 'dia_de_por_medio', [], true, '09:00'),
    ['2026-10-08', '2026-10-11', '2026-10-13', '2026-10-15', '2026-10-18'],
  )
})

test('no programa domingos fuera del horario reducido aunque se hayan permitido', () => {
  assert.deepEqual(
    planSessionDates('2026-10-08', 3, 'dia_de_por_medio', [], true, '15:00'),
    ['2026-10-08', '2026-10-12', '2026-10-14'],
  )
})
