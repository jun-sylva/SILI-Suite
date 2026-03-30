'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  GitBranch, Download, FileText, Loader2,
  ClipboardList, Users, GitMerge, MessageSquare,
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

// ── PDF styles ─────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:    { padding: 30, fontFamily: 'Helvetica', fontSize: 9 },
  header:  { marginBottom: 16 },
  company: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  period:  { fontSize: 10, color: '#555', marginBottom: 8 },
  title:   { fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#4f46e5' },
  table:   { width: '100%' },
  thead:   { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' },
  trow:    { flexDirection: 'row', borderBottom: '1px solid #e2e8f0' },
  th:      { padding: '4 6', fontWeight: 'bold', color: '#374151' },
  td:      { padding: '4 6', color: '#1e293b' },
  footer:  { marginTop: 20, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType = 'requetes' | 'par_assigne' | 'processus' | 'activite'

type StatutRequete   = 'en_attente' | 'assigne' | 'approuve' | 'refuse'
type StatutProcessus = 'en_cours' | 'approuve' | 'refuse' | 'annule'
type TypeDemande     = 'materiel_it' | 'finance' | 'formation' | 'deplacement' | 'rh' | 'autre'
type ActionType      = 'assigne' | 'approuve' | 'refuse' | 'commente'

interface RequeteRow {
  id: string; titre: string; type_demande: string; priorite: string
  statut: string; assigne_a: string; created_at: string
}

interface AssigneRow {
  assigne_a: string; total: number
  en_attente: number; approuve: number; refuse: number; taux: number
}

interface ProcessusRow {
  id: string; titre: string; template_nom: string; type_process: string
  statut: string; progression: string; initiateur: string; created_at: string
}

interface ActiviteRow {
  requete_titre: string; auteur: string; action: string
  contenu: string; created_at: string
}

type ReportData =
  | { type: 'requetes';    rows: RequeteRow[];   period: string }
  | { type: 'par_assigne'; rows: AssigneRow[];   period: string }
  | { type: 'processus';   rows: ProcessusRow[]; period: string }
  | { type: 'activite';    rows: ActiviteRow[];  period: string }

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_REQUETE_LABELS: Record<string, string> = {
  en_attente: 'En attente', assigne: 'Assignée', approuve: 'Approuvée', refuse: 'Refusée',
}
const TYPE_DEMANDE_LABELS: Record<string, string> = {
  materiel_it: 'Matériel IT', finance: 'Finance', formation: 'Formation',
  deplacement: 'Déplacement', rh: 'RH', autre: 'Autre',
}
const PRIORITE_LABELS: Record<string, string> = {
  basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente',
}
const ACTION_LABELS: Record<string, string> = {
  assigne: 'Assignée', approuve: 'Approuvée', refuse: 'Refusée', commente: 'Commentaire',
}
const STATUT_PROCESSUS_LABELS: Record<string, string> = {
  en_cours: 'En cours', approuve: 'Approuvé', refuse: 'Refusé', annule: 'Annulé',
}

// ── PDF Document ──────────────────────────────────────────────────────────────

function WorkflowPdfDocument({ data, raisonSociale }: { data: ReportData; raisonSociale: string }) {
  const titleMap: Record<ReportType, string> = {
    requetes:    'Rapport des Requêtes',
    par_assigne: 'Requêtes par Assigné',
    processus:   'Rapport des Processus',
    activite:    "Journal d'Activité Workflow",
  }

  const renderHeader = () => (
    <View style={pdfStyles.header}>
      <Text style={pdfStyles.company}>{raisonSociale}</Text>
      <Text style={pdfStyles.period}>Période : {data.period}</Text>
      <Text style={pdfStyles.title}>{titleMap[data.type]}</Text>
    </View>
  )

  if (data.type === 'requetes') {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              <Text style={[pdfStyles.th, { flex: 2 }]}>Titre</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Type</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Priorité</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Statut</Text>
              <Text style={[pdfStyles.th, { flex: 1.2 }]}>Assigné à</Text>
              <Text style={[pdfStyles.th, { flex: 0.9 }]}>Date</Text>
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.titre}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{TYPE_DEMANDE_LABELS[r.type_demande] ?? r.type_demande}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{PRIORITE_LABELS[r.priorite] ?? r.priorite}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{STATUT_REQUETE_LABELS[r.statut] ?? r.statut}</Text>
                <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.assigne_a}</Text>
                <Text style={[pdfStyles.td, { flex: 0.9 }]}>{formatDate(r.created_at)}</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  if (data.type === 'par_assigne') {
    return (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              <Text style={[pdfStyles.th, { flex: 2 }]}>Assigné</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Total</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>En attente</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Approuvées</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Refusées</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Taux approbation</Text>
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.assigne_a}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.total}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.en_attente}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.approuve}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.refuse}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.taux}%</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  if (data.type === 'processus') {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              <Text style={[pdfStyles.th, { flex: 2 }]}>Titre</Text>
              <Text style={[pdfStyles.th, { flex: 1.5 }]}>Modèle</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Statut</Text>
              <Text style={[pdfStyles.th, { flex: 0.8 }]}>Progression</Text>
              <Text style={[pdfStyles.th, { flex: 1.2 }]}>Initiateur</Text>
              <Text style={[pdfStyles.th, { flex: 0.9 }]}>Date</Text>
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.titre}</Text>
                <Text style={[pdfStyles.td, { flex: 1.5 }]}>{r.template_nom}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{STATUT_PROCESSUS_LABELS[r.statut] ?? r.statut}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.progression}</Text>
                <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.initiateur}</Text>
                <Text style={[pdfStyles.td, { flex: 0.9 }]}>{formatDate(r.created_at)}</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  // activite
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        {renderHeader()}
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            <Text style={[pdfStyles.th, { flex: 2 }]}>Requête</Text>
            <Text style={[pdfStyles.th, { flex: 1.2 }]}>Auteur</Text>
            <Text style={[pdfStyles.th, { flex: 0.8 }]}>Action</Text>
            <Text style={[pdfStyles.th, { flex: 2 }]}>Commentaire</Text>
            <Text style={[pdfStyles.th, { flex: 0.9 }]}>Date</Text>
          </View>
          {data.rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.requete_titre}</Text>
              <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.auteur}</Text>
              <Text style={[pdfStyles.td, { flex: 0.8 }]}>{ACTION_LABELS[r.action] ?? r.action}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.contenu || '—'}</Text>
              <Text style={[pdfStyles.td, { flex: 0.9 }]}>{formatDate(r.created_at)}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
      </Page>
    </Document>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RapportsWorkflowPage() {
  const t         = useTranslations('rapports_workflow')
  const params    = useParams()
  const societeId = params.societe_id as string

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [reportType, setReportType] = useState<ReportType>('requetes')

  // ── Requêtes filters ──
  const [fYear,     setFYear]     = useState(currentYear)
  const [fMonth,    setFMonth]    = useState(currentMonth)
  const [fType,     setFType]     = useState('')
  const [fStatut,   setFStatut]   = useState('')
  const [fPriorite, setFPriorite] = useState('')

  // ── Par assigné filters ──
  const [aYear,  setAYear]  = useState(currentYear)
  const [aMonth, setAMonth] = useState(currentMonth)

  // ── Processus filters ──
  const [prYear,   setPrYear]   = useState(currentYear)
  const [prMonth,  setPrMonth]  = useState(currentMonth)
  const [prStatut, setPrStatut] = useState('')

  // ── Activité filters ──
  const [acYear,   setAcYear]   = useState(currentYear)
  const [acMonth,  setAcMonth]  = useState(currentMonth)
  const [acAction, setAcAction] = useState('')

  // ── state ──
  const [loading,       setLoading]       = useState(false)
  const [exportingPdf,  setExportingPdf]  = useState(false)
  const [reportData,    setReportData]    = useState<ReportData | null>(null)
  const [raisonSociale, setRaisonSociale] = useState('')

  async function ensureCompany() {
    if (raisonSociale) return raisonSociale
    const { data } = await supabase.from('societes').select('raison_sociale').eq('id', societeId).single()
    const name = data?.raison_sociale ?? ''
    setRaisonSociale(name)
    return name
  }

  async function generate() {
    setLoading(true)
    setReportData(null)
    const company = await ensureCompany()
    try {
      if (reportType === 'requetes')    await generateRequetes(company)
      else if (reportType === 'par_assigne') await generateParAssigne(company)
      else if (reportType === 'processus')   await generateProcessus(company)
      else                                   await generateActivite(company)
    } finally {
      setLoading(false)
    }
  }

  // ── Requêtes ──
  async function generateRequetes(company: string) {
    const from = new Date(fYear, fMonth - 1, 1).toISOString()
    const to   = new Date(fYear, fMonth, 1).toISOString()

    let q = (supabase as any)
      .from('workflow_requests')
      .select(`id, titre, type_demande, priorite, statut, created_at,
        assigned_profile:profiles!workflow_requests_assigned_to_fkey(full_name)`)
      .eq('societe_id', societeId)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })

    if (fType)     q = q.eq('type_demande', fType)
    if (fStatut)   q = q.eq('statut', fStatut)
    if (fPriorite) q = q.eq('priorite', fPriorite)

    const { data } = await q
    const rows: RequeteRow[] = (data ?? []).map((r: any) => ({
      id:           r.id,
      titre:        r.titre,
      type_demande: r.type_demande,
      priorite:     r.priorite,
      statut:       r.statut,
      assigne_a:    r.assigned_profile?.full_name ?? '—',
      created_at:   r.created_at,
    }))
    setReportData({ type: 'requetes', rows, period: monthLabel(fYear, fMonth) })
  }

  // ── Par assigné ──
  async function generateParAssigne(company: string) {
    const from = new Date(aYear, aMonth - 1, 1).toISOString()
    const to   = new Date(aYear, aMonth, 1).toISOString()

    const { data } = await (supabase as any)
      .from('workflow_requests')
      .select(`statut, assigned_profile:profiles!workflow_requests_assigned_to_fkey(full_name)`)
      .eq('societe_id', societeId)
      .gte('created_at', from)
      .lt('created_at', to)
      .not('assigned_to', 'is', null)

    const map: Record<string, { total: number; en_attente: number; approuve: number; refuse: number }> = {}
    for (const r of (data ?? [])) {
      const name = r.assigned_profile?.full_name ?? '—'
      if (!map[name]) map[name] = { total: 0, en_attente: 0, approuve: 0, refuse: 0 }
      map[name].total++
      if (r.statut === 'approuve')    map[name].approuve++
      else if (r.statut === 'refuse') map[name].refuse++
      else                            map[name].en_attente++
    }

    const rows: AssigneRow[] = Object.entries(map).map(([name, s]) => ({
      assigne_a:  name,
      total:      s.total,
      en_attente: s.en_attente,
      approuve:   s.approuve,
      refuse:     s.refuse,
      taux:       s.total > 0 ? Math.round((s.approuve / s.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total)

    setReportData({ type: 'par_assigne', rows, period: monthLabel(aYear, aMonth) })
  }

  // ── Processus ──
  async function generateProcessus(company: string) {
    const from = new Date(prYear, prMonth - 1, 1).toISOString()
    const to   = new Date(prYear, prMonth, 1).toISOString()

    let q = (supabase as any)
      .from('workflow_instances')
      .select(`id, titre, statut, current_step_ordre, created_at,
        template:workflow_process_templates!template_id(nom, type_process),
        initiator:profiles!initiator_id(full_name)`)
      .eq('societe_id', societeId)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })

    if (prStatut) q = q.eq('statut', prStatut)

    const { data } = await q

    // Fetch step counts per instance
    const ids = (data ?? []).map((r: any) => r.id)
    let stepMap: Record<string, { total: number; done: number }> = {}
    if (ids.length > 0) {
      const { data: steps } = await (supabase as any)
        .from('workflow_instance_steps')
        .select('instance_id, statut')
        .in('instance_id', ids)
      for (const s of (steps ?? [])) {
        if (!stepMap[s.instance_id]) stepMap[s.instance_id] = { total: 0, done: 0 }
        stepMap[s.instance_id].total++
        if (['approuve', 'signe', 'avis_donne', 'verifie'].includes(s.statut)) stepMap[s.instance_id].done++
      }
    }

    const rows: ProcessusRow[] = (data ?? []).map((r: any) => {
      const sc = stepMap[r.id] ?? { total: 0, done: 0 }
      return {
        id:           r.id,
        titre:        r.titre,
        template_nom: r.template?.nom ?? '—',
        type_process: r.template?.type_process ?? '—',
        statut:       r.statut,
        progression:  sc.total > 0 ? `${sc.done}/${sc.total}` : '—',
        initiateur:   r.initiator?.full_name ?? '—',
        created_at:   r.created_at,
      }
    })
    setReportData({ type: 'processus', rows, period: monthLabel(prYear, prMonth) })
  }

  // ── Activité ──
  async function generateActivite(company: string) {
    const from = new Date(acYear, acMonth - 1, 1).toISOString()
    const to   = new Date(acYear, acMonth, 1).toISOString()

    let q = (supabase as any)
      .from('workflow_comments')
      .select(`action, contenu, created_at,
        request:workflow_requests!request_id(titre),
        author:profiles!author_id(full_name)`)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })

    if (acAction) q = q.eq('action', acAction)

    // Filter by societe via join — fetch request ids first
    const { data: reqIds } = await (supabase as any)
      .from('workflow_requests')
      .select('id')
      .eq('societe_id', societeId)
    const ids = (reqIds ?? []).map((r: any) => r.id)
    if (ids.length > 0) q = q.in('request_id', ids)

    const { data } = await q
    const rows: ActiviteRow[] = (data ?? []).map((r: any) => ({
      requete_titre: r.request?.titre ?? '—',
      auteur:        r.author?.full_name ?? '—',
      action:        r.action,
      contenu:       r.contenu ?? '',
      created_at:    r.created_at,
    }))
    setReportData({ type: 'activite', rows, period: monthLabel(acYear, acMonth) })
  }

  // ── Export CSV ──
  function exportCSV() {
    if (!reportData) return
    if (reportData.type === 'requetes') {
      const header = ['Titre', 'Type', 'Priorité', 'Statut', 'Assigné à', 'Date']
      const rows   = reportData.rows.map(r => [
        r.titre, TYPE_DEMANDE_LABELS[r.type_demande] ?? r.type_demande,
        PRIORITE_LABELS[r.priorite] ?? r.priorite, STATUT_REQUETE_LABELS[r.statut] ?? r.statut,
        r.assigne_a, formatDate(r.created_at),
      ])
      downloadCSV([header, ...rows], `rapport_requetes_${reportData.period}.csv`)
    } else if (reportData.type === 'par_assigne') {
      const header = ['Assigné', 'Total', 'En attente', 'Approuvées', 'Refusées', 'Taux (%)']
      const rows   = reportData.rows.map(r => [r.assigne_a, r.total, r.en_attente, r.approuve, r.refuse, r.taux])
      downloadCSV([header, ...rows], `rapport_assignes_${reportData.period}.csv`)
    } else if (reportData.type === 'processus') {
      const header = ['Titre', 'Modèle', 'Type', 'Statut', 'Progression', 'Initiateur', 'Date']
      const rows   = reportData.rows.map(r => [
        r.titre, r.template_nom, r.type_process,
        STATUT_PROCESSUS_LABELS[r.statut] ?? r.statut, r.progression, r.initiateur, formatDate(r.created_at),
      ])
      downloadCSV([header, ...rows], `rapport_processus_${reportData.period}.csv`)
    } else {
      const header = ['Requête', 'Auteur', 'Action', 'Commentaire', 'Date']
      const rows   = reportData.rows.map(r => [
        r.requete_titre, r.auteur, ACTION_LABELS[r.action] ?? r.action, r.contenu, formatDate(r.created_at),
      ])
      downloadCSV([header, ...rows], `rapport_activite_${reportData.period}.csv`)
    }
  }

  // ── Export PDF ──
  async function exportPDF() {
    if (!reportData) return
    setExportingPdf(true)
    try {
      const company = await ensureCompany()
      const blob = await pdf(<WorkflowPdfDocument data={reportData} raisonSociale={company} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `rapport_workflow_${reportData.period}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingPdf(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { id: ReportType; label: string; icon: React.ElementType }[] = [
    { id: 'requetes',    label: t('tab_requetes'),    icon: ClipboardList },
    { id: 'par_assigne', label: t('tab_par_assigne'), icon: Users },
    { id: 'processus',   label: t('tab_processus'),   icon: GitMerge },
    { id: 'activite',    label: t('tab_activite'),    icon: MessageSquare },
  ]

  const YEARS  = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleString('fr-FR', { month: 'long' }) }))

  const STATUT_REQUETE_OPTIONS: { value: StatutRequete; label: string }[] = [
    { value: 'en_attente', label: 'En attente' }, { value: 'assigne', label: 'Assignée' },
    { value: 'approuve', label: 'Approuvée' }, { value: 'refuse', label: 'Refusée' },
  ]
  const TYPE_OPTIONS: { value: TypeDemande; label: string }[] = [
    { value: 'materiel_it', label: 'Matériel IT' }, { value: 'finance', label: 'Finance' },
    { value: 'formation', label: 'Formation' }, { value: 'deplacement', label: 'Déplacement' },
    { value: 'rh', label: 'RH' }, { value: 'autre', label: 'Autre' },
  ]
  const PRIORITE_OPTIONS = [
    { value: 'basse', label: 'Basse' }, { value: 'normale', label: 'Normale' },
    { value: 'haute', label: 'Haute' }, { value: 'urgente', label: 'Urgente' },
  ]
  const STATUT_PROC_OPTIONS: { value: StatutProcessus; label: string }[] = [
    { value: 'en_cours', label: 'En cours' }, { value: 'approuve', label: 'Approuvé' },
    { value: 'refuse', label: 'Refusé' }, { value: 'annule', label: 'Annulé' },
  ]
  const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
    { value: 'assigne', label: 'Assignée' }, { value: 'approuve', label: 'Approuvée' },
    { value: 'refuse', label: 'Refusée' }, { value: 'commente', label: 'Commentaire' },
  ]

  const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  // Badge helpers
  const statutRequeteBadge: Record<string, string> = {
    en_attente: 'bg-amber-100 text-amber-700',
    assigne:    'bg-blue-100 text-blue-700',
    approuve:   'bg-emerald-100 text-emerald-700',
    refuse:     'bg-red-100 text-red-700',
  }
  const prioriteBadge: Record<string, string> = {
    basse:   'bg-slate-100 text-slate-600',
    normale: 'bg-blue-100 text-blue-600',
    haute:   'bg-orange-100 text-orange-700',
    urgente: 'bg-red-100 text-red-700',
  }
  const statutProcBadge: Record<string, string> = {
    en_cours: 'bg-blue-100 text-blue-700',
    approuve: 'bg-emerald-100 text-emerald-700',
    refuse:   'bg-red-100 text-red-700',
    annule:   'bg-slate-100 text-slate-500',
  }
  const actionBadge: Record<string, string> = {
    assigne:  'bg-blue-100 text-blue-700',
    approuve: 'bg-emerald-100 text-emerald-700',
    refuse:   'bg-red-100 text-red-700',
    commente: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <GitBranch className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('page_title')}</h1>
          <p className="text-sm text-slate-500">{t('page_desc')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => { setReportType(tab.id); setReportData(null) }}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  reportType === tab.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6 space-y-6">

          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

            {/* Requêtes filters */}
            {reportType === 'requetes' && (<>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_year')}</label>
                <select value={fYear} onChange={e => setFYear(Number(e.target.value))} className={selectCls}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_month')}</label>
                <select value={fMonth} onChange={e => setFMonth(Number(e.target.value))} className={selectCls}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_type')}</label>
                <select value={fType} onChange={e => setFType(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_statut')}</label>
                <select value={fStatut} onChange={e => setFStatut(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  {STATUT_REQUETE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_priorite')}</label>
                <select value={fPriorite} onChange={e => setFPriorite(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  {PRIORITE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>)}

            {/* Par assigné filters */}
            {reportType === 'par_assigne' && (<>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_year')}</label>
                <select value={aYear} onChange={e => setAYear(Number(e.target.value))} className={selectCls}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_month')}</label>
                <select value={aMonth} onChange={e => setAMonth(Number(e.target.value))} className={selectCls}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </>)}

            {/* Processus filters */}
            {reportType === 'processus' && (<>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_year')}</label>
                <select value={prYear} onChange={e => setPrYear(Number(e.target.value))} className={selectCls}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_month')}</label>
                <select value={prMonth} onChange={e => setPrMonth(Number(e.target.value))} className={selectCls}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_statut')}</label>
                <select value={prStatut} onChange={e => setPrStatut(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  {STATUT_PROC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>)}

            {/* Activité filters */}
            {reportType === 'activite' && (<>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_year')}</label>
                <select value={acYear} onChange={e => setAcYear(Number(e.target.value))} className={selectCls}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_month')}</label>
                <select value={acMonth} onChange={e => setAcMonth(Number(e.target.value))} className={selectCls}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('filter_action')}</label>
                <select value={acAction} onChange={e => setAcAction(e.target.value)} className={selectCls}>
                  <option value="">{t('filter_all')}</option>
                  {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>)}
          </div>

          {/* Generate button */}
          <div>
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {t('btn_generate')}
            </button>
          </div>

          {/* Results */}
          {reportData && (
            <div className="space-y-4">
              {/* Export bar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {t('results_count', { count: reportData.rows.length })} — <span className="font-medium">{reportData.period}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={exportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={exportPDF}
                    disabled={exportingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-60"
                  >
                    {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">

                    {/* Requêtes */}
                    {reportData.type === 'requetes' && (
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_titre')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_type')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_priorite')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_assigne_a')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                      </tr>
                    )}
                    {/* Par assigné */}
                    {reportData.type === 'par_assigne' && (
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_assigne')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_total')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_en_attente')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_approuvees')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_refusees')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_taux')}</th>
                      </tr>
                    )}
                    {/* Processus */}
                    {reportData.type === 'processus' && (
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_titre')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_modele')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_progression')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_initiateur')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                      </tr>
                    )}
                    {/* Activité */}
                    {reportData.type === 'activite' && (
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_requete')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_auteur')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_action')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_commentaire')}</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.rows.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">{t('no_results')}</td></tr>
                    )}

                    {reportData.type === 'requetes' && reportData.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[180px] truncate">{r.titre}</td>
                        <td className="px-4 py-3 text-slate-600">{TYPE_DEMANDE_LABELS[r.type_demande] ?? r.type_demande}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${prioriteBadge[r.priorite] ?? 'bg-slate-100 text-slate-600'}`}>
                            {PRIORITE_LABELS[r.priorite] ?? r.priorite}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${statutRequeteBadge[r.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {STATUT_REQUETE_LABELS[r.statut] ?? r.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.assigne_a}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}

                    {reportData.type === 'par_assigne' && reportData.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{r.assigne_a}</td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">{r.total}</td>
                        <td className="px-4 py-3 text-amber-600">{r.en_attente}</td>
                        <td className="px-4 py-3 text-emerald-600">{r.approuve}</td>
                        <td className="px-4 py-3 text-red-500">{r.refuse}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${r.taux}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{r.taux}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {reportData.type === 'processus' && reportData.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[160px] truncate">{r.titre}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{r.template_nom}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${statutProcBadge[r.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {STATUT_PROCESSUS_LABELS[r.statut] ?? r.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.progression}</td>
                        <td className="px-4 py-3 text-slate-600">{r.initiateur}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}

                    {reportData.type === 'activite' && reportData.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate">{r.requete_titre}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{r.auteur}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${actionBadge[r.action] ?? 'bg-slate-100 text-slate-500'}`}>
                            {ACTION_LABELS[r.action] ?? r.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{r.contenu || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
