'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { Receipt, ArrowLeft, Plus, Trash2, Loader2, Save, Send, XCircle, CreditCard, X } from 'lucide-react'

interface Ligne {
  id?: string; ordre: number; designation: string; description: string
  quantite: number; prix_unitaire: number; remise_pct: number; montant_ht: number
}

interface Paiement {
  id: string; montant: number; mode_paiement: string
  date_paiement: string; reference: string | null; notes: string | null
}

function calcHt(l: Ligne) { return l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100) }

function calcTotals(lignes: Ligne[], remiseGlobale: number, tvaPct: number) {
  const sousTotalHt = lignes.reduce((s, l) => s + calcHt(l), 0)
  const remiseAmt   = sousTotalHt * remiseGlobale / 100
  const totalHt     = sousTotalHt - remiseAmt
  const tvaAmt      = totalHt * tvaPct / 100
  return { sousTotalHt, remiseAmt, totalHt, tvaAmt, totalTtc: totalHt + tvaAmt }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
}

const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const inlineCls = 'w-full text-sm outline-none bg-transparent border-b border-transparent focus:border-indigo-400'
const inlineRCls = 'w-full text-sm text-right outline-none bg-transparent border-b border-transparent focus:border-indigo-400'

const statutColor: Record<string, string> = {
  brouillon:           'bg-slate-100  text-slate-600',
  emise:               'bg-blue-50    text-blue-700',
  partiellement_payee: 'bg-yellow-50  text-yellow-700',
  payee:               'bg-green-50   text-green-700',
  en_retard:           'bg-red-50     text-red-600',
  annulee:             'bg-slate-100  text-slate-400',
}

const MODES = ['virement', 'especes', 'cheque', 'mobile_money', 'carte']

