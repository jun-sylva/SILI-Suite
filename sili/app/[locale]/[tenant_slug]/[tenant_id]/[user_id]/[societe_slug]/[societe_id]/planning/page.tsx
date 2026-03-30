'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import {
  CalendarDays, FolderKanban, Users, Loader2,
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  ArrowRight, ChevronRight, Flag,
} from 'lucide-react'

interface KpiData {
  projets_actifs:   number
  taches_semaine:   number
  taches_retard:    number
  taux_avancement:  number
}

interface AlerteItem {
  id:      string
  type:    'retard' | 'jalon' | 'surcharge'
  label:   string
  detail:  string
}

interface MaTache {
  id:             string
  titre:          string
  projet_titre:   string
  responsable_id: string | null
  date_echeance:  string | null
  statut:         string
  priorite:       string
}

const PRIORITE_COLOR: Record<string, string> = {
  basse:    'bg-slate-100 text-slate-500',
  normale:  'bg-blue-100 text-blue-600',
  haute:    'bg-orange-100 text-orange-600',
  critique: 'bg-red-100 text-red-600',
}

const STATUT_COLOR: Record<string, string> = {
  todo:     'bg-slate-100 text-slate-500',
  en_cours: 'bg-blue-100 text-blue-600',
  revue:    'bg-amber-100 text-amber-600',
  fait:     'bg-emerald-100 text-emerald-600',
}

