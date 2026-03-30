'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  CalendarDays, Download, FileText, Loader2,
  FolderKanban, ListTodo, Flag, Users,
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

function daysDiff(date: string) {
  const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 86400000)
  return diff
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

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportType = 'projets' | 'taches' | 'jalons' | 'charge'

interface ProjetRow {
  id: string; titre: string; statut: string; priorite: string
  responsable: string; date_debut: string | null; date_fin: string | null
  nb_taches: number; nb_terminees: number; progression: number
}

interface TacheRow {
  id: string; titre: string; projet: string; statut: string; priorite: string
  assigne: string; date_echeance: string | null; en_retard: boolean
}

interface JalonRow {
  id: string; titre: string; projet: string; statut: string
  date_cible: string; jours_retard: number | null
}

interface ChargeRow {
  membre: string; actives: number; terminees: number; en_retard: number; taux: number
}

type ReportData =
  | { type: 'projets'; rows: ProjetRow[];  period: string }
  | { type: 'taches';  rows: TacheRow[];   period: string }
  | { type: 'jalons';  rows: JalonRow[];   period: string }
  | { type: 'charge';  rows: ChargeRow[];  period: string }

// ── Couleurs statut / priorité ──────────────────────────────────────────────────

const STATUT_PROJET: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  actif:     'bg-emerald-100 text-emerald-700',
  en_pause:  'bg-amber-100 text-amber-700',
  termine:   'bg-blue-100 text-blue-700',
  annule:    'bg-red-100 text-red-500',
}
const STATUT_TACHE: Record<string, string> = {
  todo:     'bg-slate-100 text-slate-600',
  en_cours: 'bg-blue-100 text-blue-700',
  revue:    'bg-violet-100 text-violet-700',
  fait:     'bg-emerald-100 text-emerald-700',
}
const STATUT_JALON: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  atteint:    'bg-emerald-100 text-emerald-700',
  manque:     'bg-red-100 text-red-600',
}
const PRIORITE_COLOR: Record<string, string> = {
  basse:    'bg-slate-100 text-slate-500',
  normale:  'bg-blue-100 text-blue-600',
  haute:    'bg-orange-100 text-orange-600',
  critique: 'bg-red-100 text-red-600',
}
const CHARGE_BADGE: Record<string, string> = {
  leger:     'bg-slate-100 text-slate-600',
  normal:    'bg-emerald-100 text-emerald-700',
  charge:    'bg-amber-100 text-amber-700',
  surcharge: 'bg-red-100 text-red-600',
}

function chargeBadge(taux: number): string {
  if (taux < 40)  return 'leger'
  if (taux < 70)  return 'normal'
  if (taux < 90)  return 'charge'
  return 'surcharge'
}

// ── PDF Documents ──────────────────────────────────────────────────────────────

function ProjetsDoc({ rows, period }: { rows: ProjetRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Planning — Projets</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des projets</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Titre','Statut','Priorité','Responsable','Début','Fin','Tâches','Progression'].map((h,i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 0 ? 3 : i === 3 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 3 }]}>{r.titre}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.priorite}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.responsable}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.date_debut)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.date_fin)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.nb_terminees}/{r.nb_taches}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.progression}%</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} projet(s)</Text>
      </Page>
    </Document>
  )
}

function TachesDoc({ rows, period }: { rows: TacheRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Planning — Tâches</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des tâches</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Titre','Projet','Statut','Priorité','Assigné','Échéance','Retard'].map((h,i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i < 2 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.titre}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.projet}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.priorite}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.assigne}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.date_echeance)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.en_retard ? 'Oui' : '—'}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} tâche(s)</Text>
      </Page>
    </Document>
  )
}

function JalonsDoc({ rows, period }: { rows: JalonRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Planning — Jalons</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Liste des jalons</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Titre','Projet','Date cible','Statut','Retard (j)'].map((h,i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i < 2 ? 2 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.titre}</Text>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.projet}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatDate(r.date_cible)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.statut}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_retard != null ? `${r.jours_retard} j` : '—'}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} jalon(s)</Text>
      </Page>
    </Document>
  )
}

