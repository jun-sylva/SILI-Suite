'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  Users,
  Building2,
  FileText,
  MessageSquare,
  Settings,
  CircleDollarSign,
  HardHat,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Grid,
  ShieldCheck
} from 'lucide-react'
import { usePermission, ModuleKey } from '@/hooks/usePermission'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  moduleKey?: ModuleKey
}

const navGroup1: NavItem[] = [
  { name: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'manage_societes', href: '/societes', icon: Briefcase },
  { name: 'users_access', href: '/utilisateurs', icon: Users },
  { name: 'consolidated_reporting', href: '/reporting', icon: FileText },
  { name: 'security_backup', href: '/securite-backup', icon: ShieldCheck },
  { name: 'tenant_settings', href: '/settings', icon: Settings },
]

const navGroup2: NavItem[] = [
  { name: 'vente', href: '/vente', icon: ShoppingCart, moduleKey: 'vente' },
  { name: 'achat', href: '/achat', icon: PackageSearch, moduleKey: 'achat' },
  { name: 'stock', href: '/stock', icon: Building2, moduleKey: 'stock' },
  { name: 'rh', href: '/rh', icon: Users, moduleKey: 'rh' },
  { name: 'crm', href: '/crm', icon: HardHat, moduleKey: 'crm' },
  { name: 'comptabilite', href: '/comptabilite', icon: CircleDollarSign, moduleKey: 'comptabilite' },
  { name: 'teams', href: '/teams', icon: MessageSquare, moduleKey: 'teams' },
  { name: 'rapports', href: '/rapports', icon: FileText, moduleKey: 'rapports' },
]

interface ProtectedSidebarItemProps {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
  onClick?: () => void
}

function ProtectedSidebarItem({ item, isActive, isCollapsed, onClick }: ProtectedSidebarItemProps) {
  const { canView } = usePermission(item.moduleKey!)
  if (!canView) return null
  return (
    <SidebarLink item={item} isActive={isActive} isCollapsed={isCollapsed} onClick={onClick} />
  )
}

interface SidebarLinkProps {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
  onClick?: () => void
}

function SidebarLink({ item, isActive, isCollapsed, onClick }: SidebarLinkProps) {
  const t = useTranslations('navigation')
  const label = t(item.name)

  return (
    <Link
      href={item.href}
      title={isCollapsed ? label : undefined}
      onClick={onClick}
      className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-indigo-600 text-white shadow-sm' 
          : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
      } ${isCollapsed ? 'md:justify-center' : ''}`}
    >
      <item.icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'md:mr-3'} mr-3 md:mr-0`} />
      {!isCollapsed && <span className="truncate hidden md:block">{label}</span>}
      <span className="truncate md:hidden">{label}</span>
    </Link>
  )
}

interface SidebarProps {
  isMobileOpen?: boolean
  setIsMobileOpen?: (val: boolean) => void
  isCollapsed?: boolean
  setIsCollapsed?: (val: boolean) => void
}

