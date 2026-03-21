'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { Building2, Users, Activity, CircleDollarSign } from 'lucide-react'

export default function SuperAdminDashboard() {
  const t = useTranslations('superadmin.dashboard')

  const stats = [
    { title: t('stats_tenants'), value: '0', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { title: t('stats_pending'), value: '0', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-100' },
    { title: t('stats_users'), value: '1', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: t('stats_revenue'), value: '0 FCFA', icon: CircleDollarSign, color: 'text-blue-600', bg: 'bg-blue-100' },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('welcome', { name: "Administrateur" })}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
              <div className={`rounded-xl p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-slate-200">
          <CardHeader>
            <CardTitle>{t('recent_activity')}</CardTitle>
          </CardHeader>
          <CardContent className="flex h-64 items-center justify-center text-sm text-slate-500 italic bg-slate-50/50 rounded-lg m-4 mt-0 border border-dashed text-center">
            {t('no_activity')}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
