'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { FileText, ArrowLeft, Plus, Trash2, Loader2, Save, CheckCircle, XCircle, Send, FileCheck } from 'lucide-react'

interface Ligne {
  id?: string; ordre: number; designation: string; description: string
  quantite: number; prix_unitaire: number; remise_pct: number; montant_ht: number
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

const inputCls   = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const inlineCls  = 'w-full text-sm outline-none bg-transparent border-b border-transparent focus:border-indigo-400'
const inlineRCls = 'w-full text-sm text-right outline-none bg-transparent border-b border-transparent focus:border-indigo-400'

const statutColor: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  envoye:    'bg-blue-50  text-blue-700',
  accepte:   'bg-green-50 text-green-700',
  refuse:    'bg-red-50   text-red-600',
  expire:    'bg-orange-50 text-orange-600',
}

export default function DevisDetailPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const router    = useRouter()
  const societeId = params.societe_id as string
  const devisId   = params.devis_id as string
  const isNew     = devisId === 'nouveau'
  const baseUrl   = `/${params.locale}/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${params.societe_id}/crm`

  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [canManage,     setCanManage]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [objet,          setObjet]          = useState('')
  const [clientNom,      setClientNom]      = useState('')
  const [dateEmission,   setDateEmission]   = useState(new Date().toISOString().slice(0, 10))
  const [dateExpiration, setDateExpiration] = useState('')
  const [remiseGlobale,  setRemiseGlobale]  = useState(0)
  const [tvaPct,         setTvaPct]         = useState(19.25)
  const [notes,          setNotes]          = useState('')
  const [statut,         setStatut]         = useState('brouillon')
  const [numero,         setNumero]         = useState<string | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([
    { ordre: 0, designation: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, montant_ht: 0 },
  ])

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
        const { data: d } = await supabase.from('crm_devis').select('*').eq('id', devisId).single()
        if (d) {
          setObjet(d.objet); setClientNom(d.client_nom ?? '')
          setDateEmission(d.date_emission); setDateExpiration(d.date_expiration ?? '')
          setRemiseGlobale(d.remise_globale); setTvaPct(d.tva_pct)
          setNotes(d.notes ?? ''); setStatut(d.statut); setNumero(d.numero)
        }
        const { data: ls } = await supabase.from('crm_devis_lignes').select('*').eq('devis_id', devisId).order('ordre')
        if (ls && ls.length > 0) setLignes(ls.map(l => ({ ...l, description: l.description ?? '' })))
      }
      setLoading(false)
    }
    init()
  }, [devisId, societeId])

  const editable = isNew || (canManage && statut === 'brouillon')

  function addLigne() {
    setLignes(prev => [...prev, { ordre: prev.length, designation: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, montant_ht: 0 }])
  }

  function removeLigne(idx: number) {
    setLignes(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLigne(idx: number, field: keyof Ligne, value: string | number) {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const u = { ...l, [field]: value }
      u.montant_ht = calcHt(u)
      return u
    }))
  }

  const { sousTotalHt, remiseAmt, totalHt, tvaAmt, totalTtc } = calcTotals(lignes, remiseGlobale, tvaPct)

  async function save() {
    if (!objet.trim()) return
    setSaving(true)
    const payload = {
      objet: objet.trim(), client_nom: clientNom.trim() || null,
      date_emission: dateEmission, date_expiration: dateExpiration || null,
      remise_globale: remiseGlobale, tva_pct: tvaPct,
      montant_ht: Math.round(totalHt * 100) / 100,
      montant_ttc: Math.round(totalTtc * 100) / 100,
      notes: notes.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    let savedId = devisId
    if (isNew) {
      const { data: nd, error } = await supabase.from('crm_devis').insert(payload as any).select('id,numero').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      savedId = nd.id; setNumero(nd.numero); setStatut('brouillon')
      toast.success(t('toast_devis_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'devis_created', resourceType: 'crm_devis', resourceId: nd.id, metadata: { objet: objet.trim(), numero: nd.numero } })
    } else {
      const { error } = await supabase.from('crm_devis').update({ ...payload, updated_at: new Date().toISOString() } as any).eq('id', devisId)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_devis_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'devis_updated', resourceType: 'crm_devis', resourceId: devisId, metadata: { objet: objet.trim() } })
    }

    // Replace lignes
    await supabase.from('crm_devis_lignes').delete().eq('devis_id', savedId)
    const lignesPayload = lignes
      .filter(l => l.designation.trim())
      .map((l, i) => ({
        devis_id: savedId, ordre: i,
        designation: l.designation.trim(), description: l.description.trim() || null,
        quantite: l.quantite, prix_unitaire: l.prix_unitaire,
        remise_pct: l.remise_pct, montant_ht: Math.round(calcHt(l) * 100) / 100,
      }))
    if (lignesPayload.length > 0) await supabase.from('crm_devis_lignes').insert(lignesPayload as any)

    setSaving(false)
    if (isNew) router.replace(`${baseUrl}/devis/${savedId}`)
  }

  async function changeStatut(newStatut: string, toastKey: string, logAction: string) {
    const { error } = await supabase.from('crm_devis').update({ statut: newStatut, updated_at: new Date().toISOString() } as any).eq('id', devisId)
    if (error) { toast.error(t('toast_error')); return }
    setStatut(newStatut)
    toast.success(t(toastKey as any))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: logAction, resourceType: 'crm_devis', resourceId: devisId, metadata: { objet } })
  }

  async function creerFacture() {
    const payload = {
      devis_id: devisId, objet, client_nom: clientNom || null,
      date_emission: new Date().toISOString().slice(0, 10),
      remise_globale: remiseGlobale, tva_pct: tvaPct,
      montant_ht: Math.round(totalHt * 100) / 100,
      montant_ttc: Math.round(totalTtc * 100) / 100,
      montant_paye: 0, montant_restant: Math.round(totalTtc * 100) / 100,
      notes: notes || null, statut: 'emise',
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    const { data: nf, error } = await supabase.from('crm_factures').insert(payload as any).select('id,numero').single()
    if (error) { toast.error(t('toast_error')); return }

    const fLignes = lignes
      .filter(l => l.designation.trim())
      .map((l, i) => ({
        facture_id: nf.id, ordre: i, designation: l.designation.trim(),
        description: l.description.trim() || null, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, remise_pct: l.remise_pct,
        montant_ht: Math.round(calcHt(l) * 100) / 100,
      }))
    if (fLignes.length > 0) await supabase.from('crm_factures_lignes').insert(fLignes as any)

    toast.success(t('toast_facture_created'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'facture_created_from_devis', resourceType: 'crm_factures', resourceId: nf.id, metadata: { devis_id: devisId, numero: nf.numero } })
    router.push(`${baseUrl}/factures/${nf.id}`)
  }

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`${baseUrl}/devis`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900">{isNew ? t('btn_new_devis') : (numero ?? '—')}</h1>
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
            <button onClick={() => changeStatut('envoye', 'toast_devis_envoye', 'devis_envoye')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50">
              <Send className="h-4 w-4" /> {t('btn_envoyer')}
            </button>
          )}
          {!isNew && statut === 'envoye' && canManage && (<>
            <button onClick={() => changeStatut('accepte', 'toast_devis_accepte', 'devis_accepte')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50">
              <CheckCircle className="h-4 w-4" /> {t('btn_accepter')}
            </button>
            <button onClick={() => changeStatut('refuse', 'toast_devis_refuse', 'devis_refuse')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">
              <XCircle className="h-4 w-4" /> {t('btn_refuser')}
            </button>
          </>)}
          {!isNew && statut === 'accepte' && canManage && (
            <button onClick={creerFacture}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
              <FileCheck className="h-4 w-4" /> {t('btn_creer_facture')}
            </button>
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
        {/* Left: form + lignes */}
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_expiration')}</label>
                <input type="date" className={inputCls} value={dateExpiration} onChange={e => setDateExpiration(e.target.value)} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_tva')} (%)</label>
                <input type="number" step="0.01" className={inputCls} value={tvaPct} onChange={e => setTvaPct(Number(e.target.value))} disabled={!editable} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_remise_globale')}</label>
                <input type="number" step="0.01" className={inputCls} value={remiseGlobale} onChange={e => setRemiseGlobale(Number(e.target.value))} disabled={!editable} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} disabled={!editable} />
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
        </div>

        {/* Right: totals */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 text-sm sticky top-4">
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
      </div>
    </div>
  )
}
