'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import {
  Package, Plus, Search, Pencil, ChevronRight,
  Loader2, X, ArrowDownCircle, ArrowUpCircle, ToggleLeft, Info,
} from 'lucide-react'

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1">
      <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  )
}

const fmtQte = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)
const fmt    = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

const CATEGORIES_BASE: { value: string; labelKey: string }[] = [
  { value: 'Alimentation & Boissons',          labelKey: 'cat_alimentation' },
  { value: 'BTP & Matériaux de construction',   labelKey: 'cat_btp'          },
  { value: 'Consommables',                      labelKey: 'cat_consommables'  },
  { value: 'Électronique & Informatique',       labelKey: 'cat_electronique'  },
  { value: 'Emballages',                        labelKey: 'cat_emballages'    },
  { value: 'Fournitures de bureau',             labelKey: 'cat_fournitures'   },
  { value: 'Hygiène & Nettoyage',               labelKey: 'cat_hygiene'       },
  { value: 'Matières premières',                labelKey: 'cat_matieres'      },
  { value: 'Médicaments & Parapharmacie',       labelKey: 'cat_medicaments'   },
  { value: 'Mobilier & Équipements',            labelKey: 'cat_mobilier'      },
  { value: 'Outillage & Quincaillerie',         labelKey: 'cat_outillage'     },
  { value: 'Pièces détachées',                  labelKey: 'cat_pieces'        },
  { value: 'Produits chimiques',                labelKey: 'cat_chimiques'     },
  { value: 'Produits finis',                    labelKey: 'cat_finis'         },
  { value: 'Textile & Habillement',             labelKey: 'cat_textile'       },
]

const UNITES_GROUPES = [
  { groupeKey: 'unite_groupe_quantite', items: ['unité', 'pièce', 'paire', 'dizaine', 'douzaine', 'lot', 'boîte', 'carton', 'palette', 'sac', 'paquet'] },
  { groupeKey: 'unite_groupe_poids',    items: ['g', 'kg', 'tonne'] },
  { groupeKey: 'unite_groupe_volume',   items: ['ml', 'cl', 'l', 'm³'] },
  { groupeKey: 'unite_groupe_longueur', items: ['cm', 'm', 'km'] },
]
const UNITES_FLAT = UNITES_GROUPES.flatMap(g => g.items)

interface Article {
  id: string; reference: string; designation: string; description: string | null
  categorie: string | null; unite: string; prix_achat: number; prix_vente: number
  stock_actuel: number; stock_minimum: number; stock_maximum: number | null
  emplacement: string | null; is_active: boolean
}

function stockBadge(a: Article): { label: string; cls: string } {
  if (a.stock_actuel <= 0)                                   return { label: 'Rupture', cls: 'bg-red-100 text-red-600' }
  if (a.stock_actuel < a.stock_minimum)                      return { label: 'Alerte',  cls: 'bg-orange-100 text-orange-600' }
  return                                                            { label: 'Normal',  cls: 'bg-emerald-100 text-emerald-700' }
}

