'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  Users, ChevronLeft, ChevronRight, Loader2, AlertCircle,
  BarChart3, Calendar, Filter, CheckSquare, Clock, TrendingUp,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Membre {
  id:         string
  nom:        string
  prenom:     string
  email:      string
  avatar_url: string | null
}

interface TacheCharge {
  id:            string
  titre:         string
  statut:        string
  priorite:      string
  date_debut:    string | null
  date_fin:      string | null
  projet_titre:  string
  projet_couleur: string
  assignee_id:   string
}

interface MembreCharge {
  membre:           Membre
  taches_totales:   number
  taches_actives:   number
  taches_retard:    number
  taches_terminees: number
  taux_charge:      number   // 0-100 (basé sur max 8 tâches actives)
  taches:           TacheCharge[]
}

type PeriodeFiltre = 'semaine' | 'mois' | 'trimestre'
type VueMode       = 'charge' | 'timeline'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(prenom: string, nom: string) {
  return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
}

function getChargeColor(taux: number) {
  if (taux >= 90) return 'bg-red-500'
  if (taux >= 70) return 'bg-amber-500'
  if (taux >= 40) return 'bg-emerald-500'
  return 'bg-slate-300'
}

function getChargeLabel(taux: number) {
  if (taux >= 90) return { label: 'Surchargé', color: 'text-red-600 bg-red-50 border-red-200' }
  if (taux >= 70) return { label: 'Chargé',    color: 'text-amber-600 bg-amber-50 border-amber-200' }
  if (taux >= 40) return { label: 'Normal',    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
  return                 { label: 'Léger',     color: 'text-slate-500 bg-slate-50 border-slate-200' }
}

function getPrioriteColor(p: string) {
  if (p === 'critique') return 'bg-red-100 text-red-700'
  if (p === 'haute')    return 'bg-orange-100 text-orange-700'
  if (p === 'normale')  return 'bg-blue-100 text-blue-700'
  return                       'bg-slate-100 text-slate-600'
}

function getStatutColor(s: string) {
  if (s === 'termine')     return 'bg-emerald-100 text-emerald-700'
  if (s === 'en_cours')    return 'bg-blue-100 text-blue-700'
  if (s === 'en_attente')  return 'bg-slate-100 text-slate-600'
  if (s === 'bloque')      return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function getStatutLabel(s: string) {
  const m: Record<string, string> = {
    en_attente: 'En attente', en_cours: 'En cours',
    termine: 'Terminé',       bloque: 'Bloqué',
  }
  return m[s] ?? s
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function isOverdue(date_fin: string | null) {
  if (!date_fin) return false
  return new Date(date_fin) < new Date()
}

// ── Timeline Bar ──────────────────────────────────────────────────────────────

function TimelineBar({
  tache, periodStart, periodEnd, couleur,
}: { tache: TacheCharge; periodStart: Date; periodEnd: Date; couleur: string }) {
  const totalDays = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / 86400000)

  const start = tache.date_debut ? new Date(tache.date_debut) : periodStart
  const end   = tache.date_fin   ? new Date(tache.date_fin)   : periodEnd

  const clampStart = start < periodStart ? periodStart : start
  const clampEnd   = end   > periodEnd   ? periodEnd   : end

  const left  = Math.max(0, (clampStart.getTime() - periodStart.getTime()) / 86400000 / totalDays * 100)
  const width = Math.max(1, (clampEnd.getTime()   - clampStart.getTime()) / 86400000 / totalDays * 100)

  const overdue = isOverdue(tache.date_fin) && tache.statut !== 'termine'

  return (
    <div className="relative h-6 flex items-center">
      <div
        className={`absolute h-5 rounded-full text-xs text-white flex items-center px-2 truncate shadow-sm
          ${overdue ? 'ring-1 ring-red-400' : ''}`}
        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, backgroundColor: couleur, opacity: 0.85, minWidth: '4px' }}
        title={`${tache.titre} — ${formatDate(tache.date_debut)} → ${formatDate(tache.date_fin)}`}
      >
        {width > 8 ? tache.titre : ''}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RessourcesPage() {
  const t         = useTranslations('planning')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [vue,          setVue]          = useState<VueMode>('charge')
  const [periode,      setPeriode]      = useState<PeriodeFiltre>('mois')
  const [charges,      setCharges]      = useState<MembreCharge[]>([])
  const [loading,      setLoading]      = useState(true)
  const [canManage,    setCanManage]    = useState(false)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [searchQ,      setSearchQ]      = useState('')

  // Timeline navigation
  const [timelineStart, setTimelineStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d
  })

  // ── Permission check ────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkPerm() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      if (profile?.role === 'tenant_admin') { setCanManage(true); return }
      const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'planning')
      setCanManage(['gestionnaire', 'admin'].includes(perm))
    }
    checkPerm()
  }, [societeId])

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadCharges = useCallback(async () => {
    setLoading(true)
    try {
      // Déterminer la fenêtre temporelle
      const now = new Date()
      let periodStart: Date
      let periodEnd: Date

      if (periode === 'semaine') {
        periodStart = new Date(now); periodStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        periodEnd   = addDays(periodStart, 6)
      } else if (periode === 'mois') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      } else {
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        periodEnd   = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0)
      }

      setTimelineStart(periodStart)

      // Récupérer les tâches de la société avec assignees + projets
      const { data: tachesRaw } = await (supabase as any)
        .from('plan_taches')
        .select(`
          id, titre, statut, priorite, date_debut, date_fin, assignee_id,
          plan_projets!inner(titre, couleur, societe_id)
        `)
        .eq('plan_projets.societe_id', societeId)
        .neq('statut', 'archive')

      if (!tachesRaw || tachesRaw.length === 0) {
        setCharges([])
        setLoading(false)
        return
      }

      // IDs des assignees uniques
      const assigneeIds: string[] = [...new Set(
        tachesRaw.filter((t: any) => t.assignee_id).map((t: any) => t.assignee_id as string)
      )]

      if (assigneeIds.length === 0) {
        setCharges([])
        setLoading(false)
        return
      }

      // Profils des assignees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom, prenom, email, avatar_url')
        .in('id', assigneeIds)

      if (!profiles) { setCharges([]); setLoading(false); return }

      // Construire la structure charge par membre
      const result: MembreCharge[] = profiles.map((p: any) => {
        const memberTaches: TacheCharge[] = tachesRaw
          .filter((t: any) => t.assignee_id === p.id)
          .map((t: any) => ({
            id:             t.id,
            titre:          t.titre,
            statut:         t.statut,
            priorite:       t.priorite,
            date_debut:     t.date_debut,
            date_fin:       t.date_fin,
            projet_titre:   t.plan_projets?.titre ?? '',
            projet_couleur: t.plan_projets?.couleur ?? '#6366f1',
            assignee_id:    t.assignee_id,
          }))

        const actives   = memberTaches.filter(t => ['en_attente', 'en_cours', 'bloque'].includes(t.statut))
        const terminees = memberTaches.filter(t => t.statut === 'termine')
        const retard    = actives.filter(t => isOverdue(t.date_fin))

        // Taux de charge : 8 tâches actives = 100%
        const taux = Math.min(100, Math.round((actives.length / 8) * 100))

        return {
          membre:           { id: p.id, nom: p.nom, prenom: p.prenom, email: p.email, avatar_url: p.avatar_url },
          taches_totales:   memberTaches.length,
          taches_actives:   actives.length,
          taches_retard:    retard.length,
          taches_terminees: terminees.length,
          taux_charge:      taux,
          taches:           memberTaches,
        }
      })

      // Trier par taux de charge décroissant
      result.sort((a, b) => b.taux_charge - a.taux_charge)
      setCharges(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [societeId, periode])

  useEffect(() => { loadCharges() }, [loadCharges])

  // ── Filtre recherche ────────────────────────────────────────────────────────

  const filteredCharges = charges.filter(c =>
    `${c.membre.prenom} ${c.membre.nom}`.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.membre.email.toLowerCase().includes(searchQ.toLowerCase())
  )

  // ── Timeline period ─────────────────────────────────────────────────────────

  const timelineEnd: Date = (() => {
    if (periode === 'semaine')   return addDays(timelineStart, 6)
    if (periode === 'mois')      return new Date(timelineStart.getFullYear(), timelineStart.getMonth() + 1, 0)
    return new Date(timelineStart.getFullYear(), Math.floor(timelineStart.getMonth() / 3) * 3 + 3, 0)
  })()

  const timelineDays = Math.round((timelineEnd.getTime() - timelineStart.getTime()) / 86400000) + 1
  const timelineLabels: Date[] = []
  const step = periode === 'semaine' ? 1 : periode === 'mois' ? 7 : 14
  for (let i = 0; i < timelineDays; i += step) timelineLabels.push(addDays(timelineStart, i))

  // KPI agrégés
  const totalMembers   = charges.length
  const surcharges     = charges.filter(c => c.taux_charge >= 90).length
  const totalRetard    = charges.reduce((s, c) => s + c.taches_retard, 0)
  const avgCharge      = totalMembers > 0
    ? Math.round(charges.reduce((s, c) => s + c.taux_charge, 0) / totalMembers)
    : 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            {t('ressources_title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('ressources_subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Recherche */}
          <input
            type="text"
            placeholder={t('ressources_search')}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
          />

          {/* Filtre période */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['semaine', 'mois', 'trimestre'] as PeriodeFiltre[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  periode === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t(`periode_${p}`)}
              </button>
            ))}
          </div>

          {/* Toggle vue */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setVue('charge')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                vue === 'charge' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {t('vue_charge')}
            </button>
            <button
              onClick={() => setVue('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                vue === 'timeline' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {t('vue_timeline')}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('kpi_membres'), value: totalMembers, icon: Users,        color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: t('kpi_charge_moy'), value: `${avgCharge}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('kpi_surcharges'), value: surcharges,  icon: AlertCircle, color: 'text-red-600',    bg: 'bg-red-50' },
          { label: t('kpi_retard'),    value: totalRetard,  icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`h-10 w-10 rounded-xl ${k.bg} flex items-center justify-center`}>
              <k.icon className={`h-5 w-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : filteredCharges.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 gap-3 text-slate-400">
          <Users className="h-12 w-12" />
          <p className="text-sm">{t('ressources_empty')}</p>
        </div>
      ) : vue === 'charge' ? (
        /* ── Vue Charge ────────────────────────────────────────────────────── */
        <div className="space-y-3">
          {filteredCharges.map(mc => {
            const chargeInfo  = getChargeLabel(mc.taux_charge)
            const isExpanded  = expandedId === mc.membre.id
            const activeTaches = mc.taches.filter(t => t.statut !== 'termine')

            return (
              <div key={mc.membre.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Ligne principale */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : mc.membre.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {mc.membre.avatar_url
                      ? <img src={mc.membre.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                      : getInitials(mc.membre.prenom, mc.membre.nom)
                    }
                  </div>

                  {/* Infos membre */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">
                        {mc.membre.prenom} {mc.membre.nom}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${chargeInfo.color}`}>
                        {chargeInfo.label}
                      </span>
                      {mc.taches_retard > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600">
                          {mc.taches_retard} en retard
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{mc.membre.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-center shrink-0">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{mc.taches_actives}</p>
                      <p className="text-xs text-slate-400">actives</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{mc.taches_terminees}</p>
                      <p className="text-xs text-slate-400">terminées</p>
                    </div>
                  </div>

                  {/* Barre de charge */}
                  <div className="w-32 shrink-0">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Charge</span>
                      <span className="font-medium">{mc.taux_charge}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getChargeColor(mc.taux_charge)}`}
                        style={{ width: `${mc.taux_charge}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Panel tâches expandable */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      {t('taches_assignees')} ({activeTaches.length})
                    </p>
                    {activeTaches.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">{t('aucune_tache_active')}</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {activeTaches.map(tache => (
                          <div key={tache.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                            <div className="flex items-start gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full mt-1 shrink-0"
                                style={{ backgroundColor: tache.projet_couleur }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{tache.titre}</p>
                                <p className="text-xs text-slate-400 truncate">{tache.projet_titre}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getStatutColor(tache.statut)}`}>
                                {getStatutLabel(tache.statut)}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getPrioriteColor(tache.priorite)}`}>
                                {tache.priorite}
                              </span>
                              {tache.date_fin && (
                                <span className={`text-xs ml-auto ${isOverdue(tache.date_fin) && tache.statut !== 'termine' ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                  {formatDate(tache.date_fin)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Vue Timeline ──────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* En-tête timeline */}
          <div className="border-b border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">
                {formatDate(timelineStart)} → {formatDate(timelineEnd)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(timelineStart)
                  if (periode === 'semaine') d.setDate(d.getDate() - 7)
                  else if (periode === 'mois') d.setMonth(d.getMonth() - 1)
                  else d.setMonth(d.getMonth() - 3)
                  setTimelineStart(d)
                }}
                className="h-7 w-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <button
                onClick={() => {
                  const d = new Date(timelineStart)
                  if (periode === 'semaine') d.setDate(d.getDate() + 7)
                  else if (periode === 'mois') d.setMonth(d.getMonth() + 1)
                  else d.setMonth(d.getMonth() + 3)
                  setTimelineStart(d)
                }}
                className="h-7 w-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: '700px' }}>
              {/* Axe des dates */}
              <div className="flex border-b border-slate-100">
                <div className="w-52 shrink-0 p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t('col_membre')}
                </div>
                <div className="flex-1 relative h-10">
                  {timelineLabels.map((d, i) => {
                    const totalDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / 86400000)
                    const left = (d.getTime() - timelineStart.getTime()) / 86400000 / totalDays * 100
                    return (
                      <span
                        key={i}
                        className="absolute text-xs text-slate-400 transform -translate-x-1/2 top-3"
                        style={{ left: `${left}%` }}
                      >
                        {d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    )
                  })}
                  {/* Ligne aujourd'hui */}
                  {(() => {
                    const now = new Date()
                    if (now >= timelineStart && now <= timelineEnd) {
                      const totalDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / 86400000)
                      const left = (now.getTime() - timelineStart.getTime()) / 86400000 / totalDays * 100
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-indigo-400 opacity-60"
                          style={{ left: `${left}%` }}
                        />
                      )
                    }
                  })()}
                </div>
              </div>

              {/* Lignes membres */}
              {filteredCharges.map(mc => (
                <div key={mc.membre.id} className="flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  {/* Membre */}
                  <div className="w-52 shrink-0 p-3 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {getInitials(mc.membre.prenom, mc.membre.nom)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {mc.membre.prenom} {mc.membre.nom}
                      </p>
                      <p className="text-xs text-slate-400">{mc.taches_actives} actives</p>
                    </div>
                  </div>

                  {/* Barres tâches */}
                  <div className="flex-1 p-2 space-y-1">
                    {mc.taches
                      .filter(t => t.statut !== 'termine' && (t.date_debut || t.date_fin))
                      .slice(0, 5)
                      .map(tache => (
                        <TimelineBar
                          key={tache.id}
                          tache={tache}
                          periodStart={timelineStart}
                          periodEnd={timelineEnd}
                          couleur={tache.projet_couleur}
                        />
                      ))}
                    {mc.taches.filter(t => t.statut !== 'termine' && (t.date_debut || t.date_fin)).length > 5 && (
                      <p className="text-xs text-slate-400 italic pl-1">
                        +{mc.taches.filter(t => t.statut !== 'termine' && (t.date_debut || t.date_fin)).length - 5} de plus
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <span className="font-medium text-slate-700">{t('legende')}</span>
        {[
          { color: 'bg-slate-300',  label: t('charge_legere')   },
          { color: 'bg-emerald-500', label: t('charge_normale')  },
          { color: 'bg-amber-500',   label: t('charge_elevee')   },
          { color: 'bg-red-500',     label: t('charge_critique') },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-5 rounded-full ${l.color}`} />
            <span>{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-px bg-indigo-400" />
          <span>{t('legende_aujourdhui')}</span>
        </div>
      </div>
    </div>
  )
}