function ChargeDoc({ rows, period }: { rows: ChargeRow[]; period: string }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.company}>Rapport Planning — Charge d'équipe</Text>
          <Text style={pdfStyles.period}>{period}</Text>
        </View>
        <Text style={pdfStyles.title}>Charge par membre</Text>
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            {['Membre','Actives','Terminées','En retard','Charge (%)'].map((h,i) => (
              <Text key={i} style={[pdfStyles.th, { flex: i === 0 ? 3 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 3 }]}>{r.membre}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.actives}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.terminees}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.en_retard}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.taux}%</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleDateString('fr-FR')} — {rows.length} membre(s)</Text>
      </Page>
    </Document>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

const TABS: { id: ReportType; labelKey: string; icon: React.ElementType }[] = [
  { id: 'projets', labelKey: 'tab_projets', icon: FolderKanban },
  { id: 'taches',  labelKey: 'tab_taches',  icon: ListTodo     },
  { id: 'jalons',  labelKey: 'tab_jalons',  icon: Flag         },
  { id: 'charge',  labelKey: 'tab_charge',  icon: Users        },
]

const now = new Date()
const YEARS  = [now.getFullYear(), now.getFullYear() - 1]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const inputCls  = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function RapportPlanningPage() {
  const t         = useTranslations('rapports_planning')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [activeTab,    setActiveTab]    = useState<ReportType>('projets')
  const [generating,   setGenerating]   = useState(false)
  const [reportData,   setReportData]   = useState<ReportData | null>(null)

  // Filtres communs
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  // Filtres projets
  const [fStatutProjet,   setFStatutProjet]   = useState('')
  const [fPrioriteProjet, setFPrioriteProjet] = useState('')

  // Filtres tâches
  const [fStatutTache,   setFStatutTache]   = useState('')
  const [fPrioriteTache, setFPrioriteTache] = useState('')
  const [fProjetTache,   setFProjetTache]   = useState('')

  // Filtres jalons
  const [fStatutJalon, setFStatutJalon] = useState('')
  const [fProjetJalon, setFProjetJalon] = useState('')

  // Projets disponibles pour les selects filtres
  const [projets, setProjets] = useState<{ id: string; titre: string }[]>([])

  // Charger la liste des projets au montage
  useState(() => {
    ;(supabase as any)
      .from('plan_projets')
      .select('id, titre')
      .eq('societe_id', societeId)
      .order('titre')
      .then(({ data }: any) => setProjets(data ?? []))
  })

  async function generate() {
    setGenerating(true)
    setReportData(null)

    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0]
    const today     = new Date().toISOString().split('T')[0]
    const period    = monthLabel(year, month)

    if (activeTab === 'projets') {
      let q = (supabase as any)
        .from('plan_projets')
        .select('id, titre, statut, priorite, date_debut, date_fin, responsable:profiles!responsable_id(full_name), taches:plan_taches(id, statut)')
        .eq('societe_id', societeId)

      if (fStatutProjet)   q = q.eq('statut', fStatutProjet)
      if (fPrioriteProjet) q = q.eq('priorite', fPrioriteProjet)
      // Filtre période : projets actifs sur le mois sélectionné
      q = q.or(`date_debut.lte.${endDate},date_debut.is.null`)
      q = q.or(`date_fin.gte.${startDate},date_fin.is.null`)

      const { data } = await q.order('created_at', { ascending: false })
      const rows: ProjetRow[] = (data ?? []).map((p: any) => {
        const taches     = p.taches ?? []
        const terminees  = taches.filter((t: any) => t.statut === 'fait').length
        const progression = taches.length > 0 ? Math.round(terminees / taches.length * 100) : 0
        return {
          id: p.id, titre: p.titre, statut: p.statut, priorite: p.priorite,
          responsable: p.responsable?.full_name ?? '—',
          date_debut: p.date_debut, date_fin: p.date_fin,
          nb_taches: taches.length, nb_terminees: terminees, progression,
        }
      })
      setReportData({ type: 'projets', rows, period })

    } else if (activeTab === 'taches') {
      let q = (supabase as any)
        .from('plan_taches')
        .select('id, titre, statut, priorite, date_echeance, assigne:profiles!assigne_a(full_name), projet:plan_projets!projet_id(id, titre)')
        .eq('societe_id', societeId)

      if (fStatutTache)   q = q.eq('statut', fStatutTache)
      if (fPrioriteTache) q = q.eq('priorite', fPrioriteTache)
      if (fProjetTache)   q = q.eq('projet_id', fProjetTache)
      // Filtre période : tâches avec échéance dans le mois
      q = q.gte('date_echeance', startDate).lte('date_echeance', endDate)

      const { data } = await q.order('date_echeance', { ascending: true })
      const rows: TacheRow[] = (data ?? []).map((t: any) => ({
        id: t.id, titre: t.titre, projet: t.projet?.titre ?? '—',
        statut: t.statut, priorite: t.priorite,
        assigne: t.assigne?.full_name ?? '—',
        date_echeance: t.date_echeance,
        en_retard: !!t.date_echeance && t.date_echeance < today && t.statut !== 'fait',
      }))
      setReportData({ type: 'taches', rows, period })

    } else if (activeTab === 'jalons') {
      let q = (supabase as any)
        .from('plan_jalons')
        .select('id, titre, statut, date_cible, projet:plan_projets!projet_id(id, titre, societe_id)')
        .eq('projet.societe_id', societeId)
        .gte('date_cible', startDate)
        .lte('date_cible', endDate)

      if (fStatutJalon) q = q.eq('statut', fStatutJalon)
      if (fProjetJalon) q = q.eq('projet_id', fProjetJalon)

      const { data } = await q.order('date_cible', { ascending: true })
      const rows: JalonRow[] = (data ?? [])
        .filter((j: any) => j.projet?.societe_id === societeId)
        .map((j: any) => ({
          id: j.id, titre: j.titre, projet: j.projet?.titre ?? '—',
          statut: j.statut, date_cible: j.date_cible,
          jours_retard: (j.statut === 'manque' && j.date_cible < today)
            ? daysDiff(j.date_cible)
            : null,
        }))
      setReportData({ type: 'jalons', rows, period })

    } else {
      // Charge d'équipe : tâches actives/terminées/retard groupées par assigne_a
      const { data: taches } = await (supabase as any)
        .from('plan_taches')
        .select('id, statut, date_echeance, assigne_a, assigne:profiles!assigne_a(full_name)')
        .eq('societe_id', societeId)
        .not('assigne_a', 'is', null)

      const map: Record<string, { membre: string; actives: number; terminees: number; en_retard: number }> = {}
      ;(taches ?? []).forEach((t: any) => {
        const uid = t.assigne_a
        if (!map[uid]) map[uid] = { membre: t.assigne?.full_name ?? uid, actives: 0, terminees: 0, en_retard: 0 }
        if (t.statut === 'fait') {
          map[uid].terminees++
        } else {
          map[uid].actives++
          if (t.date_echeance && t.date_echeance < today) map[uid].en_retard++
        }
      })
      const rows: ChargeRow[] = Object.values(map).map(m => ({
        ...m,
        taux: Math.min(100, Math.round(m.actives / 8 * 100)),
      })).sort((a, b) => b.taux - a.taux)
      setReportData({ type: 'charge', rows, period })
    }

    setGenerating(false)
  }

  async function exportPDF() {
    if (!reportData) return
    let blob: Blob
    if (reportData.type === 'projets') blob = await pdf(<ProjetsDoc rows={reportData.rows} period={reportData.period} />).toBlob()
    else if (reportData.type === 'taches') blob = await pdf(<TachesDoc rows={reportData.rows} period={reportData.period} />).toBlob()
    else if (reportData.type === 'jalons') blob = await pdf(<JalonsDoc rows={reportData.rows} period={reportData.period} />).toBlob()
    else blob = await pdf(<ChargeDoc rows={reportData.rows} period={reportData.period} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = `rapport-planning-${activeTab}-${year}-${String(month).padStart(2, '0')}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportCSV() {
    if (!reportData) return
    let rows: string[][]
    let filename = `rapport-planning-${activeTab}-${year}-${String(month).padStart(2, '0')}.csv`

    if (reportData.type === 'projets') {
      rows = [
        ['Titre','Statut','Priorité','Responsable','Début','Fin','Tâches','Terminées','Progression'],
        ...reportData.rows.map(r => [r.titre, r.statut, r.priorite, r.responsable, formatDate(r.date_debut), formatDate(r.date_fin), String(r.nb_taches), String(r.nb_terminees), `${r.progression}%`]),
      ]
    } else if (reportData.type === 'taches') {
      rows = [
        ['Titre','Projet','Statut','Priorité','Assigné','Échéance','En retard'],
        ...reportData.rows.map(r => [r.titre, r.projet, r.statut, r.priorite, r.assigne, formatDate(r.date_echeance), r.en_retard ? 'Oui' : 'Non']),
      ]
    } else if (reportData.type === 'jalons') {
      rows = [
        ['Titre','Projet','Date cible','Statut','Retard (jours)'],
        ...reportData.rows.map(r => [r.titre, r.projet, formatDate(r.date_cible), r.statut, r.jours_retard != null ? String(r.jours_retard) : '—']),
      ]
    } else {
      rows = [
        ['Membre','Tâches actives','Terminées','En retard','Charge (%)'],
        ...reportData.rows.map(r => [r.membre, String(r.actives), String(r.terminees), String(r.en_retard), `${r.taux}%`]),
      ]
    }
    downloadCSV(rows, filename)
  }

  const rowCount = reportData ? reportData.rows.length : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">{t('page_title')}</h1>
            <p className="text-xs text-slate-500">{t('page_desc')}</p>
          </div>
        </div>
        {reportData && (
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={exportPDF}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 font-medium">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setReportData(null) }}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey as any)}
              </button>
            )
          })}
        </div>

        {/* Filtres */}
        <div className="p-5 bg-slate-50 border-b border-slate-100">
          <div className="flex flex-wrap items-end gap-3">

            {/* Période */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">{t('filter_year')}</span>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">{t('filter_month')}</span>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls}>
                {MONTHS.map(m => <option key={m} value={m}>{monthLabel(year, m)}</option>)}
              </select>
            </div>

            {/* Filtres projets */}
            {activeTab === 'projets' && (<>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_statut')}</span>
                <select value={fStatutProjet} onChange={e => setFStatutProjet(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {['brouillon','actif','en_pause','termine','annule'].map(s => (
                    <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_priorite')}</span>
                <select value={fPrioriteProjet} onChange={e => setFPrioriteProjet(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {['basse','normale','haute','critique'].map(p => (
                    <option key={p} value={p}>{t(`priorite_${p}` as any)}</option>
                  ))}
                </select>
              </div>
            </>)}

            {/* Filtres tâches */}
            {activeTab === 'taches' && (<>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_statut')}</span>
                <select value={fStatutTache} onChange={e => setFStatutTache(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {['todo','en_cours','revue','fait'].map(s => (
                    <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_priorite')}</span>
                <select value={fPrioriteTache} onChange={e => setFPrioriteTache(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {['basse','normale','haute','critique'].map(p => (
                    <option key={p} value={p}>{t(`priorite_${p}` as any)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_projet')}</span>
                <select value={fProjetTache} onChange={e => setFProjetTache(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
                </select>
              </div>
            </>)}

            {/* Filtres jalons */}
            {activeTab === 'jalons' && (<>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_statut')}</span>
                <select value={fStatutJalon} onChange={e => setFStatutJalon(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {['en_attente','atteint','manque'].map(s => (
                    <option key={s} value={s}>{t(`statut_${s}` as any)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{t('filter_projet')}</span>
                <select value={fProjetJalon} onChange={e => setFProjetJalon(e.target.value)} className={inputCls}>
                  <option value="">{t('filter_all')}</option>
                  {projets.map(p => <option key={p.id} value={p.id}>{p.titre}</option>)}
                </select>
              </div>
            </>)}

            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              {t('btn_generate')}
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div className="p-5">
          {!reportData && !generating && (
            <p className="text-sm text-slate-400 text-center py-10">{t('no_results')}</p>
          )}
          {generating && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          )}

          {reportData && !generating && (
            <div>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                {t('results_count', { count: rowCount })}
                {rowCount === 0 && <span className="ml-2 text-slate-400">{t('no_results')}</span>}
              </p>

              {/* Table Projets */}
              {reportData.type === 'projets' && reportData.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                        <th className="px-4 py-3 text-left font-semibold">{t('col_titre')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_priorite')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_responsable')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_date_debut')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_date_fin')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_taches')}</th>
                        <th className="px-4 py-3 text-left font-semibold w-36">{t('col_progression')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map(r => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.titre}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_PROJET[r.statut] ?? ''}`}>{t(`statut_${r.statut}` as any)}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITE_COLOR[r.priorite] ?? ''}`}>{t(`priorite_${r.priorite}` as any)}</span></td>
                          <td className="px-4 py-3 text-slate-600">{r.responsable}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.date_debut)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.date_fin)}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{r.nb_terminees}/{r.nb_taches}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${r.progression}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 shrink-0">{r.progression}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Tâches */}
              {reportData.type === 'taches' && reportData.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                        <th className="px-4 py-3 text-left font-semibold">{t('col_titre')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_projet')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_priorite')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_assigne')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_echeance')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_retard')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map(r => (
                        <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50 ${r.en_retard ? 'bg-red-50/30' : ''}`}>
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.titre}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{r.projet}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_TACHE[r.statut] ?? ''}`}>{t(`statut_${r.statut}` as any)}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITE_COLOR[r.priorite] ?? ''}`}>{t(`priorite_${r.priorite}` as any)}</span></td>
                          <td className="px-4 py-3 text-slate-600">{r.assigne}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.date_echeance)}</td>
                          <td className="px-4 py-3">
                            {r.en_retard
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">{t('jours_retard', { n: r.date_echeance ? daysDiff(r.date_echeance) : '?' })}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Jalons */}
              {reportData.type === 'jalons' && reportData.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                        <th className="px-4 py-3 text-left font-semibold">{t('col_titre')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_projet')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_date_cible')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_statut')}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('col_retard')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map(r => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.titre}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{r.projet}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(r.date_cible)}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_JALON[r.statut] ?? ''}`}>{t(`statut_${r.statut}` as any)}</span></td>
                          <td className="px-4 py-3">
                            {r.jours_retard != null
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">{t('jours_retard', { n: r.jours_retard })}</span>
                              : <span className="text-slate-300">{t('aucun_retard')}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Charge */}
              {reportData.type === 'charge' && reportData.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                        <th className="px-4 py-3 text-left font-semibold">{t('col_membre')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('col_actives')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('col_terminees')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('col_en_retard')}</th>
                        <th className="px-4 py-3 text-left font-semibold w-48">{t('col_charge')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map((r, i) => {
                        const badge = chargeBadge(r.taux)
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-800">{r.membre}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{r.actives}</td>
                            <td className="px-4 py-3 text-right text-emerald-700">{r.terminees}</td>
                            <td className="px-4 py-3 text-right">
                              {r.en_retard > 0
                                ? <span className="text-red-600 font-semibold">{r.en_retard}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${r.taux < 40 ? 'bg-slate-400' : r.taux < 70 ? 'bg-emerald-500' : r.taux < 90 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${r.taux}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-slate-600 shrink-0 w-8">{r.taux}%</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CHARGE_BADGE[badge]}`}>
                                  {t(`badge_${badge}` as any)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
