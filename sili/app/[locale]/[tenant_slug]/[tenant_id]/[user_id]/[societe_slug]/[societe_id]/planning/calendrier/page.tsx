'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type TypeEvenement = 'reunion' | 'formation' | 'deadline' | 'rappel' | 'conge_equipe'
type VueMode       = 'mois' | 'semaine' | 'jour'

interface CalEvent {
  id:          string
  titre:       string
  type:        TypeEvenement
  date_debut:  string
  date_fin:    string
  all_day:     boolean
  couleur:     string
  description: string | null
  lien_meet:   string | null
  source:      'event' | 'conge' | 'jalon'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TypeEvenement, { label: string; color: string }> = {
  reunion:      { label: 'Réunion',       color: '#3b82f6' },
  formation:    { label: 'Formation',     color: '#8b5cf6' },
  deadline:     { label: 'Deadline',      color: '#ef4444' },
  rappel:       { label: 'Rappel',        color: '#f59e0b' },
  conge_equipe: { label: 'Congé équipe',  color: '#14b8a6' },
}

const CONGE_COLOR  = '#94a3b8'
const JALON_COLOR  = '#f59e0b'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // lundi = 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendrierPage() {
  const t         = useTranslations('planning')
  const params    = useParams()
  const societeId = params.societe_id as string

