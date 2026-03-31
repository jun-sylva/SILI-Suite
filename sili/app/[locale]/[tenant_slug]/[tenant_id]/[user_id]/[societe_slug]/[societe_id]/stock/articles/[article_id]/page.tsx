'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  Package, ArrowLeft, Pencil, X, Loader2,
  ArrowDownCircle, ArrowUpCircle, TrendingDown,
  Save,
} from 'lucide-react'

const fmtQte = (n: number | null | undefined) => n != null ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n) : '—'
const fmt    = (n: number | null | undefined) => n != null ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) : '—'
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

const inputCls = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

interface Article {
  id: string; reference: string; designation: string; description: string | null
  categorie: string | null; unite: string; prix_achat: number; prix_vente: number
  stock_actuel: number; stock_minimum: number; stock_maximum: number | null
  emplacement: string | null; is_active: boolean; created_at: string
}

interface Mouvement {
  id: string; type_mouvement: string; quantite: number
  stock_avant: number; stock_apres: number; prix_unitaire: number | null
  reference_source: string | null; motif: string | null; created_at: string
  created_by_profile: { full_name: string } | null
}

const TYPE_ICON: Record<string, React.ElementType> = { entree: ArrowDownCircle, sortie: ArrowUpCircle, ajustement: TrendingDown, inventaire: Package }
const TYPE_COLOR: Record<string, string>            = { entree: 'text-emerald-600', sortie: 'text-red-500', ajustement: 'text-amber-600', inventaire: 'text-blue-600' }
const TYPE_LABEL: Record<string, string>            = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', inventaire: 'Inventaire' }

