'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2, ShieldOff, Clock, BarChart3, Calendar,
  CheckCircle2, XCircle, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import dayjs from 'dayjs'

// ── Types ─────────────────────────────────────────────────────

type Employe = {
  id: string
  nom: string
  prenom: string
  matricule: string
  poste: string | null
}

type Presence = {
  id: string
  employe_id: string
  date: string
  statut: string
  note: string | null
}

type Conge = {
  id: string
  employe_id: string
  type_conge: string
  date_debut: string
  date_fin: string
  nb_jours: number
  motif: string | null
  statut: string
  commentaire_rh: string | null
  approuve_par: string | null
  approuve_le: string | null
  created_at: string
  rh_employes: { nom: string; prenom: string; matricule: string } | null
}

type TabId = 'pointage' | 'recap' | 'conges'

// ── Constantes ────────────────────────────────────────────────

const STATUTS = ['present', 'absent', 'retard', 'conge', 'mission'] as const

const STATUT_STYLES: Record<string, { bg: string; text: string; label_key: string }> = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-700', label_key: 'statut_present' },
  absent:  { bg: 'bg-red-100',     text: 'text-red-600',     label_key: 'statut_absent'  },
  retard:  { bg: 'bg-orange-100',  text: 'text-orange-700',  label_key: 'statut_retard'  },
  conge:   { bg: 'bg-amber-100',   text: 'text-amber-700',   label_key: 'statut_conge'   },
  mission: { bg: 'bg-blue-100',    text: 'text-blue-700',    label_key: 'statut_mission' },
}

const STATUT_LETTER: Record<string, string> = {
  present: 'P', absent: 'A', retard: 'R', conge: 'C', mission: 'M',
}

const TYPE_CONGE_KEYS: Record<string, string> = {
  annuel:      'type_annuel',
  maladie:     'type_maladie',
  maternite:   'type_maternite',
  paternite:   'type_paternite',
  sans_solde:  'type_sans_solde',
  exceptionnel:'type_exceptionnel',
}

// ── Page ──────────────────────────────────────────────────────

