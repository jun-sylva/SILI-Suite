'use client'

import { useRouter, usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggleLocale = () => {
    const nextLocale = locale === 'fr' ? 'en' : 'fr'
    // Conserve le chemin actuel mais change la langue
    router.replace(pathname, { locale: nextLocale })
  }

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
