'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { uploadFile, uniqueFilename } from '@/lib/storage'
import {
  Loader2, ShieldOff, Clock, BarChart3, Calendar,
  CheckCircle2, XCircle, LogIn, LogOut, Plus, X,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

// ── Types ──────────────────────────────────────────────────────

type Employe = {
  id: string
  nom: string
  prenom: string
  matricule: string
  poste: string | null
  user_id: string | null
}

type Presence = {
  id: string
  employe_id: string
  date: string
  statut: string | null
  heure_entree: string | null
  heure_sortie: string | null
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

type CongeForm = {
  type_conge: string
  typologie:  'daily' | 'hourly'
  date_debut: string
  date_fin:   string
  nb_heures:  string
  motif:      string
}

const CONGE_ALLOWED_FORMATS = [
  'image/jpeg', 'image/png', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const CONGE_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

type TabId = 'pointage' | 'recap' | 'conges'

// ── Constantes ────────────────────────────────────────────────

const STATUT_STYLES: Record<string, { bg: string; text: string }> = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  absent:  { bg: 'bg-red-100',     text: 'text-red-600'     },
  retard:  { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  conge:   { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  mission: { bg: 'bg-blue-100',    text: 'text-blue-700'    },
}

const STATUT_LETTER: Record<string, string> = {
  present: 'P', absent: 'A', retard: 'R', conge: 'C', mission: 'M',
}

const OVERRIDE_STATUTS = ['present', 'absent', 'retard', 'conge', 'mission']

const TYPE_CONGE_OPTIONS = [
  'annuel', 'maladie', 'maternite', 'paternite', 'sans_solde', 'exceptionnel',
]

const TYPE_CONGE_KEYS: Record<string, string> = {
  annuel:       'type_annuel',
  maladie:      'type_maladie',
  maternite:    'type_maternite',
  paternite:    'type_paternite',
  sans_solde:   'type_sans_solde',
  exceptionnel: 'type_exceptionnel',
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(ts: string | null, tz: string): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

function getDisplayStatut(presence: Presence | null): 'absent' | 'en_cours' | 'present' | string {
  if (!presence?.heure_entree) return 'absent'
  if (presence.statut) return presence.statut   // override gestionnaire
  if (presence.heure_entree && presence.heure_sortie) return 'present'
  return 'en_cours'
}

function calcNbJours(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  const d = dayjs(debut)
  const f = dayjs(fin)
  return Math.max(0, f.diff(d, 'day') + 1)
}

// ── Page ─────────────────────────────────────────────────────

export default function PresencesPage() {
  const t         = useTranslations('rh')
  const params    = useParams()
  const societeId = params.societe_id as string

  // ── Auth / permissions ─────────────────────────────────────
  const [loading, setLoading]             = useState(true)
  const [canAccessPage, setCanAccessPage] = useState(false)
  const [canManage, setCanManage]         = useState(false)   // gestionnaire+
  const [fullTenantId, setFullTenantId]   = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [myEmployeId, setMyEmployeId]     = useState<string | null>(null)
  const [timezone, setTimezone]           = useState('Africa/Douala')

  // ── Tabs ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('pointage')

  // ── Pointage ─────────────────────────────────────────────
  const [employees, setEmployees]       = useState<Employe[]>([])
  const [todayPresences, setTodayPresences] = useState<Record<string, Presence>>({})
  const [savingEntry, setSavingEntry]   = useState(false)
  const [savingExit, setSavingExit]     = useState(false)
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))


  // ── Récapitulatif ────────────────────────────────────────
  const [selectedMonth, setSelectedMonth]   = useState(dayjs().format('YYYY-MM'))
  const [monthPresences, setMonthPresences] = useState<Presence[]>([])
  const [recapLoading, setRecapLoading]     = useState(false)

  // ── Congés ───────────────────────────────────────────────
  const [myConges, setMyConges]         = useState<Conge[]>([])
  const [pendingConges, setPendingConges] = useState<Conge[]>([])
  const [historyConges, setHistoryConges] = useState<Conge[]>([])
  const [congesLoading, setCongesLoading] = useState(false)
  const [congeModal, setCongeModal]     = useState(false)
  const [congeForm, setCongeForm]       = useState<CongeForm>({ type_conge: 'annuel', typologie: 'daily', date_debut: '', date_fin: '', nb_heures: '', motif: '' })
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null)
  const [savingConge, setSavingConge]   = useState(false)
  const [actionId, setActionId]         = useState<string | null>(null)
  const [comment, setComment]           = useState('')

  // ── Init ─────────────────────────────────────────────────

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
      const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'rh')
      setCanAccessPage(perm !== 'aucun')
      setCanManage(perm === 'gestionnaire' || perm === 'admin')
    }

    // Fuseau horaire du tenant
    const { data: tsData } = await supabase
      .from('tenants')
      .select('timezone')
      .eq('id', profile.tenant_id)
      .maybeSingle()
    if (tsData?.timezone) setTimezone(tsData.timezone)

    // Fiche employé liée à ce user (pour self-pointage)
    const { data: ficheData } = await supabase
      .from('rh_employes')
      .select('id')
      .eq('societe_id', societeId)
      .eq('user_id', session.user.id)
      .maybeSingle()
    setMyEmployeId(ficheData?.id ?? null)

    await fetchEmployees()
    setLoading(false)
  }

  // ── Employees ────────────────────────────────────────────

  async function fetchEmployees() {
    const { data } = await supabase
      .from('rh_employes')
      .select('id, nom, prenom, matricule, poste, user_id')
      .eq('societe_id', societeId)
      .eq('statut', 'actif')
      .order('nom')
    setEmployees(data ?? [])
  }

  // ── Pointage ─────────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage) fetchPresencesForDate(selectedDate)
  }, [selectedDate, loading])

  async function fetchPresencesForDate(date: string) {
    const { data } = await supabase
      .from('rh_presences')
      .select('id, employe_id, date, statut, heure_entree, heure_sortie')
      .eq('societe_id', societeId)
      .eq('date', date)

    const map: Record<string, Presence> = {}
    data?.forEach((p: Presence) => { map[p.employe_id] = p })
    setTodayPresences(map)
  }

  // Enregistrer l'entrée (self-service)
  async function handleEntree() {
    if (!myEmployeId) return
    setSavingEntry(true)
    const now = new Date().toISOString()
    const today = dayjs().format('YYYY-MM-DD')

    const { error } = await supabase
      .from('rh_presences')
      .upsert({
        tenant_id:   fullTenantId,
        societe_id:  societeId,
        employe_id:  myEmployeId,
        date:        today,
        heure_entree: now,
        created_by:  currentUserId,
      }, { onConflict: 'employe_id,date' })

    if (error) toast.error(t('toast_pointage_error'))
    else { toast.success(`${t('pointage_entree_ok')} ${formatTime(now, timezone)}`); await fetchPresencesForDate(today) }
    setSavingEntry(false)
  }

  // Enregistrer la sortie (self-service)
  async function handleSortie() {
    if (!myEmployeId) return
    setSavingExit(true)
    const now = new Date().toISOString()
    const today = dayjs().format('YYYY-MM-DD')
    const existing = todayPresences[myEmployeId]

    if (!existing) { setSavingExit(false); return }

    const { error } = await supabase
      .from('rh_presences')
      .update({ heure_sortie: now, statut: 'present' })
      .eq('id', existing.id)

    if (error) toast.error(t('toast_pointage_error'))
    else { toast.success(`${t('pointage_sortie_ok')} ${formatTime(now, timezone)}`); await fetchPresencesForDate(today) }
    setSavingExit(false)
  }

  // Gestionnaire — override statut d'un employé
  async function handleOverrideStatut(employeId: string, newStatut: string) {
    const existing = todayPresences[employeId]
    if (existing) {
      await supabase.from('rh_presences').update({ statut: newStatut }).eq('id', existing.id)
    } else {
      await supabase.from('rh_presences').upsert({
        tenant_id: fullTenantId, societe_id: societeId,
        employe_id: employeId, date: selectedDate, statut: newStatut, created_by: currentUserId,
      }, { onConflict: 'employe_id,date' })
    }
    await fetchPresencesForDate(selectedDate)
  }

  // ── Récapitulatif ────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage) fetchMonthPresences(selectedMonth)
  }, [selectedMonth, loading])

  async function fetchMonthPresences(month: string) {
    setRecapLoading(true)
    const first = `${month}-01`
    const last  = dayjs(first).endOf('month').format('YYYY-MM-DD')
    const { data } = await supabase
      .from('rh_presences')
      .select('id, employe_id, date, statut, heure_entree, heure_sortie')
      .eq('societe_id', societeId)
      .gte('date', first)
      .lte('date', last)
    setMonthPresences(data ?? [])
    setRecapLoading(false)
  }

  function getMonthDays(month: string): number[] {
    return Array.from({ length: dayjs(`${month}-01`).daysInMonth() }, (_, i) => i + 1)
  }

  function getStatutForDay(employeId: string, day: number): string | null {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    const p = monthPresences.find(p => p.employe_id === employeId && p.date === dateStr)
    return p ? getDisplayStatut(p) : null
  }

  function countStatut(employeId: string, statut: string): number {
    return monthPresences.filter(p => p.employe_id === employeId && getDisplayStatut(p) === statut).length
  }

  // ── Congés ───────────────────────────────────────────────

  useEffect(() => {
    if (!loading && canAccessPage && activeTab === 'conges') fetchConges()
  }, [activeTab, loading])

  async function fetchConges() {
    setCongesLoading(true)
    const { data, error } = await supabase
      .from('rh_conges')
      .select('*, rh_employes!employe_id(nom, prenom, matricule)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    if (error) console.error('[fetchConges]', error.message)
    const all = (data ?? []) as Conge[]
    const mine = myEmployeId ? all.filter(c => c.employe_id === myEmployeId) : []
    setMyConges(mine)
    setPendingConges(all.filter(c => c.statut === 'en_attente'))
    setHistoryConges(all.filter(c => c.statut !== 'en_attente'))
    setCongesLoading(false)
  }

  async function handleSubmitConge() {
    if (!myEmployeId || !congeForm.date_debut) return
    if (congeForm.typologie === 'daily' && !congeForm.date_fin) return
    if (congeForm.typologie === 'hourly' && !congeForm.nb_heures) return

    if (justificatifFile) {
      if (!CONGE_ALLOWED_FORMATS.includes(justificatifFile.type)) {
        toast.error(t('conge_justificatif_format_error')); return
      }
      if (justificatifFile.size > CONGE_MAX_FILE_SIZE) {
        toast.error(t('conge_justificatif_size_error')); return
      }
    }

    setSavingConge(true)

    const payload: Record<string, unknown> = {
      tenant_id:   fullTenantId,
      societe_id:  societeId,
      employe_id:  myEmployeId,
      type_conge:  congeForm.type_conge,
      typologie:   congeForm.typologie,
      date_debut:  congeForm.date_debut,
      motif:       congeForm.motif || null,
      statut:      'en_attente',
      created_by:  currentUserId,
    }
    if (congeForm.typologie === 'daily') {
      payload.date_fin = congeForm.date_fin
      payload.nb_jours = calcNbJours(congeForm.date_debut, congeForm.date_fin)
    } else {
      payload.nb_heures = parseFloat(congeForm.nb_heures)
    }

    const { data: inserted, error } = await supabase
      .from('rh_conges')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      toast.error(t('toast_conge_submit_error'))
      setSavingConge(false)
      return
    }

    if (justificatifFile && inserted) {
      const filename = uniqueFilename(justificatifFile.name)
      const path = `${fullTenantId}/societes/${societeId}/rh/conges/${inserted.id}/justificatif_${filename}`
      const { error: uploadError } = await uploadFile(path, justificatifFile, { contentType: justificatifFile.type })
      if (uploadError) toast.error(t('conge_justificatif_upload_error'))
      else await supabase.from('rh_conges').update({ justificatif_path: path }).eq('id', inserted.id)
    }

    toast.success(t('toast_conge_submit_success'))
    setCongeModal(false)
    setCongeForm({ type_conge: 'annuel', typologie: 'daily', date_debut: '', date_fin: '', nb_heures: '', motif: '' })
    setJustificatifFile(null)
    await fetchConges()
    setSavingConge(false)
  }

  async function handleApprove(id: string) {
    const { error } = await supabase.from('rh_conges').update({
      statut: 'approuve', approuve_par: currentUserId,
      approuve_le: new Date().toISOString(), commentaire_rh: comment || null,
    }).eq('id', id)
    if (error) { toast.error(t('toast_approve_error')); return }
    toast.success(t('toast_approve_success'))
    setActionId(null); setComment('')
    await fetchConges()
  }

  async function handleRefuse(id: string) {
    const { error } = await supabase.from('rh_conges').update({
      statut: 'refuse', approuve_par: currentUserId,
      approuve_le: new Date().toISOString(), commentaire_rh: comment || null,
    }).eq('id', id)
    if (error) { toast.error(t('toast_refuse_error')); return }
    toast.success(t('toast_refuse_success'))
    setActionId(null); setComment('')
    await fetchConges()
  }

  // ── Guards ───────────────────────────────────────────────

  if (loading) {
    return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
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

  // Présence du jour pour l'utilisateur connecté
  const myPresence   = myEmployeId ? (todayPresences[myEmployeId] ?? null) : null
  const hasEntree    = !!myPresence?.heure_entree
  const hasSortie    = !!myPresence?.heure_sortie
  const today        = dayjs().format('YYYY-MM-DD')
  const isToday      = selectedDate === today
  const monthDays    = getMonthDays(selectedMonth)

  const nowLabel = new Date().toLocaleString('fr-FR', {
    timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const tabs: { id: TabId; label: string; icon: typeof Clock }[] = [
    { id: 'pointage', label: t('tab_pointage'), icon: Clock     },
    { id: 'recap',    label: t('tab_recap'),    icon: BarChart3 },
    { id: 'conges',   label: t('tab_conges'),   icon: Calendar  },
  ]

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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />{tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">

          {/* ══════════════════════════════════════════════
              TAB POINTAGE
          ══════════════════════════════════════════════ */}
          {activeTab === 'pointage' && (
            <div className="space-y-6">

              {/* ── Vue contributeur (self-pointage) ────────── */}
              {!canManage && (
                <div className="space-y-4">
                  {/* Horloge tenant */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{timezone}</p>
                    <p className="text-lg font-bold text-slate-700 capitalize">{nowLabel}</p>
                  </div>

                  {/* Pas de fiche employé */}
                  {!myEmployeId && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
                      {t('pointage_no_fiche')}
                    </div>
                  )}

                  {/* Carte self-pointage */}
                  {myEmployeId && (
                    <div className="rounded-2xl border border-slate-200 p-6 space-y-5">
                      <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                        {t('tab_pointage')} — {dayjs().format('DD/MM/YYYY')}
                      </p>

                      <div className="flex gap-4 flex-wrap">
                        {/* Bouton Entrée */}
                        <div className="flex-1 min-w-[160px]">
                          <button
                            onClick={handleEntree}
                            disabled={savingEntry || hasEntree}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${
                              hasEntree
                                ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                            } disabled:opacity-70`}
                          >
                            {savingEntry ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                            {hasEntree
                              ? `${t('pointage_entree')} — ${formatTime(myPresence!.heure_entree, timezone)}`
                              : t('pointage_entree')
                            }
                          </button>
                        </div>

                        {/* Bouton Sortie */}
                        <div className="flex-1 min-w-[160px]">
                          <button
                            onClick={handleSortie}
                            disabled={savingExit || !hasEntree || hasSortie}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${
                              hasSortie
                                ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                                : hasEntree
                                  ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-md'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            } disabled:opacity-70`}
                          >
                            {savingExit ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                            {hasSortie
                              ? `${t('pointage_sortie')} — ${formatTime(myPresence!.heure_sortie, timezone)}`
                              : t('pointage_sortie')
                            }
                          </button>
                        </div>
                      </div>

                      {/* Statut du jour */}
                      {myPresence && (
                        <div className="flex items-center gap-2 pt-1">
                          {hasSortie ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {t('pointage_complet')}
                            </span>
                          ) : hasEntree ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full">
                              <Clock className="h-3.5 w-3.5" /> {t('pointage_en_cours')}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Self-pointage pour gestionnaire/admin (aussi employé) ── */}
              {canManage && myEmployeId && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">
                    {t('tab_pointage')} — {t('pointage_mon_pointage')} — {dayjs().format('DD/MM/YYYY')}
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <button
                        onClick={handleEntree}
                        disabled={savingEntry || hasEntree}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm transition-all ${
                          hasEntree
                            ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                        } disabled:opacity-70`}
                      >
                        {savingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {hasEntree
                          ? `${t('pointage_entree')} — ${formatTime(myPresence!.heure_entree, timezone)}`
                          : t('pointage_entree')
                        }
                      </button>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <button
                        onClick={handleSortie}
                        disabled={savingExit || !hasEntree || hasSortie}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm transition-all ${
                          hasSortie
                            ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                            : hasEntree
                              ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-md'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        } disabled:opacity-70`}
                      >
                        {savingExit ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        {hasSortie
                          ? `${t('pointage_sortie')} — ${formatTime(myPresence!.heure_sortie, timezone)}`
                          : t('pointage_sortie')
                        }
                      </button>
                    </div>
                  </div>
                  {myPresence && (
                    <div className="flex items-center gap-2">
                      {hasSortie ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('pointage_complet')}
                        </span>
                      ) : hasEntree ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full">
                          <Clock className="h-3.5 w-3.5" /> {t('pointage_en_cours')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* ── Vue gestionnaire (tous les employés) ─────── */}
              {canManage && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap justify-between">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                        {t('pointage_date_label')}
                      </label>
                      <input type="date" value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {isToday && (
                      <p className="text-xs text-slate-400 italic">{nowLabel}</p>
                    )}
                  </div>

                  {employees.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-12">{t('pointage_empty')}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium">{t('col_employe')}</th>
                            <th className="text-left px-4 py-3 font-medium">{t('pointage_entree')}</th>
                            <th className="text-left px-4 py-3 font-medium">{t('pointage_sortie')}</th>
                            <th className="text-left px-4 py-3 font-medium">{t('col_statut')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employees.map(emp => {
                            const presence = todayPresences[emp.id] ?? null
                            const statut   = getDisplayStatut(presence)
                            const style    = statut === 'en_cours'
                              ? { bg: 'bg-blue-100', text: 'text-blue-700' }
                              : (STATUT_STYLES[statut] ?? { bg: 'bg-slate-100', text: 'text-slate-400' })

                            return (
                              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-800">{emp.prenom} {emp.nom}</div>
                                  <div className="text-xs text-slate-400">{emp.matricule}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                  {formatTime(presence?.heure_entree ?? null, timezone)}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                  {formatTime(presence?.heure_sortie ?? null, timezone)}
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={presence?.statut ?? ''}
                                    onChange={e => handleOverrideStatut(emp.id, e.target.value)}
                                    className={`border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                      statut !== 'en_cours' && STATUT_STYLES[statut]
                                        ? `${style.bg} ${style.text} border-transparent`
                                        : 'border-slate-300 text-slate-500'
                                    }`}
                                  >
                                    <option value="">{statut === 'en_cours' ? t('pointage_en_cours') : statut === 'absent' ? t('statut_absent') : t('pointage_not_set')}</option>
                                    {OVERRIDE_STATUTS.map(s => (
                                      <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                                    ))}
                                  </select>
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
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TAB RÉCAPITULATIF
          ══════════════════════════════════════════════ */}
          {activeTab === 'recap' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                  {t('recap_month_label')}
                </label>
                <input type="month" value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {recapLoading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <>
                  {/* ── Mes récapitulatifs (tous rôles) ── */}
                  {myEmployeId && (() => {
                    const myEmp = employees.find(e => e.id === myEmployeId)
                    if (!myEmp) return null
                    return (
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3">{t('recap_mes_title')}</h3>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="text-xs min-w-max w-full">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                              <tr>
                                <th className="text-left px-4 py-3 font-medium min-w-[140px] sticky left-0 bg-slate-50">{t('col_employe_p')}</th>
                                {monthDays.map(d => <th key={d} className="px-1 py-3 font-medium text-center w-7">{d}</th>)}
                                <th className="px-2 py-3 font-medium text-center text-emerald-600">P</th>
                                <th className="px-2 py-3 font-medium text-center text-red-500">A</th>
                                <th className="px-2 py-3 font-medium text-center text-amber-600">C</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="hover:bg-slate-50">
                                <td className="px-4 py-2 sticky left-0 bg-white font-medium text-slate-800 min-w-[140px]">
                                  {myEmp.prenom} {myEmp.nom}
                                </td>
                                {monthDays.map(d => {
                                  const s = getStatutForDay(myEmp.id, d)
                                  const st = s === 'en_cours' ? null : s
                                  const style = st ? STATUT_STYLES[st] : null
                                  return (
                                    <td key={d} className="px-0.5 py-2 text-center">
                                      {style ? (
                                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                          {STATUT_LETTER[st!]}
                                        </span>
                                      ) : <span className="text-slate-200">·</span>}
                                    </td>
                                  )
                                })}
                                <td className="px-2 py-2 text-center font-semibold text-emerald-600">{countStatut(myEmp.id, 'present')}</td>
                                <td className="px-2 py-2 text-center font-semibold text-red-500">{countStatut(myEmp.id, 'absent')}</td>
                                <td className="px-2 py-2 text-center font-semibold text-amber-600">{countStatut(myEmp.id, 'conge')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Récapitulatif global (gestionnaire+) ── */}
                  {canManage && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">{t('recap_global_title')}</h3>
                      {employees.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">{t('recap_empty')}</p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="text-xs min-w-max w-full">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                              <tr>
                                <th className="text-left px-4 py-3 font-medium min-w-[160px] sticky left-0 bg-slate-50">{t('col_employe_p')}</th>
                                {monthDays.map(d => <th key={d} className="px-1 py-3 font-medium text-center w-7">{d}</th>)}
                                <th className="px-2 py-3 font-medium text-center text-emerald-600">P</th>
                                <th className="px-2 py-3 font-medium text-center text-red-500">A</th>
                                <th className="px-2 py-3 font-medium text-center text-amber-600">C</th>
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
                                    const s = getStatutForDay(emp.id, d)
                                    const st = s === 'en_cours' ? null : s
                                    const style = st ? STATUT_STYLES[st] : null
                                    return (
                                      <td key={d} className="px-0.5 py-2 text-center">
                                        {style ? (
                                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                            {STATUT_LETTER[st!]}
                                          </span>
                                        ) : <span className="text-slate-200">·</span>}
                                      </td>
                                    )
                                  })}
                                  <td className="px-2 py-2 text-center font-semibold text-emerald-600">{countStatut(emp.id, 'present')}</td>
                                  <td className="px-2 py-2 text-center font-semibold text-red-500">{countStatut(emp.id, 'absent')}</td>
                                  <td className="px-2 py-2 text-center font-semibold text-amber-600">{countStatut(emp.id, 'conge')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TAB CONGÉS
          ══════════════════════════════════════════════ */}
          {activeTab === 'conges' && (
            <div className="space-y-6">

              {/* Bouton demande */}
              {myEmployeId && (
                <div className="flex justify-end">
                  <button onClick={() => setCongeModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> {t('conge_new_btn')}
                  </button>
                </div>
              )}

              {congesLoading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <>
                  {/* ── Mes congés ── */}
                  {myEmployeId && (
                    <CongeTable title={t('conges_mes_title')} conges={myConges} t={t} showAll={false} />
                  )}

                  {/* ── Demandes en attente (gestionnaire+) ── */}
                  {canManage && (
                    <div>
                      <h3 className="text-base font-bold text-slate-800 mb-3">{t('conges_pending_title')}</h3>
                      {pendingConges.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                          {t('conges_empty_pending')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {pendingConges.map(conge => (
                            <div key={conge.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-amber-50/30">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {conge.rh_employes?.prenom} {conge.rh_employes?.nom}
                                    <span className="ml-2 text-xs text-slate-400 font-normal">{conge.rh_employes?.matricule}</span>
                                  </p>
                                  <p className="text-sm text-slate-500 mt-0.5">
                                    {t(TYPE_CONGE_KEYS[conge.type_conge] as any)} · {dayjs(conge.date_debut).format('DD/MM/YY')} → {dayjs(conge.date_fin).format('DD/MM/YY')} · <strong>{conge.nb_jours} j.</strong>
                                  </p>
                                  {conge.motif && <p className="text-xs text-slate-400 mt-1 italic">"{conge.motif}"</p>}
                                </div>
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{t('conge_en_attente')}</span>
                              </div>

                              {actionId === conge.id ? (
                                <div className="space-y-2">
                                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder={t('conges_comment_placeholder')} rows={2}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => handleApprove(conge.id)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                                      <CheckCircle2 className="h-4 w-4" /> {t('conges_approve')}
                                    </button>
                                    <button onClick={() => handleRefuse(conge.id)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                                      <XCircle className="h-4 w-4" /> {t('conges_refuse')}
                                    </button>
                                    <button onClick={() => { setActionId(null); setComment('') }}
                                      className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors">
                                      {t('btn_cancel')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setActionId(conge.id)}
                                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                                  {t('conges_approve')} / {t('conges_refuse')} →
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Historique ── */}
                  <CongeTable title={t('conges_history_title')} conges={canManage ? historyConges : myConges.filter(c => c.statut !== 'en_attente')} t={t} showAll={canManage} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal demande congé ──────────────────────────────── */}
      {congeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{t('conge_modal_title')}</h2>
              <button onClick={() => setCongeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_type')}</label>
                <select value={congeForm.type_conge} onChange={e => setCongeForm(p => ({ ...p, type_conge: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                  {TYPE_CONGE_OPTIONS.map(k => <option key={k} value={k}>{t(TYPE_CONGE_KEYS[k] as any)}</option>)}
                </select>
              </div>

              {/* Modalité */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_typologie')}</label>
                <div className="flex gap-2">
                  {(['daily', 'hourly'] as const).map(typ => (
                    <label key={typ} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-sm font-bold transition-colors ${
                      congeForm.typologie === typ
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                      <input type="radio" name="typologie_pres" value={typ}
                        checked={congeForm.typologie === typ}
                        onChange={() => setCongeForm(p => ({ ...p, typologie: typ, date_fin: '', nb_heures: '' }))}
                        className="sr-only"
                      />
                      {t(`conge_typologie_${typ}` as any)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_debut')}</label>
                  <input type="date" value={congeForm.date_debut} onChange={e => setCongeForm(p => ({ ...p, date_debut: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
                {congeForm.typologie === 'daily' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_fin')}</label>
                    <input type="date" value={congeForm.date_fin} onChange={e => setCongeForm(p => ({ ...p, date_fin: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_nb_heures')}</label>
                    <input type="number" min="0.5" max="24" step="0.5" value={congeForm.nb_heures}
                      onChange={e => setCongeForm(p => ({ ...p, nb_heures: e.target.value }))}
                      placeholder="ex: 4"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                )}
              </div>

              {/* Durée calculée (daily) */}
              {congeForm.typologie === 'daily' && congeForm.date_debut && congeForm.date_fin && (
                <p className="text-xs text-indigo-600 font-medium">
                  {t('conge_field_nb_jours')} : <strong>{calcNbJours(congeForm.date_debut, congeForm.date_fin)}</strong>
                </p>
              )}

              {/* Motif */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_motif')}</label>
                <textarea value={congeForm.motif} onChange={e => setCongeForm(p => ({ ...p, motif: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </div>

              {/* Justificatif */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('conge_field_justificatif')}</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  onChange={e => setJustificatifFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t('conge_justificatif_hint')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCongeModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleSubmitConge}
                disabled={savingConge || !congeForm.date_debut || (congeForm.typologie === 'daily' ? !congeForm.date_fin : !congeForm.nb_heures)}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {savingConge ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('conge_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sous-composant tableau congés ─────────────────────────────

function CongeTable({ title, conges, t, showAll }: {
  title: string
  conges: Conge[]
  t: (key: any) => string
  showAll: boolean
}) {
  const TYPE_CONGE_KEYS: Record<string, string> = {
    annuel: 'type_annuel', maladie: 'type_maladie', maternite: 'type_maternite',
    paternite: 'type_paternite', sans_solde: 'type_sans_solde', exceptionnel: 'type_exceptionnel',
  }
  return (
    <div>
      <h3 className="text-base font-bold text-slate-800 mb-3">{title}</h3>
      {conges.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
          {t('conges_empty_history')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                {showAll && <th className="text-left px-4 py-3 font-medium">{t('col_employe_p')}</th>}
                <th className="text-left px-4 py-3 font-medium">{t('col_type')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('col_debut')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('col_fin')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('col_duree')}</th>
                <th className="text-left px-4 py-3 font-medium">{t('col_statut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conges.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  {showAll && (
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {c.rh_employes?.prenom} {c.rh_employes?.nom}
                      <div className="text-xs text-slate-400 font-normal">{c.rh_employes?.matricule}</div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{t((TYPE_CONGE_KEYS[c.type_conge] ?? c.type_conge) as any)}</td>
                  <td className="px-4 py-3 text-slate-500">{dayjs(c.date_debut).format('DD/MM/YY')}</td>
                  <td className="px-4 py-3 text-slate-500">{dayjs(c.date_fin).format('DD/MM/YY')}</td>
                  <td className="px-4 py-3 text-slate-500">{c.nb_jours} j.</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      c.statut === 'approuve' ? 'bg-emerald-100 text-emerald-700'
                      : c.statut === 'refuse'  ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.statut === 'approuve' ? t('conge_approuve') : c.statut === 'refuse' ? t('conge_refuse') : t('conge_en_attente')}
                    </span>
                    {c.commentaire_rh && <p className="text-xs text-slate-400 mt-1 italic">"{c.commentaire_rh}"</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
