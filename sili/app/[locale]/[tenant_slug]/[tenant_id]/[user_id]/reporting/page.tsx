'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, BarChart2, Loader2, CheckCircle, XCircle, Server, Layers } from 'lucide-react'
import dayjs from 'dayjs'

interface Societe {
  id: string
  raison_sociale: string
  sigle: string | null
  devise: string
  is_active: boolean
  created_at: string
}

interface TenantInfo {
  max_societes: number
  max_licences: number
  max_storage_gb: number
}

export default function ReportingPage() {
  const t = useTranslations('reporting')
  const router = useRouter()
  const params = useParams()
  const tenantId = params.tenant_id as string

  const [societes, setSocietes] = useState<Societe[]>([])
  const [usersCount, setUsersCount] = useState(0)
  const [activeModulesCount, setActiveModulesCount] = useState(0)
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAndFetch()
  }, [])

  async function checkAndFetch() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }

    const [socRes, usrRes, modRes, tenantRes] = await Promise.all([
      supabase.from('societes')
        .select('id, raison_sociale, sigle, devise, is_active, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase.from('tenant_modules')
        .select('module_key, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      supabase.from('tenants')
        .select('max_societes, max_licences, max_storage_gb')
        .eq('id', tenantId)
        .single(),
    ])

    setSocietes(socRes.data || [])
    setUsersCount(usrRes.count || 0)
    setActiveModulesCount(modRes.data?.length || 0)
    if (tenantRes.data) setTenantInfo(tenantRes.data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const activeSocietes = societes.filter(s => s.is_active).length

  const kpiCards = [
    {
      icon: Building2, color: 'indigo',
      value: activeSocietes,
      label: t('card_total_companies'),
      sub: `${societes.length} total`,
    },
    {
      icon: Users, color: 'emerald',
      value: usersCount,
      label: t('card_total_users'),
      sub: tenantInfo ? `/ ${tenantInfo.max_licences} max` : '',
    },
    {
      icon: Layers, color: 'purple',
      value: activeModulesCount,
      label: t('card_active_modules'),
      sub: '',
    },
    {
      icon: Server, color: 'sky',
      value: `${tenantInfo?.max_storage_gb ?? 0} Go`,
      label: t('card_total_storage'),
      sub: t('card_storage_allocated'),
    },
  ]

  const quotas = tenantInfo ? [
    { label: t('quota_companies'), value: activeSocietes, max: tenantInfo.max_societes, color: 'indigo' },
    { label: t('quota_users'), value: usersCount, max: tenantInfo.max_licences, color: 'emerald' },
  ] : []

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <BarChart2 className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ icon: Icon, color, value, label, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                color === 'indigo' ? 'bg-indigo-50' :
                color === 'emerald' ? 'bg-emerald-50' :
                color === 'purple' ? 'bg-purple-50' : 'bg-sky-50'
              }`}>
                <Icon className={`h-5 w-5 ${
                  color === 'indigo' ? 'text-indigo-600' :
                  color === 'emerald' ? 'text-emerald-600' :
                  color === 'purple' ? 'text-purple-600' : 'text-sky-600'
                }`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            <div className="text-sm font-medium text-slate-600 mt-1">{label}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Quota Usage */}
      {tenantInfo && (
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
            <CardTitle className="text-base font-bold text-slate-800">{t('quota_title')}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4 space-y-5">
            {quotas.map(({ label, value, max, color }) => {
              const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
              const isAlert = pct >= 80
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className={`font-bold ${isAlert ? 'text-red-600' : 'text-slate-600'}`}>
                      {value} / {max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${isAlert ? 'bg-red-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Per Company Overview */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">{t('per_company_title')}</h2>
        {societes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-600">{t('no_companies')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('no_companies_desc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {societes.map(s => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:border-indigo-200 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center font-bold text-indigo-700 text-sm shrink-0">
                      {s.raison_sociale[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{s.raison_sociale}</p>
                      {s.sigle && <p className="text-xs text-slate-400 font-mono">{s.sigle}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.is_active
                      ? <><CheckCircle className="h-3 w-3" />{t('company_status_active')}</>
                      : <><XCircle className="h-3 w-3" />{t('company_status_inactive')}</>
                    }
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('company_devise')}</p>
                    <p className="font-bold text-slate-700 font-mono mt-1">{s.devise}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('company_created')}</p>
                    <p className="font-bold text-slate-700 mt-1">{dayjs(s.created_at).format('DD/MM/YYYY')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
