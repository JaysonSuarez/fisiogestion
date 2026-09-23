import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agenda tu cita | FisioGestión',
  manifest: '/manifest-agendar.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agenda Fisio',
  },
}

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-white">
      {children}
    </div>
  )
}
