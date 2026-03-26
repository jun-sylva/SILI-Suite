'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Clock, Banknote } from 'lucide-react'

export default function RHLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('rh')
  const pathname = usePathname()
  const params = useParams()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/rh`

  const navItems = [
    { label: t('nav_dashboard'), href: base,             icon: LayoutDashboard, exact: true  },
    { label: t('nav_employes'),  href: `${base}/employes`, icon: Users,          exact: false },
    { label: t('nav_presences'), href: null,             icon: Clock,            exact: false },
    { label: t('nav_paie'),      href: null,             icon: Banknote,         exact: false },
  ]

  return (
    <div className="space-y-0">
      {/* Navbar module RH */}
      <div className="bg-white border-b border-slate-200 mb-6 -mx-6 px-6 sticky top-0 z-20 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = item.href
              ? item.exact
                ? pathname === item.href || pathname.endsWith('/rh')
                : pathname.startsWith(item.href)
              : false

            if (!item.href) {
              return (
                <span
                  key={item.label}
                  className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium text-slate-300 cursor-not-allowed whitespace-nowrap border-b-2 border-transparent"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
                    {t('nav_soon')}
                  </span>
                </span>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
