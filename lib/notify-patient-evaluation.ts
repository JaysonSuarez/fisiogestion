export async function notifyPatientEvaluationReady(pacienteId: string, tipo: 'inicial' | 'reevaluacion') {
  try {
    const response = await fetch('/api/patient/evaluation-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pacienteId, tipo }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result?.notified !== true) {
      console.error('La evaluación se guardó, pero no se pudo entregar el push al paciente:', result?.error || response.status)
    }
  } catch (error) {
    console.error('No se pudo notificar al paciente:', error)
  }
}
