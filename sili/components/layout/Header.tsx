'use client'

import { supabase } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LogOut, User, Menu, ChevronDown, Settings, Building2, Check } from 'lucide-react'
import { useSocieteStore } from '@/stores/societeStore'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface SocieteItem {
  id: string
  raison_sociale: string
}

export function Header({ setIsMobileOpen }: { setIsMobileOpen?: (val: boolean) => void }) {
  const t = useTranslations('navigation')
  const router = useRouter()
  const locale = useLocale()
  const params = useParams()
  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string
  const currentSocieteId = params.societe_id as string | undefined

  const { currentSociete, setCurrentSociete } = useSocieteStore()

  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [fullTenantId, setFullTenantId] = useState<string | null>(null)
  const [societes, setSocietes] = useState<SocieteItem[]>([])
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSocieteOpen, setIsSocieteOpen] = useState(false)

  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const societeDropdownRef = useRef<HTMLDivElement>(null)

  const tenantBase = `/${tenantSlug}/${tenantId}/${userId}`

  // Fetch profile + societes
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, role, tenant_id')
        .eq('id', data.user.id)
        .single()

      setProfile({ full_name: p?.full_name ?? null, email: data.user.email ?? null })
      setUserRole(p?.role ?? null)
      setFullTenantId(p?.tenant_id ?? null)

      if (!p?.tenant_id) return

      if (p.role === 'tenant_admin' || p.role === 'super_admin') {
        // Toutes les sociétés actives du tenant
        const { data: s } = await supabase
          .from('societes')
          .select('id, raison_sociale')
          .eq('tenant_id', p.tenant_id)
          .eq('is_active', true)
          .order('raison_sociale')
        setSocietes(s || [])
      } else if (p.role === 'tenant_user') {
        // Uniquement les sociétés assignées et actives
        const { data: us } = await supabase
          .from('user_societes')
          .select('societes(id, raison_sociale)')
          .eq('user_id', data.user.id)
          .eq('is_active', true)
        const list = ((us || []) as any[])
          .map(x => x.societes)
          .filter(Boolean) as SocieteItem[]
        setSocietes(list)
      }
    })
  }, [])

  // Clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node))
        setIsProfileOpen(false)
      if (societeDropdownRef.current && !societeDropdownRef.current.contains(e.target as Node))
        setIsSocieteOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function switchSociete(s: SocieteItem) {
    setIsSocieteOpen(false)
    setCurrentSociete({ id: s.id, tenant_id: fullTenantId ?? '', raison_sociale: s.raison_sociale, devise: currentSociete?.devise ?? '' })
    router.push(`/${locale}${tenantBase}/${toSlug(s.raison_sociale)}/${s.id}/dashboard`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  // Société affichée dans le switcher — uniquement basé sur l'URL (pas le store)
  const activeSociete = currentSocieteId ? (societes.find(s => s.id === currentSocieteId) ?? null) : null

  return (
    <header className="flex shrink-0 h-16 w-full items-center justify-center border-b bg-white shadow-sm z-10">
      <div className="mx-auto flex w-full max-w-[2000px] items-center justify-between px-4 md:px-6">

        {/* Left: Mobile toggle + Company switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen?.(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Company switcher — visible si societes disponibles */}
          {societes.length > 0 && (
            <div className="relative" ref={societeDropdownRef}>
              <button
                onClick={() => setIsSocieteOpen(v => !v)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
              >
                <span className="text-base shrink-0">🏢</span>
                <span className="text-sm font-semibold text-slate-700 hidden sm:block truncate max-w-[180px]">
                  {activeSociete?.raison_sociale ?? t('select_company')}
                </span>
                {societes.length >= 1 && (
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isSocieteOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isSocieteOpen && societes.length >= 1 && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
                  {/* Header du menu */}
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('company_switcher_title')}</p>
                  </div>

                  {/* Liste des sociétés */}
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {societes.map(s => {
                      const isActive = s.id === currentSocieteId
                      return (
                        <button
                          key={s.id}
                          onClick={() => switchSociete(s)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>
                            {s.raison_sociale[0].toUpperCase()}
                          </div>
                          <span className="flex-1 font-semibold truncate">{s.raison_sociale}</span>
                          {isActive && <Check className="h-4 w-4 text-indigo-600 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Lien gestion (admin seulement) */}
                  {(userRole === 'tenant_admin' || userRole === 'super_admin') && (
                    <div className="border-t border-slate-100 p-1.5">
                      <button
                        onClick={() => { setIsSocieteOpen(false); router.push(`/${locale}${tenantBase}/societes`) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {t('manage_companies')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Lang switcher + Profile dropdown */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="topbar" />

          {/* Profile Dropdown */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div className="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 group-hover:bg-indigo-700 transition-colors">
                {initials}
              </div>
              <span className="text-sm font-semibold text-slate-700 hidden sm:block max-w-[120px] truncate">
                {profile?.full_name ?? profile?.email ?? 'Profil'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-800 truncate">{profile?.full_name ?? 'Utilisateur'}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{profile?.email}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => { setIsProfileOpen(false); router.push(tenantBase + '/profile') }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    {t('my_profile')}
                  </button>
                  <button
                    onClick={() => { setIsProfileOpen(false); router.push(tenantBase + '/settings') }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    {t('settings')}
                  </button>
                </div>
                <div className="p-1.5 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
