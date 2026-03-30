'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { CreditCard, Loader2, Search, X, Trash2, Plus } from 'lucide-react'

interface Paiement {
  id: string; montant: number; mode_paiement: string
  date_paiement: string; reference: string | null; notes: string | null
  facture_id: string
  crm_factures: { numero: string | null; objet: string; client_nom: string | null } | null
}

interface Facture {
  id: string; numero: string | null; objet: string; client_nom: string | null
  montant_ttc: number; montant_restant: number; statut: string
}

const MODES = ['virement', 'especes', 'cheque', 'mobile_money', 'carte']

const modeColor: Record<string, string> = {
  virement:     'bg-blue-50   text-blue-700',
  especes:      'bg-green-50  text-green-700',
  cheque:       'bg-purple-50 text-purple-700',
  mobile_money: 'bg-orange-50 text-orange-700',
  carte:        'bg-pink-50   text-pink-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

const inputCls = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function PaiementsPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,      setLoading]      = useState(true)
  const [paiements,    setPaiements]    = useState<Paiement[]>([])
  const [search,       setSearch]       = useState('')
  const [canManage,    setCanManage]    = useState(false)
  const [canDelete,    setCanDelete]    = useState(false)
  const [fullTenantId, setFullTenantId] = useState('')
  const [userId,       setUserId]       = useState('')

  // KPIs
  const [encaisseMois, setEncaisseMois] = useState(0)
  const [encaisseTrim, setEncaisseTrim] = useState(0)
  const [enAttente,    setEnAttente]    = useState(0)

  // Modal
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [factures,   setFactures]   = useState<Facture[]>([])
  const [pFactureId, setPFactureId] = useState('')
  const [pMontant,   setPMontant]   = useState('')
  const [pMode,      setPMode]      = useState('virement')
  const [pDate,      setPDate]      = useState(new Date().toISOString().slice(0, 10))
  const [pReference, setPReference] = useState('')
  const [pNotes,     setPNotes]     = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'crm')
        setCanManage(['contributeur', 'gestionnaire', 'admin'].includes(perm))
        setCanDelete(['gestionnaire', 'admin'].includes(perm))
      } else { setCanManage(true); setCanDelete(true) }
      await Promise.all([loadPaiements(), loadKpis()])
      setLoading(false)
    }
    init()
  }, [societeId])

  const loadPaiements = useCallback(async () => {
    const { data } = await supabase
      .from('crm_paiements')
      .select('id,montant,mode_paiement,date_paiement,reference,notes,facture_id,crm_factures(numero,objet,client_nom)')
      .eq('societe_id', societeId)
      .order('date_paiement', { ascending: false })
    setPaiements((data ?? []) as Paiement[])
  }, [societeId])

  const loadKpis = useCallback(async () => {
    const now = new Date()
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const debutTrim = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10)

    const [resMois, resTrim, resAttente] = await Promise.all([
      supabase.from('crm_paiements').select('montant').eq('societe_id', societeId).gte('date_paiement', debutMois),
      supabase.from('crm_paiements').select('montant').eq('societe_id', societeId).gte('date_paiement', debutTrim),
      supabase.from('crm_factures').select('montant_restant').eq('societe_id', societeId).in('statut', ['emise', 'partiellement_payee', 'en_retard']),
    ])
    setEncaisseMois((resMois.data ?? []).reduce((s, r) => s + r.montant, 0))
    setEncaisseTrim((resTrim.data ?? []).reduce((s, r) => s + r.montant, 0))
    setEnAttente((resAttente.data ?? []).reduce((s, r) => s + r.montant_restant, 0))
  }, [societeId])

  async function openModal() {
    const { data } = await supabase
      .from('crm_factures')
      .select('id,numero,objet,client_nom,montant_ttc,montant_restant,statut')
      .eq('societe_id', societeId)
      .in('statut', ['emise', 'partiellement_payee', 'en_retard'])
      .order('created_at', { ascending: false })
    setFactures((data ?? []) as Facture[])
    setPFactureId(''); setPMontant(''); setPMode('virement')
    setPDate(new Date().toISOString().slice(0, 10)); setPReference(''); setPNotes('')
    setShowModal(true)
  }

  async function savePaiement() {
    if (!pFactureId || !pMontant || Number(pMontant) <= 0) return
    setSaving(true)
    const payload = {
      facture_id: pFactureId, societe_id: societeId, tenant_id: fullTenantId,
      montant: Number(pMontant), mode_paiement: pMode, date_paiement: pDate,
      reference: pReference.trim() || null, notes: pNotes.trim() || null,
      enregistre_par: userId,
    }
    const { data: np, error } = await supabase.from('crm_paiements').insert(payload as any).select('id').single()
    if (error) { toast.error(t('toast_error')); setSaving(false); return }
    toast.success(t('toast_paiement_created'))
    await writeLog({ tenantId: fullTenantId, userId, action: 'paiement_created', resourceType: 'crm_paiements', resourceId: np?.id, metadata: { montant: Number(pMontant), facture_id: pFactureId } })
    setShowModal(false); setSaving(false)
    await Promise.all([loadPaiements(), loadKpis()])
  }

  async function deletePaiement(p: Paiement) {
    if (!confirm(t('confirm_delete_paiement'))) return
    const { error } = await supabase.from('crm_paiements').delete().eq('id', p.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_paiement_deleted'))
    await writeLog({ tenantId: fullTenantId, userId, action: 'paiement_deleted', resourceType: 'crm_paiements', resourceId: p.id, metadata: { montant: p.montant } })
    await Promise.all([loadPaiements(), loadKpis()])
  }

  const filtered = paiements.filter(p => {
    const q = search.toLowerCase()
    return !q
      || (p.reference ?? '').toLowerCase().includes(q)
      || (p.crm_factures?.numero ?? '').toLowerCase().includes(q)
      || (p.crm_factures?.client_nom ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('kpi_encaisse_mois'), value: fmt(encaisseMois), color: 'text-emerald-600' },
          { label: t('kpi_encaisse_trim'), value: fmt(encaisseTrim), color: 'text-indigo-600' },
          { label: t('kpi_en_attente'),    value: fmt(enAttente),    color: 'text-orange-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400">FCFA</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('paiements_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">{paiements.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-52">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-full" />
          </div>
          {canManage && (
            <button onClick={openModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="h-4 w-4" /> {t('btn_new_paiement')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16">
          <CreditCard className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-400 text-sm">{t('paiements_empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">{t('col_date')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_facture')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_client')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('field_reference')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_mode')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('field_montant')}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 text-xs">{p.date_paiement}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">{p.crm_factures?.numero ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.crm_factures?.client_nom ?? p.crm_factures?.objet ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.reference ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modeColor[p.mode_paiement] ?? 'bg-slate-100 text-slate-500'}`}>
                      {t(`mode_${p.mode_paiement}` as any)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold font-mono text-emerald-700">{fmt(p.montant)}</td>
                  <td className="px-4 py-3">
                    {canDelete && (
                      <button onClick={() => deletePaiement(p)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{t('modal_new_paiement')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_facture')} *</label>
                <select value={pFactureId} onChange={e => {
                  setPFactureId(e.target.value)
                  const f = factures.find(f => f.id === e.target.value)
                  if (f) setPMontant(String(f.montant_restant))
                }} className={inputCls}>
                  <option value="">— Choisir une facture —</option>
                  {factures.map(f => (
                    <option key={f.id} value={f.id}>{f.numero ?? f.id.slice(0, 8)} — {f.client_nom ?? f.objet} — Reste: {fmt(f.montant_restant)} FCFA</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_montant')} *</label>
                  <input type="number" className={inputCls} value={pMontant} onChange={e => setPMontant(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_paiement')}</label>
                  <input type="date" className={inputCls} value={pDate} onChange={e => setPDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_mode_paiement')}</label>
                  <select value={pMode} onChange={e => setPMode(e.target.value)} className={inputCls}>
                    {MODES.map(m => <option key={m} value={m}>{t(`mode_${m}` as any)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_reference')}</label>
                  <input className={inputCls} value={pReference} onChange={e => setPReference(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                  <textarea rows={2} className={inputCls} value={pNotes} onChange={e => setPNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={savePaiement} disabled={saving || !pFactureId || !pMontant || Number(pMontant) <= 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