export function Sidebar({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: SidebarProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const params = useParams()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [activeModules, setActiveModules] = useState<string[]>([])

  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string
  const societeSlug = params.societe_slug as string
  const societeId = params.societe_id as string

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('role').eq('id', data.user.id).single().then(({ data: p }) => {
          setUserRole(p?.role ?? null)
        })
      }
    })
  }, [])

  // Charge les modules actifs de la société courante
  useEffect(() => {
    if (!societeId) { setActiveModules([]); return }
    supabase
      .from('societe_modules')
      .select('module')
      .eq('societe_id', societeId)
      .eq('is_active', true)
      .then(({ data }) => setActiveModules(data?.map(r => r.module) ?? []))
  }, [societeId])

  const isCompanyLevel = !!societeId
  const closeMobile = () => setIsMobileOpen?.(false)

  // Base paths
  const tenantBase = `/${tenantSlug}/${tenantId}/${userId}`
  const societeBase = isCompanyLevel ? `${tenantBase}/${societeSlug}/${societeId}` : ''

  return (
    <>
      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-indigo-950/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col bg-indigo-950 text-slate-50 border-r border-indigo-900/50 shadow-2xl transition-all duration-300 ease-in-out md:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'w-20' : 'w-64 xl:w-72'}`}>
        
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-indigo-900/50">
          <div className="flex items-center overflow-hidden whitespace-nowrap">
            <Link href={tenantBase + '/dashboard'} className="flex items-center">
              <div className="relative h-8 w-8 shrink-0 md:mr-3 mr-3 md:mr-0">
                <Image 
                  src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/bg-removed-result.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvYmctcmVtb3ZlZC1yZXN1bHQucG5nIiwiaWF0IjoxNzc0MTExNjE5LCJleHAiOjMzMjc4NTc1NjE5fQ.ayB7A8-QO35h0sC8KhDzgMdwj-6OW0-JmHA5tgJhCNQ"
                  alt="SILI Logo"
                  fill
                  sizes="32px"
                  className="object-contain"
                  unoptimized
                />
              </div>
              {!isCollapsed && <span className="text-xl font-bold transition-opacity duration-300 hidden md:block">SILI</span>}
              <span className="text-xl font-bold transition-opacity duration-300 md:hidden ml-3">SILI</span>
            </Link>
          </div>

          <button onClick={closeMobile} className="md:hidden p-1 text-indigo-300 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-6">
          {/* Section Tenant (Visible uniquement pour les admins) */}
          {!isCompanyLevel && (userRole === 'tenant_admin' || userRole === 'super_admin') ? (
            <div>
              {!isCollapsed && (
                <h3 className="px-3 text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3 italic">{t('tenant_group')}</h3>
              )}
              <ul className="space-y-1">
                {navGroup1.map((item) => {
                  const fullHref = `${tenantBase}${item.href}`
                  const isActive = pathname === fullHref || (item.href !== '/dashboard' && pathname.startsWith(fullHref))
                  return (
                    <SidebarLink 
                      key={item.href} 
                      item={{ ...item, href: fullHref }} 
                      isActive={isActive} 
                      isCollapsed={isCollapsed!}
                      onClick={closeMobile} 
                    />
                  )
                })}
              </ul>
            </div>
          ) : (
            <>
              {/* Bouton Retour au Tenant */}
              <Link 
                href={tenantBase + '/dashboard'}
                className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-indigo-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors mb-4 border border-white/5"
              >
                <ChevronLeft className="h-4 w-4" />
                {!isCollapsed && <span>{t('return_to_tenant')}</span>}
              </Link>

              {/* Section Société — Dashboard */}
              <div>
                {!isCollapsed && (
                  <h3 className="px-3 text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-3 italic">{t('societe_group')}</h3>
                )}
                <ul className="space-y-1">
                  <SidebarLink
                    item={{ name: 'dashboard', href: societeBase + '/dashboard', icon: LayoutDashboard }}
                    isActive={pathname === societeBase + '/dashboard'}
                    isCollapsed={isCollapsed!}
                    onClick={closeMobile}
                  />
                  {/* Paramètres société — admins uniquement */}
                  {(userRole === 'tenant_admin' || userRole === 'super_admin') && (
                    <SidebarLink
                      item={{ name: 'societe_settings', href: societeBase + '/settings', icon: Settings }}
                      isActive={pathname === societeBase + '/settings'}
                      isCollapsed={isCollapsed!}
                      onClick={closeMobile}
                    />
                  )}
                </ul>
              </div>

              {/* Groupe Applications — modules activés pour cette société */}
              {activeModules.length > 0 && (() => {
                const navMap = Object.fromEntries(navGroup2.map(i => [i.moduleKey!, i]))
                const items = activeModules.map(m => navMap[m]).filter(Boolean) as NavItem[]
                return (
                  <div>
                    {!isCollapsed && (
                      <h3 className="px-3 text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3 italic">{t('applications_group')}</h3>
                    )}
                    <ul className="space-y-1">
                      {items.map(item => {
                        const fullHref = `${societeBase}${item.href}`
                        const isActive = pathname === fullHref || pathname.startsWith(fullHref)
                        return (
                          <ProtectedSidebarItem
                            key={item.href}
                            item={{ ...item, href: fullHref }}
                            isActive={isActive}
                            isCollapsed={isCollapsed!}
                            onClick={closeMobile}
                          />
                        )
                      })}
                    </ul>
                  </div>
                )
              })()}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-indigo-900/50 flex flex-col gap-2">
          <button
            onClick={() => setIsCollapsed?.(!isCollapsed)}
            className="hidden md:flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-900/50 hover:text-indigo-200 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>
    </>
  )
}
