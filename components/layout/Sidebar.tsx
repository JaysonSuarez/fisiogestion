'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'
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
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  // Scroll handler to hide/show mobile nav
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      // Hide if scrolling down and not at the very top
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false)
      } 
      // Show if scrolling up
      else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true)
      }
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
      <div 
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md lg:hidden transition-all duration-500 ease-in-out ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95'
        }`}
      >
        <nav className="relative bg-white/30 backdrop-blur-[24px] border border-white/40 rounded-[35px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.4)] overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex items-center overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory py-3 px-4 gap-1"
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={`relative flex flex-col items-center justify-center min-w-[70px] py-1.5 transition-all duration-300 snap-center shrink-0 rounded-2xl ${
                    active ? 'active-mobile-item text-rose-600 scale-110' : 'text-rose-950/40'
                  }`}
                >
                  <div className={`relative p-2 rounded-xl transition-all duration-300 ${active ? 'bg-rose-50 shadow-inner' : ''}`}>
                    <Icon strokeWidth={active ? 2.5 : 2} size={22} className={active ? 'scale-110' : 'scale-100'} />
                    {active && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-rose-600 rounded-full"></span>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 transition-all duration-300 ${
                    active ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
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
