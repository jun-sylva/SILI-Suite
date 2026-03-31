'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Package, Download, FileText, Loader2,
  ArrowLeftRight, BarChart3, Bell, ExternalLink,
  ArrowDownCircle, ArrowUpCircle, TrendingDown,
} from 'lucide-react'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtQte  = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── PDF Styles ─────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:    { padding: 30, fontFamily: 'Helvetica', fontSize: 9 },
  header:  { marginBottom: 16 },
  company: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  period:  { fontSize: 10, color: '#555', marginBottom: 8 },
  title:   { fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#d97706' },
  table:   { width: '100%' },
  thead:   { flexDirection: 'row', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' },
  trow:    { flexDirection: 'row', borderBottom: '1px solid #e2e8f0' },
  th:      { padding: '4 6', fontWeight: 'bold', color: '#374151' },
  td:      { padding: '4 6', color: '#1e293b' },
  footer:  { marginTop: 20, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

// ── Types ──────────────────────────────────────────────────────────────────────

type TabType = 'catalogue' | 'mouvements' | 'valorisation' | 'alertes'

interface ArticleRow {
  id: string; reference: string; designation: string; categorie: string | null
  unite: string; prix_achat: number; prix_vente: number; stock_actuel: number
  stock_minimum: number; stock_maximum: number | null; emplacement: string | null
  is_active: boolean
}

interface MouvRow {
  id: string; type_mouvement: string; quantite: number; stock_avant: number; stock_apres: number
  prix_unitaire: number | null; motif: string | null; created_at: string
  article: { reference: string; designation: string; unite: string } | null
  created_by_profile: { full_name: string } | null
}

interface ValRow {
  categorie: string; nb_articles: number; stock_total: number
  valeur_achat: number; valeur_vente: number; marge: number
}

// ── Statut badge ───────────────────────────────────────────────────────────────

function statutBadge(a: ArticleRow): { label: string; cls: string } {
  if (a.stock_actuel <= 0)                    return { label: 'Rupture', cls: 'bg-red-100 text-red-600' }
  if (a.stock_actuel < a.stock_minimum)       return { label: 'Alerte',  cls: 'bg-orange-100 text-orange-600' }
  return                                             { label: 'Normal',  cls: 'bg-emerald-100 text-emerald-700' }
}

const TYPE_LABEL: Record<string, string> = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', inventaire: 'Inventaire' }
const TYPE_COLOR: Record<string, string> = { entree: 'text-emerald-600', sortie: 'text-red-500', ajustement: 'text-amber-600', inventaire: 'text-blue-600' }
const TYPE_ICON:  Record<string, React.ElementType> = { entree: ArrowDownCircle, sortie: ArrowUpCircle, ajustement: TrendingDown, inventaire: Package }

// ── PDF Documents ──────────────────────────────────────────────────────────────

function CatalogueDoc({ rows, period }: { rows: ArticleRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Stock — Catalogue</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des articles</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Référence','Désignation','Catégorie','Unité','Prix achat','Prix vente','Stock actuel','Minimum','Valeur stock','Statut'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 1 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => {
            const val = r.stock_actuel * r.prix_achat
            const { label } = statutBadge(r)
            return (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.reference}</Text>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.designation}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.categorie ?? '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.unite}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.prix_achat)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.prix_vente)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_actuel)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_minimum)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(val)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{label}</Text>
              </View>
            )
          })}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} article(s)</Text>
      </Page>
    </Document>
  )
}

function MouvementsDoc({ rows, period }: { rows: MouvRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Stock — Mouvements</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Journal des mouvements</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Date','Article','Type','Quantité','Prix unitaire','Avant','Après','Motif','Par'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 1 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtDate(r.created_at)}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.article ? `${r.article.reference} — ${r.article.designation}` : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{TYPE_LABEL[r.type_mouvement] ?? r.type_mouvement}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.quantite)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.prix_unitaire != null ? fmt(r.prix_unitaire) : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_avant)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_apres)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.motif ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.created_by_profile?.full_name ?? '—'}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} mouvement(s)</Text>
      </Page>
    </Document>
  )
}

function ValorisationDoc({ rows, period }: { rows: ValRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Stock — Valorisation</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Valorisation par catégorie</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Catégorie','Nb articles','Stock total','Valeur achat','Valeur vente','Marge potentielle'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 0 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.categorie}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.nb_articles}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_total)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.valeur_achat)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.valeur_vente)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmt(r.marge)}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} catégorie(s)</Text>
      </Page>
    </Document>
  )
}

