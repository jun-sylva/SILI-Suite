'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  ArrowLeftRight, Plus, Loader2, X, Download,
  ArrowDownCircle, ArrowUpCircle, TrendingDown, Package,
} from 'lucide-react'

const fmtQte  = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

interface ArticleOption { id: string; reference: string; designation: string; stock_actuel: number; unite: string }
interface Mouvement {
  id: string; type_mouvement: string; quantite: number; stock_avant: number; stock_apres: number
  prix_unitaire: number | null; reference_source: string | null; motif: string | null; created_at: string
  article: { reference: string; designation: string; unite: string } | null
  created_by_profile: { full_name: string } | null
}

const TYPE_ICON: Record<string, React.ElementType>  = { entree: ArrowDownCircle, sortie: ArrowUpCircle, ajustement: TrendingDown, inventaire: Package }
const TYPE_COLOR: Record<string, string>             = { entree: 'text-emerald-600', sortie: 'text-red-500', ajustement: 'text-amber-600', inventaire: 'text-blue-600' }
const TYPE_LABEL: Record<string, string>             = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', inventaire: 'Inventaire' }

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function MouvementsPage() {
  const t      = useTranslations('stock')
  const params = useParams()

  const societeId   = params.societe_id   as string

  const [loading,        setLoading]        = useState(true)
  const [mouvements,     setMouvements]     = useState<Mouvement[]>([])
  const [articles,       setArticles]       = useState<ArticleOption[]>([])
  const [filterType,     setFilterType]     = useState('')
  const [filterArticle,  setFilterArticle]  = useState('')
  const [filterDateDeb,  setFilterDateDeb]  = useState('')
  const [filterDateFin,  setFilterDateFin]  = useState('')
  const [canContrib,     setCanContrib]     = useState(false)
  const [fullTenantId,   setFullTenantId]   = useState('')
  const [currentUserId,  setCurrentUserId]  = useState('')

  // Modal
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [mType,      setMType]      = useState<'entree' | 'sortie' | 'ajustement'>('entree')
  const [mArticle,   setMArticle]   = useState('')
  const [mQte,       setMQte]       = useState('')
  const [mPrix,      setMPrix]      = useState('')
  const [mRefSrc,    setMRefSrc]    = useState('')
  const [mMotif,     setMMotif]     = useState('')

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

      const { data: arts } = await (supabase as any)
        .from('stock_articles').select('id, reference, designation, stock_actuel, unite')
        .eq('societe_id', societeId).eq('is_active', true).order('designation')
      setArticles(arts ?? [])

      await loadMouvements()
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

  const loadMouvements = useCallback(async () => {
    let q = (supabase as any)
      .from('stock_mouvements')
      .select('*, article:article_id(reference,designation,unite), created_by_profile:created_by(full_name)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filterType)    q = q.eq('type_mouvement', filterType)
    if (filterArticle) q = q.eq('article_id', filterArticle)
    if (filterDateDeb) q = q.gte('created_at', `${filterDateDeb}T00:00:00`)
    if (filterDateFin) q = q.lte('created_at', `${filterDateFin}T23:59:59`)

    const { data } = await q
    setMouvements(data ?? [])
  }, [societeId, filterType, filterArticle, filterDateDeb, filterDateFin])

  useEffect(() => {
    if (!loading) loadMouvements()
  }, [filterType, filterArticle, filterDateDeb, filterDateFin])

  async function saveMouvement() {
    if (!mArticle || !mQte) { toast.error('Article et quantité obligatoires'); return }
    const qte = parseFloat(mQte)
    if (isNaN(qte) || qte <= 0) { toast.error('Quantité invalide'); return }

    const art = articles.find(a => a.id === mArticle)
    if (!art) return

    if (mType === 'sortie' && qte > art.stock_actuel) {
      toast.error(t('stock_insuffisant')); return
    }

    setSaving(true)
    const stockAvant = art.stock_actuel
    const stockApres = mType === 'entree'
      ? stockAvant + qte
      : mType === 'sortie'
        ? stockAvant - qte
        : qte // ajustement = nouveau total

    const { error } = await (supabase as any).from('stock_mouvements').insert({
      tenant_id: fullTenantId, societe_id: societeId, article_id: mArticle,
      type_mouvement: mType,
      quantite: mType === 'ajustement' ? Math.abs(stockApres - stockAvant) : qte,
      stock_avant: stockAvant, stock_apres: stockApres,
      prix_unitaire: mPrix ? parseFloat(mPrix) : null,
      reference_source: mRefSrc || null, motif: mMotif || null,
      created_by: currentUserId,
    })

    if (error) { toast.error(error.message); setSaving(false); return }
    await writeLog({ action: `stock_mouvement_${mType}`, table_name: 'stock_mouvements', details: { article: art.designation, quantite: qte } })

    // Notifications rupture / sous minimum après sortie
    if (mType === 'sortie') {
      if (stockApres <= 0) {
        await notifyGestionnairesStock(
          'Rupture de stock',
          `L'article "${art.designation}" (${art.reference}) est en rupture de stock (${fmtQte(stockApres)} ${art.unite}).`,
          'warning'
        )
      } else {
        // Récupérer stock_minimum de l'article pour comparer
        const { data: artFull } = await (supabase as any).from('stock_articles').select('stock_minimum').eq('id', mArticle).single()
        if (artFull && stockApres < artFull.stock_minimum && stockAvant >= artFull.stock_minimum) {
          await notifyGestionnairesStock(
            'Stock sous le seuil minimum',
            `L'article "${art.designation}" (${art.reference}) est passé sous le seuil minimum (${fmtQte(stockApres)} / min ${fmtQte(artFull.stock_minimum)} ${art.unite}).`,
            'warning'
          )
        }
      }
    }

    toast.success(t('mouvement_saved'))
    setShowModal(false)

    // Rafraichir articles + mouvements
    const { data: arts } = await (supabase as any)
      .from('stock_articles').select('id, reference, designation, stock_actuel, unite')
      .eq('societe_id', societeId).eq('is_active', true).order('designation')
    setArticles(arts ?? [])
    await loadMouvements()
    setSaving(false)
  }

  function exportCSV() {
    downloadCSV(
      [['Type', 'Article', 'Quantité', 'Stock avant', 'Stock après', 'Prix unitaire', 'Réf. source', 'Motif', 'Par', 'Date'],
       ...mouvements.map(m => [
         TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement,
         m.article ? `${m.article.reference} — ${m.article.designation}` : '—',
         fmtQte(m.quantite), fmtQte(m.stock_avant), fmtQte(m.stock_apres),
         m.prix_unitaire != null ? String(m.prix_unitaire) : '',
         m.reference_source ?? '', m.motif ?? '',
         m.created_by_profile?.full_name ?? '',
         fmtDate(m.created_at),
       ])],
      `mouvements-stock-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  const selectedArt = articles.find(a => a.id === mArticle)

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
            <ArrowLeftRight className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{t('mouvement_title')}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <Download className="h-4 w-4" /> {t('btn_export')}
          </button>
          {canContrib && (
            <button onClick={() => { setMType('entree'); setMArticle(''); setMQte(''); setMPrix(''); setMRefSrc(''); setMMotif(''); setShowModal(true) }}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
              <Plus className="h-4 w-4" /> {t('mouvement_new')}
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-2xl border border-slate-200">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Tous types</option>
          <option value="entree">Entrée</option>
          <option value="sortie">Sortie</option>
          <option value="ajustement">Ajustement</option>
          <option value="inventaire">Inventaire</option>
        </select>
        <select value={filterArticle} onChange={e => setFilterArticle(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Tous articles</option>
          {articles.map(a => <option key={a.id} value={a.id}>{a.reference} — {a.designation}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Du</label>
          <input type="date" value={filterDateDeb} onChange={e => setFilterDateDeb(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">au</label>
          <input type="date" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <span className="ml-auto text-xs text-slate-400">{mouvements.length} mouvement(s)</span>
      </div>

      {/* Tableau */}
      {mouvements.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">{t('no_mouvements')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">{t('col_type')}</th>
                  <th className="px-4 py-3 text-left">{t('col_article')}</th>
                  <th className="px-4 py-3 text-right">{t('col_quantite')}</th>
                  <th className="px-4 py-3 text-right">{t('col_stock_avant')}</th>
                  <th className="px-4 py-3 text-right">{t('col_stock_apres')}</th>
                  <th className="px-4 py-3 text-right">{t('col_prix_unitaire')}</th>
                  <th className="px-4 py-3 text-left">{t('col_reference_src')}</th>
                  <th className="px-4 py-3 text-left">{t('col_motif')}</th>
                  <th className="px-4 py-3 text-left">{t('col_par')}</th>
                  <th className="px-4 py-3 text-left">{t('col_date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mouvements.map(m => {
                  const Icon = TYPE_ICON[m.type_mouvement] ?? Package
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TYPE_COLOR[m.type_mouvement]}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{m.article?.designation ?? '—'}</p>
                        <p className="text-xs text-slate-400 font-mono">{m.article?.reference}</p>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${TYPE_COLOR[m.type_mouvement]}`}>
                        {m.type_mouvement === 'sortie' ? '-' : '+'}{fmtQte(m.quantite)} {m.article?.unite ?? ''}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtQte(m.stock_avant)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtQte(m.stock_apres)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{m.prix_unitaire != null ? new Intl.NumberFormat('fr-FR').format(m.prix_unitaire) : '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.reference_source ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.motif ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.created_by_profile?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal mouvement ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{t('mouvement_new')}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_type')}</label>
                <select value={mType} onChange={e => setMType(e.target.value as any)} className={selectCls}>
                  <option value="entree">Entrée</option>
                  <option value="sortie">Sortie</option>
                  <option value="ajustement">Ajustement</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_article')} *</label>
                <select value={mArticle} onChange={e => setMArticle(e.target.value)} className={selectCls}>
                  <option value="">— Sélectionner —</option>
                  {articles.map(a => <option key={a.id} value={a.id}>{a.reference} — {a.designation} ({fmtQte(a.stock_actuel)} {a.unite})</option>)}
                </select>
              </div>
              {selectedArt && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                  Stock actuel : <strong className="text-slate-800">{fmtQte(selectedArt.stock_actuel)} {selectedArt.unite}</strong>
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {mType === 'ajustement' ? 'Nouveau stock total' : t('field_quantite')} *
                </label>
                <input type="number" min="0.001" step="0.001" value={mQte} onChange={e => setMQte(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_prix_u')}</label>
                <input type="number" min="0" value={mPrix} onChange={e => setMPrix(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_ref_src')}</label>
                <input value={mRefSrc} onChange={e => setMRefSrc(e.target.value)} className={inputCls} placeholder="N° commande, N° livraison..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_motif')}</label>
                <input value={mMotif} onChange={e => setMMotif(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={saveMouvement} disabled={saving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