export default function ArticlesPage() {
  const t      = useTranslations('stock')
  const params = useParams()
  const router = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base        = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/stock`

  const [loading,        setLoading]        = useState(true)
  const [articles,       setArticles]       = useState<Article[]>([])
  const [search,         setSearch]         = useState('')
  const [filterCat,      setFilterCat]      = useState('')
  const [filterStock,    setFilterStock]    = useState('')
  const [categories,     setCategories]     = useState<string[]>([])
  const [canManage,      setCanManage]      = useState(false)
  const [fullTenantId,   setFullTenantId]   = useState('')
  const [currentUserId,  setCurrentUserId]  = useState('')

  // ── Modal article ───────────────────────────────────────────
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState<Article | null>(null)
  const [saving,       setSaving]       = useState(false)

  const [fRef,         setFRef]         = useState('')
  const [fDes,         setFDes]         = useState('')
  const [fDesc,        setFDesc]        = useState('')
  const [fCat,         setFCat]         = useState('')
  const [newCatMode,   setNewCatMode]   = useState(false)
  const [newCatValue,  setNewCatValue]  = useState('')
  const [fUnite,       setFUnite]       = useState('unité')
  const [newUniteMode, setNewUniteMode] = useState(false)
  const [newUniteValue,setNewUniteValue]= useState('')
  const [fPrixA,       setFPrixA]       = useState('')
  const [fPrixV,       setFPrixV]       = useState('')
  const [fStockMin,    setFStockMin]    = useState('')
  const [fStockMax,    setFStockMax]    = useState('')
  const [fEmpl,        setFEmpl]        = useState('')

  // ── Modal mouvement rapide ──────────────────────────────────
  const [showMouv,  setShowMouv]  = useState(false)
  const [mouvType,  setMouvType]  = useState<'entree' | 'sortie'>('entree')
  const [mouvArt,   setMouvArt]   = useState<Article | null>(null)
  const [mouvQte,   setMouvQte]   = useState('')
  const [mouvPrix,  setMouvPrix]  = useState('')
  const [mouvMotif, setMouvMotif] = useState('')
  const [mouvSaving,setMouvSaving]= useState(false)

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

      await loadArticles()
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

  const loadArticles = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('stock_articles')
      .select('*')
      .eq('societe_id', societeId)
      .order('designation', { ascending: true })
    const arts = data ?? []
    setArticles(arts)
    const cats = [...new Set(arts.map((a: any) => a.categorie).filter(Boolean))] as string[]
    setCategories(cats.sort())
  }, [societeId])

  // ── Filtrage ────────────────────────────────────────────────
  const filtered = articles.filter(a => {
    const matchSearch = !search || a.designation.toLowerCase().includes(search.toLowerCase()) || a.reference.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !filterCat || a.categorie === filterCat
    const matchStock  = !filterStock ||
      (filterStock === 'rupture' && a.stock_actuel <= 0) ||
      (filterStock === 'alerte'  && a.stock_actuel > 0 && a.stock_actuel < a.stock_minimum) ||
      (filterStock === 'ok'      && a.stock_actuel >= a.stock_minimum)
    return matchSearch && matchCat && matchStock
  })

  // ── Ouvrir form ─────────────────────────────────────────────
  function openNew() {
    setEditing(null)
    setFRef(''); setFDes(''); setFDesc(''); setFCat(''); setNewCatMode(false); setNewCatValue('')
    setFUnite('unité'); setNewUniteMode(false); setNewUniteValue('')
    setFPrixA(''); setFPrixV(''); setFStockMin('0'); setFStockMax(''); setFEmpl('')
    setShowForm(true)
  }

  function openEdit(a: Article) {
    setEditing(a)
    setFRef(a.reference); setFDes(a.designation); setFDesc(a.description ?? '')
    setFCat(a.categorie ?? ''); setNewCatMode(false); setNewCatValue('')
    const uniteKnown = UNITES_FLAT.includes(a.unite)
    setFUnite(uniteKnown ? a.unite : '__autre__')
    setNewUniteMode(!uniteKnown); setNewUniteValue(uniteKnown ? '' : a.unite)
    setFPrixA(String(a.prix_achat)); setFPrixV(String(a.prix_vente))
    setFStockMin(String(a.stock_minimum)); setFStockMax(a.stock_maximum != null ? String(a.stock_maximum) : ''); setFEmpl(a.emplacement ?? '')
    setShowForm(true)
  }

  async function saveArticle() {
    if (!fRef.trim() || !fDes.trim()) { toast.error('Référence et désignation obligatoires'); return }
    setSaving(true)
    const payload = {
      reference: fRef.trim(), designation: fDes.trim(), description: fDesc || null,
      categorie: (newCatMode ? newCatValue.trim() : fCat) || null,
      unite: (newUniteMode ? newUniteValue.trim() : fUnite) || 'unité',
      prix_achat: parseFloat(fPrixA) || 0, prix_vente: parseFloat(fPrixV) || 0,
      stock_minimum: parseFloat(fStockMin) || 0,
      stock_maximum: fStockMax ? parseFloat(fStockMax) : null,
      emplacement: fEmpl || null,
    }

    let error: any = null
    if (editing) {
      const { error: e } = await (supabase as any).from('stock_articles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      error = e
    } else {
      const { error: e } = await (supabase as any).from('stock_articles').insert({ ...payload, societe_id: societeId, tenant_id: fullTenantId, stock_actuel: 0, is_active: true })
      error = e
    }

    if (error) { toast.error(error.message); setSaving(false); return }
    await writeLog({ action: editing ? 'stock_article_update' : 'stock_article_create', table_name: 'stock_articles', details: { reference: fRef } })
    toast.success(t('article_saved'))
    setShowForm(false)
    await loadArticles()
    setSaving(false)
  }

  async function toggleActive(a: Article) {
    if (!confirm(`${a.is_active ? 'Désactiver' : 'Réactiver'} "${a.designation}" ?`)) return
    await (supabase as any).from('stock_articles').update({ is_active: !a.is_active, updated_at: new Date().toISOString() }).eq('id', a.id)
    if (a.is_active) {
      await writeLog({ action: 'stock_article_delete', table_name: 'stock_articles', details: { id: a.id, reference: a.reference, designation: a.designation } })
    }
    await loadArticles()
  }

  // ── Mouvement rapide ─────────────────────────────────────────
  function openMouvement(a: Article, type: 'entree' | 'sortie') {
    setMouvArt(a); setMouvType(type); setMouvQte(''); setMouvPrix(''); setMouvMotif('')
    setShowMouv(true)
  }

  async function saveMouvement() {
    if (!mouvArt || !mouvQte) { toast.error('Quantité obligatoire'); return }
    const qte = parseFloat(mouvQte)
    if (isNaN(qte) || qte <= 0) { toast.error('Quantité invalide'); return }
    if (mouvType === 'sortie' && qte > mouvArt.stock_actuel) {
      toast.error(t('stock_insuffisant')); return
    }
    setMouvSaving(true)
    const stockAvant = mouvArt.stock_actuel
    const stockApres = mouvType === 'entree' ? stockAvant + qte : stockAvant - qte

    const { error } = await (supabase as any).from('stock_mouvements').insert({
      tenant_id: fullTenantId, societe_id: societeId,
      article_id: mouvArt.id, type_mouvement: mouvType,
      quantite: qte, stock_avant: stockAvant, stock_apres: stockApres,
      prix_unitaire: mouvPrix ? parseFloat(mouvPrix) : null,
      motif: mouvMotif || null, created_by: currentUserId,
    })

    if (error) { toast.error(error.message); setMouvSaving(false); return }
    await writeLog({ action: `stock_mouvement_${mouvType}`, table_name: 'stock_mouvements', details: { article: mouvArt.designation, quantite: qte } })

    // Notifications rupture / sous minimum après sortie
    if (mouvType === 'sortie') {
      if (stockApres <= 0) {
        await notifyGestionnairesStock(
          'Rupture de stock',
          `L'article "${mouvArt.designation}" (${mouvArt.reference}) est en rupture de stock (${fmtQte(stockApres)} ${mouvArt.unite}).`,
          'warning'
        )
      } else if (stockApres < mouvArt.stock_minimum && stockAvant >= mouvArt.stock_minimum) {
        await notifyGestionnairesStock(
          'Stock sous le seuil minimum',
          `L'article "${mouvArt.designation}" (${mouvArt.reference}) est passé sous le seuil minimum (${fmtQte(stockApres)} / min ${fmtQte(mouvArt.stock_minimum)} ${mouvArt.unite}).`,
          'warning'
        )
      }
    }

    toast.success(t('mouvement_saved'))
    setShowMouv(false)
    await loadArticles()
    setMouvSaving(false)
  }

  if (loading) {
    return <div className="flex h-60 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{t('articles_title')}</h1>
        {canManage && (
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
            <Plus className="h-4 w-4" /> {t('articles_new')}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">{t('filter_all')} catégories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">{t('filter_all')} niveaux</option>
          <option value="ok">{t('filter_stock_ok')}</option>
          <option value="alerte">{t('filter_stock_alerte')}</option>
          <option value="rupture">{t('filter_stock_rupture')}</option>
        </select>
        <span className="text-xs text-slate-400">{filtered.length} article(s)</span>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">{t('no_results')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">{t('col_reference')}</th>
                  <th className="px-4 py-3 text-left">{t('col_designation')}</th>
                  <th className="px-4 py-3 text-left">{t('col_categorie')}</th>
                  <th className="px-4 py-3 text-center">{t('col_stock')}</th>
                  <th className="px-4 py-3 text-center">Niveau</th>
                  <th className="px-4 py-3 text-right">{t('col_prix_achat')}</th>
                  <th className="px-4 py-3 text-right">{t('col_valeur')}</th>
                  <th className="px-4 py-3 text-left">{t('col_emplacement')}</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => {
                  const badge = stockBadge(a)
                  const valeur = a.stock_actuel * a.prix_achat
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${!a.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.reference}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{a.designation}</p>
                        {a.description && <p className="text-xs text-slate-400 truncate max-w-40">{a.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{a.categorie ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div>
                          <p className="font-semibold text-slate-800">{fmtQte(a.stock_actuel)} {a.unite}</p>
                          <p className="text-xs text-slate-400">min: {fmtQte(a.stock_minimum)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(a.prix_achat)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(valeur)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{a.emplacement ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canManage && a.is_active && (
                            <>
                              <button onClick={() => openMouvement(a, 'entree')} title="Entrée"
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                                <ArrowDownCircle className="h-4 w-4" />
                              </button>
                              <button onClick={() => openMouvement(a, 'sortie')} title="Sortie"
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                                <ArrowUpCircle className="h-4 w-4" />
                              </button>
                              <button onClick={() => openEdit(a)} title="Modifier"
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => toggleActive(a)} title="Désactiver"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                                <ToggleLeft className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => router.push(`${base}/articles/${a.id}`)} title="Détail"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal article ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{editing ? t('articles_edit') : t('articles_new')}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_reference')} *
                  <InfoTooltip text="Code unique identifiant l'article (ex : ART-001). Non modifiable après la création." />
                </label>
                <input value={fRef} onChange={e => setFRef(e.target.value)} className={inputCls} disabled={!!editing} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_designation')} *
                  <InfoTooltip text="Nom commercial de l'article tel qu'il apparaît sur les documents (factures, bons de livraison…)." />
                </label>
                <input value={fDes} onChange={e => setFDes(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_description')}
                  <InfoTooltip text="Informations complémentaires sur l'article : composition, caractéristiques techniques, remarques…" />
                </label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_categorie')}
                  <InfoTooltip text="Famille ou groupe de l'article pour faciliter les recherches et les rapports." />
                </label>
                <select
                  value={newCatMode ? '__new__' : fCat}
                  onChange={e => {
                    if (e.target.value === '__new__') { setNewCatMode(true); setNewCatValue('') }
                    else { setNewCatMode(false); setFCat(e.target.value) }
                  }}
                  className={selectCls}
                >
                  <option value="">{t('select_placeholder')}</option>
                  {CATEGORIES_BASE.map(c => (
                    <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                  ))}
                  {categories.filter(c => !CATEGORIES_BASE.some(p => p.value === c)).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new__">{t('cat_nouvelle')}</option>
                </select>
                {newCatMode && (
                  <input
                    autoFocus
                    placeholder={t('cat_nouvelle_placeholder')}
                    value={newCatValue}
                    onChange={e => setNewCatValue(e.target.value)}
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_unite')}
                  <InfoTooltip text="Unité de mesure utilisée pour le stock (ex : pcs, kg, litre, boîte). Par défaut : « unité »." />
                </label>
                <select
                  value={newUniteMode ? '__autre__' : fUnite}
                  onChange={e => {
                    if (e.target.value === '__autre__') { setNewUniteMode(true); setNewUniteValue('') }
                    else { setNewUniteMode(false); setFUnite(e.target.value) }
                  }}
                  className={selectCls}
                >
                  {UNITES_GROUPES.map(g => (
                    <optgroup key={g.groupeKey} label={t(g.groupeKey)}>
                      {g.items.map(u => <option key={u} value={u}>{u}</option>)}
                    </optgroup>
                  ))}
                  <option value="__autre__">{t('unite_autre')}</option>
                </select>
                {newUniteMode && (
                  <input
                    autoFocus
                    placeholder={t('unite_autre_placeholder')}
                    value={newUniteValue}
                    onChange={e => setNewUniteValue(e.target.value)}
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_prix_achat')}
                  <InfoTooltip text="Coût d'acquisition de l'article (hors taxes). Utilisé pour calculer la marge et valoriser le stock." />
                </label>
                <input type="number" min="0" value={fPrixA} onChange={e => setFPrixA(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_prix_vente')}
                  <InfoTooltip text="Prix facturé au client (hors taxes). Sert de tarif par défaut lors de la création de devis ou factures." />
                </label>
                <input type="number" min="0" value={fPrixV} onChange={e => setFPrixV(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_stock_min')}
                  <InfoTooltip text="Seuil minimal en dessous duquel une alerte de réapprovisionnement est déclenchée. Mettre 0 pour désactiver l'alerte." />
                </label>
                <input type="number" min="0" value={fStockMin} onChange={e => setFStockMin(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_stock_max')}
                  <InfoTooltip text="Capacité maximale de stockage souhaitée. Permet d'éviter les surcommandes. Laisser vide si illimité." />
                </label>
                <input type="number" min="0" value={fStockMax} onChange={e => setFStockMax(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center">
                  {t('field_emplacement')}
                  <InfoTooltip text="Localisation physique de l'article dans l'entrepôt ou le magasin (ex : Rayon A, Étagère 3, Cellule F2)." />
                </label>
                <input value={fEmpl} onChange={e => setFEmpl(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={saveArticle} disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal mouvement rapide ── */}
      {showMouv && mouvArt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">
                {mouvType === 'entree' ? t('btn_entree') : t('btn_sortie')} — {mouvArt.designation}
              </h2>
              <button onClick={() => setShowMouv(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">Stock actuel : <strong className="text-slate-800">{fmtQte(mouvArt.stock_actuel)} {mouvArt.unite}</strong></p>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">{t('field_quantite')} *</label>
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
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2 ${mouvType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
                {mouvSaving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
