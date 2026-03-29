'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users } from 'lucide-react'

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

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t('nav_dashboard'), href: base,          icon: LayoutDashboard, exact: true },
    { id: 'rh',        label: t('nav_rh'),        href: `${base}/rh`,  icon: Users,           exact: false },
  ]

  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-slate-200 mb-6 -mx-6 px-6 sticky top-0 z-20 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => (
            <RapportsNavItem
              key={item.id}
              item={item}
              isActive={item.exact ? pathname === item.href || pathname.endsWith('/rapports') : pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
