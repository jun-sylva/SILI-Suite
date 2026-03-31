'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  ClipboardList, Plus, Loader2, X, ChevronRight,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'

const fmtQte  = (n: number | null | undefined) => n != null ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n) : '—'
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')
const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

interface Inventaire {
  id: string; titre: string; date_inventaire: string; statut: string
  notes: string | null; created_at: string
  created_by_profile: { full_name: string } | null
  validated_by_profile: { full_name: string } | null
  _nbLignes?: number; _nbEcarts?: number
}

interface LigneSaisie {
  id: string; article_id: string; reference: string; designation: string; unite: string
  stock_theorique: number; stock_compte: number | null; ecart: number | null; adjusted: boolean
}

const STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  valide:    'bg-emerald-100 text-emerald-700',
  annule:    'bg-red-100 text-red-500',
}

export default function InventairePage() {
  const t      = useTranslations('stock')
  const params = useParams()

  const societeId   = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [inventaires,   setInventaires]   = useState<Inventaire[]>([])
  const [canManage,     setCanManage]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // ── Modal création ──────────────────────────────────────────
  const [showNew,    setShowNew]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [nTitre,     setNTitre]     = useState('')
  const [nDate,      setNDate]      = useState(new Date().toISOString().split('T')[0])
  const [nNotes,     setNNotes]     = useState('')

  // ── Vue détail inventaire ───────────────────────────────────
  const [selected,    setSelected]    = useState<Inventaire | null>(null)
  const [lignes,      setLignes]      = useState<LigneSaisie[]>([])
  const [loadingDet,  setLoadingDet]  = useState(false)
  const [validating,  setValidating]  = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId((profile as any)?.tenant_id ?? '')

      const isTenantAdmin = (profile as any)?.role === 'tenant_admin' || (profile as any)?.role === 'super_admin'
      if (isTenantAdmin) {
        setCanManage(true)
      } else {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'stock')
        setCanManage(['gestionnaire', 'admin'].includes(perm))
      }

      await loadInventaires()
      setLoading(false)
    }
    init()
  }, [societeId])

  async function notifyGestionnairesStock(titre: string, message: string, type = 'info') {
    const [{ data: perms }, { data: admins }] = await Promise.all([
      supabase.from('user_module_permissions').select('user_id').eq('societe_id', societeId).eq('module', 'stock').in('permission', ['gestionnaire', 'admin']),
      supabase.from('profiles').select('id').eq('tenant_id', fullTenantId).eq('role', 'tenant_admin'),
    ])
    const targets = [...(perms ?? []).map((p: any) => p.user_id), ...(admins ?? []).map((a: any) => a.id)]
      .filter((id, i, arr) => arr.indexOf(id) === i && id !== currentUserId)
    if (targets.length > 0)
      await supabase.from('notifications').insert(targets.map((uid: string) => ({
        tenant_id: fullTenantId, user_id: uid, type, titre, message,
      })))
  }

  const loadInventaires = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('stock_inventaires')
      .select('*, created_by_profile:created_by(full_name), validated_by_profile:validated_by(full_name)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    const invs: Inventaire[] = []
    for (const inv of data ?? []) {
      const { count: nbLignes } = await (supabase as any)
        .from('stock_inventaire_lignes').select('id', { count: 'exact', head: true }).eq('inventaire_id', inv.id)
      const { data: ecartData } = await (supabase as any)
        .from('stock_inventaire_lignes').select('ecart').eq('inventaire_id', inv.id).neq('ecart', 0)
      invs.push({ ...inv, _nbLignes: nbLignes ?? 0, _nbEcarts: (ecartData ?? []).length })
    }
    setInventaires(invs)
  }, [societeId])

  async function createInventaire() {
    if (!nTitre.trim()) { toast.error('Titre obligatoire'); return }
    setSaving(true)

    // Créer la session
    const { data: inv, error } = await (supabase as any)
      .from('stock_inventaires')
      .insert({ tenant_id: fullTenantId, societe_id: societeId, titre: nTitre.trim(), date_inventaire: nDate, notes: nNotes || null, created_by: currentUserId })
      .select().single()

    if (error || !inv) { toast.error(error?.message ?? 'Erreur création'); setSaving(false); return }

    // Peupler les lignes avec tous les articles actifs
    const { data: arts } = await (supabase as any)
      .from('stock_articles').select('id, stock_actuel').eq('societe_id', societeId).eq('is_active', true)

    if ((arts ?? []).length > 0) {
      await (supabase as any).from('stock_inventaire_lignes').insert(
        (arts ?? []).map((a: any) => ({ inventaire_id: inv.id, article_id: a.id, stock_theorique: a.stock_actuel, stock_compte: null }))
      )
    }

    await writeLog({
      tenantId:     fullTenantId,
      userId:       currentUserId,
      action:       'stock_inventaire_create',
      resourceType: 'stock_inventaires',
      metadata:     { titre: nTitre }
    })
    toast.success(t('inventaire_saved'))
    setShowNew(false)
    await loadInventaires()
    setSaving(false)
  }

  async function openDetail(inv: Inventaire) {
    setSelected(inv)
    setLoadingDet(true)
    const { data } = await (supabase as any)
      .from('stock_inventaire_lignes')
      .select('*, article:article_id(reference, designation, unite)')
      .eq('inventaire_id', inv.id)
      .order('article(designation)')

    setLignes(
      (data ?? []).map((l: any) => ({
        id: l.id, article_id: l.article_id,
        reference: l.article?.reference ?? '—', designation: l.article?.designation ?? '—', unite: l.article?.unite ?? '',
        stock_theorique: l.stock_theorique, stock_compte: l.stock_compte,
        ecart: l.ecart, adjusted: l.adjusted,
      }))
    )
    setLoadingDet(false)
  }

  async function saveLigne(ligneId: string, stockCompte: number | null) {
    await (supabase as any).from('stock_inventaire_lignes').update({ stock_compte: stockCompte }).eq('id', ligneId)
    setLignes(prev => prev.map(l => l.id === ligneId
      ? { ...l, stock_compte: stockCompte, ecart: stockCompte != null ? stockCompte - l.stock_theorique : null }
      : l
    ))
  }

  async function validateInventaire() {
    if (!selected) return
    setValidating(true)

    // Générer les mouvements d'ajustement pour les lignes avec écart ≠ 0 et non encore ajustées
    const lignesEcart = lignes.filter(l => l.stock_compte != null && l.ecart !== 0 && !l.adjusted)
    for (const l of lignesEcart) {
      const stockApres = l.stock_compte!
      await (supabase as any).from('stock_mouvements').insert({
        tenant_id: fullTenantId, societe_id: societeId,
        article_id: l.article_id, type_mouvement: 'inventaire',
        quantite: Math.abs(l.ecart!),
        stock_avant: l.stock_theorique, stock_apres: stockApres,
        motif: `Inventaire : ${selected.titre}`,
        reference_source: selected.id, created_by: currentUserId,
      })
      await (supabase as any).from('stock_inventaire_lignes').update({ adjusted: true }).eq('id', l.id)
    }

    // Valider
    await (supabase as any).from('stock_inventaires').update({
      statut: 'valide', validated_by: currentUserId, validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    await writeLog({
      tenantId:     fullTenantId,
      userId:       currentUserId,
      action:       'stock_inventaire_validate',
      resourceType: 'stock_inventaires',
      resourceId:   selected.id,
      metadata:     { titre: selected.titre, nb_ajustements: lignesEcart.length }
    })
    await notifyGestionnairesStock(
      'Inventaire validé',
      `L'inventaire "${selected.titre}" a été validé avec ${lignesEcart.length} ajustement(s) généré(s).`,
      'info'
    )
    toast.success(t('inventaire_validated'))
    setShowConfirm(false)
    setSelected(null)
    await loadInventaires()
    setValidating(false)
  }

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>

  // ── Vue détail ───────────────────────────────────────────────
  if (selected) {
    const nbEcarts = lignes.filter(l => l.stock_compte != null && l.ecart !== 0).length
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100">
              <ChevronRight className="h-4 w-4 text-slate-500 rotate-180" />
            </button>
            <div>
              <p className="font-bold text-slate-900">{selected.titre}</p>
              <p className="text-xs text-slate-400">{fmtDate(selected.date_inventaire)} — {lignes.length} article(s) — {nbEcarts} écart(s)</p>
            </div>
          </div>
          {canManage && selected.statut === 'brouillon' && (
            <button onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
              <CheckCircle2 className="h-4 w-4" /> {t('inventaire_validate')}
            </button>
          )}
        </div>

        {loadingDet ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('inv_col_reference')}</th>
                    <th className="px-4 py-3 text-left">{t('inv_col_designation')}</th>
                    <th className="px-4 py-3 text-right">{t('inv_col_theorique')}</th>
                    <th className="px-4 py-3 text-center">{t('inv_col_compte')}</th>
                    <th className="px-4 py-3 text-right">{t('inv_col_ecart')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map(l => {
                    const ecart = l.stock_compte != null ? l.stock_compte - l.stock_theorique : null
                    const ecartColor = ecart == null ? '' : ecart > 0 ? 'text-emerald-600' : ecart < 0 ? 'text-red-500' : 'text-slate-400'
                    return (
                      <tr key={l.id} className={`hover:bg-slate-50 ${l.adjusted ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.reference}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{l.designation}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmtQte(l.stock_theorique)} {l.unite}</td>
                        <td className="px-4 py-3 text-center">
                          {selected.statut === 'brouillon' && !l.adjusted ? (
                            <input
                              type="number" min="0" step="0.001"
                              defaultValue={l.stock_compte ?? ''}
                              onBlur={e => saveLigne(l.id, e.target.value !== '' ? parseFloat(e.target.value) : null)}
                              className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          ) : (
                            <span className={l.stock_compte != null ? 'font-medium text-slate-800' : 'text-slate-300'}>
                              {l.stock_compte != null ? `${fmtQte(l.stock_compte)} ${l.unite}` : '—'}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${ecartColor}`}>
                          {ecart == null ? '—' : ecart === 0 ? '±0' : `${ecart > 0 ? '+' : ''}${fmtQte(ecart)}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirm validation */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{t('inventaire_validate')}</p>
                  <p className="text-sm text-slate-500 mt-1">{t('inventaire_confirm_validate')}</p>
                  <p className="text-sm font-medium text-amber-700 mt-2">{nbEcarts} ajustement(s) seront générés.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowConfirm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
                <button onClick={validateInventaire} disabled={validating}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                  {validating && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vue liste ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
            <ClipboardList className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{t('inventaire_title')}</h1>
        </div>
        {canManage && (
          <button onClick={() => { setNTitre(''); setNDate(new Date().toISOString().split('T')[0]); setNNotes(''); setShowNew(true) }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
            <Plus className="h-4 w-4" /> {t('inventaire_new')}
          </button>
        )}
      </div>

      {inventaires.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-14 text-center text-sm text-slate-400">
          Aucune session d'inventaire. Créez-en une pour commencer.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t('col_titre')}</th>
                <th className="px-4 py-3 text-left">{t('col_date')}</th>
                <th className="px-4 py-3 text-center">{t('col_lignes')}</th>
                <th className="px-4 py-3 text-center">{t('col_ecart')}</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">{t('col_validated_by')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventaires.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{inv.titre}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(inv.date_inventaire)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{inv._nbLignes ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {(inv._nbEcarts ?? 0) > 0
                      ? <span className="inline-block rounded-full bg-orange-100 text-orange-600 text-xs font-semibold px-2 py-0.5">{inv._nbEcarts}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_BADGE[inv.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                      {inv.statut === 'brouillon' ? t('inv_statut_brouillon') : inv.statut === 'valide' ? t('inv_statut_valide') : t('inv_statut_annule')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{inv.validated_by_profile?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDetail(inv)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal créer inventaire */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{t('inventaire_new')}</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_titre')} *</label>
                <input value={nTitre} onChange={e => setNTitre(e.target.value)} className={inputCls} placeholder="Ex: Inventaire mensuel mars 2026" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_date_inventaire')}</label>
                <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_notes')}</label>
                <textarea value={nNotes} onChange={e => setNNotes(e.target.value)} rows={2} className={inputCls} />
              </div>
              <p className="text-xs text-slate-400">La session sera initialisée avec le stock actuel de tous les articles actifs.</p>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowNew(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={createInventaire} disabled={saving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
