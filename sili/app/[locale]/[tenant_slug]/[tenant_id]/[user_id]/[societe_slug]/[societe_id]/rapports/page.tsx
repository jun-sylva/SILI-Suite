'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  BarChart3, Loader2, Users, Clock, CalendarOff, FileText,
  ShoppingCart, PackageSearch, Package, PhoneCall,
  CircleDollarSign, MessageSquare, GitBranch, ArrowRight,
} from 'lucide-react'

// ── Config des modules reportables ────────────────────────────────────────────

type ModuleConfig = {
  key: string
  titleKey: string
  descKey: string
  icon: React.ElementType
  color: string       // Tailwind bg + text pour la carte
  iconBg: string
  href: string | null // null = bientôt disponible
}

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    key: 'rh',
    titleKey: 'card_rh_title',
    descKey:  'card_rh_desc',
    icon:     Users,
    color:    'border-emerald-200 hover:border-emerald-400',
    iconBg:   'bg-emerald-50 text-emerald-600',
    href:     null,
  },
  {
    key: 'workflow',
    titleKey: 'card_workflow_title',
    descKey:  'card_workflow_desc',
    icon:     GitBranch,
    color:    'border-indigo-200 hover:border-indigo-400',
    iconBg:   'bg-indigo-50 text-indigo-600',
    href:     null,
  },
  {
    key: 'vente',
    titleKey: 'card_vente_title',
    descKey:  'card_vente_desc',
    icon:     ShoppingCart,
    color:    'border-blue-200 hover:border-blue-400',
    iconBg:   'bg-blue-50 text-blue-600',
    href:     null,
  },
  {
    key: 'achat',
    titleKey: 'card_achat_title',
    descKey:  'card_achat_desc',
    icon:     PackageSearch,
    color:    'border-orange-200 hover:border-orange-400',
    iconBg:   'bg-orange-50 text-orange-600',
    href:     null,
  },
  {
    key: 'stock',
    titleKey: 'card_stock_title',
    descKey:  'card_stock_desc',
    icon:     Package,
    color:    'border-amber-200 hover:border-amber-400',
    iconBg:   'bg-amber-50 text-amber-600',
    href:     null,
  },
  {
    key: 'crm',
    titleKey: 'card_crm_title',
    descKey:  'card_crm_desc',
    icon:     PhoneCall,
    color:    'border-pink-200 hover:border-pink-400',
    iconBg:   'bg-pink-50 text-pink-600',
    href:     null,
  },
  {
    key: 'comptabilite',
    titleKey: 'card_comptabilite_title',
    descKey:  'card_comptabilite_desc',
    icon:     CircleDollarSign,
    color:    'border-teal-200 hover:border-teal-400',
    iconBg:   'bg-teal-50 text-teal-600',
    href:     null,
  },
  {
    key: 'teams',
    titleKey: 'card_teams_title',
    descKey:  'card_teams_desc',
    icon:     MessageSquare,
    color:    'border-violet-200 hover:border-violet-400',
    iconBg:   'bg-violet-50 text-violet-600',
    href:     null,
  },
]

// ── Types stats ────────────────────────────────────────────────────────────────

interface RhStats {
  employes:        number
  presencesToday:  number
  congesPending:   number
}

interface WorkflowStats {
  enCours:  number
  enAttente: number
}

type ModuleStats = {
  rh?:       RhStats
  workflow?: WorkflowStats
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RapportsDashboard() {
  const t      = useTranslations('rapports')
  const router = useRouter()
  const params = useParams()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base        = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/rapports`

  const [loading, setLoading]               = useState(true)
  const [activeModules, setActiveModules]   = useState<string[]>([])
  const [stats, setStats]                   = useState<ModuleStats>({})

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()
    if (!profile) return

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
    if (!isTenantAdmin) {
      const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'rapports')
      if (perm === 'aucun') { router.push(`/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/dashboard`); return }
    }

    // Modules actifs sur cette société
    const { data: modsData } = await supabase
      .from('societe_modules')
      .select('module')
      .eq('societe_id', societeId)
      .eq('is_active', true)
    const mods = (modsData ?? []).map((r: any) => r.module)
    setActiveModules(mods)

    // Stats en parallèle selon modules actifs
    const statsResult: ModuleStats = {}

    await Promise.all([
      // RH
      mods.includes('rh') && (async () => {
        const today = new Date().toISOString().split('T')[0]
        const [{ count: employes }, { count: presences }, { count: conges }] = await Promise.all([
          supabase.from('rh_employes').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).eq('statut', 'actif'),
          supabase.from('rh_presences').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).eq('date', today),
          supabase.from('rh_conges').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).eq('statut', 'en_attente'),
        ])
        statsResult.rh = {
          employes:       employes ?? 0,
          presencesToday: presences ?? 0,
          congesPending:  conges ?? 0,
        }
      })(),

      // Workflow
      mods.includes('workflow') && (async () => {
        const [{ count: enCours }, { count: enAttente }] = await Promise.all([
          supabase.from('workflow_requests').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).eq('statut', 'assigne'),
          supabase.from('workflow_requests').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).eq('statut', 'en_attente'),
        ])
        statsResult.workflow = {
          enCours:   enCours ?? 0,
          enAttente: enAttente ?? 0,
        }
      })(),
    ])

    setStats(statsResult)
    setLoading(false)
  }

  // Filtrer les modules actifs qui ont une config rapport
  const visibleModules = MODULE_CONFIGS.filter(m => activeModules.includes(m.key))

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Modules actifs */}
      {visibleModules.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 text-sm">
          {t('no_modules')}
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">{t('modules_section')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map((mod) => {
              const Icon = mod.icon
              const isSoon = mod.href === null

              return (
                <div
                  key={mod.key}
                  className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-200 ${mod.color} ${isSoon ? 'opacity-80' : 'cursor-pointer'}`}
                >
                  {/* Badge bientôt */}
                  {isSoon && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {t('badge_soon')}
                    </span>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${mod.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{t(mod.titleKey as any)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t(mod.descKey as any)}</p>
                    </div>
                  </div>

                  {/* Stats inline */}
                  {mod.key === 'rh' && stats.rh && (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-base font-bold text-slate-800">{stats.rh.employes}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t('stat_employes')}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-base font-bold text-slate-800">{stats.rh.presencesToday}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t('stat_presences_today')}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-base font-bold text-slate-800">{stats.rh.congesPending}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t('stat_conges_pending')}</p>
                      </div>
                    </div>
                  )}

                  {mod.key === 'workflow' && stats.workflow && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-base font-bold text-slate-800">{stats.workflow.enCours}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t('stat_workflow_en_cours')}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-base font-bold text-slate-800">{stats.workflow.enAttente}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t('stat_workflow_pending')}</p>
                      </div>
                    </div>
                  )}

                  {/* Lien rapport */}
                  {!isSoon && mod.href && (
                    <div className="mt-4 flex justify-end">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                        {t('btn_voir')} <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
