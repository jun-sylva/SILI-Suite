'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Clock, Banknote, Lock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

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

  const [canAccessEmployes, setCanAccessEmployes] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!profile) return

      if (profile.role === 'tenant_admin' || profile.role === 'super_admin') {
        setCanAccessEmployes(true)
        return
      }

      const { data: permData } = await supabase
        .from('user_module_permissions')
        .select('permission')
        .eq('user_id', session.user.id)
        .eq('societe_id', societeId)
        .eq('module', 'rh')
        .maybeSingle()
      const perm = permData?.permission ?? 'aucun'
      setCanAccessEmployes(perm === 'gestionnaire' || perm === 'admin')
    }
    checkAccess()
  }, [societeId])

  const navItems = [
    { id: 'dashboard', label: t('nav_dashboard'), href: base,                icon: LayoutDashboard, exact: true,  restricted: false },
    { id: 'employes',  label: t('nav_employes'),  href: `${base}/employes`,  icon: Users,           exact: false, restricted: !canAccessEmployes },
    { id: 'presences', label: t('nav_presences'), href: `${base}/presences`, icon: Clock,           exact: false, restricted: false },
    { id: 'paie',      label: t('nav_paie'),      href: `${base}/paie`,      icon: Banknote,        exact: false, restricted: false },
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

            // Pas de lien (futur module)
            if (!item.href) {
              return (
                <span
                  key={item.id}
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

            // Lien existant mais accès restreint par permission
            if (item.restricted) {
              return (
                <span
                  key={item.id}
                  className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium text-slate-300 cursor-not-allowed whitespace-nowrap border-b-2 border-transparent"
                  title={t('acces_refuse_employes_tab')}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <Lock className="h-3 w-3" />
                </span>
              )
            }

            return (
              <Link
                key={item.id}
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
