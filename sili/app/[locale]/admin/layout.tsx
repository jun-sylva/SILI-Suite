'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { ShieldAlert, Building2, Users, Settings, LogOut, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('superadmin.layout')
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: t('dashboard'), href: '/admin', icon: LayoutDashboard },
    { name: t('tenants'), href: '/admin/tenants', icon: Building2 },
    { name: t('users'), href: '/admin/users', icon: Users },
    { name: t('settings'), href: '/admin/settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Sidebar Super Admin (Noire / Émeraude) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-950 text-slate-300 border-r border-slate-800 shrink-0 shadow-2xl z-20">
        <div className="flex h-16 items-center px-6 text-xl font-bold border-b border-slate-800 text-white">
          <ShieldAlert className="h-6 w-6 text-emerald-500 mr-3" />
          SILI Master
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-emerald-600/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-emerald-500' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 w-full overflow-hidden relative">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm z-10">
          <h1 className="text-lg font-semibold text-slate-800">{t('title')}</h1>
          {/* Le Language Switcher viendra se greffer automatiquement ici grâce au layout parent (AppLayout/RootLayout) 
              ou s'il est globalement importé, mais par sécurité on l'invoque dans un coin. */}
          <LanguageSwitcher />
        </header>
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 lg:p-8 bg-slate-50/50">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
