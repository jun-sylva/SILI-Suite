'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Users, Clock, Banknote, ChevronRight } from 'lucide-react'

export default function RHDashboard() {
  const t = useTranslations('rh')
  const params = useParams()

  const base = `/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${params.societe_id}/rh`

  const cards = [
    {
      title:  t('dashboard_employes_title'),
      desc:   t('dashboard_employes_desc'),
      icon:   Users,
      href:   `${base}/employes`,
      color:  'bg-indigo-50 text-indigo-600 border-indigo-100',
      active: true,
    },
    {
      title:  t('dashboard_presences_title'),
      desc:   t('dashboard_presences_desc'),
      icon:   Clock,
      href:   `${base}/presences`,
      color:  'bg-teal-50 text-teal-600 border-teal-100',
      active: true,
    },
    {
      title:  t('dashboard_paie_title'),
      desc:   t('dashboard_paie_desc'),
      icon:   Banknote,
      href:   null,
      color:  'bg-slate-50 text-slate-400 border-slate-100',
      active: false,
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('module_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('employes_subtitle')}</p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          if (card.active && card.href) {
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all p-6 flex flex-col gap-4"
              >
                <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-base">{card.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{card.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:gap-2 transition-all">
                  Accéder <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )
          }
          return (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4 opacity-60 cursor-not-allowed"
            >
              <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-500 text-base">{card.title}</p>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                    {t('nav_soon')}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{card.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