export default function FactureDetailPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const router    = useRouter()
  const societeId   = params.societe_id as string
  const factureId   = params.facture_id as string
  const isNew       = factureId === 'nouveau'
  const baseUrl     = `/${params.locale}/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${params.societe_id}/crm`

  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [canManage,     setCanManage]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Facture fields
  const [objet,              setObjet]              = useState('')
  const [clientNom,          setClientNom]          = useState('')
  const [dateEmission,       setDateEmission]       = useState(new Date().toISOString().slice(0, 10))
  const [dateEcheance,       setDateEcheance]       = useState('')
  const [remiseGlobale,      setRemiseGlobale]      = useState(0)
  const [tvaPct,             setTvaPct]             = useState(19.25)
  const [notes,              setNotes]              = useState('')
  const [conditions,         setConditions]         = useState('')
  const [statut,             setStatut]             = useState('brouillon')
  const [numero,             setNumero]             = useState<string | null>(null)
  const [montantPaye,        setMontantPaye]        = useState(0)
  const [montantRestant,     setMontantRestant]     = useState(0)

  const [lignes, setLignes] = useState<Ligne[]>([
    { ordre: 0, designation: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, montant_ht: 0 },
  ])

  // Paiements
  const [paiements,    setPaiements]    = useState<Paiement[]>([])
  const [showPaiModal, setShowPaiModal] = useState(false)
  const [savingPai,    setSavingPai]    = useState(false)
  const [pMontant,     setPMontant]     = useState('')
  const [pMode,        setPMode]        = useState('virement')
  const [pDate,        setPDate]        = useState(new Date().toISOString().slice(0, 10))
  const [pReference,   setPReference]   = useState('')
  const [pNotes,       setPNotes]       = useState('')

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
      } else { setCanManage(true) }

      if (!isNew) {
        const { data: f } = await supabase.from('crm_factures').select('*').eq('id', factureId).single()
        if (f) {
          setObjet(f.objet); setClientNom(f.client_nom ?? '')
          setDateEmission(f.date_emission); setDateEcheance(f.date_echeance ?? '')
          setRemiseGlobale(f.remise_globale); setTvaPct(f.tva_pct)
          setNotes(f.notes ?? ''); setConditions(f.conditions_paiement ?? '')
          setStatut(f.statut); setNumero(f.numero)
          setMontantPaye(f.montant_paye); setMontantRestant(f.montant_restant)
        }
        const [resLignes, resPaiements] = await Promise.all([
          supabase.from('crm_factures_lignes').select('*').eq('facture_id', factureId).order('ordre'),
          supabase.from('crm_paiements').select('*').eq('facture_id', factureId).order('date_paiement', { ascending: false }),
        ])
        if (resLignes.data && resLignes.data.length > 0)
          setLignes(resLignes.data.map(l => ({ ...l, description: l.description ?? '' })))
        setPaiements((resPaiements.data ?? []) as Paiement[])
      }
      setLoading(false)
    }
    init()
  }, [factureId, societeId])

  const { sousTotalHt, remiseAmt, totalHt, tvaAmt, totalTtc } = calcTotals(lignes, remiseGlobale, tvaPct)
  const editable = isNew || (canManage && statut === 'brouillon')

  function addLigne() {
    setLignes(prev => [...prev, { ordre: prev.length, designation: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, montant_ht: 0 }])
  }
  function removeLigne(idx: number) { setLignes(prev => prev.filter((_, i) => i !== idx)) }
  function updateLigne(idx: number, field: keyof Ligne, value: string | number) {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const u = { ...l, [field]: value }
      u.montant_ht = calcHt(u)
      return u
    }))
  }

  async function save() {
    if (!objet.trim()) return
    setSaving(true)
    const payload = {
      objet: objet.trim(), client_nom: clientNom.trim() || null,
      date_emission: dateEmission, date_echeance: dateEcheance || null,
      remise_globale: remiseGlobale, tva_pct: tvaPct,
      montant_ht: Math.round(totalHt * 100) / 100,
      montant_ttc: Math.round(totalTtc * 100) / 100,
      montant_restant: Math.round(totalTtc * 100) / 100,
      notes: notes.trim() || null,
      conditions_paiement: conditions.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    let savedId = factureId
    if (isNew) {
      const { data: nf, error } = await supabase.from('crm_factures').insert(payload as any).select('id,numero').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      savedId = nf.id; setNumero(nf.numero); setStatut('brouillon')
      toast.success(t('toast_facture_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'facture_created', resourceType: 'crm_factures', resourceId: nf.id, metadata: { objet: objet.trim(), numero: nf.numero } })
    } else {
      const { error } = await supabase.from('crm_factures').update({ ...payload, updated_at: new Date().toISOString() } as any).eq('id', factureId)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_facture_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'facture_updated', resourceType: 'crm_factures', resourceId: factureId, metadata: { objet: objet.trim() } })
    }

    await supabase.from('crm_factures_lignes').delete().eq('facture_id', savedId)
    const lignesPayload = lignes
      .filter(l => l.designation.trim())
      .map((l, i) => ({
        facture_id: savedId, ordre: i,
        designation: l.designation.trim(), description: l.description.trim() || null,
        quantite: l.quantite, prix_unitaire: l.prix_unitaire,
        remise_pct: l.remise_pct, montant_ht: Math.round(calcHt(l) * 100) / 100,
      }))
    if (lignesPayload.length > 0) await supabase.from('crm_factures_lignes').insert(lignesPayload as any)

    setSaving(false)
    if (isNew) router.replace(`${baseUrl}/factures/${savedId}`)
  }

  async function emettre() {
    const { error } = await supabase.from('crm_factures').update({ statut: 'emise', updated_at: new Date().toISOString() } as any).eq('id', factureId)
    if (error) { toast.error(t('toast_error')); return }
    setStatut('emise')
    toast.success(t('toast_facture_emise'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'facture_emise', resourceType: 'crm_factures', resourceId: factureId, metadata: { objet } })
  }

  async function annuler() {
    if (!confirm(t('confirm_annuler_facture'))) return
    const { error } = await supabase.from('crm_factures').update({ statut: 'annulee', updated_at: new Date().toISOString() } as any).eq('id', factureId)
    if (error) { toast.error(t('toast_error')); return }
    setStatut('annulee')
    toast.success(t('toast_facture_annulee'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'facture_annulee', resourceType: 'crm_factures', resourceId: factureId, metadata: { objet } })
  }

  async function savePaiement() {
    if (!pMontant || Number(pMontant) <= 0) return
    setSavingPai(true)
    const payload = {
      facture_id: factureId, societe_id: societeId, tenant_id: fullTenantId,
      montant: Number(pMontant), mode_paiement: pMode, date_paiement: pDate,
      reference: pReference.trim() || null, notes: pNotes.trim() || null,
      enregistre_par: currentUserId,
    }
    const { data: np, error } = await supabase.from('crm_paiements').insert(payload as any).select('id').single()
    if (error) { toast.error(t('toast_error')); setSavingPai(false); return }
    toast.success(t('toast_paiement_created'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'paiement_created', resourceType: 'crm_paiements', resourceId: np?.id, metadata: { montant: Number(pMontant), facture_id: factureId } })
    setShowPaiModal(false); setSavingPai(false)

    // Reload facture (trigger recalculated statut/montants)
    const { data: updated } = await supabase.from('crm_factures').select('statut,montant_paye,montant_restant').eq('id', factureId).single()
    if (updated) { setStatut(updated.statut); setMontantPaye(updated.montant_paye); setMontantRestant(updated.montant_restant) }
    const { data: ps } = await supabase.from('crm_paiements').select('*').eq('facture_id', factureId).order('date_paiement', { ascending: false })
    setPaiements((ps ?? []) as Paiement[])
  }

  async function deletePaiement(p: Paiement) {
    if (!confirm(t('confirm_delete_paiement'))) return
    const { error } = await supabase.from('crm_paiements').delete().eq('id', p.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_paiement_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'paiement_deleted', resourceType: 'crm_paiements', resourceId: p.id, metadata: { montant: p.montant } })
    const { data: updated } = await supabase.from('crm_factures').select('statut,montant_paye,montant_restant').eq('id', factureId).single()
    if (updated) { setStatut(updated.statut); setMontantPaye(updated.montant_paye); setMontantRestant(updated.montant_restant) }
    const { data: ps } = await supabase.from('crm_paiements').select('*').eq('facture_id', factureId).order('date_paiement', { ascending: false })
    setPaiements((ps ?? []) as Paiement[])
  }

  function openPaiModal() {
    setPMontant(String(montantRestant > 0 ? montantRestant : ''))
    setPMode('virement'); setPDate(new Date().toISOString().slice(0, 10)); setPReference(''); setPNotes('')
    setShowPaiModal(true)
  }

  const pct = totalTtc > 0 ? Math.min(100, Math.round(montantPaye / totalTtc * 100)) : 0

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`${baseUrl}/factures`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900">{isNew ? t('btn_new_facture') : (numero ?? '—')}</h1>
              {!isNew && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statutColor[statut] ?? ''}`}>
                  {t(`statut_${statut}` as any)}
                </span>
              )}
            </div>
            {!isNew && <p className="text-xs text-slate-500">{objet}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && statut === 'brouillon' && canManage && (
            <button onClick={emettre}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50">
              <Send className="h-4 w-4" /> {t('btn_emettre')}
            </button>
          )}
          {!isNew && ['emise', 'partiellement_payee', 'en_retard'].includes(statut) && canManage && (
            <>
              <button onClick={openPaiModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                <CreditCard className="h-4 w-4" /> {t('btn_enregistrer_paiement')}
              </button>
              <button onClick={annuler}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">
                <XCircle className="h-4 w-4" /> {t('btn_annuler_facture')}
              </button>
            </>
          )}
          {editable && (
            <button onClick={save} disabled={saving || !objet.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('btn_save')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Left: form + lignes + paiements */}
        <div className="col-span-2 space-y-5">
          {/* Header fields */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_objet')} *</label>
                <input className={inputCls} value={objet} onChange={e => setObjet(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_client_nom')}</label>
                <input className={inputCls} value={clientNom} onChange={e => setClientNom(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_emission')}</label>
                <input type="date" className={inputCls} value={dateEmission} onChange={e => setDateEmission(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_echeance')}</label>
                <input type="date" className={inputCls} value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_tva')} (%)</label>
                <input type="number" step="0.01" className={inputCls} value={tvaPct} onChange={e => setTvaPct(Number(e.target.value))} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_remise_globale')}</label>
                <input type="number" step="0.01" className={inputCls} value={remiseGlobale} onChange={e => setRemiseGlobale(Number(e.target.value))} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_conditions')}</label>
                <input className={inputCls} value={conditions} onChange={e => setConditions(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} disabled={!editable} />
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Lignes</h2>
              {editable && (
                <button onClick={addLigne} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                  <Plus className="h-3.5 w-3.5" /> {t('btn_add_ligne')}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="px-4 py-2 text-left font-semibold w-[28%]">{t('ligne_designation')}</th>
                    <th className="px-4 py-2 text-left font-semibold w-[18%]">{t('ligne_description')}</th>
                    <th className="px-4 py-2 text-right font-semibold w-[9%]">{t('ligne_quantite')}</th>
                    <th className="px-4 py-2 text-right font-semibold w-[15%]">{t('ligne_prix_unit')}</th>
                    <th className="px-4 py-2 text-right font-semibold w-[9%]">{t('ligne_remise')}</th>
                    <th className="px-4 py-2 text-right font-semibold w-[13%]">{t('ligne_montant_ht')}</th>
                    {editable && <th className="w-9" />}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-4 py-2">
                        {editable
                          ? <input className={inlineCls} value={l.designation} placeholder="Désignation…" onChange={e => updateLigne(i, 'designation', e.target.value)} />
                          : <span>{l.designation}</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {editable
                          ? <input className={inlineCls} value={l.description} placeholder="Description…" onChange={e => updateLigne(i, 'description', e.target.value)} />
                          : <span>{l.description}</span>}
                      </td>
                      <td className="px-4 py-2">
                        {editable
                          ? <input type="number" className={inlineRCls} value={l.quantite} onChange={e => updateLigne(i, 'quantite', Number(e.target.value))} />
                          : <span className="block text-right">{l.quantite}</span>}
                      </td>
                      <td className="px-4 py-2">
                        {editable
                          ? <input type="number" className={inlineRCls} value={l.prix_unitaire} onChange={e => updateLigne(i, 'prix_unitaire', Number(e.target.value))} />
                          : <span className="block text-right font-mono">{fmt(l.prix_unitaire)}</span>}
                      </td>
                      <td className="px-4 py-2">
                        {editable
                          ? <input type="number" className={inlineRCls} value={l.remise_pct} onChange={e => updateLigne(i, 'remise_pct', Number(e.target.value))} />
                          : <span className="block text-right">{l.remise_pct}%</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold font-mono text-slate-800">{fmt(calcHt(l))}</td>
                      {editable && (
                        <td className="px-2 py-2">
                          <button onClick={() => removeLigne(i)} className="p-1 rounded hover:bg-red-50 text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paiements reçus */}
          {!isNew && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 text-sm">{t('paiements_recus')}</h2>
                <span className="text-xs text-slate-400">{paiements.length} paiement(s)</span>
              </div>
              {paiements.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-slate-400">{t('paiements_empty')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                      <th className="px-4 py-2 text-left font-semibold">{t('col_date')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('col_mode')}</th>
                      <th className="px-4 py-2 text-left font-semibold">{t('field_reference')}</th>
                      <th className="px-4 py-2 text-right font-semibold">{t('field_montant')}</th>
                      {canManage && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {paiements.map(p => (
                      <tr key={p.id} className="border-b border-slate-50">
                        <td className="px-4 py-2 text-slate-600 text-xs">{p.date_paiement}</td>
                        <td className="px-4 py-2 text-slate-600">{t(`mode_${p.mode_paiement}` as any)}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{p.reference ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold font-mono text-emerald-700">{fmt(p.montant)}</td>
                        {canManage && (
                          <td className="px-2 py-2">
                            <button onClick={() => deletePaiement(p)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Right: totals + progression */}
        <div className="space-y-4 sticky top-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{t('sous_total_ht')}</span>
              <span className="font-mono">{fmt(sousTotalHt)}</span>
            </div>
            {remiseGlobale > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{t('remise_globale')} ({remiseGlobale}%)</span>
                <span className="font-mono">− {fmt(remiseAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-700 border-t border-slate-100 pt-2">
              <span className="font-semibold">{t('total_ht')}</span>
              <span className="font-mono font-semibold">{fmt(totalHt)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t('tva')} ({tvaPct}%)</span>
              <span className="font-mono">{fmt(tvaAmt)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-base border-t border-slate-200 pt-3">
              <span>{t('total_ttc')}</span>
              <span className="font-mono">{fmt(totalTtc)} FCFA</span>
            </div>
          </div>

          {!isNew && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-sm">
              <h3 className="font-semibold text-slate-700">{t('progression_paiement')}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>{t('paiements_recus')}</span>
                  <span className="font-mono font-semibold text-emerald-700">{fmt(montantPaye)}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{pct}% payé</span>
                  <span>{100 - pct}% restant</span>
                </div>
                <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-100 pt-2">
                  <span>{t('reste_du')}</span>
                  <span className="font-mono text-red-600">{fmt(montantRestant)} FCFA</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal paiement */}
      {showPaiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{t('modal_new_paiement')}</h2>
              <button onClick={() => setShowPaiModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
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
              <button onClick={() => setShowPaiModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={savePaiement} disabled={savingPai || !pMontant || Number(pMontant) <= 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {savingPai ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
