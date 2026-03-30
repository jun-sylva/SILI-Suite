'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { Users, Plus, X, Loader2, Pencil, Trash2, ArrowRightCircle, Search } from 'lucide-react'

type LeadStatut = 'nouveau' | 'contacte' | 'qualifie' | 'converti' | 'perdu'

interface Lead {
  id: string; nom: string; email: string | null; telephone: string | null
  entreprise: string | null; source: string | null; statut: string | null
  score: number | null; notes: string | null; valeur_estimee: number | null
  assigne: { full_name: string } | null; created_at: string | null
}

const STATUT_LABELS: Record<string, string> = { nouveau: 'Nouveau', contacte: 'Contacté', qualifie: 'Qualifié', converti: 'Converti', perdu: 'Perdu' }
const STATUT_COLOR: Record<string, string>  = { nouveau: 'bg-slate-100 text-slate-600', contacte: 'bg-blue-100 text-blue-700', qualifie: 'bg-violet-100 text-violet-700', converti: 'bg-emerald-100 text-emerald-700', perdu: 'bg-red-100 text-red-600' }
const SOURCES = ['site_web', 'appel', 'recommandation', 'salon', 'autre']
const SOURCE_LABELS: Record<string, string> = { site_web: 'Site web', appel: 'Appel entrant', recommandation: 'Recommandation', salon: 'Salon / Événement', autre: 'Autre' }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function LeadsPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [leads,         setLeads]         = useState<Lead[]>([])
  const [search,        setSearch]        = useState('')
  const [filterStatut,  setFilterStatut]  = useState('')
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Lead | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [lNom,      setLNom]      = useState('')
  const [lEmail,    setLEmail]    = useState('')
  const [lTel,      setLTel]      = useState('')
  const [lEntreprise, setLEntreprise] = useState('')
  const [lSource,   setLSource]   = useState('autre')
  const [lStatut,   setLStatut]   = useState<LeadStatut>('nouveau')
  const [lScore,    setLScore]    = useState('')
  const [lValeur,   setLValeur]   = useState('')
  const [lNotes,    setLNotes]    = useState('')

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
      await loadLeads(); setLoading(false)
    }
    init()
  }, [societeId])

  const loadLeads = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('crm_leads')
      .select('id, nom, email, telephone, entreprise, source, statut, score, notes, valeur_estimee, created_at, assigne:profiles!assigne_a(full_name)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
    setLeads(data ?? [])
  }, [societeId])

  function openNew() {
    setEditing(null)
    setLNom(''); setLEmail(''); setLTel(''); setLEntreprise(''); setLSource('autre'); setLStatut('nouveau'); setLScore(''); setLValeur(''); setLNotes('')
    setShowModal(true)
  }
  function openEdit(l: Lead) {
    setEditing(l)
    setLNom(l.nom); setLEmail(l.email ?? ''); setLTel(l.telephone ?? ''); setLEntreprise(l.entreprise ?? '')
    setLSource(l.source ?? 'autre'); setLStatut((l.statut as LeadStatut) ?? 'nouveau')
    setLScore(String(l.score ?? '')); setLValeur(String(l.valeur_estimee ?? '')); setLNotes(l.notes ?? '')
    setShowModal(true)
  }

  async function save() {
    if (!lNom.trim()) return
    setSaving(true)
    const payload = {
      nom: lNom.trim(), email: lEmail.trim() || null, telephone: lTel.trim() || null,
      entreprise: lEntreprise.trim() || null, source: lSource, statut: lStatut,
      score: lScore ? parseInt(lScore) : null,
      valeur_estimee: lValeur ? parseFloat(lValeur) : null,
      notes: lNotes.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    if (editing) {
      const { error } = await (supabase as any).from('crm_leads').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_lead_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'lead_updated', resourceType: 'crm_leads', resourceId: editing.id, metadata: { nom: lNom.trim() } })
    } else {
      const { data: newLead, error } = await (supabase as any).from('crm_leads').insert(payload).select('id').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_lead_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'lead_created', resourceType: 'crm_leads', resourceId: newLead?.id, metadata: { nom: lNom.trim() } })
    }
    setShowModal(false); setSaving(false); await loadLeads()
  }

  async function deleteLead(l: Lead) {
    if (!confirm(t('confirm_delete_lead'))) return
    const { error } = await (supabase as any).from('crm_leads').delete().eq('id', l.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_lead_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'lead_deleted', resourceType: 'crm_leads', resourceId: l.id, metadata: { nom: l.nom } })
    await loadLeads()
  }

  async function convertir(l: Lead) {
    if (!confirm(t('confirm_convertir'))) return
    const { data: newOpp, error } = await (supabase as any).from('crm_opportunites').insert({
      titre: `Opportunité — ${l.nom}${l.entreprise ? ` (${l.entreprise})` : ''}`,
      etape: 'qualification', valeur: l.valeur_estimee,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }).select('id').single()
    if (error) { toast.error(t('toast_error')); return }
    await (supabase as any).from('crm_leads').update({ statut: 'converti', updated_at: new Date().toISOString() }).eq('id', l.id)
    toast.success(t('toast_lead_converti'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'lead_converti', resourceType: 'crm_leads', resourceId: l.id, metadata: { nom: l.nom, opportunite_id: newOpp?.id } })
    // Notification aux gestionnaires CRM + tenant_admins
    const [{ data: perms }, { data: admins }] = await Promise.all([
      supabase.from('user_module_permissions').select('user_id').eq('societe_id', societeId).eq('module', 'crm').in('permission', ['gestionnaire', 'admin']),
      supabase.from('profiles').select('id').eq('tenant_id', fullTenantId).eq('role', 'tenant_admin'),
    ])
    const targets = [
      ...(perms ?? []).map((g: any) => g.user_id),
      ...(admins ?? []).map((a: any) => a.id),
    ].filter((id, i, arr) => arr.indexOf(id) === i && id !== currentUserId)
    if (targets.length > 0) {
      await supabase.from('notifications').insert(targets.map((uid: string) => ({
        tenant_id: fullTenantId, user_id: uid, type: 'info',
        titre: 'Nouveau lead converti', message: `Le lead "${l.nom}" a été converti en opportunité.`,
      })))
    }
    await loadLeads()
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.nom.toLowerCase().includes(q) || (l.entreprise ?? '').toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q)
    const matchStatut = !filterStatut || l.statut === filterStatut
    return matchSearch && matchStatut
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('leads_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold">{leads.length}</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 sm:w-56">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-full" />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tous</option>
            {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {canManage && (
            <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
              <Plus className="h-4 w-4" /> {t('btn_new_lead')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16"><Users className="h-10 w-10 text-slate-200 mb-3" /><p className="text-slate-400 text-sm">{t('leads_empty')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('col_nom')}</th>
                  <th className="px-5 py-3 text-left">{t('col_entreprise')}</th>
                  <th className="px-5 py-3 text-left">{t('col_source')}</th>
                  <th className="px-5 py-3 text-left">{t('col_statut')}</th>
                  <th className="px-5 py-3 text-left">{t('col_score')}</th>
                  <th className="px-5 py-3 text-right">{t('col_valeur')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800">{l.nom}</p>
                      {l.email && <p className="text-xs text-slate-400">{l.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{l.entreprise ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{SOURCE_LABELS[l.source ?? ''] ?? l.source ?? '—'}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLOR[l.statut ?? 'nouveau']}`}>{STATUT_LABELS[l.statut ?? 'nouveau']}</span></td>
                    <td className="px-5 py-3">
                      {l.score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${l.score}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{l.score}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">{l.valeur_estimee ? `${fmt(l.valeur_estimee)} FCFA` : '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && l.statut !== 'converti' && (
                          <button onClick={() => convertir(l)} title={t('btn_convertir')} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><ArrowRightCircle className="h-4 w-4" /></button>
                        )}
                        {canManage && <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
                        {canDelete && <button onClick={() => deleteLead(l)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-bold text-slate-900">{editing ? t('modal_edit_lead') : t('modal_new_lead')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_nom')} *</label>
                  <input className={inputCls} value={lNom} onChange={e => setLNom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_email')}</label>
                  <input type="email" className={inputCls} value={lEmail} onChange={e => setLEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_telephone')}</label>
                  <input type="tel" className={inputCls} value={lTel} onChange={e => setLTel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_entreprise')}</label>
                  <input className={inputCls} value={lEntreprise} onChange={e => setLEntreprise(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_source')}</label>
                  <select className={selectCls} value={lSource} onChange={e => setLSource(e.target.value)}>
                    {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_statut')}</label>
                  <select className={selectCls} value={lStatut} onChange={e => setLStatut(e.target.value as LeadStatut)}>
                    {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_score')}</label>
                  <input type="number" min="0" max="100" className={inputCls} value={lScore} onChange={e => setLScore(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_valeur')}</label>
                  <input type="number" min="0" className={inputCls} value={lValeur} onChange={e => setLValeur(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                  <textarea rows={3} className={inputCls} value={lNotes} onChange={e => setLNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={save} disabled={saving || !lNom.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