function AlertesDoc({ rows, period }: { rows: ArticleRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Stock — Alertes</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Articles à réapprovisionner</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Référence','Désignation','Catégorie','Unité','Stock actuel','Minimum','Manquant','Qté suggérée','Statut'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 1 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => {
            const manquant  = Math.max(0, r.stock_minimum - r.stock_actuel)
            const suggere   = r.stock_maximum != null ? r.stock_maximum - r.stock_actuel : r.stock_minimum * 2
            const { label } = statutBadge(r)
            return (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.reference}</Text>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.designation}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.categorie ?? '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.unite}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_actuel)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(r.stock_minimum)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(manquant)}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(Math.max(0, suggere))}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{label}</Text>
              </View>
            )
          })}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} article(s) en alerte</Text>
      </Page>
    </Document>
  )
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1,  label: 'Janvier' },  { value: 2,  label: 'Février' },
  { value: 3,  label: 'Mars' },     { value: 4,  label: 'Avril' },
  { value: 5,  label: 'Mai' },      { value: 6,  label: 'Juin' },
  { value: 7,  label: 'Juillet' },  { value: 8,  label: 'Août' },
  { value: 9,  label: 'Septembre' },{ value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
]

const now = new Date()

const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RapportStockPage() {
  const t      = useTranslations('rapports_stock')
  const params = useParams()
  const router = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const carteBase = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/rapports/stock/carte`

  // ── Période ────────────────────────────────────────────────────────────────
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // ── Onglet ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabType>('catalogue')

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [filterCat,    setFilterCat]    = useState('')
  const [filterNiveau, setFilterNiveau] = useState('')

  // ── Data ───────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)
  const [articles,  setArticles]  = useState<ArticleRow[]>([])
  const [mouv,      setMouv]      = useState<MouvRow[]>([])
  const [categories,setCategories] = useState<string[]>([])

  // ── Période label ──────────────────────────────────────────────────────────
  function periodLabel() {
    return new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
  }
  function periodStart() { return `${year}-${String(month).padStart(2, '0')}-01` }
  function periodEnd()   { return new Date(year, month, 1).toISOString().split('T')[0] }

  // ── Génération ─────────────────────────────────────────────────────────────
  async function generate() {
    setLoading(true)

    const [{ data: artsRaw }, { data: mouvRaw }] = await Promise.all([
      (supabase as any)
        .from('stock_articles')
        .select('id, reference, designation, categorie, unite, prix_achat, prix_vente, stock_actuel, stock_minimum, stock_maximum, emplacement, is_active')
        .eq('societe_id', societeId)
        .eq('is_active', true)
        .order('designation', { ascending: true }),

      (supabase as any)
        .from('stock_mouvements')
        .select('id, type_mouvement, quantite, stock_avant, stock_apres, prix_unitaire, motif, created_at, article:article_id(reference, designation, unite), created_by_profile:created_by(full_name)')
        .eq('societe_id', societeId)
        .gte('created_at', periodStart())
        .lt('created_at', periodEnd())
        .order('created_at', { ascending: false }),
    ])

    const arts = artsRaw ?? []
    const movs = mouvRaw ?? []

    setArticles(arts)
    setMouv(movs)

    const cats = [...new Set(arts.map((a: any) => a.categorie).filter(Boolean))].sort() as string[]
    setCategories(cats)

    setGenerated(true)
    setLoading(false)
  }

  // ── Données filtrées ───────────────────────────────────────────────────────
  const filteredArticles = articles.filter(a => {
    const matchCat    = !filterCat    || a.categorie === filterCat
    const { label }   = statutBadge(a)
    const matchNiveau = !filterNiveau || label.toLowerCase() === filterNiveau
    return matchCat && matchNiveau
  })

  const filteredMouv = mouv.filter(m => {
    return !filterCat || m.article == null || (articles.find(a => a.reference === m.article?.reference)?.categorie ?? '') === filterCat
  })

  const alertArticles = articles.filter(a => a.stock_actuel < a.stock_minimum)

  const valorisation: ValRow[] = (() => {
    const map: Record<string, ValRow> = {}
    const catKey = (a: ArticleRow) => a.categorie ?? '— Sans catégorie —'
    articles.forEach(a => {
      const k = catKey(a)
      if (!map[k]) map[k] = { categorie: k, nb_articles: 0, stock_total: 0, valeur_achat: 0, valeur_vente: 0, marge: 0 }
      map[k].nb_articles  += 1
      map[k].stock_total  += a.stock_actuel
      map[k].valeur_achat += a.stock_actuel * a.prix_achat
      map[k].valeur_vente += a.stock_actuel * a.prix_vente
      map[k].marge        += a.stock_actuel * (a.prix_vente - a.prix_achat)
    })
    return Object.values(map).sort((a, b) => b.valeur_achat - a.valeur_achat)
  })()

  // ── CSV exports ────────────────────────────────────────────────────────────
  function exportCSV() {
    if (tab === 'catalogue') {
      downloadCSV(
        [['Référence','Désignation','Catégorie','Unité','Prix achat','Prix vente','Stock actuel','Minimum','Valeur stock','Statut'],
          ...filteredArticles.map(a => [a.reference, a.designation, a.categorie ?? '', a.unite, String(a.prix_achat), String(a.prix_vente), String(a.stock_actuel), String(a.stock_minimum), String(Math.round(a.stock_actuel * a.prix_achat)), statutBadge(a).label])],
        `rapport-stock-catalogue-${year}-${month}.csv`
      )
    } else if (tab === 'mouvements') {
      downloadCSV(
        [['Date','Article','Type','Quantité','Prix unitaire','Avant','Après','Motif','Par'],
          ...filteredMouv.map(m => [fmtDate(m.created_at), m.article ? `${m.article.reference} — ${m.article.designation}` : '', TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement, String(m.quantite), m.prix_unitaire != null ? String(m.prix_unitaire) : '', String(m.stock_avant), String(m.stock_apres), m.motif ?? '', m.created_by_profile?.full_name ?? ''])],
        `rapport-stock-mouvements-${year}-${month}.csv`
      )
    } else if (tab === 'valorisation') {
      downloadCSV(
        [['Catégorie','Nb articles','Stock total','Valeur achat','Valeur vente','Marge potentielle'],
          ...valorisation.map(v => [v.categorie, String(v.nb_articles), String(v.stock_total), String(Math.round(v.valeur_achat)), String(Math.round(v.valeur_vente)), String(Math.round(v.marge))])],
        `rapport-stock-valorisation-${year}-${month}.csv`
      )
    } else {
      downloadCSV(
        [['Référence','Désignation','Catégorie','Unité','Stock actuel','Minimum','Manquant','Qté suggérée','Statut'],
          ...alertArticles.map(a => {
            const manquant = Math.max(0, a.stock_minimum - a.stock_actuel)
            const suggere  = a.stock_maximum != null ? a.stock_maximum - a.stock_actuel : a.stock_minimum * 2
            return [a.reference, a.designation, a.categorie ?? '', a.unite, String(a.stock_actuel), String(a.stock_minimum), String(manquant), String(Math.max(0, suggere)), statutBadge(a).label]
          })],
        `rapport-stock-alertes-${year}-${month}.csv`
      )
    }
  }

  async function exportPDF() {
    const period = periodLabel()
    let blob: Blob
    if (tab === 'catalogue') {
      blob = await pdf(<CatalogueDoc rows={filteredArticles} period={period} />).toBlob()
    } else if (tab === 'mouvements') {
      blob = await pdf(<MouvementsDoc rows={filteredMouv} period={period} />).toBlob()
    } else if (tab === 'valorisation') {
      blob = await pdf(<ValorisationDoc rows={valorisation} period={period} />).toBlob()
    } else {
      blob = await pdf(<AlertesDoc rows={alertArticles} period={period} />).toBlob()
    }
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = `rapport-stock-${tab}-${year}-${month}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'catalogue',    label: t('tab_catalogue'),    icon: Package       },
    { id: 'mouvements',   label: t('tab_mouvements'),   icon: ArrowLeftRight },
    { id: 'valorisation', label: t('tab_valorisation'), icon: BarChart3     },
    { id: 'alertes',      label: t('tab_alertes'),      icon: Bell          },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">

      {/* En-tête */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
          <Package className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('page_title')}</h1>
          <p className="text-sm text-slate-500">{t('page_desc')}</p>
        </div>
      </div>

      {/* Tabs type de rapport */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
          {tabs.map(tb => {
            const Icon = tb.icon
            return (
              <button
                key={tb.id}
                onClick={() => { setTab(tb.id); setGenerated(false); }}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === tb.id
                    ? 'text-amber-600 border-amber-600 bg-amber-50/30'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tb.label}
              </button>
            )
          })}
        </div>

        {/* Filters panel */}
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            {(tab === 'mouvements' || tab === 'valorisation') && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('filter_year')}</label>
                  <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">{t('filter_month')}</label>
                  <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t('filter_categorie')}</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectCls}>
                <option value="">{t('filter_all')}</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {tab === 'catalogue' && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{t('filter_niveau')}</label>
                <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  <option value="normal">{t('filter_normal')}</option>
                  <option value="alerte">{t('filter_alerte')}</option>
                  <option value="rupture">{t('filter_rupture')}</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-1">
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {t('btn_generate')}
            </button>
          </div>
        </div>
      </div>

      {generated && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">
                {tab === 'catalogue' ? filteredArticles.length :
                 tab === 'mouvements' ? filteredMouv.length :
                 tab === 'valorisation' ? valorisation.length :
                 alertArticles.length}
              </span> résultats — <span className="italic">{tab === 'mouvements' || tab === 'valorisation' ? periodLabel() : 'Stock actuel'}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={exportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button onClick={exportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200">
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          </div>

          <div className="p-5">
              {/* ── Catalogue ── */}
              {tab === 'catalogue' && (
                <>
                  <p className="text-xs text-slate-400 mb-3">{t('results_count', { count: filteredArticles.length })}</p>
                  {filteredArticles.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">{t('no_results')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {[t('col_reference'), t('col_designation'), t('col_categorie'), t('col_unite'), t('col_prix_achat'), t('col_prix_vente'), t('col_stock_actuel'), t('col_stock_min'), t('col_valeur'), t('col_statut'), ''].map((h, i) => (
                              <th key={i} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredArticles.map(a => {
                            const { label, cls } = statutBadge(a)
                            return (
                              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="py-2 pr-4 font-mono text-xs text-slate-500">{a.reference}</td>
                                <td className="py-2 pr-4 font-medium text-slate-800">{a.designation}</td>
                                <td className="py-2 pr-4 text-slate-500">{a.categorie ?? '—'}</td>
                                <td className="py-2 pr-4 text-slate-500">{a.unite}</td>
                                <td className="py-2 pr-4 text-slate-700">{fmt(a.prix_achat)}</td>
                                <td className="py-2 pr-4 text-slate-700">{fmt(a.prix_vente)}</td>
                                <td className="py-2 pr-4 font-semibold text-slate-800">{fmtQte(a.stock_actuel)}</td>
                                <td className="py-2 pr-4 text-slate-500">{fmtQte(a.stock_minimum)}</td>
                                <td className="py-2 pr-4 font-semibold text-amber-700">{fmt(a.stock_actuel * a.prix_achat)}</td>
                                <td className="py-2 pr-4">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
                                </td>
                                <td className="py-2">
                                  <button
                                    onClick={() => router.push(`${carteBase}/${a.id}`)}
                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" /> {t('btn_carte')}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Mouvements ── */}
              {tab === 'mouvements' && (
                <>
                  <p className="text-xs text-slate-400 mb-3">{t('results_count', { count: filteredMouv.length })}</p>
                  {filteredMouv.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">{t('no_results')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {[t('col_date'), t('col_article'), t('col_type'), t('col_quantite'), t('col_prix_u'), t('col_stock_avant'), t('col_stock_apres'), t('col_motif'), t('col_par')].map((h, i) => (
                              <th key={i} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMouv.map(m => {
                            const Icon  = TYPE_ICON[m.type_mouvement]  ?? Package
                            const color = TYPE_COLOR[m.type_mouvement] ?? 'text-slate-600'
                            return (
                              <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                                <td className="py-2 pr-4 font-medium text-slate-800">
                                  {m.article ? <><span className="font-mono text-xs text-slate-400 mr-1">{m.article.reference}</span>{m.article.designation}</> : '—'}
                                </td>
                                <td className="py-2 pr-4">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
                                    <Icon className="h-3.5 w-3.5" /> {TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 font-semibold text-slate-800">{fmtQte(m.quantite)} {m.article?.unite ?? ''}</td>
                                <td className="py-2 pr-4 text-slate-600">{m.prix_unitaire != null ? `${fmt(m.prix_unitaire)} FCFA` : '—'}</td>
                                <td className="py-2 pr-4 text-slate-500">{fmtQte(m.stock_avant)}</td>
                                <td className="py-2 pr-4 text-slate-500">{fmtQte(m.stock_apres)}</td>
                                <td className="py-2 pr-4 text-slate-500 max-w-[160px] truncate">{m.motif ?? '—'}</td>
                                <td className="py-2 pr-4 text-slate-500">{m.created_by_profile?.full_name ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Valorisation ── */}
              {tab === 'valorisation' && (
                <>
                  <p className="text-xs text-slate-400 mb-3">{t('results_count', { count: valorisation.length })}</p>
                  {valorisation.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">{t('no_results')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {[t('col_categorie'), t('col_nb_articles'), t('col_stock_total'), t('col_valeur_achat'), t('col_valeur_vente'), t('col_marge')].map((h, i) => (
                              <th key={i} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {valorisation.map((v, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-2 pr-4 font-medium text-slate-800">{v.categorie}</td>
                              <td className="py-2 pr-4 text-slate-600">{v.nb_articles}</td>
                              <td className="py-2 pr-4 text-slate-600">{fmtQte(v.stock_total)}</td>
                              <td className="py-2 pr-4 font-semibold text-slate-800">{fmt(v.valeur_achat)} FCFA</td>
                              <td className="py-2 pr-4 font-semibold text-slate-800">{fmt(v.valeur_vente)} FCFA</td>
                              <td className={`py-2 pr-4 font-semibold ${v.marge >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(v.marge)} FCFA</td>
                            </tr>
                          ))}
                          {/* Total */}
                          <tr className="border-t-2 border-slate-200 bg-amber-50">
                            <td className="py-2 pr-4 font-bold text-slate-800">Total</td>
                            <td className="py-2 pr-4 font-bold text-slate-800">{valorisation.reduce((s, v) => s + v.nb_articles, 0)}</td>
                            <td className="py-2 pr-4 text-slate-600">—</td>
                            <td className="py-2 pr-4 font-bold text-amber-700">{fmt(valorisation.reduce((s, v) => s + v.valeur_achat, 0))} FCFA</td>
                            <td className="py-2 pr-4 font-bold text-amber-700">{fmt(valorisation.reduce((s, v) => s + v.valeur_vente, 0))} FCFA</td>
                            <td className="py-2 pr-4 font-bold text-emerald-700">{fmt(valorisation.reduce((s, v) => s + v.marge, 0))} FCFA</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Alertes ── */}
              {tab === 'alertes' && (
                <>
                  <p className="text-xs text-slate-400 mb-3">{t('results_count', { count: alertArticles.length })}</p>
                  {alertArticles.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">{t('no_results')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {[t('col_reference'), t('col_designation'), t('col_categorie'), t('col_unite'), t('col_stock_actuel'), t('col_stock_min'), t('col_manquant'), t('col_suggere'), t('col_statut'), ''].map((h, i) => (
                              <th key={i} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {alertArticles.map(a => {
                            const manquant        = Math.max(0, a.stock_minimum - a.stock_actuel)
                            const suggere         = a.stock_maximum != null ? a.stock_maximum - a.stock_actuel : a.stock_minimum * 2
                            const { label, cls }  = statutBadge(a)
                            return (
                              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="py-2 pr-4 font-mono text-xs text-slate-500">{a.reference}</td>
                                <td className="py-2 pr-4 font-medium text-slate-800">{a.designation}</td>
                                <td className="py-2 pr-4 text-slate-500">{a.categorie ?? '—'}</td>
                                <td className="py-2 pr-4 text-slate-500">{a.unite}</td>
                                <td className="py-2 pr-4 font-semibold text-slate-800">{fmtQte(a.stock_actuel)}</td>
                                <td className="py-2 pr-4 text-slate-500">{fmtQte(a.stock_minimum)}</td>
                                <td className="py-2 pr-4 font-semibold text-red-600">{fmtQte(manquant)}</td>
                                <td className="py-2 pr-4 text-emerald-700 font-semibold">{fmtQte(Math.max(0, suggere))}</td>
                                <td className="py-2 pr-4">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
                                </td>
                                <td className="py-2">
                                  <button
                                    onClick={() => router.push(`${carteBase}/${a.id}`)}
                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" /> {t('btn_carte')}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
      )}
    </div>
  )
}