export default function ArticleDetailPage() {
  const t      = useTranslations('stock')
  const params = useParams()
  const router = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const articleId   = params.article_id   as string
  const base        = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/stock`

  const [loading,       setLoading]       = useState(true)
  const [article,       setArticle]       = useState<Article | null>(null)
  const [mouvements,    setMouvements]    = useState<Mouvement[]>([])
  const [canManage,     setCanManage]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)

  // Champs form
  const [fDes,      setFDes]      = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fCat,      setFCat]      = useState('')
  const [fUnite,    setFUnite]    = useState('')
  const [fPrixA,    setFPrixA]    = useState('')
  const [fPrixV,    setFPrixV]    = useState('')
  const [fStockMin, setFStockMin] = useState('')
  const [fStockMax, setFStockMax] = useState('')
  const [fEmpl,     setFEmpl]     = useState('')

  // Mouvement rapide
  const [showMouv,   setShowMouv]   = useState(false)
  const [mouvType,   setMouvType]   = useState<'entree' | 'sortie' | 'ajustement'>('entree')
  const [mouvQte,    setMouvQte]    = useState('')
  const [mouvPrix,   setMouvPrix]   = useState('')
  const [mouvMotif,  setMouvMotif]  = useState('')
  const [mouvSaving, setMouvSaving] = useState(false)

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

      await Promise.all([loadArticle(), loadMouvements()])
      setLoading(false)
    }
    init()
  }, [articleId])

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

  async function loadArticle() {
    const { data } = await (supabase as any).from('stock_articles').select('*').eq('id', articleId).single()
    if (data) {
      setArticle(data)
      setFDes(data.designation); setFDesc(data.description ?? ''); setFCat(data.categorie ?? '')
      setFUnite(data.unite); setFPrixA(String(data.prix_achat)); setFPrixV(String(data.prix_vente))
      setFStockMin(String(data.stock_minimum)); setFStockMax(data.stock_maximum != null ? String(data.stock_maximum) : ''); setFEmpl(data.emplacement ?? '')
    }
  }

  async function loadMouvements() {
    const { data } = await (supabase as any)
      .from('stock_mouvements')
      .select('*, created_by_profile:created_by(full_name)')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
      .limit(50)
    setMouvements(data ?? [])
  }

  async function saveArticle() {
    if (!fDes.trim()) { toast.error('Désignation obligatoire'); return }
    setSaving(true)
    const { error } = await (supabase as any).from('stock_articles').update({
      designation: fDes.trim(), description: fDesc || null, categorie: fCat || null,
      unite: fUnite || 'unité', prix_achat: parseFloat(fPrixA) || 0, prix_vente: parseFloat(fPrixV) || 0,
      stock_minimum: parseFloat(fStockMin) || 0,
      stock_maximum: fStockMax ? parseFloat(fStockMax) : null,
      emplacement: fEmpl || null, updated_at: new Date().toISOString(),
    }).eq('id', articleId)

    if (error) { toast.error(error.message); setSaving(false); return }
    await writeLog({ action: 'stock_article_update', table_name: 'stock_articles', details: { id: articleId } })
    toast.success(t('article_saved'))
    setEditing(false)
    await loadArticle()
    setSaving(false)
  }

  async function saveMouvement() {
    if (!article || !mouvQte) { toast.error('Quantité obligatoire'); return }
    const qte = parseFloat(mouvQte)
    if (isNaN(qte) || qte <= 0) { toast.error('Quantité invalide'); return }
    if (mouvType === 'sortie' && qte > article.stock_actuel) {
      toast.error(t('stock_insuffisant')); return
    }
    setMouvSaving(true)
    const stockAvant = article.stock_actuel
    const stockApres = mouvType === 'entree' ? stockAvant + qte : mouvType === 'sortie' ? stockAvant - qte : qte

    const { error } = await (supabase as any).from('stock_mouvements').insert({
      tenant_id: fullTenantId, societe_id: societeId, article_id: articleId,
      type_mouvement: mouvType, quantite: mouvType === 'ajustement' ? Math.abs(stockApres - stockAvant) : qte,
      stock_avant: stockAvant, stock_apres: stockApres,
      prix_unitaire: mouvPrix ? parseFloat(mouvPrix) : null,
      motif: mouvMotif || null, created_by: currentUserId,
    })

    if (error) { toast.error(error.message); setMouvSaving(false); return }
    await writeLog({ action: `stock_mouvement_${mouvType}`, table_name: 'stock_mouvements', details: { article: article.designation, quantite: qte } })

    // Notifications rupture / sous minimum après sortie ou ajustement vers le bas
    const estSortie = mouvType === 'sortie' || (mouvType === 'ajustement' && stockApres < stockAvant)
    if (estSortie) {
      if (stockApres <= 0) {
        await notifyGestionnairesStock(
          'Rupture de stock',
          `L'article "${article.designation}" (${article.reference}) est en rupture de stock (${fmtQte(stockApres)} ${article.unite}).`,
          'warning'
        )
      } else if (stockApres < article.stock_minimum && stockAvant >= article.stock_minimum) {
        await notifyGestionnairesStock(
          'Stock sous le seuil minimum',
          `L'article "${article.designation}" (${article.reference}) est passé sous le seuil minimum (${fmtQte(stockApres)} / min ${fmtQte(article.stock_minimum)} ${article.unite}).`,
          'warning'
        )
      }
    }

    toast.success(t('mouvement_saved'))
    setShowMouv(false)
    await Promise.all([loadArticle(), loadMouvements()])
    setMouvSaving(false)
  }

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>
  if (!article) return <div className="p-10 text-center text-slate-500">Article introuvable.</div>

  const stockBadge = article.stock_actuel <= 0
    ? { label: t('badge_rupture'), cls: 'bg-red-100 text-red-600' }
    : article.stock_actuel < article.stock_minimum
      ? { label: t('badge_alerte'), cls: 'bg-orange-100 text-orange-600' }
      : { label: t('badge_normal'), cls: 'bg-emerald-100 text-emerald-700' }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <button onClick={() => router.push(`${base}/articles`)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
          <Package className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 truncate">{article.designation}</p>
          <p className="text-xs text-slate-400 font-mono">{article.reference}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockBadge.cls}`}>{stockBadge.label}</span>
        {canManage && (
          <div className="flex gap-2">
            {!editing && (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </button>
            )}
            <button onClick={() => { setMouvType('entree'); setMouvQte(''); setMouvPrix(''); setMouvMotif(''); setShowMouv(true) }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700">
              <ArrowDownCircle className="h-3.5 w-3.5" /> Mouvement
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Fiche article */}
        <div className="lg:col-span-1 space-y-4">

          {/* Infos générales */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm">{t('detail_info')}</h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_designation')} *</label>
                  <input value={fDes} onChange={e => setFDes(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_description')}</label>
                  <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_categorie')}</label>
                  <input value={fCat} onChange={e => setFCat(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_unite')}</label>
                  <input value={fUnite} onChange={e => setFUnite(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_emplacement')}</label>
                  <input value={fEmpl} onChange={e => setFEmpl(e.target.value)} className={inputCls} />
                </div>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                {[
                  { label: t('col_reference'),   value: article.reference },
                  { label: t('col_categorie'),   value: article.categorie ?? '—' },
                  { label: t('col_unite'),        value: article.unite },
                  { label: t('col_emplacement'), value: article.emplacement ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-800 text-right">{value}</dd>
                  </div>
                ))}
                {article.description && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">{article.description}</p>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Stock */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">{t('detail_stock_info')}</h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_stock_min')}</label>
                  <input type="number" min="0" value={fStockMin} onChange={e => setFStockMin(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_stock_max')}</label>
                  <input type="number" min="0" value={fStockMax} onChange={e => setFStockMax(e.target.value)} className={inputCls} />
                </div>
              </div>
            ) : (
              <>
                <div className="text-center py-3">
                  <p className="text-3xl font-bold text-slate-900">{fmtQte(article.stock_actuel)}</p>
                  <p className="text-sm text-slate-400">{article.unite}</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Minimum', value: fmtQte(article.stock_minimum) },
                    { label: 'Maximum', value: article.stock_maximum != null ? fmtQte(article.stock_maximum) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full transition-all ${article.stock_actuel <= 0 ? 'bg-red-500' : article.stock_actuel < article.stock_minimum ? 'bg-orange-400' : 'bg-emerald-500'}`}
                      style={{ width: `${article.stock_minimum > 0 ? Math.min(100, (article.stock_actuel / article.stock_minimum) * 100) : 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Prix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">{t('detail_prix')}</h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_prix_achat')}</label>
                  <input type="number" min="0" value={fPrixA} onChange={e => setFPrixA(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('field_prix_vente')}</label>
                  <input type="number" min="0" value={fPrixV} onChange={e => setFPrixV(e.target.value)} className={inputCls} />
                </div>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                {[
                  { label: t('col_prix_achat'), value: fmt(article.prix_achat) + ' FCFA' },
                  { label: t('col_prix_vente'), value: fmt(article.prix_vente) + ' FCFA' },
                  { label: 'Valeur stock',      value: fmt(article.stock_actuel * article.prix_achat) + ' FCFA' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {editing && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={saveArticle} disabled={saving}
                className="flex-1 rounded-xl bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" /> {t('btn_save')}
              </button>
            </div>
          )}
        </div>

        {/* Historique */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{t('detail_historique')}</h2>
          </div>
          {mouvements.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">{t('no_mouvements')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('col_type')}</th>
                    <th className="px-4 py-3 text-right">{t('col_quantite')}</th>
                    <th className="px-4 py-3 text-right">{t('col_stock_avant')}</th>
                    <th className="px-4 py-3 text-right">{t('col_stock_apres')}</th>
                    <th className="px-4 py-3 text-left">{t('col_motif')}</th>
                    <th className="px-4 py-3 text-left">{t('col_par')}</th>
                    <th className="px-4 py-3 text-left">{t('col_date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mouvements.map(m => {
                    const Icon = TYPE_ICON[m.type_mouvement] ?? Package
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TYPE_COLOR[m.type_mouvement]}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${TYPE_COLOR[m.type_mouvement]}`}>
                          {m.type_mouvement === 'sortie' ? '-' : '+'}{fmtQte(m.quantite)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{fmtQte(m.stock_avant)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtQte(m.stock_apres)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{m.motif ?? m.reference_source ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{m.created_by_profile?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal mouvement */}
      {showMouv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Enregistrer un mouvement</h2>
              <button onClick={() => setShowMouv(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_type')}</label>
                <select value={mouvType} onChange={e => setMouvType(e.target.value as any)}
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="entree">Entrée</option>
                  <option value="sortie">Sortie</option>
                  <option value="ajustement">Ajustement</option>
                </select>
              </div>
              <p className="text-sm text-slate-500">Stock actuel : <strong className="text-slate-800">{fmtQte(article.stock_actuel)} {article.unite}</strong></p>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {mouvType === 'ajustement' ? 'Nouveau stock total' : t('field_quantite')} *
                </label>
                <input type="number" min="0.001" step="0.001" value={mouvQte} onChange={e => setMouvQte(e.target.value)} className={inputCls} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_prix_u')}</label>
                <input type="number" min="0" value={mouvPrix} onChange={e => setMouvPrix(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_motif')}</label>
                <input value={mouvMotif} onChange={e => setMouvMotif(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowMouv(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={saveMouvement} disabled={mouvSaving}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                {mouvSaving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
