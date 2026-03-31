'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  AlertTriangle, Download, ArrowDownCircle, Loader2, X,
} from 'lucide-react'

const fmtQte = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)
const inputCls = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

interface AlerteArticle {
  id: string; reference: string; designation: string; categorie: string | null
  stock_actuel: number; stock_minimum: number; stock_maximum: number | null; unite: string
  prix_achat: number; emplacement: string | null
}

type Criticite = 'rupture' | 'critique' | 'alerte'

function criticite(a: AlerteArticle): Criticite {
  if (a.stock_actuel <= 0) return 'rupture'
  if (a.stock_actuel < a.stock_minimum * 0.5) return 'critique'
  return 'alerte'
}

const CRIT_BADGE: Record<Criticite, string> = {
  rupture:  'bg-red-100 text-red-700 border border-red-200',
  critique: 'bg-orange-100 text-orange-700 border border-orange-200',
  alerte:   'bg-amber-100 text-amber-700 border border-amber-200',
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AlertesPage() {
  const t      = useTranslations('stock')
  const params = useParams()

  const societeId   = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [alertes,       setAlertes]       = useState<AlerteArticle[]>([])
  const [canContrib,    setCanContrib]    = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Modal réapprovisionnement
  const [showModal,   setShowModal]   = useState(false)
  const [reapproArt,  setReapproArt]  = useState<AlerteArticle | null>(null)
  const [reapproQte,  setReapproQte]  = useState('')
  const [reapproPrix, setReapproPrix] = useState('')
  const [reapproRef,  setReapproRef]  = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId((profile as any)?.tenant_id ?? '')

      const isTenantAdmin = (profile as any)?.role === 'tenant_admin' || (profile as any)?.role === 'super_admin'
      if (isTenantAdmin) {
        setCanContrib(true)
      } else {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'stock')
        setCanContrib(['contributeur', 'gestionnaire', 'admin'].includes(perm))
      }

      await loadAlertes()
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

  async function loadAlertes() {
    const { data: arts } = await (supabase as any)
      .from('stock_articles')
      .select('*')
      .eq('societe_id', societeId)
      .eq('is_active', true)
      .order('stock_actuel', { ascending: true })

    // Filtrer client-side car comparaison de colonnes non triviale en PostgREST
    const alerteArts = (arts ?? []).filter((a: any) => a.stock_actuel < a.stock_minimum)
    setAlertes(alerteArts)
  }

  function openReappro(a: AlerteArticle) {
    setReapproArt(a)
    const suggere = a.stock_maximum != null
      ? Math.max(0, a.stock_maximum - a.stock_actuel)
      : Math.max(0, a.stock_minimum * 2 - a.stock_actuel)
    setReapproQte(fmtQte(suggere).replace(/\s/g, ''))
    setReapproPrix(String(a.prix_achat))
    setReapproRef('')
    setShowModal(true)
  }

  async function saveReappro() {
    if (!reapproArt || !reapproQte) { toast.error('Quantité obligatoire'); return }
    const qte = parseFloat(reapproQte.replace(',', '.'))
    if (isNaN(qte) || qte <= 0) { toast.error('Quantité invalide'); return }

    setSaving(true)
    const stockAvant = reapproArt.stock_actuel
    const stockApres = stockAvant + qte

    const { error } = await (supabase as any).from('stock_mouvements').insert({
      tenant_id: fullTenantId, societe_id: societeId,
      article_id: reapproArt.id, type_mouvement: 'entree',
      quantite: qte, stock_avant: stockAvant, stock_apres: stockApres,
      prix_unitaire: reapproPrix ? parseFloat(reapproPrix) : null,
      reference_source: reapproRef || null,
      motif: 'Réapprovisionnement depuis alerte stock',
      created_by: currentUserId,
    })

    if (error) { toast.error(error.message); setSaving(false); return }
    await writeLog({ action: 'stock_reapprovisionnement', table_name: 'stock_mouvements', details: { article: reapproArt.designation, quantite: qte } })
    await notifyGestionnairesStock(
      'Réapprovisionnement enregistré',
      `${fmtQte(qte)} ${reapproArt.unite} de "${reapproArt.designation}" (${reapproArt.reference}) ont été réceptionnés. Stock : ${fmtQte(stockApres)} ${reapproArt.unite}.`,
      'info'
    )
    toast.success(t('mouvement_saved'))
    setShowModal(false)
    await loadAlertes()
    setSaving(false)
  }

  function exportCSV() {
    downloadCSV(
      [['Criticité', 'Référence', 'Désignation', 'Catégorie', 'Stock actuel', 'Stock minimum', 'Manquant', 'Qté suggérée', 'Prix achat', 'Emplacement'],
       ...alertes.map(a => {
         const crit = criticite(a)
         const manquant = a.stock_minimum - a.stock_actuel
         const suggere = a.stock_maximum != null ? Math.max(0, a.stock_maximum - a.stock_actuel) : Math.max(0, a.stock_minimum * 2 - a.stock_actuel)
         return [crit, a.reference, a.designation, a.categorie ?? '', fmtQte(a.stock_actuel), fmtQte(a.stock_minimum), fmtQte(manquant), fmtQte(suggere), String(a.prix_achat), a.emplacement ?? '']
       })],
      `alertes-stock-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  // Grouper par criticité
  const ruptures  = alertes.filter(a => criticite(a) === 'rupture')
  const critiques = alertes.filter(a => criticite(a) === 'critique')
  const enAlerte  = alertes.filter(a => criticite(a) === 'alerte')

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('alertes_title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('alertes_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <Download className="h-4 w-4" /> {t('btn_export')} (Bon commande)
          </button>
        </div>
      </div>

      {/* Compteurs */}
      {alertes.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{ruptures.length}</p>
            <p className="text-xs text-red-500 mt-0.5">{t('alerte_rupture')}</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
            <p className="text-2xl font-bold text-orange-700">{critiques.length}</p>
            <p className="text-xs text-orange-500 mt-0.5">{t('alerte_critique')}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{enAlerte.length}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t('alerte_alerte')}</p>
          </div>
        </div>
      )}

      {alertes.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 py-14 text-center">
          <p className="text-emerald-700 font-medium">{t('no_alertes')}</p>
          <p className="text-sm text-emerald-500 mt-1">Tous les stocks sont au-dessus du seuil minimum.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Criticité</th>
                  <th className="px-4 py-3 text-left">{t('col_reference')}</th>
                  <th className="px-4 py-3 text-left">{t('col_designation')}</th>
                  <th className="px-4 py-3 text-left">{t('col_categorie')}</th>
                  <th className="px-4 py-3 text-right">{t('col_stock_actuel')}</th>
                  <th className="px-4 py-3 text-right">{t('col_stock_minimum')}</th>
                  <th className="px-4 py-3 text-right">{t('col_manquant')}</th>
                  <th className="px-4 py-3 text-right">{t('col_suggere')}</th>
                  <th className="px-4 py-3 text-left">{t('col_emplacement')}</th>
                  {canContrib && <th className="px-4 py-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alertes.map(a => {
                  const crit    = criticite(a)
                  const manquant = a.stock_minimum - a.stock_actuel
                  const suggere = a.stock_maximum != null
                    ? Math.max(0, a.stock_maximum - a.stock_actuel)
                    : Math.max(0, a.stock_minimum * 2 - a.stock_actuel)
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${CRIT_BADGE[crit]}`}>
                          {t(`alerte_${crit}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.reference}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.designation}</td>
                      <td className="px-4 py-3 text-slate-500">{a.categorie ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${a.stock_actuel <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {fmtQte(a.stock_actuel)} {a.unite}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmtQte(a.stock_minimum)} {a.unite}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{fmtQte(manquant)} {a.unite}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">{fmtQte(suggere)} {a.unite}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{a.emplacement ?? '—'}</td>
                      {canContrib && (
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => openReappro(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                            <ArrowDownCircle className="h-3.5 w-3.5" /> {t('btn_reappro')}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal réapprovisionnement */}
      {showModal && reapproArt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">{t('btn_reappro')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{reapproArt.designation}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock actuel</span>
                  <span className="font-medium text-slate-800">{fmtQte(reapproArt.stock_actuel)} {reapproArt.unite}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Minimum requis</span>
                  <span className="font-medium text-slate-800">{fmtQte(reapproArt.stock_minimum)} {reapproArt.unite}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_quantite')} à recevoir *</label>
                <input type="number" min="0.001" step="0.001" value={reapproQte} onChange={e => setReapproQte(e.target.value)} className={inputCls} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_prix_u')}</label>
                <input type="number" min="0" value={reapproPrix} onChange={e => setReapproPrix(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_ref_src')} (N° BL / commande)</label>
                <input value={reapproRef} onChange={e => setReapproRef(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={saveReappro} disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <ArrowDownCircle className="h-4 w-4" /> Enregistrer l'entrée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
