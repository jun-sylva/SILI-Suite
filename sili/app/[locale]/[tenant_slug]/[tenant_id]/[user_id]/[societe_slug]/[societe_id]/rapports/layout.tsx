'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, GitBranch, CalendarDays, PhoneCall, Package, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
}

function RapportsNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        isActive
          ? 'text-indigo-600 border-indigo-600'
          : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  )
}

export default function RapportsLayout({ children }: { children: React.ReactNode }) {
  const t        = useTranslations('rapports')
  const pathname = usePathname()
  const params   = useParams()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/rapports`

  const [activeModules, setActiveModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchModules() {
      const { data } = await supabase
        .from('societe_modules')
        .select('module')
        .eq('societe_id', societeId)
        .eq('is_active', true)
      
      setActiveModules((data || []).map((r: any) => r.module))
      setLoading(false)
    }
    fetchModules()
  }, [societeId])

  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: t('nav_dashboard'), href: base,                icon: LayoutDashboard, exact: true  },
    { id: 'rh',        label: t('nav_rh'),        href: `${base}/rh`,        icon: Users,           exact: false },
    { id: 'workflow',  label: t('nav_workflow'),  href: `${base}/workflow`,  icon: GitBranch,       exact: false },
    { id: 'planning',  label: t('nav_planning'),  href: `${base}/planning`,  icon: CalendarDays,    exact: false },
    { id: 'crm',       label: t('nav_crm'),       href: `${base}/crm`,       icon: PhoneCall,       exact: false },
    { id: 'stock',     label: t('nav_stock'),     href: `${base}/stock`,     icon: Package,         exact: false },
  ]

  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-slate-200 mb-6 -mx-6 px-6 sticky top-0 z-20 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center px-4 py-3.5 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <>
              <RapportsNavItem
                item={allNavItems[0]}
                isActive={pathname === allNavItems[0].href || pathname.endsWith('/rapports')}
              />
              {activeModules.includes('rh') && (
                <RapportsNavItem
                  item={allNavItems[1]}
                  isActive={pathname.startsWith(allNavItems[1].href)}
                />
              )}
              {activeModules.includes('workflow') && (
                <RapportsNavItem
                  item={allNavItems[2]}
                  isActive={pathname.startsWith(allNavItems[2].href)}
                />
              )}
              {activeModules.includes('planning') && (
                <RapportsNavItem
                  item={allNavItems[3]}
                  isActive={pathname.startsWith(allNavItems[3].href)}
                />
              )}
              {activeModules.includes('crm') && (
                <RapportsNavItem
                  item={allNavItems[4]}
                  isActive={pathname.startsWith(allNavItems[4].href)}
                />
              )}
              {activeModules.includes('stock') && (
                <RapportsNavItem
                  item={allNavItems[5]}
                  isActive={pathname.startsWith(allNavItems[5].href)}
                />
              )}
            </>
          )}
        </nav>
      </div>
      {children}
    </div>
  )
}
