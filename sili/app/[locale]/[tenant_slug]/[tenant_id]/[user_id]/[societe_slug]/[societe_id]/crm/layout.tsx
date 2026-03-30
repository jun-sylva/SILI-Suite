'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  LayoutDashboard, GitBranch, Users, Activity,
  BookUser, FileText, Receipt, Wallet, Loader2, ShieldOff,
} from 'lucide-react'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
}

function CrmNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
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

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const t        = useTranslations('crm')
  const pathname = usePathname()
  const params   = useParams()
  const router   = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/crm`

  const [checking,  setChecking]  = useState(true)
  const [canAccess, setCanAccess] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()

      if (profile?.role === 'tenant_admin') { setCanAccess(true); setChecking(false); return }

      const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'crm')
      setCanAccess(['lecteur', 'contributeur', 'gestionnaire', 'admin'].includes(perm))
      setChecking(false)
    }
    check()
  }, [societeId, router])

  const navItems: NavItem[] = [
    { id: 'dashboard',  label: t('nav_dashboard'),  href: base,                   icon: LayoutDashboard, exact: true  },
    { id: 'pipeline',   label: t('nav_pipeline'),   href: `${base}/pipeline`,     icon: GitBranch,       exact: false },
    { id: 'leads',      label: t('nav_leads'),      href: `${base}/leads`,        icon: Users,           exact: false },
    { id: 'activites',  label: t('nav_activites'),  href: `${base}/activites`,    icon: Activity,        exact: false },
    { id: 'contacts',   label: t('nav_contacts'),   href: `${base}/contacts`,     icon: BookUser,        exact: false },
    { id: 'devis',      label: t('nav_devis'),      href: `${base}/devis`,        icon: FileText,        exact: false },
    { id: 'factures',   label: t('nav_factures'),   href: `${base}/factures`,     icon: Receipt,         exact: false },
    { id: 'paiements',  label: t('nav_paiements'),  href: `${base}/paiements`,    icon: Wallet,          exact: false },
  ]

  if (checking) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
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
            <CrmNavItem
              key={item.id}
              item={item}
              isActive={item.exact ? pathname === item.href || pathname.endsWith('/crm') : pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
