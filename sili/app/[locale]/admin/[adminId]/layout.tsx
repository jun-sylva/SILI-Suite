'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ShieldAlert, Building2, LogOut, LayoutDashboard, BarChart3, Box, ActivitySquare, RefreshCcw, ScrollText, CheckCircle, AlertTriangle, Wrench, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('superadmin.layout')
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const adminId = params.adminId as string

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navGroup = [
    { name: t('dashboard'), href: `/admin/${adminId}/dashboard`, icon: LayoutDashboard },
    { name: t('organization'), href: `/admin/${adminId}/tenants`, icon: Building2 },
    { name: t('bi_reports'), href: `/admin/${adminId}/bi-reports`, icon: BarChart3 },
    { name: t('modules'), href: `/admin/${adminId}/modules`, icon: Box },
  ]

  const toolsGroup = [
    { name: t('diagnostic'), href: `/admin/${adminId}/tools/diagnostic`, icon: ActivitySquare },
    { name: t('recovery'), href: `/admin/${adminId}/tools/recovery`, icon: RefreshCcw },
    { name: t('logs'), href: `/admin/${adminId}/tools/logs`, icon: ScrollText },
    { name: t('validation'), href: `/admin/${adminId}/tools/validation`, icon: CheckCircle },
    { name: t('errors'), href: `/admin/${adminId}/tools/errors`, icon: AlertTriangle },
    { name: t('remediation'), href: `/admin/${adminId}/tools/remediation`, icon: Wrench },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-indigo-950/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Super Admin */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-950 text-slate-300 border-r border-slate-800 shadow-2xl transition-all duration-300 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-800 text-white">
          <div className="flex items-center overflow-hidden whitespace-nowrap">
            <ShieldAlert className="h-6 w-6 text-emerald-500 shrink-0 md:mr-3" />
            {!isCollapsed && <span className="text-xl font-bold transition-opacity duration-300 hidden md:block">SILI Master</span>}
            <span className="text-xl font-bold transition-opacity duration-300 md:hidden ml-3">SILI Master</span>
          </div>
          
          {/* Close mobile menu */}
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-1 text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 py-4 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {/* Navigation Group */}
          <div>
            {!isCollapsed ? (
              <h3 className="px-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 truncate hidden md:block">
                {t('nav_group')}
              </h3>
            ) : (
              <div className="hidden md:flex w-full justify-center mb-2">
                <div className="h-px w-8 bg-slate-800" />
              </div>
            )}
            {/* Affichage Mobile Titre */}
            <h3 className="px-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 truncate md:hidden">
              {t('nav_group')}
            </h3>

            <div className="space-y-1 px-2">
              {navGroup.map((item) => {
                const isActive = pathname === item.href || (item.href !== `/admin/${adminId}/dashboard` && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-emerald-600/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${isCollapsed ? 'md:justify-center' : ''}`}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-500' : 'text-slate-500'} ${isCollapsed ? '' : 'md:mr-3'} mr-3 md:mr-0`} />
                    {!isCollapsed && <span className="truncate hidden md:block">{item.name}</span>}
                    <span className="truncate md:hidden">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Tools Group */}
          <div>
            {!isCollapsed ? (
              <h3 className="px-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 truncate hidden md:block">
                {t('tools_group')}
              </h3>
            ) : (
              <div className="hidden md:flex w-full justify-center mb-2">
                <div className="h-px w-8 bg-slate-800" />
              </div>
            )}
            <h3 className="px-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 truncate md:hidden">
              {t('tools_group')}
            </h3>

            <div className="space-y-1 px-2">
              {toolsGroup.map((item) => {
                const isActive = pathname === item.href || (item.href !== `/admin/${adminId}/dashboard` && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-emerald-600/10 text-emerald-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${isCollapsed ? 'md:justify-center' : ''}`}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-500' : 'text-slate-500'} ${isCollapsed ? '' : 'md:mr-3'} mr-3 md:mr-0`} />
                    {!isCollapsed && <span className="truncate hidden md:block">{item.name}</span>}
                    <span className="truncate md:hidden">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={handleLogout}
            title={isCollapsed ? t('logout') : undefined}
            className={`flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-slate-800 transition-colors ${isCollapsed ? 'md:justify-center' : ''}`}
          >
            <LogOut className={`h-5 w-5 shrink-0 ${isCollapsed ? '' : 'md:mr-3'} mr-3 md:mr-0`} />
            {!isCollapsed && <span className="truncate hidden md:block">{t('logout')}</span>}
            <span className="truncate md:hidden">{t('logout')}</span>
          </button>
          
          {/* Bouton pour replier (Desktop uniquement) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className={`flex flex-col flex-1 w-full overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 md:px-6 shadow-sm z-10 w-full">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 truncate">{t('title')}</h1>
          </div>
          <LanguageSwitcher />
        </header>

        {/* Support écrans ultra larges */}
        <main className="flex-1 overflow-y-auto w-full px-4 py-8 md:p-6 lg:p-8 bg-slate-50">
          <div className="mx-auto w-full max-w-[2000px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
