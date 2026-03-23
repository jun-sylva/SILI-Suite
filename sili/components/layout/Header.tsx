'use client'

import { supabase } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { LogOut, User, Menu, ChevronDown, Settings } from 'lucide-react'
import { useSocieteStore } from '@/stores/societeStore'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { useTranslations } from 'next-intl'

export function Header({ setIsMobileOpen }: { setIsMobileOpen?: (val: boolean) => void }) {
  const t = useTranslations('navigation')
  const router = useRouter()
  const { currentSociete } = useSocieteStore()
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('full_name').eq('id', data.user.id).single().then(({ data: p }) => {
          setProfile({ full_name: p?.full_name ?? null, email: data.user.email ?? null })
        })
      }
    })
  }, [])

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '??'

    const params = useParams()
    const tenantSlug = params.tenant_slug as string
    const tenantId = params.tenant_id as string
    const userId = params.user_id as string

    const tenantBase = `/${tenantSlug}/${tenantId}/${userId}`

    return (
      <header className="flex shrink-0 h-16 w-full items-center justify-center border-b bg-white shadow-sm z-10">
        <div className="mx-auto flex w-full max-w-[2000px] items-center justify-between px-4 md:px-6">
          
          {/* Left: Mobile toggle + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen?.(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
  
            {currentSociete && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
                <span className="text-base">🏢</span>
                <span className="text-sm font-semibold text-slate-700 hidden sm:block truncate max-w-[180px]">{currentSociete.raison_sociale}</span>
              </div>
            )}
          </div>
  
          {/* Right: Lang switcher + Profile dropdown */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="topbar" />
  
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(prev => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
              >
                {/* Avatar */}
                <div className="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 group-hover:bg-indigo-700 transition-colors">
                  {initials}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden sm:block max-w-[120px] truncate">
                  {profile?.full_name ?? profile?.email ?? 'Profil'}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>
  
              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-800 truncate">{profile?.full_name ?? 'Utilisateur'}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{profile?.email}</p>
                  </div>
  
                  {/* Actions */}
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

                {/* Logout */}
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
