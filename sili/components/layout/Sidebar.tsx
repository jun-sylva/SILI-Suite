'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useParams } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  Users,
  Building2,
  FileText,
  MessageSquare,
  Shield,
  Settings,
  CircleDollarSign,
  HardHat,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Grid
} from 'lucide-react'
import { usePermission, ModuleKey } from '@/hooks/usePermission'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  moduleKey?: ModuleKey
}

const navGroup1: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sociétés', href: '/societes', icon: Briefcase },
  { name: 'Utilisateurs', href: '/utilisateurs', icon: Users },
  { name: 'Applications', href: '/applications', icon: Grid },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

const navGroup2: NavItem[] = [
  { name: 'Vente', href: '/vente', icon: ShoppingCart, moduleKey: 'vente' },
  { name: 'Achat', href: '/achat', icon: PackageSearch, moduleKey: 'achat' },
  { name: 'Stock', href: '/stock', icon: Building2, moduleKey: 'stock' },
  { name: 'RH', href: '/rh', icon: Users, moduleKey: 'rh' },
  { name: 'CRM', href: '/crm', icon: HardHat, moduleKey: 'crm' },
  { name: 'Comptabilité', href: '/comptabilite', icon: CircleDollarSign, moduleKey: 'comptabilite' },
  { name: 'Teams', href: '/teams', icon: MessageSquare, moduleKey: 'teams' },
  { name: 'Rapports', href: '/rapports', icon: FileText, moduleKey: 'rapports' },
  { name: 'Sécurité', href: '/securite', icon: Shield, moduleKey: 'securite' },
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
  return (
    <Link
      href={item.href}
      title={isCollapsed ? item.name : undefined}
      onClick={onClick}
      className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-indigo-600 text-white shadow-sm' 
          : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
      } ${isCollapsed ? 'md:justify-center' : ''}`}
    >
      <item.icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'md:mr-3'} mr-3 md:mr-0`} />
      {!isCollapsed && <span className="truncate hidden md:block">{item.name}</span>}
      <span className="truncate md:hidden">{item.name}</span>
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
  const pathname = usePathname()
  const params = useParams()
  
  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string
  const societeSlug = params.societe_slug as string
  const societeId = params.societe_id as string

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
          {/* Section Tenant (Toujours visible ou prioritaire si pas en société) */}
          {!isCompanyLevel ? (
            <div>
              {!isCollapsed && (
                <h3 className="px-3 text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3 italic">Espace Tenant</h3>
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
                {!isCollapsed && <span>Retour au Tenant</span>}
              </Link>

              {/* Section Société */}
              <div>
                {!isCollapsed && (
                  <h3 className="px-3 text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-3 italic">Espace Société</h3>
                )}
                <ul className="space-y-1">
                  {/* Dashboard Société */}
                  <SidebarLink 
                    item={{ name: 'Tableau de bord', href: societeBase + '/dashboard', icon: LayoutDashboard }}
                    isActive={pathname === societeBase + '/dashboard'}
                    isCollapsed={isCollapsed!}
                    onClick={closeMobile}
                  />
                  
                  {/* Modules Métier */}
                  {navGroup2.map((item) => {
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
