'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { ShieldOff, Phone, Mail, User, LogOut } from 'lucide-react'

export default function TenantBloquePage() {
  const t = useTranslations('blocked')
  const searchParams = useSearchParams()
  const router = useRouter()
  const role = searchParams.get('role') // 'admin' | 'user'
  const isAdmin = role === 'admin'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Bande rouge en haut */}
          <div className="h-2 bg-gradient-to-r from-red-500 to-rose-600" />

          {/* Icône + titre */}
          <div className="p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 border border-red-100 mx-auto mb-5">
              <ShieldOff className="h-8 w-8 text-red-500" />
            </div>

            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-4">
              {t('tag_suspended')}
            </span>

            <h1 className="text-xl font-bold text-slate-800 mb-2">
              {isAdmin ? t('admin_title') : t('user_title')}
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              {isAdmin ? t('admin_subtitle') : t('user_subtitle')}
            </p>
          </div>

          {/* Bloc contact */}
          <div className="px-8 pb-8">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                {isAdmin ? t('admin_contact_intro') : t('user_contact_intro')}
              </p>

              {isAdmin ? (
                /* Contact Master — visible uniquement pour tenant_admin */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <User className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{t('contact_name')}</p>
                      <p className="text-sm font-bold text-slate-800">{t('master_name')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{t('contact_phone')}</p>
                      <a href={`tel:${t('master_phone').replace(/\s/g, '')}`} className="text-sm font-bold text-emerald-700 hover:underline">
                        {t('master_phone')}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                      <Mail className="h-4 w-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{t('contact_email')}</p>
                      <a href={`mailto:${t('master_email')}`} className="text-sm font-bold text-sky-700 hover:underline">
                        {t('master_email')}
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                /* Message simple pour tenant_user */
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 mt-0.5">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Votre compte a été suspendu. Contactez votre administrateur pour rétablir l'accès.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('btn_logout')}
            </button>
          </div>
        </div>

        {/* Branding */}
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">SILI Suite — BBMediaTech</p>
      </div>
    </div>
  )
}