export default function PlanningDashboard() {
  const t         = useTranslations('planning')
  const params    = useParams()
  const router    = useRouter()
  const societeId = params.societe_id as string
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/planning`

  const [loading,      setLoading]      = useState(true)
  const [kpi,          setKpi]          = useState<KpiData>({ projets_actifs: 0, taches_semaine: 0, taches_retard: 0, taux_avancement: 0 })
  const [alertes,      setAlertes]      = useState<AlerteItem[]>([])
  const [mesTaches,    setMesTaches]    = useState<MaTache[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [canManage,    setCanManage]    = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'planning')
        setCanManage(['gestionnaire', 'admin'].includes(perm))
      } else {
        setCanManage(true)
      }

      await Promise.all([
        loadKpi(session.user.id),
        loadAlertes(),
        loadMesTaches(session.user.id),
      ])
      setLoading(false)
    }
    init()
  }, [societeId])

  async function loadKpi(uid: string) {
    const now   = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1) // lundi
    const end   = new Date(start); end.setDate(start.getDate() + 6) // dimanche

    const [projRes, allTachesRes] = await Promise.all([
      (supabase as any).from('plan_projets').select('id').eq('societe_id', societeId).eq('statut', 'actif'),
      (supabase as any).from('plan_taches').select('id, statut, date_echeance').eq('societe_id', societeId),
    ])

    const projets_actifs = (projRes.data ?? []).length
    const taches         = allTachesRes.data ?? []
    const taches_semaine = taches.filter((t: any) =>
      t.date_echeance && new Date(t.date_echeance) >= start && new Date(t.date_echeance) <= end
    ).length
    const taches_retard = taches.filter((t: any) =>
      t.date_echeance && new Date(t.date_echeance) < now && t.statut !== 'fait'
    ).length
    const total = taches.length
    const faites = taches.filter((t: any) => t.statut === 'fait').length
    const taux_avancement = total > 0 ? Math.round((faites / total) * 100) : 0

    setKpi({ projets_actifs, taches_semaine, taches_retard, taux_avancement })
  }

  async function loadAlertes() {
    const now     = new Date()
    const in7days = new Date(); in7days.setDate(now.getDate() + 7)
    const items: AlerteItem[] = []

    // Tâches en retard
    const { data: retard } = await (supabase as any)
      .from('plan_taches')
      .select('id, titre, projet:plan_projets!projet_id(titre)')
      .eq('societe_id', societeId)
      .neq('statut', 'fait')
      .lt('date_echeance', now.toISOString().split('T')[0])
      .limit(3)

    for (const r of (retard ?? [])) {
      items.push({ id: r.id, type: 'retard', label: r.titre, detail: r.projet?.titre ?? '' })
    }

    // Jalons imminents (7 jours)
    const { data: jalons } = await (supabase as any)
      .from('plan_jalons')
      .select('id, titre, date_cible, projet:plan_projets!projet_id(societe_id)')
      .gte('date_cible', now.toISOString().split('T')[0])
      .lte('date_cible', in7days.toISOString().split('T')[0])
      .eq('statut', 'en_attente')
      .limit(3)

    for (const j of (jalons ?? []).filter((j: any) => j.projet?.societe_id === societeId)) {
      items.push({ id: j.id, type: 'jalon', label: j.titre, detail: `Échéance : ${new Date(j.date_cible).toLocaleDateString('fr-FR')}` })
    }

    // Membres surchargés (≥ 5 tâches actives)
    const { data: actives } = await (supabase as any)
      .from('plan_taches')
      .select('assigne_a, profiles:profiles!assigne_a(full_name)')
      .eq('societe_id', societeId)
      .in('statut', ['todo', 'en_cours', 'revue'])
      .not('assigne_a', 'is', null)

    const chargeMap: Record<string, { count: number; name: string }> = {}
    for (const t of (actives ?? [])) {
      if (!chargeMap[t.assigne_a]) chargeMap[t.assigne_a] = { count: 0, name: t.profiles?.full_name ?? '—' }
      chargeMap[t.assigne_a].count++
    }
    for (const [uid, { count, name }] of Object.entries(chargeMap)) {
      if (count >= 5) items.push({ id: uid, type: 'surcharge', label: name, detail: `${count} tâches actives` })
    }

    setAlertes(items.slice(0, 6))
  }

  async function loadMesTaches(uid: string) {
    const { data } = await (supabase as any)
      .from('plan_taches')
      .select('id, titre, statut, priorite, date_echeance, projet:plan_projets!projet_id(titre, responsable_id)')
      .eq('societe_id', societeId)
      .eq('assigne_a', uid)
      .neq('statut', 'fait')
      .order('date_echeance', { ascending: true, nullsFirst: false })
      .limit(8)

    setMesTaches((data ?? []).map((t: any) => ({
      id:               t.id,
      titre:            t.titre,
      projet_titre:     t.projet?.titre ?? '—',
      responsable_id:   t.projet?.responsable_id ?? null,
      date_echeance:    t.date_echeance,
      statut:           t.statut,
      priorite:         t.priorite,
    })))
  }

  async function markFait(tacheId: string) {
    const tache = mesTaches.find(t => t.id === tacheId)
    await (supabase as any).from('plan_taches').update({ statut: 'fait', date_completee: new Date().toISOString() }).eq('id', tacheId)
    setMesTaches(prev => prev.filter(t => t.id !== tacheId))
    if (tache) {
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'tache_completed', resourceType: 'plan_taches', resourceId: tacheId, metadata: { titre: tache.titre, projet_titre: tache.projet_titre } })
      // Notifier le responsable du projet si c'est quelqu'un d'autre
      if (tache.responsable_id && tache.responsable_id !== currentUserId) {
        await supabase.from('notifications').insert({
          tenant_id: fullTenantId,
          user_id:   tache.responsable_id,
          type:      'info',
          titre:     'Tâche complétée',
          message:   `La tâche "${tache.titre}" sur le projet "${tache.projet_titre}" a été complétée.`,
        })
      }
    }
  }

  if (loading) {
    return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
  }

  const ALERTE_CONFIG = {
    retard:    { color: 'bg-red-50 border-red-200 text-red-700',   icon: AlertTriangle, label: 'En retard' },
    jalon:     { color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Flag,    label: 'Jalon imminent' },
    surcharge: { color: 'bg-orange-50 border-orange-200 text-orange-700', icon: Users, label: 'Surcharge' },
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{t('dashboard_title')}</h1>
            <p className="text-sm text-slate-500">{t('dashboard_desc')}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`${base}/projets`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <FolderKanban className="h-4 w-4" />
          {t('btn_voir_projets')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpi_projets_actifs'), value: kpi.projets_actifs, icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: t('kpi_taches_semaine'), value: kpi.taches_semaine, icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: t('kpi_taches_retard'),  value: kpi.taches_retard,  icon: AlertTriangle, color: kpi.taches_retard > 0 ? 'text-red-600' : 'text-slate-400', bg: kpi.taches_retard > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: t('kpi_taux_avancement'), value: `${kpi.taux_avancement}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{k.label}</span>
                <div className={`h-8 w-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertes intelligentes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t('section_alertes')}</h2>
            {alertes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-bold">{alertes.length}</span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {alertes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-400">{t('alertes_empty')}</p>
              </div>
            )}
            {alertes.map(a => {
              const cfg = ALERTE_CONFIG[a.type]
              const Icon = cfg.icon
              return (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.color}`}>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide opacity-70">{cfg.label}</p>
                    <p className="text-sm font-semibold truncate">{a.label}</p>
                    {a.detail && <p className="text-xs opacity-70">{a.detail}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mes tâches du jour */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t('section_mes_taches')}</h2>
            <button
              onClick={() => router.push(`${base}/projets`)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              {t('voir_tout')} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {mesTaches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-400">{t('mes_taches_empty')}</p>
              </div>
            )}
            {mesTaches.map(t => {
              const isRetard = t.date_echeance && new Date(t.date_echeance) < new Date()
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                  <button
                    onClick={() => markFait(t.id)}
                    className="h-5 w-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors shrink-0"
                    title="Marquer comme fait"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.titre}</p>
                    <p className="text-xs text-slate-400">{t.projet_titre}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITE_COLOR[t.priorite]}`}>
                      {t.priorite}
                    </span>
                    {t.date_echeance && (
                      <span className={`text-[10px] font-semibold ${isRetard ? 'text-red-500' : 'text-slate-400'}`}>
                        {new Date(t.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Raccourcis */}
      {canManage && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t('shortcut_projets'),    href: `${base}/projets`,    icon: FolderKanban, color: 'indigo' },
            { label: t('shortcut_calendrier'), href: `${base}/calendrier`, icon: CalendarDays, color: 'blue'   },
            { label: t('shortcut_ressources'), href: `${base}/ressources`, icon: Users,        color: 'emerald'},
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <button
                key={i}
                onClick={() => router.push(s.href)}
                className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all text-left group"
              >
                <div className={`h-10 w-10 rounded-xl bg-${s.color}-50 flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 text-${s.color}-600`} />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{s.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 ml-auto transition-colors" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