  const now = new Date()
  const [vue,          setVue]          = useState<VueMode>('mois')
  const [year,         setYear]         = useState(now.getFullYear())
  const [month,        setMonth]        = useState(now.getMonth())
  const [weekStart,    setWeekStart]    = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d
  })
  const [dayDate,      setDayDate]      = useState(new Date())

  const [events,       setEvents]       = useState<CalEvent[]>([])
  const [loading,      setLoading]      = useState(true)
  const [canManage,    setCanManage]    = useState(false)
  const [fullTenantId, setFullTenantId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [rhModuleActive, setRhModuleActive] = useState(false)

  // Modal event
  const [showModal,    setShowModal]    = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [eTitre,       setETitre]       = useState('')
  const [eType,        setEType]        = useState<TypeEvenement>('reunion')
  const [eDesc,        setEDesc]        = useState('')
  const [eDateDebut,   setEDateDebut]   = useState('')
  const [eDateFin,     setEDateFin]     = useState('')
  const [eAllDay,      setEAllDay]      = useState(true)
  const [eLienMeet,    setELienMeet]    = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      setCanManage(isAdmin || true) // contributeur+ peut créer des événements

      // Vérifier si le module RH est actif sur cette société
      const { data: rhMod } = await (supabase as any)
        .from('societe_modules').select('is_active').eq('societe_id', societeId).eq('module', 'rh').single()
      setRhModuleActive(rhMod?.is_active === true)

      setLoading(false)
    }
    init()
  }, [societeId])

  const loadEvents = useCallback(async () => {
    // Période à charger selon la vue
    let from: Date, to: Date
    if (vue === 'mois') {
      from = new Date(year, month, 1)
      to   = new Date(year, month + 1, 0)
    } else if (vue === 'semaine') {
      from = new Date(weekStart)
      to   = new Date(weekStart); to.setDate(to.getDate() + 6)
    } else {
      from = new Date(dayDate); from.setHours(0,0,0,0)
      to   = new Date(dayDate); to.setHours(23,59,59,999)
    }
    const fromStr = from.toISOString().split('T')[0]
    const toStr   = to.toISOString().split('T')[0]

    const all: CalEvent[] = []

    // Événements planning
    const { data: evts } = await (supabase as any)
      .from('plan_evenements')
      .select('id, titre, type, date_debut, date_fin, all_day, couleur, description, lien_meet')
      .eq('societe_id', societeId)
      .lte('date_debut', to.toISOString())
      .gte('date_fin',   from.toISOString())
    for (const e of (evts ?? [])) {
      all.push({ ...e, source: 'event' })
    }

    // Congés approuvés (si module RH actif)
    if (rhModuleActive) {
      const { data: conges } = await (supabase as any)
        .from('rh_conges')
        .select('id, type_conge, date_debut, date_fin, rh_employes!employe_id(prenom, nom)')
        .eq('societe_id', societeId)
        .eq('statut', 'approuve')
        .lte('date_debut', toStr)
        .gte('date_fin',   fromStr)
      for (const c of (conges ?? [])) {
        const nom = c.rh_employes ? `${c.rh_employes.prenom} ${c.rh_employes.nom}` : 'Employé'
        all.push({
          id: c.id, titre: `Congé — ${nom}`, type: 'conge_equipe',
          date_debut: `${c.date_debut}T00:00:00`, date_fin: `${c.date_fin || c.date_debut}T23:59:59`,
          all_day: true, couleur: CONGE_COLOR, description: c.type_conge, lien_meet: null, source: 'conge',
        })
      }
    }

    // Jalons projets
    const { data: jalons } = await (supabase as any)
      .from('plan_jalons')
      .select('id, titre, date_cible, projet:plan_projets!projet_id(societe_id, couleur)')
      .gte('date_cible', fromStr)
      .lte('date_cible', toStr)
      .eq('statut', 'en_attente')
    for (const j of (jalons ?? []).filter((j: any) => j.projet?.societe_id === societeId)) {
      all.push({
        id: j.id, titre: `🏁 ${j.titre}`, type: 'deadline',
        date_debut: `${j.date_cible}T00:00:00`, date_fin: `${j.date_cible}T23:59:59`,
        all_day: true, couleur: j.projet?.couleur ?? JALON_COLOR, description: null, lien_meet: null, source: 'jalon',
      })
    }

    setEvents(all)
  }, [vue, year, month, weekStart, dayDate, societeId, rhModuleActive])

  useEffect(() => {
    if (!loading) loadEvents()
  }, [loading, loadEvents])

  function openNewEvent(dateStr: string) {
    setSelectedEvent(null)
    setETitre(''); setEType('reunion'); setEDesc('')
    setEDateDebut(dateStr); setEDateFin(dateStr)
    setEAllDay(true); setELienMeet('')
    setSelectedDate(dateStr)
    setShowModal(true)
  }

  function openEvent(e: CalEvent) {
    if (e.source !== 'event') return
    setSelectedEvent(e)
    setETitre(e.titre); setEType(e.type); setEDesc(e.description ?? '')
    setEDateDebut(e.date_debut.split('T')[0]); setEDateFin(e.date_fin.split('T')[0])
    setEAllDay(e.all_day); setELienMeet(e.lien_meet ?? '')
    setShowModal(true)
  }

  async function saveEvent() {
    if (!eTitre.trim()) return
    setSaving(true)
    const payload = {
      titre: eTitre.trim(), type: eType, description: eDesc.trim() || null,
      date_debut: eAllDay ? `${eDateDebut}T00:00:00` : eDateDebut,
      date_fin:   eAllDay ? `${eDateFin}T23:59:59`   : eDateFin,
      all_day: eAllDay, couleur: TYPE_CONFIG[eType].color,
      lien_meet: eLienMeet.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, organisateur_id: currentUserId,
    }

    if (selectedEvent) {
      const { error } = await (supabase as any).from('plan_evenements').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', selectedEvent.id)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_event_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'event_updated', resourceType: 'plan_evenements', resourceId: selectedEvent.id, metadata: { titre: eTitre.trim(), type: eType } })
    } else {
      const { data: newEvent, error } = await (supabase as any).from('plan_evenements').insert(payload).select('id').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_event_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'event_created', resourceType: 'plan_evenements', resourceId: newEvent?.id, metadata: { titre: eTitre.trim(), type: eType, date_debut: eDateDebut } })
    }

    setShowModal(false); setSaving(false)
    await loadEvents()
  }

  async function deleteEvent() {
    if (!selectedEvent) return
    const { error } = await (supabase as any).from('plan_evenements').delete().eq('id', selectedEvent.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_event_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'event_deleted', resourceType: 'plan_evenements', resourceId: selectedEvent.id, metadata: { titre: selectedEvent.titre, type: selectedEvent.type } })
    setShowModal(false)
    await loadEvents()
  }

  // Navigation
  function prevPeriod() {
    if (vue === 'mois') { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
    else if (vue === 'semaine') { setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n }) }
    else { setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n }) }
  }
  function nextPeriod() {
    if (vue === 'mois') { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
    else if (vue === 'semaine') { setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n }) }
    else { setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n }) }
  }

  function periodLabel() {
    if (vue === 'mois') return new Date(year, month, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    if (vue === 'semaine') {
      const end = new Date(weekStart); end.setDate(end.getDate() + 6)
      return `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function eventsForDay(dateStr: string) {
    return events.filter(e => {
      const start = e.date_debut.split('T')[0]
      const end   = e.date_fin.split('T')[0]
      return dateStr >= start && dateStr <= end
    })
  }

  const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  // ── Mois view ────────────────────────────────────────────────────────────────
  const daysInMonth   = getDaysInMonth(year, month)
  const firstDayOfMonth = getFirstDayOfMonth(year, month)
  const todayStr = now.toISOString().split('T')[0]

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // ── Semaine view ─────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-4 animate-in fade-in duration-500">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <h1 className="font-bold text-slate-900">{t('calendrier_title')}</h1>
            {rhModuleActive && (
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 text-[10px] font-bold border border-teal-100">+ Congés RH</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Vue toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['mois','semaine','jour'] as VueMode[]).map(v => (
                <button key={v} onClick={() => setVue(v)} className={`px-3 py-1.5 font-medium capitalize transition-colors ${vue === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{v}</button>
              ))}
            </div>
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button onClick={prevPeriod} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center capitalize">{periodLabel()}</span>
              <button onClick={nextPeriod} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={() => openNewEvent(todayStr)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl">
              <Plus className="h-4 w-4" /> {t('btn_new_event')}
            </button>
          </div>
        </div>

        {/* Légende types */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} />
              {v.label}
            </div>
          ))}
          {rhModuleActive && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONGE_COLOR }} />
              Congés approuvés (RH)
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: JALON_COLOR }} />
            Jalons projets
          </div>
        </div>
      </div>

      {/* Calendrier Mois */}
      {vue === 'mois' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {JOURS.map(j => (
              <div key={j} className="py-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide">{j}</div>
            ))}
          </div>
          {/* Grille */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : ''
              const dayEvents = day ? eventsForDay(dateStr) : []
              const isToday   = dateStr === todayStr
              return (
                <div
                  key={idx}
                  className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 ${day ? 'cursor-pointer hover:bg-slate-50' : 'bg-slate-50/50'}`}
                  onClick={() => day && openNewEvent(dateStr)}
                >
                  {day && (
                    <>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(e => (
                          <div
                            key={e.id}
                            onClick={ev => { ev.stopPropagation(); openEvent(e) }}
                            className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white cursor-pointer"
                            style={{ backgroundColor: e.couleur }}
                          >
                            {e.titre}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 3} autres</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendrier Semaine */}
      {vue === 'semaine' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {weekDays.map((d, i) => {
              const isToday = d.toISOString().split('T')[0] === todayStr
              return (
                <div key={i} className={`py-3 text-center border-r border-slate-100 last:border-0 ${isToday ? 'bg-indigo-50' : ''}`}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">{JOURS[i]}</p>
                  <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{d.getDate()}</p>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[300px]">
            {weekDays.map((d, i) => {
              const dateStr   = d.toISOString().split('T')[0]
              const dayEvents = eventsForDay(dateStr)
              const isToday   = dateStr === todayStr
              return (
                <div
                  key={i}
                  className={`border-r border-slate-100 last:border-0 p-2 space-y-1 cursor-pointer hover:bg-slate-50 ${isToday ? 'bg-indigo-50/30' : ''}`}
                  onClick={() => openNewEvent(dateStr)}
                >
                  {dayEvents.map(e => (
                    <div
                      key={e.id}
                      onClick={ev => { ev.stopPropagation(); openEvent(e) }}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white cursor-pointer truncate"
                      style={{ backgroundColor: e.couleur }}
                    >
                      {e.titre}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendrier Jour */}
      {vue === 'jour' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {eventsForDay(dayDate.toISOString().split('T')[0]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">{t('jour_empty')}</p>
              <button onClick={() => openNewEvent(dayDate.toISOString().split('T')[0])} className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:text-indigo-800">
                <Plus className="h-4 w-4" /> {t('btn_new_event')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {eventsForDay(dayDate.toISOString().split('T')[0]).map(e => (
                <div
                  key={e.id}
                  onClick={() => openEvent(e)}
                  className="flex items-start gap-4 p-4 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow"
                  style={{ borderLeftWidth: 4, borderLeftColor: e.couleur }}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{e.titre}</p>
                    {e.description && <p className="text-sm text-slate-500 mt-0.5">{e.description}</p>}
                    {e.lien_meet && <a href={e.lien_meet} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 mt-1 block" onClick={ev => ev.stopPropagation()}>Rejoindre la réunion →</a>}
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: e.couleur }}>
                    {e.all_day ? 'Journée entière' : `${new Date(e.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal événement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{selectedEvent ? t('modal_edit_event') : t('modal_new_event')}</h2>
              <div className="flex items-center gap-2">
                {selectedEvent && (
                  <button onClick={deleteEvent} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></button>
                )}
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
            </div>
            <div className="space-y-3">
              <input value={eTitre} onChange={e => setETitre(e.target.value)} className={inputCls} placeholder={t('placeholder_event_titre')} />
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_type_event')}</label>
                <select value={eType} onChange={e => setEType(e.target.value as TypeEvenement)} className={selectCls}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_date_debut')}</label>
                  <input type="date" value={eDateDebut} onChange={e => setEDateDebut(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_date_fin')}</label>
                  <input type="date" value={eDateFin} onChange={e => setEDateFin(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_description')}</label>
                <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} className={inputCls} rows={2} />
              </div>
              {eType === 'reunion' && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_lien_meet')}</label>
                  <input value={eLienMeet} onChange={e => setELienMeet(e.target.value)} className={inputCls} placeholder="https://meet.google.com/..." />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={eAllDay} onChange={e => setEAllDay(e.target.checked)} className="rounded" />
                {t('field_all_day')}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">{t('btn_cancel')}</button>
              <button onClick={saveEvent} disabled={!eTitre.trim() || saving} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
