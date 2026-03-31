'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { uploadFile, uniqueFilename } from '@/lib/storage'
import {
  ArrowLeft, Loader2, LogIn, LogOut, CheckCircle2,
  Clock, Search, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

// ── Types ──────────────────────────────────────────────────

type Employe = {
  id: string
  nom: string
  prenom: string
  email: string | null
  poste: string | null
  matricule: string
}

type Presence = {
  id: string
  heure_entree: string | null
  heure_sortie: string | null
  statut: string | null
}

type Conge = {
  id: string
  type_conge: string
  typologie: 'daily' | 'hourly'
  date_debut: string
  date_fin: string | null
  nb_jours: number | null
  nb_heures: number | null
  statut: string
  motif: string | null
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

// ── Constantes ─────────────────────────────────────────────

const TYPE_CONGE_OPTIONS = ['annuel', 'maladie', 'maternite', 'paternite', 'sans_solde', 'exceptionnel']

const CONGE_STATUT_STYLES: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  approuve:   'bg-emerald-100 text-emerald-700',
  refuse:     'bg-red-100 text-red-600',
}

function formatTime(ts: string | null, tz: string): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

function calcNbJours(debut: string, fin: string): number {
  if (!debut || !fin) return 0
  return Math.max(0, dayjs(fin).diff(dayjs(debut), 'day') + 1)
}

// ── Page ───────────────────────────────────────────────────

export default function PortailPage() {
  const t       = useTranslations('rh')
  const params  = useParams()
  const router  = useRouter()

  const societeId = params.societe_id as string
  const base = `/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${societeId}/rh`

  // ── Auth / config ────────────────────────────────────────
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [timezone,      setTimezone]      = useState('Africa/Douala')
  const [portailPin,    setPortailPin]    = useState('0000')
  const [loading,       setLoading]       = useState(true)

  // ── Horloge live ─────────────────────────────────────────
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const nowLabel = now.toLocaleString('fr-FR', {
    timeZone: timezone, weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  // ── Recherche ────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [suggestions, setSuggestions] = useState<Employe[]>([])
  const [searching,   setSearching]   = useState(false)
  const [showSugg,    setShowSugg]    = useState(false)

  // ── Employé sélectionné ──────────────────────────────────
  const [selected,     setSelected]     = useState<Employe | null>(null)
  const [todayPresence, setTodayPresence] = useState<Presence | null>(null)
  const [savingEntry,  setSavingEntry]  = useState(false)
  const [savingExit,   setSavingExit]   = useState(false)

  // ── Congé ────────────────────────────────────────────────
  const [congeOpen,        setCongeOpen]        = useState(false)
  const [congeForm,        setCongeForm]        = useState<CongeForm>({ type_conge: 'annuel', typologie: 'daily', date_debut: '', date_fin: '', nb_heures: '', motif: '' })
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null)
  const [savingConge,      setSavingConge]      = useState(false)
  const [myConges,         setMyConges]         = useState<Conge[]>([])

  // ── PIN modal ────────────────────────────────────────────
  const [pinOpen,  setPinOpen]  = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // ── Init ─────────────────────────────────────────────────

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return }

    setCurrentUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single()
    if (!profile) return

    setFullTenantId(profile.tenant_id ?? '')

    const { data: soc } = await supabase
      .from('societes')
      .select('portail_pin')
      .eq('id', societeId)
      .maybeSingle()
    if (soc?.portail_pin) setPortailPin(soc.portail_pin)

    const { data: tenant } = await supabase
      .from('tenants')
      .select('timezone')
      .eq('id', profile.tenant_id ?? '')
      .maybeSingle()
    if (tenant?.timezone) setTimezone(tenant.timezone)

    setLoading(false)
  }

  // ── Recherche employés (sans compte) ─────────────────────

  const doSearch = useCallback(async (value: string) => {
    if (value.length < 4) { setSuggestions([]); setShowSugg(false); return }
    setSearching(true)
    const { data } = await supabase
      .from('rh_employes')
      .select('id, nom, prenom, email, poste, matricule')
      .eq('societe_id', societeId)
      .is('user_id', null)
      .eq('statut', 'actif')
      .or(`nom.ilike.%${value}%,prenom.ilike.%${value}%,email.ilike.%${value}%,matricule.ilike.%${value}%`)
      .limit(5)
    setSuggestions(data ?? [])
    setShowSugg(true)
    setSearching(false)
  }, [societeId])

  useEffect(() => {
    if (selected) return   // employé déjà sélectionné → ne pas relancer la recherche
    const timer = setTimeout(() => doSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search, doSearch, selected])

  async function selectEmployee(emp: Employe) {
    setSelected(emp)
    setSearch(`${emp.prenom} ${emp.nom}`)
    setShowSugg(false)
    setCongeOpen(false)
    setCongeForm({ type_conge: 'annuel', typologie: 'daily', date_debut: '', date_fin: '', nb_heures: '', motif: '' })
    setJustificatifFile(null)
    await fetchTodayPresence(emp.id)
    await fetchConges(emp.id)
  }

  function clearSelection() {
    setSelected(null)
    setSearch('')
    setSuggestions([])
    setTodayPresence(null)
    setMyConges([])
    setCongeOpen(false)
  }

  // ── Présence du jour ──────────────────────────────────────

  async function fetchTodayPresence(employeId: string) {
    const today = dayjs().format('YYYY-MM-DD')
    const { data } = await supabase
      .from('rh_presences')
      .select('id, heure_entree, heure_sortie, statut')
      .eq('employe_id', employeId)
      .eq('date', today)
      .maybeSingle()
    setTodayPresence(data ?? null)
  }

  async function handleEntree() {
    if (!selected || !fullTenantId) return
    setSavingEntry(true)
    const today = dayjs().format('YYYY-MM-DD')
    const { data, error } = await supabase
      .from('rh_presences')
      .upsert({
        tenant_id:    fullTenantId,
        societe_id:   societeId,
        employe_id:   selected.id,
        date:         today,
        heure_entree: new Date().toISOString(),
        created_by:   currentUserId,
      }, { onConflict: 'employe_id,date' })
      .select('id, heure_entree, heure_sortie, statut')
      .maybeSingle()
    if (error) toast.error('Erreur lors de l\'enregistrement de l\'entrée')
    else { setTodayPresence(data); toast.success(t('toast_pointage_success')) }
    setSavingEntry(false)
  }

  async function handleSortie() {
    if (!selected || !todayPresence?.id) return
    setSavingExit(true)
    const { data, error } = await supabase
      .from('rh_presences')
      .update({ heure_sortie: new Date().toISOString(), statut: 'present' })
      .eq('id', todayPresence.id)
      .select('id, heure_entree, heure_sortie, statut')
      .maybeSingle()
    if (error) toast.error('Erreur lors de l\'enregistrement de la sortie')
    else { setTodayPresence(data); toast.success(t('toast_pointage_success')) }
    setSavingExit(false)
  }

  // ── Congés ────────────────────────────────────────────────

  async function fetchConges(employeId: string) {
    const { data, error } = await supabase
      .from('rh_conges')
      .select('id, type_conge, typologie, date_debut, date_fin, nb_jours, nb_heures, statut, motif')
      .eq('employe_id', employeId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) console.error('[portail fetchConges]', error.message)
    setMyConges((data as any) ?? [])
  }

  async function handleCongeSubmit() {
    if (!selected || !fullTenantId) {
      toast.error(t('toast_conge_submit_error'))
      return
    }
    if (!congeForm.date_debut) return
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

    const payload: any = {
      tenant_id:  fullTenantId,
      societe_id: societeId,
      employe_id: selected.id,
      type_conge: congeForm.type_conge,
      typologie:  congeForm.typologie,
      date_debut: congeForm.date_debut,
      motif:      congeForm.motif || null,
      statut:     'en_attente',
      created_by: currentUserId,
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
    setCongeForm({ type_conge: 'annuel', typologie: 'daily', date_debut: '', date_fin: '', nb_heures: '', motif: '' })
    setJustificatifFile(null)
    setCongeOpen(false)
    await fetchConges(selected.id)
    setSavingConge(false)
  }

  // ── PIN ───────────────────────────────────────────────────

  function handleBack() {
    if (portailPin && portailPin !== '0000') { setPinOpen(true); setPinInput(''); setPinError(false) }
    else router.push(base)
  }

  function confirmPin() {
    if (pinInput === portailPin) router.push(base)
    else { setPinError(true); setPinInput('') }
  }

  // ── Render ────────────────────────────────────────────────

  const hasEntree = !!todayPresence?.heure_entree
  const hasSortie = !!todayPresence?.heure_sortie

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{t('portail_back')}</span>
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700 capitalize">{nowLabel}</p>
          <p className="text-[11px] text-slate-400">{timezone}</p>
        </div>
        <div className="w-20" />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-5 py-8 space-y-6">

          {/* ── Titre ── */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">{t('portail_title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('portail_subtitle')}</p>
          </div>

          {/* ── Recherche ── */}
          <div className="relative">
            <div className="flex items-center gap-3 bg-white border-2 border-slate-200 focus-within:border-violet-400 rounded-2xl px-4 py-3.5 transition-colors shadow-sm">
              {searching
                ? <Loader2 className="h-5 w-5 text-slate-400 animate-spin shrink-0" />
                : <Search className="h-5 w-5 text-slate-400 shrink-0" />
              }
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); if (selected) clearSelection() }}
                placeholder={t('portail_search_placeholder')}
                className="flex-1 text-base text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                autoComplete="off"
              />
              {search && (
                <button onClick={clearSelection} className="p-1 text-slate-300 hover:text-slate-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Suggestions */}
            {showSugg && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                {suggestions.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => selectEmployee(emp)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-violet-50 transition-colors text-left border-b border-slate-100 last:border-0"
                  >
                    <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center font-bold text-sm text-violet-700 shrink-0">
                      {(emp.prenom[0] ?? '') + (emp.nom[0] ?? '')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{emp.prenom} {emp.nom}</p>
                      <p className="text-xs text-slate-400">{emp.poste ?? '—'} · {emp.matricule}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showSugg && suggestions.length === 0 && !searching && search.length >= 4 && (
              <div className="absolute z-10 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-5 text-center">
                <p className="text-sm text-slate-400">{t('portail_no_results')}</p>
              </div>
            )}

            {!showSugg && !selected && search.length < 4 && (
              <p className="text-xs text-slate-400 mt-2 text-center">{t('portail_search_hint')}</p>
            )}
          </div>

          {/* ── Employé sélectionné ── */}
          {selected && (
            <div className="space-y-5">

              {/* Mini fiche */}
              <div className="bg-white border border-violet-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                <div className="h-14 w-14 rounded-full bg-violet-100 flex items-center justify-center font-bold text-lg text-violet-700 shrink-0">
                  {(selected.prenom[0] ?? '') + (selected.nom[0] ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-lg">{selected.prenom} {selected.nom}</p>
                  <p className="text-sm text-slate-500">{selected.poste ?? '—'}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selected.matricule}{selected.email ? ` · ${selected.email}` : ''}</p>
                </div>
              </div>

              {/* Pointage */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('tab_pointage')} — {dayjs().format('DD/MM/YYYY')}</p>

                <div className="flex gap-3">
                  {/* Entrée */}
                  <button
                    type="button"
                    onClick={handleEntree}
                    disabled={savingEntry || hasEntree}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-bold text-sm transition-all ${
                      hasEntree
                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md'
                    } disabled:opacity-70`}
                  >
                    {savingEntry ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                    {hasEntree
                      ? `${t('pointage_entree')} — ${formatTime(todayPresence!.heure_entree, timezone)}`
                      : t('pointage_entree')
                    }
                  </button>

                  {/* Sortie */}
                  <button
                    type="button"
                    onClick={handleSortie}
                    disabled={savingExit || !hasEntree || hasSortie}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-bold text-sm transition-all ${
                      hasSortie
                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 cursor-default'
                        : hasEntree
                          ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-md'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    } disabled:opacity-70`}
                  >
                    {savingExit ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                    {hasSortie
                      ? `${t('pointage_sortie')} — ${formatTime(todayPresence!.heure_sortie, timezone)}`
                      : t('pointage_sortie')
                    }
                  </button>
                </div>

                {/* Statut */}
                <div className="flex items-center gap-2">
                  {hasSortie ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('portail_status_present')}
                    </span>
                  ) : hasEntree ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full">
                      <Clock className="h-3.5 w-3.5" /> {t('portail_status_en_cours')} {formatTime(todayPresence!.heure_entree, timezone)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">
                      {t('portail_status_absent')}
                    </span>
                  )}
                </div>
              </div>

              {/* Demande de congé */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setCongeOpen(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('portail_conge_section')}
                  {congeOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {congeOpen && (
                  <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">

                    {/* Type de congé */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_type_conge')}</label>
                      <select
                        value={congeForm.type_conge}
                        onChange={e => setCongeForm(p => ({ ...p, type_conge: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        {TYPE_CONGE_OPTIONS.map(tc => (
                          <option key={tc} value={tc}>{t(`type_conge_${tc}` as any)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Modalité */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('conge_field_typologie')}</label>
                      <div className="flex gap-3">
                        {(['daily', 'hourly'] as const).map(typ => (
                          <label key={typ} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-bold transition-colors ${
                            congeForm.typologie === typ
                              ? 'border-violet-500 bg-violet-50 text-violet-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                            <input type="radio" name="typologie" value={typ}
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
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_date_debut')}</label>
                        <input type="date" value={congeForm.date_debut}
                          onChange={e => setCongeForm(p => ({ ...p, date_debut: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      {congeForm.typologie === 'daily' ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_date_fin')}</label>
                          <input type="date" value={congeForm.date_fin}
                            onChange={e => setCongeForm(p => ({ ...p, date_fin: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('conge_field_nb_heures')}</label>
                          <input type="number" min="0.5" max="24" step="0.5" value={congeForm.nb_heures}
                            onChange={e => setCongeForm(p => ({ ...p, nb_heures: e.target.value }))}
                            placeholder="ex: 4"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          />
                        </div>
                      )}
                    </div>

                    {/* Durée calculée (daily) */}
                    {congeForm.typologie === 'daily' && congeForm.date_debut && congeForm.date_fin && (
                      <p className="text-xs text-slate-500">
                        Durée : <span className="font-bold text-slate-700">{calcNbJours(congeForm.date_debut, congeForm.date_fin)} jour(s)</span>
                      </p>
                    )}

                    {/* Motif */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_motif')}</label>
                      <input type="text" value={congeForm.motif}
                        onChange={e => setCongeForm(p => ({ ...p, motif: e.target.value }))}
                        placeholder="Optionnel"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </div>

                    {/* Justificatif */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('conge_field_justificatif')}</label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                        onChange={e => setJustificatifFile(e.target.files?.[0] ?? null)}
                        className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">{t('conge_justificatif_hint')}</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCongeSubmit}
                      disabled={savingConge || !congeForm.date_debut || (congeForm.typologie === 'daily' ? !congeForm.date_fin : !congeForm.nb_heures)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-700 disabled:opacity-40 transition shadow-sm"
                    >
                      {savingConge && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('conge_submit_btn')}
                    </button>
                  </div>
                )}
              </div>

              {/* Historique congés */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('portail_history_title')}</p>
                {myConges.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">{t('portail_history_empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {myConges.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-700">{t(`type_conge_${c.type_conge}` as any)}</p>
                          <p className="text-xs text-slate-400">
                            {dayjs(c.date_debut).format('DD/MM/YY')}
                            {c.typologie === 'hourly'
                              ? ` · ${c.nb_heures}h`
                              : ` → ${c.date_fin ? dayjs(c.date_fin).format('DD/MM/YY') : '?'} · ${c.nb_jours}j`
                            }
                          </p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${CONGE_STATUT_STYLES[c.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                          {t(`conge_${c.statut}` as any)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Message initial si rien sélectionné */}
          {!selected && search.length < 4 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">{t('portail_select_hint')}</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Modal PIN ── */}
      {pinOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">{t('portail_pin_modal_title')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('portail_pin_modal_desc')}</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && confirmPin()}
              placeholder="••••"
              autoFocus
              className={`w-full text-center text-3xl font-mono tracking-[1rem] border-2 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 ${
                pinError ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-violet-400'
              }`}
            />
            {pinError && (
              <p className="text-center text-sm font-bold text-red-500">{t('portail_pin_error')}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setPinOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={confirmPin}
                disabled={pinInput.length !== 4}
                className="flex-1 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-700 disabled:opacity-40 transition"
              >
                {t('portail_pin_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
