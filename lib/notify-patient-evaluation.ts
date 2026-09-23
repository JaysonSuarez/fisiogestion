export async function notifyPatientEvaluationReady(pacienteId: string, tipo: 'inicial' | 'reevaluacion') {
  try {
    await fetch('/api/patient/evaluation-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pacienteId, tipo }),
    })
  } catch (error) {
    console.error('No se pudo notificar al paciente:', error)
  }
}
