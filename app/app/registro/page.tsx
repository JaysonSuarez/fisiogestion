import Link from 'next/link'
import { Heart, ChevronLeft } from 'lucide-react'

export default function PatientRegistroPage() {
  return <main className="min-h-screen bg-[#fffafa] flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-[40px] bg-white p-8 text-center shadow-xl">
      <Heart className="mx-auto mb-5 text-rose-500" size={40} fill="currentColor" />
      <h1 className="text-3xl font-black italic text-rose-950">Acceso para pacientes</h1>
      <p className="mt-3 text-sm leading-relaxed text-rose-400">Tu cuenta se habilita cuando la clínica registra tu ficha. Pide tus datos de acceso a tu fisioterapeuta.</p>
      <Link href="/app/login" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white">
        <ChevronLeft size={16} /> Ir a iniciar sesión
      </Link>
    </div>
  </main>
}
