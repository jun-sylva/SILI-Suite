'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, FileText, ClipboardList, Lock, Wrench, GitMerge } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact: boolean
  restricted: boolean
}

function WorkflowNavItem({ item, isActive, t }: {
  item: NavItem
  isActive: boolean
  t: ReturnType<typeof useTranslations>
}) {
  const Icon = item.icon

  if (item.restricted) {
    return (
      <span
        className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium text-slate-300 cursor-not-allowed whitespace-nowrap border-b-2 border-transparent"
        title={t('acces_refuse_assignees')}
      >
        <Icon className="h-4 w-4" />
        {item.label}
        <Lock className="h-3 w-3" />
      </span>
    )
  }

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

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const t  = useTranslations('workflow')
  const tb = useTranslations('workflow_builder')
  const pathname = usePathname()
  const params = useParams()
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`

  const [canAccessAssignees, setCanAccessAssignees] = useState(false)
  const [isTenantAdmin, setIsTenantAdmin]           = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      if (!profile) return

      const admin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
      setIsTenantAdmin(admin)

      if (admin) { setCanAccessAssignees(true); return }

      const { data: permData } = await supabase
        .from('user_module_permissions').select('permission')
        .eq('user_id', session.user.id).eq('societe_id', societeId).eq('module', 'workflow').maybeSingle()
      const perm = permData?.permission ?? 'aucun'
      setCanAccessAssignees(perm === 'gestionnaire' || perm === 'admin')
    }
    checkAccess()
  }, [societeId])

  const navItems: NavItem[] = [
    { id: 'dashboard',    label: t('nav_dashboard'),    href: base,                    icon: LayoutDashboard, exact: true,  restricted: false },
    { id: 'mes-requetes', label: t('nav_mes_requetes'), href: `${base}/mes-requetes`,  icon: FileText,        exact: false, restricted: false },
    { id: 'assignees',    label: t('nav_assignees'),    href: `${base}/assignees`,     icon: ClipboardList,   exact: false, restricted: !canAccessAssignees },
    { id: 'processes',    label: tb('nav_processes'),   href: `${base}/processes`,     icon: GitMerge,        exact: false, restricted: !canAccessAssignees },
    { id: 'builder',      label: tb('nav_builder'),     href: `${base}/builder`,       icon: Wrench,          exact: false, restricted: !isTenantAdmin },
  ]

  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-slate-200 mb-6 -mx-6 px-6 sticky top-0 z-20 shadow-sm">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href || pathname.endsWith('/workflow')
              : pathname.startsWith(item.href)
            return <WorkflowNavItem key={item.id} item={item} isActive={isActive} t={t} />
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}
