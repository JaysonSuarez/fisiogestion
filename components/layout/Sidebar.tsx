'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useEffect } from 'react'
import {
  LayoutDashboard, Users, CalendarDays, Wallet,
  ClipboardList, Heart, Menu, Sparkles, Flower2, Flower, Sprout, Moon, Sun, Stars, Settings, FileText
} from 'lucide-react'

const navItems = [
  { href: '/',          label: 'Inicio',      icon: LayoutDashboard },
  { href: '/pacientes', label: 'Pacientes',   icon: Users },
  { href: '/evaluaciones', label: 'Evaluaciones', icon: FileText },
  { href: '/sesiones',  label: 'Planes',      icon: ClipboardList },
  { href: '/agenda',    label: 'Calendario',  icon: CalendarDays },
  { href: '/finanzas',  label: 'Finanzas',    icon: Wallet },
  { href: '/diezmo',    label: 'Diezmo',      icon: Heart },
  { href: '/ajustes',   label: 'Ajustes',     icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      const activeItem = scrollRef.current.querySelector('.active-mobile-item')
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [pathname])

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar !bg-[#fff5f6] relative overflow-hidden flex flex-col">
        {/* Decorative background icons */}
        <div className="absolute -top-10 -left-10 text-rose-100 opacity-20 rotate-12 -z-0">
          <Flower2 size={160} />
        </div>
        <div className="absolute bottom-20 -right-10 text-rose-100 opacity-20 -rotate-12 -z-0">
          <Sprout size={140} />
        </div>

        <div className="sidebar-logo mb-1 relative z-10">
          <div className="w-14 h-14 bg-rose-600 rounded-[22px] flex items-center justify-center text-white shadow-2xl shadow-rose-200 animate-pulse border-4 border-white">
            <Sparkles size={28} fill="currentColor" />
          </div>
          <div className="ml-1">
             <h1 className="font-display italic text-3xl text-rose-950 leading-tight">FisioGestión</h1>
             <div className="flex items-center gap-1">
                <div className="h-[2px] w-8 bg-rose-200 rounded-full"></div>
                <Flower size={10} className="text-rose-300" />
             </div>
          </div>
        </div>

        <nav className="nav-section space-y-3 relative z-10">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={`nav-item !rounded-[20px] !py-4 !px-5 transition-all duration-300 group ${active ? 'active !bg-rose-600 !text-white !shadow-xl !shadow-rose-300/40 translate-x-1' : '!text-rose-400 hover:!bg-white hover:!text-rose-600 hover:translate-x-1'}`}>
                <div className={`${active ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}`}>
                   <Icon strokeWidth={active ? 3 : 2} size={22} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="pt-10 border-t border-rose-100 mt-auto relative z-10 pb-4">
          <div className="p-4 bg-white/60 backdrop-blur-md rounded-[28px] border border-white flex items-center gap-4 shadow-sm group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-950 text-rose-100 flex items-center justify-center font-black text-xs shadow-lg group-hover:rotate-6 transition-transform">
              LG
            </div>
            <div>
              <div className="text-[11px] font-black text-rose-950 uppercase tracking-tighter">Dra. Liliana G.</div>
              <div className="flex items-center gap-1">
                 <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                 <div className="text-[9px] text-rose-400 font-bold uppercase tracking-widest">Fisioterapeuta</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
             <Flower2 size={16} className="text-rose-100 mx-auto" />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav - Liquid Glass Floating Pill with Camera-like Scroll */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-md lg:hidden">
        <nav className="relative bg-white/40 backdrop-blur-2xl border border-white/50 rounded-[32px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex items-center overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory py-2 px-4 gap-2"
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={`relative flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-500 snap-center shrink-0 ${
                    active ? 'active-mobile-item bg-rose-950 text-white shadow-lg scale-105' : 'text-rose-900/60 hover:text-rose-900'
                  }`}
                >
                  <Icon strokeWidth={active ? 3 : 2} size={active ? 18 : 20} className={active ? 'animate-pulse' : ''} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all duration-300 ${
                    active ? 'max-w-[200px] opacity-100 ml-1' : 'max-w-0 opacity-0 overflow-hidden'
                  }`}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
