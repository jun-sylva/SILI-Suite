'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { GitBranch, Plus, X, Loader2, ChevronRight, Pencil, Trash2, Flag, CalendarDays, TrendingUp } from 'lucide-react'
import dayjs from 'dayjs'

type Etape = 'qualification' | 'proposition' | 'negociation' | 'gagnee' | 'perdue'
type Priorite = 'basse' | 'normale' | 'haute' | 'critique'

interface Opportunite {
  id: string; titre: string; etape: Etape
  valeur: number | null; probabilite: number | null
  date_cloture_prevue: string | null; notes: string | null
  assigne_a: string | null
  assigne: { full_name: string } | null
  created_at: string
}

const ETAPES: Etape[] = ['qualification', 'proposition', 'negociation', 'gagnee', 'perdue']
const ETAPE_LABELS: Record<Etape, string> = {
  qualification: 'Qualification',
  proposition:   'Proposition',
  negociation:   'Négociation',
  gagnee:        'Gagnée',
  perdue:        'Perdue',
}
const ETAPE_COLOR: Record<Etape, string> = {
  qualification: 'border-slate-300  bg-slate-50',
  proposition:   'border-blue-300   bg-blue-50',
  negociation:   'border-amber-300  bg-amber-50',
  gagnee:        'border-emerald-300 bg-emerald-50',
  perdue:        'border-red-300    bg-red-50',
}
const ETAPE_BADGE: Record<Etape, string> = {
  qualification: 'bg-slate-100 text-slate-600',
  proposition:   'bg-blue-100 text-blue-700',
  negociation:   'bg-amber-100 text-amber-700',
  gagnee:        'bg-emerald-100 text-emerald-700',
  perdue:        'bg-red-100 text-red-600',
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function PipelinePage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [opps,          setOpps]          = useState<Opportunite[]>([])
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Panel détail
  const [detail,        setDetail]        = useState<Opportunite | null>(null)

  // Modal
  const [showModal,     setShowModal]     = useState(false)
  const [editing,       setEditing]       = useState<Opportunite | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [oTitre,        setOTitre]        = useState('')
  const [oEtape,        setOEtape]        = useState<Etape>('qualification')
  const [oValeur,       setOValeur]       = useState('')
  const [oProbabilite,  setOProbabilite]  = useState('50')
  const [oCloture,      setOCloture]      = useState('')
  const [oNotes,        setONotes]        = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'crm')
        setCanManage(['contributeur', 'gestionnaire', 'admin'].includes(perm))
        setCanDelete(['gestionnaire', 'admin'].includes(perm))
      } else { setCanManage(true); setCanDelete(true) }
      await loadOpps()
      setLoading(false)
    }
    init()
  }, [societeId])

  const loadOpps = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('crm_opportunites')
      .select('id, titre, etape, valeur, probabilite, date_cloture_prevue, notes, assigne_a, created_at, assigne:profiles!assigne_a(full_name)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
    setOpps(data ?? [])
  }, [societeId])

  function openNew() {
    setEditing(null)
    setOTitre(''); setOEtape('qualification'); setOValeur(''); setOProbabilite('50'); setOCloture(''); setONotes('')
    setShowModal(true)
  }
  function openEdit(o: Opportunite) {
    setEditing(o)
    setOTitre(o.titre); setOEtape(o.etape); setOValeur(String(o.valeur ?? '')); setOProbabilite(String(o.probabilite ?? 50)); setOCloture(o.date_cloture_prevue ?? ''); setONotes(o.notes ?? '')
    setShowModal(true)
  }

  async function save() {
    if (!oTitre.trim()) return
    setSaving(true)
    const payload = {
      titre: oTitre.trim(), etape: oEtape,
      valeur: oValeur ? parseFloat(oValeur) : null,
      probabilite: oProbabilite ? parseInt(oProbabilite) : null,
      date_cloture_prevue: oCloture || null, notes: oNotes.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    if (editing) {
      const { error } = await (supabase as any).from('crm_opportunites').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_opportunite_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'opportunite_updated', resourceType: 'crm_opportunites', resourceId: editing.id, metadata: { titre: oTitre.trim(), etape: oEtape } })
    } else {
      const { data: newOpp, error } = await (supabase as any).from('crm_opportunites').insert(payload).select('id').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_opportunite_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'opportunite_created', resourceType: 'crm_opportunites', resourceId: newOpp?.id, metadata: { titre: oTitre.trim() } })
    }
    setShowModal(false); setSaving(false); await loadOpps()
  }

  async function changeEtape(opp: Opportunite, newEtape: Etape) {
    const oldEtape = opp.etape
    setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, etape: newEtape } : o))
    const { error } = await (supabase as any).from('crm_opportunites').update({ etape: newEtape, updated_at: new Date().toISOString() }).eq('id', opp.id)
    if (error) { setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, etape: oldEtape } : o)); return }
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: newEtape === 'gagnee' ? 'opportunite_gagnee' : newEtape === 'perdue' ? 'opportunite_perdue' : 'opportunite_etape_changed', resourceType: 'crm_opportunites', resourceId: opp.id, metadata: { titre: opp.titre, ancien: oldEtape, nouveau: newEtape } })
    if (detail?.id === opp.id) setDetail(prev => prev ? { ...prev, etape: newEtape } : prev)
  }

  async function deleteOpp(opp: Opportunite) {
    if (!confirm('Supprimer cette opportunité ?')) return
    const { error } = await (supabase as any).from('crm_opportunites').delete().eq('id', opp.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_opportunite_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'opportunite_deleted', resourceType: 'crm_opportunites', resourceId: opp.id, metadata: { titre: opp.titre } })
    if (detail?.id === opp.id) setDetail(null)
    await loadOpps()
  }

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('pipeline_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">{opps.length}</span>
        </div>
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="h-4 w-4" /> {t('btn_new_opportunite')}
          </button>
        )}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {ETAPES.map(etape => {
          const colOpps = opps.filter(o => o.etape === etape)
          const total   = colOpps.reduce((s, o) => s + (o.valeur ?? 0), 0)
          return (
            <div key={etape} className={`rounded-2xl border-2 ${ETAPE_COLOR[etape]} p-3 space-y-3 min-h-[200px]`}>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ETAPE_BADGE[etape]}`}>{ETAPE_LABELS[etape]}</span>
                <span className="text-xs text-slate-400">{colOpps.length}</span>
              </div>
              {total > 0 && <p className="text-xs text-slate-500 font-medium">{fmt(total)} FCFA</p>}
              {colOpps.map(o => (
                <div
                  key={o.id}
                  onClick={() => setDetail(o)}
                  className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all space-y-2 group"
                >
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2">{o.titre}</p>
                  {o.valeur != null && (
                    <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> {fmt(o.valeur)} FCFA
                    </p>
                  )}
                  {o.probabilite != null && <p className="text-xs text-slate-400">{o.probabilite}% de succès</p>}
                  {o.date_cloture_prevue && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {dayjs(o.date_cloture_prevue).format('DD/MM/YYYY')}
                    </p>
                  )}
                  {o.assigne && <p className="text-xs text-slate-400">{o.assigne.full_name}</p>}
                </div>
              ))}
              {colOpps.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{t('pipeline_empty')}</p>}
            </div>
          )
        })}
      </div>

      {/* Panel slide-in */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white w-full max-w-md shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-lg line-clamp-1">{detail.titre}</h2>
              <button onClick={() => setDetail(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ETAPE_BADGE[detail.etape]}`}>{ETAPE_LABELS[detail.etape]}</span>
                {detail.probabilite != null && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{detail.probabilite}%</span>}
              </div>
              {detail.valeur != null && <p className="text-2xl font-bold text-indigo-600">{fmt(detail.valeur)} FCFA</p>}
              {detail.date_cloture_prevue && <p className="text-sm text-slate-500 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {dayjs(detail.date_cloture_prevue).format('DD/MM/YYYY')}</p>}
              {detail.assigne && <p className="text-sm text-slate-500 flex items-center gap-2"><Flag className="h-4 w-4" /> {detail.assigne.full_name}</p>}
              {detail.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{detail.notes}</p>}

              {canManage && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Changer d'étape</p>
                  <div className="flex flex-wrap gap-2">
                    {ETAPES.filter(e => e !== detail.etape).map(e => (
                      <button key={e} onClick={() => changeEtape(detail, e)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${ETAPE_BADGE[e]}`}>
                        → {ETAPE_LABELS[e]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {canManage && (
                  <button onClick={() => { openEdit(detail); setDetail(null) }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => deleteOpp(detail)} className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? t('modal_edit_opportunite') : t('modal_new_opportunite')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_titre')} *</label>
                <input className={inputCls} value={oTitre} onChange={e => setOTitre(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_etape')}</label>
                  <select className={selectCls} value={oEtape} onChange={e => setOEtape(e.target.value as Etape)}>
                    {ETAPES.map(e => <option key={e} value={e}>{ETAPE_LABELS[e]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_probabilite')}</label>
                  <input type="number" min="0" max="100" className={inputCls} value={oProbabilite} onChange={e => setOProbabilite(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_valeur')}</label>
                  <input type="number" min="0" className={inputCls} value={oValeur} onChange={e => setOValeur(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_cloture')}</label>
                  <input type="date" className={inputCls} value={oCloture} onChange={e => setOCloture(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                <textarea rows={3} className={inputCls} value={oNotes} onChange={e => setONotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={save} disabled={saving || !oTitre.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
