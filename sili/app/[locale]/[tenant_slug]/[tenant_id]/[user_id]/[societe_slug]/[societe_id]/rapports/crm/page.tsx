'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  PhoneCall, Download, FileText, Loader2,
  UserPlus, TrendingUp, FileCheck, CreditCard,
} from 'lucide-react'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── helpers ────────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function formatMontant(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR') + ' FCFA'
}

// ── PDF styles ─────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:    { padding: 30, fontFamily: 'Helvetica', fontSize: 9 },
  header:  { marginBottom: 16 },
  company: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  period:  { fontSize: 10, color: '#555', marginBottom: 8 },
  title:   { fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#db2777' },
  table:   { width: '100%' },
  thead:   { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' },
  trow:    { flexDirection: 'row', borderBottom: '1px solid #e2e8f0' },
  th:      { padding: '4 6', fontWeight: 'bold', color: '#374151' },
  td:      { padding: '4 6', color: '#1e293b' },
  footer:  { marginTop: 20, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportType = 'leads' | 'opps' | 'devis' | 'factures'

interface LeadRow {
  id: string; nom: string; societe: string | null; source: string; statut: string
  valeur_estimee: number | null; responsable: string; created_at: string
}

interface OppRow {
  id: string; nom: string; client: string | null; objet: string | null
  montant: number | null; etape: string; probabilite: number | null
  date_cloture_prevue: string | null; responsable: string
}

interface DevisRow {
  id: string; numero: string | null; client: string | null; objet: string | null
  montant_ht: number | null; montant_ttc: number | null; statut: string
  assigne: string; created_at: string
}

interface FactureRow {
  id: string; numero: string | null; client: string | null; objet: string | null
  montant_ttc: number | null; montant_paye: number | null; montant_restant: number | null
  statut: string; assigne: string; created_at: string; progression: number
}

interface KpiData {
  caFacture:   number
  caEncaisse:  number
  conversion:  number
  devisAttente: number
}

// ── Couleurs statut ────────────────────────────────────────────────────────────

const STATUT_LEAD: Record<string, string> = {
  nouveau:   'bg-slate-100 text-slate-600',
  contacte:  'bg-blue-100 text-blue-700',
  qualifie:  'bg-emerald-100 text-emerald-700',
  perdu:     'bg-red-100 text-red-500',
}

const ETAPE_OPP: Record<string, string> = {
  prospection:   'bg-slate-100 text-slate-600',
  qualification: 'bg-blue-100 text-blue-700',
  proposition:   'bg-violet-100 text-violet-700',
  negociation:   'bg-amber-100 text-amber-700',
  gagnee:        'bg-emerald-100 text-emerald-700',
  perdue:        'bg-red-100 text-red-500',
}

const STATUT_DEVIS: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  envoye:    'bg-blue-100 text-blue-700',
  accepte:   'bg-emerald-100 text-emerald-700',
  refuse:    'bg-red-100 text-red-500',
  expire:    'bg-amber-100 text-amber-700',
}

const STATUT_FACTURE: Record<string, string> = {
  brouillon:           'bg-slate-100 text-slate-600',
  emise:               'bg-blue-100 text-blue-700',
  partiellement_payee: 'bg-amber-100 text-amber-700',
  payee:               'bg-emerald-100 text-emerald-700',
  annulee:             'bg-red-100 text-red-500',
}

// ── PDF Documents ──────────────────────────────────────────────────────────────

function LeadsDoc({ rows, period }: { rows: LeadRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport CRM — Leads</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des leads</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Nom','Société','Source','Statut','Valeur est.','Responsable','Créé le'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 0 || i === 5 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.nom}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.societe ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.source}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.valeur_estimee != null ? r.valeur_estimee.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.responsable}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.created_at)}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} lead(s)</Text>
      </Page>
    </Document>
  )
}

function OppsDoc({ rows, period }: { rows: OppRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport CRM — Opportunités</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des opportunités</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Nom','Client','Objet','Montant','Étape','Probabilité','Clôture prévue','Responsable'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 0 || i === 7 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.nom}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.client ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.objet ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant != null ? r.montant.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.etape}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.probabilite != null ? `${r.probabilite}%` : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.date_cloture_prevue)}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.responsable}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} opportunité(s)</Text>
      </Page>
    </Document>
  )
}

function DevisDoc({ rows, period }: { rows: DevisRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport CRM — Devis</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des devis</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Numéro','Client','Objet','Montant HT','Montant TTC','Statut','Assigné','Créé le'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 2 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.numero ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.client ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.objet ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant_ht != null ? r.montant_ht.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant_ttc != null ? r.montant_ttc.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.assigne}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.created_at)}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} devis</Text>
      </Page>
    </Document>
  )
}

function FacturesDoc({ rows, period }: { rows: FactureRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport CRM — Factures & Paiements</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des factures</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Numéro','Client','Objet','Total TTC','Payé','Restant','Statut','Assigné'].map((h, i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 2 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.numero ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.client ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.objet ?? '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant_ttc != null ? r.montant_ttc.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant_paye != null ? r.montant_paye.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.montant_restant != null ? r.montant_restant.toLocaleString('fr-FR') : '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.assigne}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} facture(s)</Text>
      </Page>
    </Document>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1,  label: 'Janvier' }, { value: 2,  label: 'Février' },
  { value: 3,  label: 'Mars' },    { value: 4,  label: 'Avril' },
  { value: 5,  label: 'Mai' },     { value: 6,  label: 'Juin' },
  { value: 7,  label: 'Juillet' }, { value: 8,  label: 'Août' },
  { value: 9,  label: 'Septembre' },{ value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },{ value: 12, label: 'Décembre' },
]

const now = new Date()

export default function RapportCrmPage() {
  const t      = useTranslations('rapports_crm')
  const params = useParams()

  const societeId    = params.societe_id   as string
  const tenantId     = params.tenant_id    as string

  // ── Période ────────────────────────────────────────────────────────────────

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // ── Onglet actif ───────────────────────────────────────────────────────────

  const [tab, setTab] = useState<ReportType>('leads')

  // ── Filtres ────────────────────────────────────────────────────────────────

  const [filterStatutLead,    setFilterStatutLead]    = useState('')
  const [filterSourceLead,    setFilterSourceLead]    = useState('')
  const [filterEtapeOpp,      setFilterEtapeOpp]      = useState('')
  const [filterStatutDevis,   setFilterStatutDevis]   = useState('')
  const [filterStatutFacture, setFilterStatutFacture] = useState('')

  // ── Data ───────────────────────────────────────────────────────────────────

  const [loading, setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)
  const [leads,    setLeads]    = useState<LeadRow[]>([])
  const [opps,     setOpps]     = useState<OppRow[]>([])
  const [devis,    setDevis]    = useState<DevisRow[]>([])
  const [factures, setFactures] = useState<FactureRow[]>([])
  const [kpis,     setKpis]     = useState<KpiData>({ caFacture: 0, caEncaisse: 0, conversion: 0, devisAttente: 0 })

  // ── Helpers ────────────────────────────────────────────────────────────────

  function periodStart() {
    return `${year}-${String(month).padStart(2, '0')}-01`
  }
  function periodEnd() {
    const d = new Date(year, month, 1)
    return d.toISOString().split('T')[0]
  }

  async function resolveProfile(userId: string | null): Promise<string> {
    if (!userId) return '—'
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
    return (data as any)?.full_name ?? '—'
  }

  // ── Génération ─────────────────────────────────────────────────────────────

  async function generate() {
    setLoading(true)
    const start = periodStart()
    const end   = periodEnd()

    // ── Leads ────────────────────────────────────────────────────────────────
    let leadsQuery = (supabase as any)
      .from('crm_leads')
      .select('id, nom, societe, source, statut, valeur_estimee, responsable_id, created_at')
      .eq('societe_id', societeId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (filterStatutLead)  leadsQuery = leadsQuery.eq('statut', filterStatutLead)
    if (filterSourceLead)  leadsQuery = leadsQuery.eq('source', filterSourceLead)
    const { data: leadsRaw } = await leadsQuery

    const leadsResolved: LeadRow[] = await Promise.all(
      (leadsRaw ?? []).map(async (l: any) => ({
        ...l,
        responsable: await resolveProfile(l.responsable_id),
      }))
    )
    setLeads(leadsResolved)

    // ── Opportunités ─────────────────────────────────────────────────────────
    let oppsQuery = (supabase as any)
      .from('crm_opportunites')
      .select('id, nom, client, objet, montant, etape, probabilite, date_cloture_prevue, responsable_id, created_at')
      .eq('societe_id', societeId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (filterEtapeOpp)    oppsQuery = oppsQuery.eq('etape', filterEtapeOpp)
    const { data: oppsRaw } = await oppsQuery

    const oppsResolved: OppRow[] = await Promise.all(
      (oppsRaw ?? []).map(async (o: any) => ({
        ...o,
        responsable: await resolveProfile(o.responsable_id),
      }))
    )
    setOpps(oppsResolved)

    // ── Devis ─────────────────────────────────────────────────────────────────
    let devisQuery = (supabase as any)
      .from('crm_devis')
      .select('id, numero, client, objet, montant_ht, montant_ttc, statut, assigne_a, created_at')
      .eq('societe_id', societeId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (filterStatutDevis) devisQuery = devisQuery.eq('statut', filterStatutDevis)
    const { data: devisRaw } = await devisQuery

    const devisResolved: DevisRow[] = await Promise.all(
      (devisRaw ?? []).map(async (d: any) => ({
        ...d,
        assigne: await resolveProfile(d.assigne_a),
      }))
    )
    setDevis(devisResolved)

    // ── Factures ──────────────────────────────────────────────────────────────
    let factQuery = (supabase as any)
      .from('crm_factures')
      .select('id, numero, client, objet, montant_ttc, montant_paye, montant_restant, statut, assigne_a, created_at')
      .eq('societe_id', societeId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
    if (filterStatutFacture) factQuery = factQuery.eq('statut', filterStatutFacture)
    const { data: factRaw } = await factQuery

    const facturesResolved: FactureRow[] = await Promise.all(
      (factRaw ?? []).map(async (f: any) => {
        const pct = f.montant_ttc > 0 ? Math.round((f.montant_paye ?? 0) / f.montant_ttc * 100) : 0
        return { ...f, assigne: await resolveProfile(f.assigne_a), progression: pct }
      })
    )
    setFactures(facturesResolved)

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const [{ data: allLeads }, { data: allOpps }, { data: allFact }] = await Promise.all([
      (supabase as any).from('crm_leads').select('statut').eq('societe_id', societeId).gte('created_at', start).lt('created_at', end),
      (supabase as any).from('crm_opportunites').select('etape').eq('societe_id', societeId).gte('created_at', start).lt('created_at', end),
      (supabase as any).from('crm_factures').select('montant_ttc, montant_paye, statut').eq('societe_id', societeId).gte('created_at', start).lt('created_at', end),
    ])

    const totalLeads    = (allLeads ?? []).length
    const oppsGagnees   = (allOpps ?? []).filter((o: any) => o.etape === 'gagnee').length
    const conversion    = totalLeads > 0 ? Math.round(oppsGagnees / totalLeads * 100) : 0
    const caFacture     = (allFact ?? []).filter((f: any) => ['emise', 'partiellement_payee', 'payee'].includes(f.statut)).reduce((s: number, f: any) => s + (f.montant_ttc ?? 0), 0)
    const caEncaisse    = (allFact ?? []).reduce((s: number, f: any) => s + (f.montant_paye ?? 0), 0)
    const devisAttente  = (devisResolved ?? []).filter(d => d.statut === 'envoye').length

    setKpis({ caFacture, caEncaisse, conversion, devisAttente })
    setGenerated(true)
    setLoading(false)
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const period = monthLabel(year, month)
    if (tab === 'leads') {
      downloadCSV(
        [['Nom','Société','Source','Statut','Valeur estimée','Responsable','Créé le'],
         ...leads.map(r => [r.nom, r.societe ?? '', r.source, r.statut, String(r.valeur_estimee ?? ''), r.responsable, formatDate(r.created_at)])],
        `rapport-crm-leads-${period}.csv`
      )
    } else if (tab === 'opps') {
      downloadCSV(
        [['Nom','Client','Objet','Montant','Étape','Probabilité','Clôture prévue','Responsable'],
         ...opps.map(r => [r.nom, r.client ?? '', r.objet ?? '', String(r.montant ?? ''), r.etape, r.probabilite != null ? `${r.probabilite}%` : '', formatDate(r.date_cloture_prevue), r.responsable])],
        `rapport-crm-opportunites-${period}.csv`
      )
    } else if (tab === 'devis') {
      downloadCSV(
        [['Numéro','Client','Objet','Montant HT','Montant TTC','Statut','Assigné','Créé le'],
         ...devis.map(r => [r.numero ?? '', r.client ?? '', r.objet ?? '', String(r.montant_ht ?? ''), String(r.montant_ttc ?? ''), r.statut, r.assigne, formatDate(r.created_at)])],
        `rapport-crm-devis-${period}.csv`
      )
    } else {
      downloadCSV(
        [['Numéro','Client','Objet','Total TTC','Payé','Restant','Statut','Assigné','Créé le'],
         ...factures.map(r => [r.numero ?? '', r.client ?? '', r.objet ?? '', String(r.montant_ttc ?? ''), String(r.montant_paye ?? ''), String(r.montant_restant ?? ''), r.statut, r.assigne, formatDate(r.created_at)])],
        `rapport-crm-factures-${period}.csv`
      )
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────

  async function exportPDF() {
    const period = monthLabel(year, month)
    let doc: React.ReactElement
    let filename: string
    if (tab === 'leads') {
      doc = <LeadsDoc rows={leads} period={period} />
      filename = `rapport-crm-leads-${period}.pdf`
    } else if (tab === 'opps') {
      doc = <OppsDoc rows={opps} period={period} />
      filename = `rapport-crm-opportunites-${period}.pdf`
    } else if (tab === 'devis') {
      doc = <DevisDoc rows={devis} period={period} />
      filename = `rapport-crm-devis-${period}.pdf`
    } else {
      doc = <FacturesDoc rows={factures} period={period} />
      filename = `rapport-crm-factures-${period}.pdf`
    }
    const blob = await pdf(doc).toBlob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Données courantes ──────────────────────────────────────────────────────

  const currentRows = tab === 'leads' ? leads : tab === 'opps' ? opps : tab === 'devis' ? devis : factures
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: ReportType; label: string; icon: React.ElementType }[] = [
    { id: 'leads',    label: t('tab_leads'),    icon: UserPlus    },
    { id: 'opps',     label: t('tab_opps'),     icon: TrendingUp  },
    { id: 'devis',    label: t('tab_devis'),    icon: FileCheck   },
    { id: 'factures', label: t('tab_factures'), icon: CreditCard  },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('page_title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('page_desc')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-50 border border-pink-100">
          <PhoneCall className="h-6 w-6 text-pink-600" />
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? 'text-pink-600 border-pink-600 bg-pink-50/40'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Année */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">{t('filter_year')}</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Mois */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">{t('filter_month')}</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Filtre Statut lead */}
            {tab === 'leads' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">{t('filter_statut')}</label>
                  <select value={filterStatutLead} onChange={e => setFilterStatutLead(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                    <option value="">{t('filter_all')}</option>
                    {['nouveau','contacte','qualifie','perdu'].map(s => (
                      <option key={s} value={s}>{t(`statut_lead_${s}` as any)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">{t('filter_source')}</label>
                  <select value={filterSourceLead} onChange={e => setFilterSourceLead(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                    <option value="">{t('filter_all')}</option>
                    {['site_web','referral','appel','email','autre'].map(s => (
                      <option key={s} value={s}>{t(`source_${s}` as any)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Filtre Étape opportunité */}
            {tab === 'opps' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">{t('filter_etape')}</label>
                <select value={filterEtapeOpp} onChange={e => setFilterEtapeOpp(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">{t('filter_all')}</option>
                  {['prospection','qualification','proposition','negociation','gagnee','perdue'].map(s => (
                    <option key={s} value={s}>{t(`etape_${s}` as any)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtre Statut devis */}
            {tab === 'devis' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">{t('filter_statut')}</label>
                <select value={filterStatutDevis} onChange={e => setFilterStatutDevis(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">{t('filter_all')}</option>
                  {['brouillon','envoye','accepte','refuse','expire'].map(s => (
                    <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtre Statut facture */}
            {tab === 'factures' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">{t('filter_statut')}</label>
                <select value={filterStatutFacture} onChange={e => setFilterStatutFacture(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">{t('filter_all')}</option>
                  {['brouillon','emise','partiellement_payee','payee','annulee'].map(s => (
                    <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Bouton générer */}
            <button
              onClick={generate}
              disabled={loading}
              className="ml-auto h-9 inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('btn_generate')}
            </button>
          </div>
        </div>

        {/* KPIs */}
        {generated && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-b border-slate-100">
            <div className="bg-pink-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-pink-700">{kpis.caFacture.toLocaleString('fr-FR')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('kpi_ca_facture')}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-emerald-700">{kpis.caEncaisse.toLocaleString('fr-FR')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('kpi_ca_encaisse')}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-indigo-700">{kpis.conversion}%</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('kpi_conversion')}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-amber-700">{kpis.devisAttente}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('kpi_devis_attente')}</p>
            </div>
          </div>
        )}

        {/* Résultats */}
        {generated && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {t('results_count', { count: currentRows.length })}
              </p>
              <div className="flex gap-2">
                <button onClick={exportCSV}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={exportPDF}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-100 transition-colors">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            </div>

            {currentRows.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 py-10 text-center text-sm text-slate-400">
                {t('no_results')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <tr>
                      {/* Leads */}
                      {tab === 'leads' && <>
                        <th className="px-4 py-3 text-left">{t('col_nom')}</th>
                        <th className="px-4 py-3 text-left">{t('col_societe')}</th>
                        <th className="px-4 py-3 text-left">{t('col_source')}</th>
                        <th className="px-4 py-3 text-left">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-right">{t('col_valeur')}</th>
                        <th className="px-4 py-3 text-left">{t('col_responsable')}</th>
                        <th className="px-4 py-3 text-left">{t('col_date_creation')}</th>
                      </>}
                      {/* Opportunités */}
                      {tab === 'opps' && <>
                        <th className="px-4 py-3 text-left">{t('col_nom')}</th>
                        <th className="px-4 py-3 text-left">{t('col_client')}</th>
                        <th className="px-4 py-3 text-left">{t('col_objet')}</th>
                        <th className="px-4 py-3 text-right">{t('col_montant_ttc')}</th>
                        <th className="px-4 py-3 text-left">{t('col_etape')}</th>
                        <th className="px-4 py-3 text-right">{t('col_probabilite')}</th>
                        <th className="px-4 py-3 text-left">{t('col_date_cloture')}</th>
                        <th className="px-4 py-3 text-left">{t('col_responsable')}</th>
                      </>}
                      {/* Devis */}
                      {tab === 'devis' && <>
                        <th className="px-4 py-3 text-left">{t('col_numero')}</th>
                        <th className="px-4 py-3 text-left">{t('col_client')}</th>
                        <th className="px-4 py-3 text-left">{t('col_objet')}</th>
                        <th className="px-4 py-3 text-right">{t('col_montant_ht')}</th>
                        <th className="px-4 py-3 text-right">{t('col_montant_ttc')}</th>
                        <th className="px-4 py-3 text-left">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left">{t('col_assigne')}</th>
                        <th className="px-4 py-3 text-left">{t('col_date_creation')}</th>
                      </>}
                      {/* Factures */}
                      {tab === 'factures' && <>
                        <th className="px-4 py-3 text-left">{t('col_numero')}</th>
                        <th className="px-4 py-3 text-left">{t('col_client')}</th>
                        <th className="px-4 py-3 text-left">{t('col_objet')}</th>
                        <th className="px-4 py-3 text-right">{t('col_montant_ttc')}</th>
                        <th className="px-4 py-3 text-right">{t('col_montant_paye')}</th>
                        <th className="px-4 py-3 text-right">{t('col_restant')}</th>
                        <th className="px-4 py-3 text-left">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left">{t('col_progression')}</th>
                        <th className="px-4 py-3 text-left">{t('col_assigne')}</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">

                    {/* Leads rows */}
                    {tab === 'leads' && (leads as LeadRow[]).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{r.nom}</td>
                        <td className="px-4 py-3 text-slate-600">{r.societe ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {t(`source_${r.source}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_LEAD[r.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {t(`statut_lead_${r.statut}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{r.valeur_estimee != null ? r.valeur_estimee.toLocaleString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.responsable}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}

                    {/* Opportunités rows */}
                    {tab === 'opps' && (opps as OppRow[]).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{r.nom}</td>
                        <td className="px-4 py-3 text-slate-600">{r.client ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.objet ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{r.montant != null ? r.montant.toLocaleString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ETAPE_OPP[r.etape] ?? 'bg-slate-100 text-slate-500'}`}>
                            {t(`etape_${r.etape}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{r.probabilite != null ? `${r.probabilite}%` : '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.date_cloture_prevue)}</td>
                        <td className="px-4 py-3 text-slate-600">{r.responsable}</td>
                      </tr>
                    ))}

                    {/* Devis rows */}
                    {tab === 'devis' && (devis as DevisRow[]).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.numero ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{r.client ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.objet ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{r.montant_ht != null ? r.montant_ht.toLocaleString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{r.montant_ttc != null ? r.montant_ttc.toLocaleString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_DEVIS[r.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {t(`statut_${r.statut}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.assigne}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}

                    {/* Factures rows */}
                    {tab === 'factures' && (factures as FactureRow[]).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.numero ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{r.client ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{r.objet ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{r.montant_ttc != null ? r.montant_ttc.toLocaleString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{r.montant_paye != null ? r.montant_paye.toLocaleString('fr-FR') : '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${(r.montant_restant ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {r.montant_restant != null ? r.montant_restant.toLocaleString('fr-FR') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_FACTURE[r.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {t(`statut_${r.statut}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${r.progression}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 shrink-0">{r.progression}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.assigne}</td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* État vide initial */}
        {!generated && !loading && (
          <div className="p-10 text-center text-sm text-slate-400">
            Sélectionnez une période et cliquez sur <strong>{t('btn_generate')}</strong> pour afficher le rapport.
          </div>
        )}
      </div>
    </div>
  )
}
