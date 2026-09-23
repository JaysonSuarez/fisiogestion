'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function CambiarClavePage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 10) return setError('Usa al menos 10 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setSaving(true)
    try {
      const response = await fetch('/api/patient/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la contraseña.')
      const { error: sessionError } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token })
      if (sessionError) throw sessionError
      router.replace('/app')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return <main className="min-h-screen bg-[#fffafa] flex items-center justify-center p-6">
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[36px] bg-white p-8 shadow-xl space-y-5">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600"><Lock /></div>
      <div className="text-center"><h1 className="text-2xl font-black text-rose-950">Crea tu contraseña personal</h1><p className="mt-2 text-sm text-rose-400">Por seguridad, cambia la clave inicial antes de entrar.</p></div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-center text-sm font-bold text-rose-700">{error}</p>}
      <input type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-4 outline-none focus:border-rose-300" required />
      <input type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite la contraseña" className="w-full rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-4 outline-none focus:border-rose-300" required />
      <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-4 font-black text-white disabled:opacity-60">
        {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Guardar y continuar
      </button>
    </form>
  </main>
}
