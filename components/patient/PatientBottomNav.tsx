'use client'

import Link from 'next/link'
import { Home, CalendarPlus, CalendarDays, User } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function PatientBottomNav() {
  const pathname = usePathname()

  // Ocultar en rutas de auth
  if (
    pathname.includes('/login') ||
    pathname.includes('/registro') ||
    pathname.includes('/recuperar-password') ||
    pathname.includes('/reset-password')
  ) {
    return null
  }

  return (
    <nav className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-xl border-t border-rose-100 shadow-[0_-10px_40px_-15px_rgba(225,29,72,0.1)] z-50">
      <div className="max-w-md mx-auto px-6 h-20 flex items-center justify-between">
        <NavItem href="/app" icon={<Home size={24} />} label="Inicio" currentPath={pathname} exact />
        <NavItem href="/app/agendar" icon={<CalendarPlus size={24} />} label="Agendar" currentPath={pathname} />
        <NavItem href="/app/mis-citas" icon={<CalendarDays size={24} />} label="Mis Citas" currentPath={pathname} />
        <NavItem href="/app/perfil" icon={<User size={24} />} label="Perfil" currentPath={pathname} />
      </div>
    </nav>
  )
}

function NavItem({ href, icon, label, currentPath, exact = false }: { href: string; icon: React.ReactNode; label: string, currentPath: string, exact?: boolean }) {
  const isActive = exact ? currentPath === href : currentPath.startsWith(href)
  
  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center gap-1.5 transition-colors active:scale-95 ${
        isActive ? 'text-rose-600' : 'text-rose-300 hover:text-rose-500'
      }`}
    >
      <div className={isActive ? 'animate-bounce' : ''}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  )
}