export default function PresencesPage() {
  const t         = useTranslations('rh')
  const params    = useParams()
  const societeId = params.societe_id as string

  // Auth / permissions
  const [loading, setLoading]             = useState(true)
  const [canAccessPage, setCanAccessPage] = useState(false)
  const [canManage, setCanManage]         = useState(false)
  const [fullTenantId, setFullTenantId]   = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<TabId>('pointage')

  // ── Pointage state ───────────────────────────────────────────
  const [employees, setEmployees]       = useState<Employe[]>([])
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [presenceMap, setPresenceMap]   = useState<Record<string, string>>({})   // employe_id → statut
  const [saving, setSaving]             = useState(false)

  // ── Récapitulatif state ──────────────────────────────────────
  const [selectedMonth, setSelectedMonth]     = useState(dayjs().format('YYYY-MM'))
  const [monthPresences, setMonthPresences]   = useState<Presence[]>([])
  const [recapLoading, setRecapLoading]       = useState(false)

  // ── Congés state ─────────────────────────────────────────────
  const [pending, setPending]             = useState<Conge[]>([])
  const [history, setHistory]             = useState<Conge[]>([])
  const [congesLoading, setCongesLoading] = useState(false)
  const [actionId, setActionId]           = useState<string | null>(null)
  const [comment, setComment]             = useState('')

  // ── Init ──────────────────────────────────────────────────────

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) return

    setFullTenantId(profile.tenant_id)
    setCurrentUserId(session.user.id)

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'

    if (isTenantAdmin) {
      setCanAccessPage(true)
      setCanManage(true)
    } else {
      const { data: perm } = await supabase
        .rpc('get_user_permission', { p_module: 'rh', p_societe_id: societeId })

      const hasAccess  = perm !== 'aucun' && !!perm
      const hasManage  = perm === 'gestionnaire' || perm === 'admin'
      setCanAccessPage(hasAccess)
      setCanManage(hasManage)
    }

    await fetchEmployees()
    setLoading(false)
  }

  // ── Employees ─────────────────────────────────────────────────

  async function fetchEmployees() {
    const { data } = await supabase
      .from('rh_employes')
      .select('id, nom, prenom, matricule, poste')
      .eq('societe_id', societeId)
      .eq('statut', 'actif')
      .order('nom')

    setEmployees(data ?? [])
  }

  // ── Pointage ─────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage) fetchPresencesForDate(selectedDate)
  }, [selectedDate, loading])

  async function fetchPresencesForDate(date: string) {
    const { data } = await supabase
      .from('rh_presences')
      .select('employe_id, statut')
      .eq('societe_id', societeId)
      .eq('date', date)

    const map: Record<string, string> = {}
    data?.forEach((p: any) => { map[p.employe_id] = p.statut })
    setPresenceMap(map)
  }

  async function handleSavePointage() {
    if (!canManage) return
    setSaving(true)

    const rows = employees.map(emp => ({
      tenant_id:  fullTenantId,
      societe_id: societeId,
      employe_id: emp.id,
      date:       selectedDate,
      statut:     presenceMap[emp.id] ?? 'present',
      created_by: currentUserId,
    }))

    const { error } = await supabase
      .from('rh_presences')
      .upsert(rows, { onConflict: 'employe_id,date' })

    if (error) toast.error(t('toast_pointage_error'))
    else       toast.success(t('toast_pointage_success'))

    setSaving(false)
  }

  // ── Récapitulatif ─────────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage) fetchMonthPresences(selectedMonth)
  }, [selectedMonth, loading])

  async function fetchMonthPresences(month: string) {
    setRecapLoading(true)
    const firstDay = `${month}-01`
    const lastDay  = dayjs(firstDay).endOf('month').format('YYYY-MM-DD')

    const { data } = await supabase
      .from('rh_presences')
      .select('id, employe_id, date, statut')
      .eq('societe_id', societeId)
      .gte('date', firstDay)
      .lte('date', lastDay)

    setMonthPresences(data ?? [])
    setRecapLoading(false)
  }

  // ── Congés ────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage && activeTab === 'conges') fetchConges()
  }, [activeTab, loading])

  async function fetchConges() {
    setCongesLoading(true)

    const { data } = await supabase
      .from('rh_conges')
      .select('*, rh_employes!employe_id(nom, prenom, matricule)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    const all = (data ?? []) as Conge[]
    setPending(all.filter(c => c.statut === 'en_attente'))
    setHistory(all.filter(c => c.statut !== 'en_attente'))
    setCongesLoading(false)
  }

  async function handleApprove(id: string) {
    const { error } = await supabase
      .from('rh_conges')
      .update({
        statut:          'approuve',
        approuve_par:    currentUserId,
        approuve_le:     new Date().toISOString(),
        commentaire_rh:  comment || null,
      })
      .eq('id', id)

    if (error) { toast.error(t('toast_approve_error')); return }
    toast.success(t('toast_approve_success'))
    setActionId(null)
    setComment('')
    await fetchConges()
  }

  async function handleRefuse(id: string) {
    const { error } = await supabase
      .from('rh_conges')
      .update({
        statut:         'refuse',
        approuve_par:   currentUserId,
        approuve_le:    new Date().toISOString(),
        commentaire_rh: comment || null,
      })
      .eq('id', id)

    if (error) { toast.error(t('toast_refuse_error')); return }
    toast.success(t('toast_refuse_success'))
    setActionId(null)
    setComment('')
    await fetchConges()
  }

  // ── Helpers récapitulatif ─────────────────────────────────────

  function getMonthDays(month: string): number[] {
    const total = dayjs(`${month}-01`).daysInMonth()
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  function getStatutForDay(employeId: string, day: number): string | null {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    return monthPresences.find(p => p.employe_id === employeId && p.date === dateStr)?.statut ?? null
  }

  function countStatutForEmployee(employeId: string, statut: string): number {
    return monthPresences.filter(p => p.employe_id === employeId && p.statut === statut).length
  }

  // ── Guards ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!canAccessPage) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-500">
        <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800">{t('acces_refuse_title')}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">{t('acces_refuse_desc')}</p>
        </div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: typeof Clock }[] = [
    { id: 'pointage', label: t('tab_pointage'), icon: Clock        },
    { id: 'recap',    label: t('tab_recap'),    icon: BarChart3    },
    { id: 'conges',   label: t('tab_conges'),   icon: Calendar     },
  ]

  const monthDays = getMonthDays(selectedMonth)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('presences_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('presences_subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex gap-0">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">

          {/* ── Tab Pointage ──────────────────────────────────── */}
          {activeTab === 'pointage' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                    {t('pointage_date_label')}
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {canManage && (
                  <button
                    onClick={handleSavePointage}
                    disabled={saving || employees.length === 0}
                    className="mt-5 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {t('pointage_save')}
                  </button>
                )}
              </div>

              {!canManage && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  {t('pointage_readonly')}
                </p>
              )}

              {employees.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">{t('pointage_empty')}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">{t('col_employe')}</th>
                        <th className="text-left px-4 py-3 font-medium">{t('col_poste')}</th>
                        <th className="text-left px-4 py-3 font-medium">{t('col_statut')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map(emp => {
                        const statut = presenceMap[emp.id]
                        const style  = statut ? STATUT_STYLES[statut] : null
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{emp.prenom} {emp.nom}</div>
                              <div className="text-xs text-slate-400">{emp.matricule}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{emp.poste ?? '—'}</td>
                            <td className="px-4 py-3">
                              {canManage ? (
                                <select
                                  value={statut ?? ''}
                                  onChange={e => setPresenceMap(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                  className={`border rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    style ? `${style.bg} ${style.text} border-transparent` : 'border-slate-300 text-slate-500'
                                  }`}
                                >
                                  <option value="">{t('pointage_not_set')}</option>
                                  {STATUTS.map(s => (
                                    <option key={s} value={s}>{t(STATUT_STYLES[s].label_key as any)}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  style ? `${style.bg} ${style.text}` : 'bg-slate-100 text-slate-400'
                                }`}>
                                  {style ? t(STATUT_STYLES[statut].label_key as any) : t('pointage_not_set')}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Récapitulatif ─────────────────────────────── */}
          {activeTab === 'recap' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  {t('recap_month_label')}
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {recapLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : employees.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">{t('recap_empty')}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="text-xs min-w-max w-full">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-50 min-w-[160px]">
                          {t('col_employe_p')}
                        </th>
                        {monthDays.map(d => (
                          <th key={d} className="px-1.5 py-3 font-medium text-center w-8">
                            {d}
                          </th>
                        ))}
                        <th className="px-3 py-3 font-medium text-center text-emerald-600">P</th>
                        <th className="px-3 py-3 font-medium text-center text-red-500">A</th>
                        <th className="px-3 py-3 font-medium text-center text-amber-600">C</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 sticky left-0 bg-white font-medium text-slate-800 min-w-[160px]">
                            {emp.prenom} {emp.nom}
                            <div className="text-slate-400 font-normal">{emp.matricule}</div>
                          </td>
                          {monthDays.map(d => {
                            const statut = getStatutForDay(emp.id, d)
                            const style  = statut ? STATUT_STYLES[statut] : null
                            return (
                              <td key={d} className="px-1 py-2 text-center">
                                {style ? (
                                  <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                    {STATUT_LETTER[statut!]}
                                  </span>
                                ) : (
                                  <span className="text-slate-200">·</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-center font-semibold text-emerald-600">
                            {countStatutForEmployee(emp.id, 'present')}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-red-500">
                            {countStatutForEmployee(emp.id, 'absent')}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-amber-600">
                            {countStatutForEmployee(emp.id, 'conge')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Congés ────────────────────────────────────── */}
          {activeTab === 'conges' && (
            <div className="space-y-6">
              {congesLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : (
                <>
                  {/* Demandes en attente */}
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3">{t('conges_pending_title')}</h3>
                    {pending.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        {t('conges_empty_pending')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {pending.map(conge => (
                          <div key={conge.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-amber-50/30">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {conge.rh_employes?.prenom} {conge.rh_employes?.nom}
                                  <span className="ml-2 text-xs text-slate-400 font-normal">{conge.rh_employes?.matricule}</span>
                                </p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                  {TYPE_CONGE_KEYS[conge.type_conge] ? t(TYPE_CONGE_KEYS[conge.type_conge] as any) : conge.type_conge}
                                  {' · '}
                                  {dayjs(conge.date_debut).format('DD/MM/YY')} → {dayjs(conge.date_fin).format('DD/MM/YY')}
                                  {' · '}
                                  <strong>{conge.nb_jours} j.</strong>
                                </p>
                                {conge.motif && (
                                  <p className="text-xs text-slate-400 mt-1 italic">"{conge.motif}"</p>
                                )}
                              </div>
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full whitespace-nowrap">
                                {t('conge_en_attente')}
                              </span>
                            </div>

                            {canManage && (
                              actionId === conge.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder={t('conges_comment_placeholder')}
                                    rows={2}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApprove(conge.id)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      {t('conges_approve')}
                                    </button>
                                    <button
                                      onClick={() => handleRefuse(conge.id)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      {t('conges_refuse')}
                                    </button>
                                    <button
                                      onClick={() => { setActionId(null); setComment('') }}
                                      className="px-4 py-2 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                      {t('btn_cancel')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActionId(conge.id)}
                                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                  {t('conges_approve')} / {t('conges_refuse')}
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Historique */}
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-3">{t('conges_history_title')}</h3>
                    {history.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        {t('conges_empty_history')}
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium">{t('col_employe_p')}</th>
                              <th className="text-left px-4 py-3 font-medium">{t('col_type')}</th>
                              <th className="text-left px-4 py-3 font-medium">{t('col_debut')}</th>
                              <th className="text-left px-4 py-3 font-medium">{t('col_fin')}</th>
                              <th className="text-left px-4 py-3 font-medium">{t('col_duree')}</th>
                              <th className="text-left px-4 py-3 font-medium">{t('col_statut')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {history.map(conge => {
                              const isApproved = conge.statut === 'approuve'
                              return (
                                <tr key={conge.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-800">
                                    {conge.rh_employes?.prenom} {conge.rh_employes?.nom}
                                    <div className="text-xs text-slate-400 font-normal">{conge.rh_employes?.matricule}</div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {TYPE_CONGE_KEYS[conge.type_conge] ? t(TYPE_CONGE_KEYS[conge.type_conge] as any) : conge.type_conge}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">{dayjs(conge.date_debut).format('DD/MM/YY')}</td>
                                  <td className="px-4 py-3 text-slate-500">{dayjs(conge.date_fin).format('DD/MM/YY')}</td>
                                  <td className="px-4 py-3 text-slate-500">{conge.nb_jours} j.</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                      isApproved
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-600'
                                    }`}>
                                      {isApproved ? t('conge_approuve') : t('conge_refuse')}
                                    </span>
                                    {conge.commentaire_rh && (
                                      <p className="text-xs text-slate-400 mt-1 italic">"{conge.commentaire_rh}"</p>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
