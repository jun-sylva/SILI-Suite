'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  LayoutDashboard, Package, ArrowLeftRight,
  ClipboardList, AlertTriangle, Loader2, ShieldOff,
} from 'lucide-react'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
  badge?: number
}

function StockNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        isActive
          ? 'text-amber-600 border-amber-600'
          : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
      {item.badge != null && item.badge > 0 && (
        <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

export default function StockLayout({ children }: { children: React.ReactNode }) {
  const t        = useTranslations('stock')
  const pathname = usePathname()
  const params   = useParams()
  const router   = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/stock`

  const [checking,   setChecking]   = useState(true)
  const [canAccess,  setCanAccess]  = useState(false)
  const [alertBadge, setAlertBadge] = useState(0)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()

      if (profile?.role === 'tenant_admin' || profile?.role === 'super_admin') {
        setCanAccess(true)
      } else {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'stock')
        setCanAccess(['lecteur', 'contributeur', 'gestionnaire', 'admin'].includes(perm))
      }

      // Comptage alertes
      const { data } = await supabase
        .from('stock_articles')
        .select('stock_actuel, stock_minimum')
        .eq('societe_id', societeId)
        .eq('is_active', true)
      
      const alertsCount = (data ?? []).filter((a: any) => a.stock_actuel < a.stock_minimum).length
      setAlertBadge(alertsCount)

      setChecking(false)
    }
    check()
  }, [societeId, router])

  const navItems: NavItem[] = [
    { id: 'dashboard',  label: t('nav_dashboard'),  href: base,                    icon: LayoutDashboard, exact: true  },
    { id: 'articles',   label: t('nav_articles'),   href: `${base}/articles`,      icon: Package,         exact: false },
    { id: 'mouvements', label: t('nav_mouvements'), href: `${base}/mouvements`,    icon: ArrowLeftRight,  exact: false },
    { id: 'inventaire', label: t('nav_inventaire'), href: `${base}/inventaire`,    icon: ClipboardList,   exact: false },
    { id: 'alertes',    label: t('nav_alertes'),    href: `${base}/alertes`,       icon: AlertTriangle,   exact: false, badge: alertBadge },
  ]

  if (checking) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-500">
        <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <p className="font-semibold text-slate-800">{t('acces_refuse')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-slate-200 mb-6 -mx-6 px-6 sticky top-0 z-20 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => (
            <StockNavItem
              key={item.id}
              item={item}
              isActive={item.exact ? pathname === item.href || pathname.endsWith('/stock') : pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
