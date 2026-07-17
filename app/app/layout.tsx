import Link from 'next/link'
import { Home, CalendarPlus, CalendarDays, User } from 'lucide-react'
import PatientPushProvider from '@/components/patient/PatientPushProvider'
import PatientBottomNav from '@/components/patient/PatientBottomNav'

export default function PatientAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex justify-center overflow-x-hidden">
      <div className="w-full max-w-md bg-rose-50/30 min-h-screen relative shadow-2xl flex flex-col border-x border-slate-200">
        <PatientPushProvider />
        <div className="flex-1 pb-24 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
        <PatientBottomNav />
      </div>
    </div>
  )
}
