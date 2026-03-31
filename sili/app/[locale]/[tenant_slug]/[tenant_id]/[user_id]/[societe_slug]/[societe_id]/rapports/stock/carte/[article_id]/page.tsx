'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Package, ArrowLeft, Printer, Loader2,
  ArrowDownCircle, ArrowUpCircle, TrendingDown,
} from 'lucide-react'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt     = (n: number | null | undefined) => n != null ? new Intl.NumberFormat('fr-FR').format(Math.round(n)) : '—'
const fmtQte  = (n: number | null | undefined) => n != null ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n) : '—'
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

// ── Types ──────────────────────────────────────────────────────────────────────

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

const TYPE_ICON:  Record<string, React.ElementType> = { entree: ArrowDownCircle, sortie: ArrowUpCircle, ajustement: TrendingDown, inventaire: Package }
const TYPE_COLOR: Record<string, string>             = { entree: 'text-emerald-600', sortie: 'text-red-500', ajustement: 'text-amber-600', inventaire: 'text-blue-600' }
const TYPE_LABEL: Record<string, string>             = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', inventaire: 'Inventaire' }

// ── PDF ────────────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:     { padding: 30, fontFamily: 'Helvetica', fontSize: 9 },
  h1:       { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#d97706' },
  h2:       { fontSize: 11, fontWeight: 'bold', marginBottom: 6, marginTop: 14, color: '#374151' },
  ref:      { fontSize: 10, color: '#64748b', marginBottom: 12 },
  row:      { flexDirection: 'row', marginBottom: 3 },
  label:    { fontSize: 9, color: '#64748b', width: 120 },
  value:    { fontSize: 9, color: '#1e293b', fontWeight: 'bold' },
  table:    { width: '100%', marginTop: 6 },
  thead:    { flexDirection: 'row', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' },
  trow:     { flexDirection: 'row', borderBottom: '1px solid #f1f5f9' },
  th:       { padding: '3 5', fontWeight: 'bold', color: '#374151', fontSize: 8 },
  td:       { padding: '3 5', color: '#1e293b', fontSize: 8 },
  footer:   { marginTop: 20, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
  divider:  { borderBottom: '1px solid #e2e8f0', marginTop: 10, marginBottom: 2 },
})

function CarteDoc({ article: a, mouvements }: { article: Article; mouvements: Mouvement[] }) {
  const valeur = a.stock_actuel * a.prix_achat
  const marge  = a.prix_vente - a.prix_achat

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.h1}>Carte Stock — {a.designation}</Text>
        <Text style={pdfStyles.ref}>Réf. {a.reference} | Généré le {new Date().toLocaleDateString('fr-FR')}</Text>

        {/* Identité */}
        <Text style={pdfStyles.h2}>Identité de l&apos;article</Text>
        {[
          ['Référence',    a.reference],
          ['Désignation',  a.designation],
          ['Description',  a.description ?? '—'],
          ['Catégorie',    a.categorie ?? '—'],
          ['Unité',        a.unite],
          ['Emplacement',  a.emplacement ?? '—'],
          ['Statut',       a.is_active ? 'Actif' : 'Inactif'],
        ].map(([l, v]) => (
          <View key={l} style={pdfStyles.row}>
            <Text style={pdfStyles.label}>{l}</Text>
            <Text style={pdfStyles.value}>{v}</Text>
          </View>
        ))}

        {/* Niveaux de stock */}
        <View style={pdfStyles.divider} />
        <Text style={pdfStyles.h2}>Niveaux de stock</Text>
        {[
          ['Stock actuel',  fmtQte(a.stock_actuel) + ' ' + a.unite],
          ['Stock minimum', fmtQte(a.stock_minimum) + ' ' + a.unite],
          ['Stock maximum', a.stock_maximum != null ? fmtQte(a.stock_maximum) + ' ' + a.unite : '—'],
          ['Valeur en stock', fmt(valeur) + ' FCFA'],
        ].map(([l, v]) => (
          <View key={l} style={pdfStyles.row}>
            <Text style={pdfStyles.label}>{l}</Text>
            <Text style={pdfStyles.value}>{v}</Text>
          </View>
        ))}

        {/* Prix */}
        <View style={pdfStyles.divider} />
        <Text style={pdfStyles.h2}>Prix</Text>
        {[
          ['Prix d\'achat',  fmt(a.prix_achat) + ' FCFA'],
          ['Prix de vente',  fmt(a.prix_vente) + ' FCFA'],
          ['Marge unitaire', fmt(marge) + ' FCFA'],
        ].map(([l, v]) => (
          <View key={l} style={pdfStyles.row}>
            <Text style={pdfStyles.label}>{l}</Text>
            <Text style={pdfStyles.value}>{v}</Text>
          </View>
        ))}

        {/* Historique */}
        <View style={pdfStyles.divider} />
        <Text style={pdfStyles.h2}>Historique des mouvements (30 derniers)</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Date','Type','Quantité','Prix unitaire','Avant','Après','Motif','Par'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 6 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {mouvements.map((m, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtDate(m.created_at)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(m.quantite)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{m.prix_unitaire != null ? fmt(m.prix_unitaire) : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(m.stock_avant)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{fmtQte(m.stock_apres)}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{m.motif ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{m.created_by_profile?.full_name ?? '—'}</Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.footer}>SILI Suite — Carte Stock générée le {new Date().toLocaleDateString('fr-FR')}</Text>
      </Page>
    </Document>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CarteStockPage() {
  const t      = useTranslations('rapports_stock')
  const params = useParams()
  const router = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const articleId   = params.article_id   as string

  const rapportBase = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/rapports/stock`

  const [loading,    setLoading]    = useState(true)
  const [article,    setArticle]    = useState<Article | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [exporting,  setExporting]  = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: art }, { data: movs }] = await Promise.all([
        (supabase as any)
          .from('stock_articles')
          .select('*')
          .eq('id', articleId)
          .eq('societe_id', societeId)
          .single(),

        (supabase as any)
          .from('stock_mouvements')
          .select('id, type_mouvement, quantite, stock_avant, stock_apres, prix_unitaire, reference_source, motif, created_at, created_by_profile:created_by(full_name)')
          .eq('article_id', articleId)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      setArticle(art)
      setMouvements(movs ?? [])
      setLoading(false)
    }
    load()
  }, [articleId, societeId])

  async function handleExportPDF() {
    if (!article) return
    setExporting(true)
    const blob = await pdf(<CarteDoc article={article} mouvements={mouvements} />).toBlob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `carte-stock-${article.reference}.pdf`; a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex h-60 items-center justify-center text-slate-500 text-sm">
        Article introuvable.
      </div>
    )
  }

  const valeur = article.stock_actuel * article.prix_achat
  const marge  = article.prix_vente - article.prix_achat

  const stockPct = article.stock_maximum
    ? Math.min(100, (article.stock_actuel / article.stock_maximum) * 100)
    : article.stock_minimum > 0
      ? Math.min(100, (article.stock_actuel / (article.stock_minimum * 2)) * 100)
      : 0

  const barColor = article.stock_actuel <= 0
    ? 'bg-red-500'
    : article.stock_actuel < article.stock_minimum
      ? 'bg-orange-400'
      : 'bg-emerald-500'

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(rapportBase)} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
            <Package className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{t('carte_title')} — {article.designation}</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Réf. {article.reference}</p>
          </div>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          {t('btn_imprimer')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Identité */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('carte_identity')}</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Référence',   article.reference],
              ['Désignation', article.designation],
              ['Catégorie',   article.categorie ?? '—'],
              ['Unité',       article.unite],
              ['Emplacement', article.emplacement ?? '—'],
              ['Description', article.description ?? '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <dt className="text-slate-500">{l}</dt>
                <dd className="font-medium text-slate-800 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Niveaux de stock */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('carte_niveaux')}</h2>

          {/* Barre visuelle */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>0</span>
              <span className="font-semibold text-slate-700">{fmtQte(article.stock_actuel)} {article.unite}</span>
              {article.stock_maximum && <span>{fmtQte(article.stock_maximum)}</span>}
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(2, stockPct)}%` }} />
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="h-2.5 w-0.5 bg-orange-400" style={{ marginLeft: article.stock_minimum > 0 && article.stock_maximum ? `${(article.stock_minimum / article.stock_maximum) * 100}%` : '0' }} />
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            {[
              ['Stock actuel',  `${fmtQte(article.stock_actuel)} ${article.unite}`],
              ['Stock minimum', `${fmtQte(article.stock_minimum)} ${article.unite}`],
              ['Stock maximum', article.stock_maximum != null ? `${fmtQte(article.stock_maximum)} ${article.unite}` : '—'],
              [t('carte_valeur'), `${fmt(valeur)} FCFA`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <dt className="text-slate-500">{l}</dt>
                <dd className="font-semibold text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Prix */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:col-span-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('carte_prix')}</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Prix d'achat",  value: `${fmt(article.prix_achat)} FCFA`,  cls: 'text-slate-800' },
              { label: "Prix de vente", value: `${fmt(article.prix_vente)} FCFA`,  cls: 'text-slate-800' },
              { label: t('carte_marge'), value: `${fmt(marge)} FCFA`,              cls: marge >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map((item, i) => (
              <div key={i} className="text-center bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.cls}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historique des mouvements */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{t('carte_historique')}</h2>
        {mouvements.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Aucun mouvement enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Date','Type','Quantité','Prix unitaire','Avant','Après','Motif','Par'].map((h, i) => (
                    <th key={i} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mouvements.map(m => {
                  const Icon  = TYPE_ICON[m.type_mouvement]  ?? Package
                  const color = TYPE_COLOR[m.type_mouvement] ?? 'text-slate-600'
                  return (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
                          <Icon className="h-3.5 w-3.5" /> {TYPE_LABEL[m.type_mouvement] ?? m.type_mouvement}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-semibold text-slate-800">{fmtQte(m.quantite)} {article.unite}</td>
                      <td className="py-2 pr-4 text-slate-600">{m.prix_unitaire != null ? `${fmt(m.prix_unitaire)} FCFA` : '—'}</td>
                      <td className="py-2 pr-4 text-slate-500">{fmtQte(m.stock_avant)}</td>
                      <td className="py-2 pr-4 text-slate-500">{fmtQte(m.stock_apres)}</td>
                      <td className="py-2 pr-4 text-slate-500 max-w-[180px] truncate">{m.motif ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-500">{m.created_by_profile?.full_name ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
