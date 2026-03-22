'use client'

import { useRouter, usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { Globe } from 'lucide-react'

// variant="login"  → bouton flottant (absolute) pour la page de connexion
// variant="topbar" → version encastrée dans une barre de navigation
export function LanguageSwitcher({ variant = 'login' }: { variant?: 'login' | 'topbar' }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggleLocale = () => {
    const nextLocale = locale === 'fr' ? 'en' : 'fr'
    router.replace(pathname, { locale: nextLocale })
  }

  if (variant === 'topbar') {
    return (
      <button
        onClick={toggleLocale}
        title={locale === 'fr' ? 'Switch to English' : 'Passer en Français'}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
      </button>
    )
  }

  // Default: login variant (floating)
  return (
    <button
      onClick={toggleLocale}
      className="absolute top-4 right-4 md:top-6 md:right-6 z-[100] flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md border border-slate-200 hover:bg-white hover:shadow-md transition-all"
    >
      <Globe className="h-4 w-4 text-indigo-600" />
      {locale === 'fr' ? 'English (EN)' : 'Français (FR)'}
    </button>
  )
}
