'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  FileText, Clock, CheckCircle2, ClipboardList, ArrowRight, Loader2,
} from 'lucide-react'

interface Stats {
  mesRequetes: number
  enAttente: number
  approuvees: number
  assignees: number
}

export default function WorkflowDashboard() {
  const t = useTranslations('workflow')
  const params = useParams()
  const router = useRouter()
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`

  const [stats, setStats] = useState<Stats>({ mesRequetes: 0, enAttente: 0, approuvees: 0, assignees: 0 })
  const [canAccessAssignees, setCanAccessAssignees] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      if (!profile) return

      const isAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'

      if (!isAdmin) {
        const { data: permData } = await supabase
          .from('user_module_permissions').select('permission')
          .eq('user_id', session.user.id).eq('societe_id', societeId).eq('module', 'workflow').maybeSingle()
        const perm = permData?.permission ?? 'aucun'
        if (perm === 'gestionnaire' || perm === 'admin') setCanAccessAssignees(true)
      } else {
        setCanAccessAssignees(true)
      }

      // Mes requêtes (créées par moi)
      const { data: myRequests } = await supabase
        .from('workflow_requests')
        .select('id, statut')
        .eq('created_by', session.user.id)
        .eq('societe_id', societeId)

      const mesRequetes = myRequests?.length ?? 0
      const enAttente = myRequests?.filter(r => r.statut === 'en_attente' || r.statut === 'assigne').length ?? 0
      const approuvees = myRequests?.filter(r => r.statut === 'approuve').length ?? 0

      // Requêtes assignées à moi
      const { data: assignedRequests } = await supabase
        .from('workflow_requests')
        .select('id')
        .eq('assigned_to', session.user.id)
        .eq('societe_id', societeId)
        .in('statut', ['assigne'])

      const assignees = assignedRequests?.length ?? 0

      setStats({ mesRequetes, enAttente, approuvees, assignees })
      setLoading(false)
    }
    load()
  }, [societeId])

  const statCards = [
    {
      key: 'mesRequetes',
      label: t('stat_mes_requetes'),
      value: stats.mesRequetes,
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      key: 'enAttente',
      label: t('stat_en_attente'),
      value: stats.enAttente,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      key: 'approuvees',
      label: t('stat_approuvees'),
      value: stats.approuvees,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      key: 'assignees',
      label: t('stat_assignees'),
      value: stats.assignees,
      icon: ClipboardList,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">{card.label}</span>
                <div className={`${card.bg} p-2 rounded-lg`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Cartes cliquables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mes Requêtes */}
        <button
          onClick={() => router.push(`${base}/mes-requetes`)}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-3 rounded-xl">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">{t('stat_mes_requetes')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t('card_mes_requetes_desc')}</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </div>
          <p className="text-3xl font-bold text-indigo-600">{stats.mesRequetes}</p>
        </button>

        {/* Requêtes Assignées */}
        <button
          onClick={() => canAccessAssignees && router.push(`${base}/assignees`)}
          disabled={!canAccessAssignees}
          className={`bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-left transition-all group ${
            canAccessAssignees
              ? 'hover:border-purple-300 hover:shadow-md cursor-pointer'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-3 rounded-xl">
                <ClipboardList className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-base">{t('stat_assignees')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t('card_assignees_desc')}</p>
              </div>
            </div>
            <ArrowRight className={`h-5 w-5 text-slate-300 ${canAccessAssignees ? 'group-hover:text-purple-500' : ''} transition-colors`} />
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats.assignees}</p>
        </button>
      </div>
    </div>
  )
}
