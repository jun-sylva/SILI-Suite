'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Users, Download, FileText, Loader2, ChevronDown,
  CalendarDays, CreditCard, ClipboardList,
} from 'lucide-react'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── helpers ────────────────────────────────────────────────────────────────────

function workingDaysInMonth(year: number, month: number): number {
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── PDF styles ─────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page:       { padding: 30, fontFamily: 'Helvetica', fontSize: 9 },
  header:     { marginBottom: 16 },
  company:    { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  period:     { fontSize: 10, color: '#555', marginBottom: 8 },
  title:      { fontSize: 12, fontWeight: 'bold', marginBottom: 10, color: '#4f46e5' },
  table:      { width: '100%' },
  thead:      { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' },
  trow:       { flexDirection: 'row', borderBottom: '1px solid #e2e8f0' },
  th:         { padding: '4 6', fontWeight: 'bold', color: '#374151' },
  td:         { padding: '4 6', color: '#1e293b' },
  footer:     { marginTop: 20, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType = 'employes' | 'presences' | 'conges' | 'paie'

interface EmployeRow {
  matricule: string; nom: string; prenom: string; poste: string
  departement: string; type_contrat: string; statut: string
  date_embauche: string; salaire_base: number | null
}

interface PresenceRow {
  nom: string; prenom: string; jours_presents: number; jours_absents: number
}

interface CongeRow {
  nom: string; prenom: string; nb_journaliers: number; nb_horaires: number
}

interface PaieRow {
  nom: string; prenom: string; salaire_base: number
  jours_ouvrables: number; jours_presents: number; jours_absents: number; salaire_paye: number
}

type ReportData =
  | { type: 'employes';  rows: EmployeRow[];  period: string }
  | { type: 'presences'; rows: PresenceRow[]; period: string }
  | { type: 'conges';    rows: CongeRow[];    period: string }
  | { type: 'paie';      rows: PaieRow[];     period: string }

// ── PDF document ──────────────────────────────────────────────────────────────

function RhPdfDocument({ data, raisonSociale }: { data: ReportData; raisonSociale: string }) {
  const titleMap: Record<ReportType, string> = {
    employes:  'Liste des Employés',
    presences: 'Rapport de Présences',
    conges:    'Rapport de Congés Approuvés',
    paie:      'Rapport de Paie',
  }

  const renderHeader = () => (
    <View style={pdfStyles.header}>
      <Text style={pdfStyles.company}>{raisonSociale}</Text>
      <Text style={pdfStyles.period}>Période : {data.period}</Text>
      <Text style={pdfStyles.title}>{titleMap[data.type]}</Text>
    </View>
  )

  if (data.type === 'employes') {
    const cols = [
      { label: 'Matricule', key: 'matricule', flex: 1 },
      { label: 'Nom',       key: 'nom',       flex: 1.2 },
      { label: 'Prénom',    key: 'prenom',    flex: 1.2 },
      { label: 'Poste',     key: 'poste',     flex: 1.5 },
      { label: 'Départ.',   key: 'departement', flex: 1.2 },
      { label: 'Contrat',   key: 'type_contrat', flex: 1 },
      { label: 'Statut',    key: 'statut',    flex: 0.8 },
      { label: 'Embauche',  key: 'date_embauche', flex: 1 },
      { label: 'Salaire',   key: 'salaire_base', flex: 1 },
    ]
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              {cols.map(c => (
                <Text key={c.key} style={[pdfStyles.th, { flex: c.flex }]}>{c.label}</Text>
              ))}
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.matricule}</Text>
                <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.nom}</Text>
                <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.prenom}</Text>
                <Text style={[pdfStyles.td, { flex: 1.5 }]}>{r.poste || '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 1.2 }]}>{r.departement || '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.type_contrat || '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 0.8 }]}>{r.statut}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.date_embauche || '—'}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.salaire_base != null ? formatCurrency(r.salaire_base) : '—'}</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  if (data.type === 'presences') {
    return (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              <Text style={[pdfStyles.th, { flex: 2 }]}>Nom complet</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Jours présents</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Jours absents</Text>
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.prenom} {r.nom}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_presents}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_absents}</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  if (data.type === 'conges') {
    return (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          {renderHeader()}
          <View style={pdfStyles.table}>
            <View style={pdfStyles.thead}>
              <Text style={[pdfStyles.th, { flex: 2 }]}>Nom complet</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Congés journaliers</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Congés horaires</Text>
            </View>
            {data.rows.map((r, i) => (
              <View key={i} style={pdfStyles.trow}>
                <Text style={[pdfStyles.td, { flex: 2 }]}>{r.prenom} {r.nom}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.nb_journaliers}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{r.nb_horaires}</Text>
              </View>
            ))}
          </View>
          <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
        </Page>
      </Document>
    )
  }

  // paie
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        {renderHeader()}
        <View style={pdfStyles.table}>
          <View style={pdfStyles.thead}>
            <Text style={[pdfStyles.th, { flex: 2 }]}>Nom complet</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Salaire base</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>J. ouvrables</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>J. présents</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>J. absents</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Salaire payé</Text>
          </View>
          {data.rows.map((r, i) => (
            <View key={i} style={pdfStyles.trow}>
              <Text style={[pdfStyles.td, { flex: 2 }]}>{r.prenom} {r.nom}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatCurrency(r.salaire_base)}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_ouvrables}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_presents}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{r.jours_absents}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{formatCurrency(r.salaire_paye)}</Text>
            </View>
          ))}
        </View>
        <Text style={pdfStyles.footer}>Généré le {new Date().toLocaleString('fr-FR')} — {raisonSociale}</Text>
      </Page>
    </Document>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RapportsRhPage() {
  const t      = useTranslations('rapports_rh')
  const params = useParams()
  const societeId = params.societe_id as string

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // ── report type ──
  const [reportType, setReportType] = useState<ReportType>('employes')

  // ── Employés filters ──
  const [fPoste,       setFPoste]       = useState('')
  const [fDept,        setFDept]        = useState('')
  const [fContrat,     setFContrat]     = useState('')
  const [fStatut,      setFStatut]      = useState('')
  const [fSalaireMin,  setFSalaireMin]  = useState('')
  const [fSalaireMax,  setFSalaireMax]  = useState('')

  // ── Présences filters ──
  const [pPeriode,     setPPeriode]     = useState<'semaine'|'mois'|'intervalle'>('mois')
  const [pYear,        setPYear]        = useState(currentYear)
  const [pMonth,       setPMonth]       = useState(currentMonth)
  const [pDateFrom,    setPDateFrom]    = useState('')
  const [pDateTo,      setPDateTo]      = useState('')

  // ── Congés filters ──
  const [cPeriode,     setCPeriode]     = useState<'annee'|'mois'|'semaine'|'intervalle'>('mois')
  const [cYear,        setCYear]        = useState(currentYear)
  const [cMonth,       setCMonth]       = useState(currentMonth)
  const [cDateFrom,    setCDateFrom]    = useState('')
  const [cDateTo,      setCDateTo]      = useState('')

  // ── Paie filters ──
  const [payYear,      setPayYear]      = useState(currentYear)
  const [payMonth,     setPayMonth]     = useState(currentMonth)

  // ── state ──
  const [loading,      setLoading]      = useState(false)
  const [reportData,   setReportData]   = useState<ReportData | null>(null)
  const [raisonSociale, setRaisonSociale] = useState('')

  // ── fetch raisonSociale (once) ──
  async function ensureCompany() {
    if (raisonSociale) return raisonSociale
    const { data } = await supabase.from('societes').select('raison_sociale').eq('id', societeId).single()
    const name = data?.raison_sociale ?? ''
    setRaisonSociale(name)
    return name
  }

  // ── generate report ──
  async function generate() {
    setLoading(true)
    setReportData(null)
    const company = await ensureCompany()

    try {
      if (reportType === 'employes') {
        await generateEmployes(company)
      } else if (reportType === 'presences') {
        await generatePresences(company)
      } else if (reportType === 'conges') {
        await generateConges(company)
      } else {
        await generatePaie(company)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Employés ──
  async function generateEmployes(company: string) {
    let q = supabase.from('rh_employes')
      .select('matricule,nom,prenom,poste,departement,type_contrat,statut,date_embauche,salaire_base')
      .eq('societe_id', societeId)
      .order('nom')

    if (fPoste)    q = q.ilike('poste', `%${fPoste}%`)
    if (fDept)     q = q.ilike('departement', `%${fDept}%`)
    if (fContrat)  q = q.eq('type_contrat', fContrat)
    if (fStatut)   q = q.eq('statut', fStatut)
    if (fSalaireMin) q = q.gte('salaire_base', Number(fSalaireMin))
    if (fSalaireMax) q = q.lte('salaire_base', Number(fSalaireMax))

    const { data } = await q
    const rows: EmployeRow[] = (data ?? []).map((r: any) => ({
      matricule:     r.matricule,
      nom:           r.nom,
      prenom:        r.prenom,
      poste:         r.poste ?? '',
      departement:   r.departement ?? '',
      type_contrat:  r.type_contrat ?? '',
      statut:        r.statut,
      date_embauche: r.date_embauche ?? '',
      salaire_base:  r.salaire_base,
    }))

    const filters = [fPoste, fDept, fContrat, fStatut].filter(Boolean)
    const period  = filters.length ? `Filtres : ${filters.join(', ')}` : 'Tous les employés'
    setReportData({ type: 'employes', rows, period })
  }

  // ── Présences ──
  async function generatePresences(company: string) {
    let dateFrom = '', dateTo = ''
    let periodLabel = ''

    if (pPeriode === 'mois') {
      dateFrom = `${pYear}-${String(pMonth).padStart(2, '0')}-01`
      const last = new Date(pYear, pMonth, 0).getDate()
      dateTo = `${pYear}-${String(pMonth).padStart(2, '0')}-${last}`
      periodLabel = monthLabel(pYear, pMonth)
    } else if (pPeriode === 'semaine') {
      const now = new Date()
      const day = now.getDay() || 7
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      dateFrom = mon.toISOString().split('T')[0]
      dateTo   = sun.toISOString().split('T')[0]
      periodLabel = `Semaine du ${dateFrom} au ${dateTo}`
    } else {
      dateFrom = pDateFrom; dateTo = pDateTo
      periodLabel = `${dateFrom} → ${dateTo}`
    }

    const { data: employes } = await supabase
      .from('rh_employes').select('id,nom,prenom').eq('societe_id', societeId).eq('statut', 'actif').order('nom')

    const { data: presences } = await supabase
      .from('rh_presences').select('employe_id,statut')
      .eq('societe_id', societeId).gte('date', dateFrom).lte('date', dateTo)

    const rows: PresenceRow[] = (employes ?? []).map((e: any) => {
      const eps = (presences ?? []).filter((p: any) => p.employe_id === e.id)
      const presents = eps.filter((p: any) => p.statut === 'present' || p.statut === 'retard' || p.statut === 'mission').length
      const absents  = eps.filter((p: any) => p.statut === 'absent').length
      return { nom: e.nom, prenom: e.prenom, jours_presents: presents, jours_absents: absents }
    })

    setReportData({ type: 'presences', rows, period: periodLabel })
  }

  // ── Congés ──
  async function generateConges(company: string) {
    let dateFrom = '', dateTo = ''
    let periodLabel = ''

    if (cPeriode === 'annee') {
      dateFrom = `${cYear}-01-01`; dateTo = `${cYear}-12-31`
      periodLabel = `Année ${cYear}`
    } else if (cPeriode === 'mois') {
      dateFrom = `${cYear}-${String(cMonth).padStart(2, '0')}-01`
      const last = new Date(cYear, cMonth, 0).getDate()
      dateTo = `${cYear}-${String(cMonth).padStart(2, '0')}-${last}`
      periodLabel = monthLabel(cYear, cMonth)
    } else if (cPeriode === 'semaine') {
      const now = new Date()
      const day = now.getDay() || 7
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      dateFrom = mon.toISOString().split('T')[0]
      dateTo   = sun.toISOString().split('T')[0]
      periodLabel = `Semaine du ${dateFrom} au ${dateTo}`
    } else {
      dateFrom = cDateFrom; dateTo = cDateTo
      periodLabel = `${dateFrom} → ${dateTo}`
    }

    const { data: conges } = await supabase
      .from('rh_conges')
      .select('employe_id,typologie,rh_employes!employe_id(nom,prenom)')
      .eq('societe_id', societeId)
      .eq('statut', 'approuve')
      .gte('date_debut', dateFrom)
      .lte('date_debut', dateTo)

    // Group by employee
    const map = new Map<string, { nom: string; prenom: string; daily: number; hourly: number }>()
    for (const c of (conges ?? [])) {
      const emp = (c as any).rh_employes
      if (!emp) continue
      const key = c.employe_id as string
      if (!map.has(key)) map.set(key, { nom: emp.nom, prenom: emp.prenom, daily: 0, hourly: 0 })
      const entry = map.get(key)!
      if ((c as any).typologie === 'hourly') entry.hourly++
      else entry.daily++
    }

    const rows: CongeRow[] = Array.from(map.values())
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map(v => ({ nom: v.nom, prenom: v.prenom, nb_journaliers: v.daily, nb_horaires: v.hourly }))

    setReportData({ type: 'conges', rows, period: periodLabel })
  }

  // ── Paie ──
  async function generatePaie(company: string) {
    const periodLabel = monthLabel(payYear, payMonth)
    const dateFrom = `${payYear}-${String(payMonth).padStart(2, '0')}-01`
    const last = new Date(payYear, payMonth, 0).getDate()
    const dateTo = `${payYear}-${String(payMonth).padStart(2, '0')}-${last}`
    const joursOuvrables = workingDaysInMonth(payYear, payMonth)

    const { data: employes } = await supabase
      .from('rh_employes').select('id,nom,prenom,salaire_base').eq('societe_id', societeId).eq('statut', 'actif').order('nom')

    const { data: presences } = await supabase
      .from('rh_presences').select('employe_id,statut')
      .eq('societe_id', societeId).gte('date', dateFrom).lte('date', dateTo)

    const rows: PaieRow[] = (employes ?? []).map((e: any) => {
      const eps = (presences ?? []).filter((p: any) => p.employe_id === e.id)
      const presents = eps.filter((p: any) => ['present','retard','mission'].includes(p.statut)).length
      const absents  = Math.max(0, joursOuvrables - presents)
      const base     = e.salaire_base ?? 0
      const paye     = presents >= joursOuvrables
        ? base
        : base - (base / joursOuvrables) * absents

      return {
        nom: e.nom, prenom: e.prenom,
        salaire_base:    base,
        jours_ouvrables: joursOuvrables,
        jours_presents:  presents,
        jours_absents:   absents,
        salaire_paye:    Math.round(paye * 100) / 100,
      }
    })

    setReportData({ type: 'paie', rows, period: periodLabel })
  }

  // ── CSV export ──
  function exportCSV() {
    if (!reportData) return

    if (reportData.type === 'employes') {
      const headers = ['Matricule','Nom','Prénom','Poste','Département','Type Contrat','Statut','Date Embauche','Salaire Base']
      const rows = reportData.rows.map(r => [r.matricule,r.nom,r.prenom,r.poste,r.departement,r.type_contrat,r.statut,r.date_embauche,String(r.salaire_base ?? '')])
      downloadCSV([headers, ...rows], `employes_${Date.now()}.csv`)
    } else if (reportData.type === 'presences') {
      const headers = ['Nom','Prénom','Jours Présents','Jours Absents']
      const rows = reportData.rows.map(r => [r.nom, r.prenom, String(r.jours_presents), String(r.jours_absents)])
      downloadCSV([headers, ...rows], `presences_${Date.now()}.csv`)
    } else if (reportData.type === 'conges') {
      const headers = ['Nom','Prénom','Congés Journaliers','Congés Horaires']
      const rows = reportData.rows.map(r => [r.nom, r.prenom, String(r.nb_journaliers), String(r.nb_horaires)])
      downloadCSV([headers, ...rows], `conges_${Date.now()}.csv`)
    } else if (reportData.type === 'paie') {
      const headers = ['Nom','Prénom','Salaire Base','J. Ouvrables','J. Présents','J. Absents','Salaire Payé']
      const rows = reportData.rows.map(r => [r.nom,r.prenom,String(r.salaire_base),String(r.jours_ouvrables),String(r.jours_presents),String(r.jours_absents),String(r.salaire_paye)])
      downloadCSV([headers, ...rows], `paie_${Date.now()}.csv`)
    }
  }

  // ── PDF export ──
  async function exportPDF() {
    if (!reportData) return
    const company = raisonSociale || (await ensureCompany())
    const blob  = await pdf(<RhPdfDocument data={reportData} raisonSociale={company} />).toBlob()
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = `rapport_rh_${reportData.type}_${Date.now()}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── UI helpers ──
  const REPORT_TABS: { type: ReportType; label: string; icon: React.ElementType }[] = [
    { type: 'employes',  label: t('tab_employes'),  icon: Users },
    { type: 'presences', label: t('tab_presences'), icon: ClipboardList },
    { type: 'conges',    label: t('tab_conges'),    icon: CalendarDays },
    { type: 'paie',      label: t('tab_paie'),      icon: CreditCard },
  ]

  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleString('fr-FR', { month: 'long' }),
  }))

  const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // ── Render ──
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">

      {/* En-tête */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
          <Users className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
      </div>

      {/* Tabs type de rapport */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {REPORT_TABS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => { setReportType(type); setReportData(null) }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                reportType === type
                  ? 'text-indigo-600 border-indigo-600 bg-indigo-50/30'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Filters panel */}
        <div className="p-5 space-y-4">

          {/* ── Employés filters ── */}
          {reportType === 'employes' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <input value={fPoste}      onChange={e => setFPoste(e.target.value)}      placeholder={t('f_poste')}      className="input-filter" />
              <input value={fDept}       onChange={e => setFDept(e.target.value)}        placeholder={t('f_dept')}       className="input-filter" />
              <select value={fContrat}   onChange={e => setFContrat(e.target.value)}     className="input-filter">
                <option value="">{t('f_contrat_all')}</option>
                {['CDI','CDD','Stage','Freelance','Consultant'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select value={fStatut}    onChange={e => setFStatut(e.target.value)}      className="input-filter">
                <option value="">{t('f_statut_all')}</option>
                {['actif','inactif','suspendu','conge'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <input value={fSalaireMin} onChange={e => setFSalaireMin(e.target.value)} placeholder={t('f_salaire_min')} type="number" className="input-filter" />
              <input value={fSalaireMax} onChange={e => setFSalaireMax(e.target.value)} placeholder={t('f_salaire_max')} type="number" className="input-filter" />
            </div>
          )}

          {/* ── Présences filters ── */}
          {reportType === 'presences' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                {(['semaine','mois','intervalle'] as const).map(v => (
                  <button key={v} onClick={() => setPPeriode(v)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${pPeriode === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {t(`periode_${v}`)}
                  </button>
                ))}
              </div>
              {pPeriode === 'mois' && (
                <>
                  <select value={pMonth} onChange={e => setPMonth(Number(e.target.value))} className="input-filter">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select value={pYear}  onChange={e => setPYear(Number(e.target.value))}  className="input-filter">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </>
              )}
              {pPeriode === 'intervalle' && (
                <>
                  <input type="date" value={pDateFrom} onChange={e => setPDateFrom(e.target.value)} className="input-filter" />
                  <input type="date" value={pDateTo}   onChange={e => setPDateTo(e.target.value)}   className="input-filter" />
                </>
              )}
            </div>
          )}

          {/* ── Congés filters ── */}
          {reportType === 'conges' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                {(['annee','mois','semaine','intervalle'] as const).map(v => (
                  <button key={v} onClick={() => setCPeriode(v)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${cPeriode === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {t(`periode_${v}`)}
                  </button>
                ))}
              </div>
              {(cPeriode === 'annee' || cPeriode === 'mois') && (
                <select value={cYear} onChange={e => setCYear(Number(e.target.value))} className="input-filter">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {cPeriode === 'mois' && (
                <select value={cMonth} onChange={e => setCMonth(Number(e.target.value))} className="input-filter">
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              )}
              {cPeriode === 'intervalle' && (
                <>
                  <input type="date" value={cDateFrom} onChange={e => setCDateFrom(e.target.value)} className="input-filter" />
                  <input type="date" value={cDateTo}   onChange={e => setCDateTo(e.target.value)}   className="input-filter" />
                </>
              )}
            </div>
          )}

          {/* ── Paie filters ── */}
          {reportType === 'paie' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">{t('periode_mois')} :</span>
                <select value={payMonth} onChange={e => setPayMonth(Number(e.target.value))} className="input-filter">
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={payYear} onChange={e => setPayYear(Number(e.target.value))} className="input-filter">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="pt-1">
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {t('btn_generate')}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {reportData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{
                reportData.type === 'employes'  ? reportData.rows.length :
                reportData.type === 'presences' ? reportData.rows.length :
                reportData.type === 'conges'    ? reportData.rows.length :
                reportData.rows.length
              }</span> {t('results')} — <span className="italic">{reportData.period}</span>
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

          {/* table */}
          <div className="overflow-x-auto">

            {/* Employés table */}
            {reportData.type === 'employes' && (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    {['Matricule','Nom','Prénom','Poste','Département','Contrat','Statut','Date Embauche','Salaire Base'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.matricule}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.nom}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.prenom}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.poste || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.departement || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{r.type_contrat || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                          r.statut === 'actif'    ? 'bg-emerald-100 text-emerald-700' :
                          r.statut === 'conge'    ? 'bg-blue-100 text-blue-700' :
                          r.statut === 'suspendu' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{r.statut}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{r.date_embauche || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">{r.salaire_base != null ? formatCurrency(r.salaire_base) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Présences table */}
            {reportData.type === 'presences' && (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nom complet</th>
                    <th className="px-4 py-3 text-right font-semibold">Jours présents</th>
                    <th className="px-4 py-3 text-right font-semibold">Jours absents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.prenom} {r.nom}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{r.jours_presents}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-medium">{r.jours_absents}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Congés table */}
            {reportData.type === 'conges' && (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nom complet</th>
                    <th className="px-4 py-3 text-right font-semibold">Congés journaliers</th>
                    <th className="px-4 py-3 text-right font-semibold">Congés horaires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.prenom} {r.nom}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{r.nb_journaliers}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">{r.nb_horaires}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Paie table */}
            {reportData.type === 'paie' && (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nom complet</th>
                    <th className="px-4 py-3 text-right font-semibold">Salaire base</th>
                    <th className="px-4 py-3 text-right font-semibold">J. ouvrables</th>
                    <th className="px-4 py-3 text-right font-semibold">J. présents</th>
                    <th className="px-4 py-3 text-right font-semibold">J. absents</th>
                    <th className="px-4 py-3 text-right font-semibold">Salaire payé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.prenom} {r.nom}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(r.salaire_base)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.jours_ouvrables}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{r.jours_presents}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-medium">{r.jours_absents}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatCurrency(r.salaire_paye)}</td>
                    </tr>
                  ))}
                </tbody>
                {reportData.rows.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-700">{formatCurrency(reportData.rows.reduce((s, r) => s + r.salaire_base, 0))}</td>
                      <td colSpan={3} />
                      <td className="px-4 py-2.5 text-right font-bold text-indigo-700">{formatCurrency(reportData.rows.reduce((s, r) => s + r.salaire_paye, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* Empty state */}
            {(
              (reportData.type === 'employes'  && reportData.rows.length === 0) ||
              (reportData.type === 'presences' && reportData.rows.length === 0) ||
              (reportData.type === 'conges'    && reportData.rows.length === 0) ||
              (reportData.type === 'paie'      && reportData.rows.length === 0)
            ) && (
              <div className="py-12 text-center text-slate-400 text-sm">{t('no_results')}</div>
            )}
          </div>
        </div>
      )}

      {/* Input filter styles (inline via global) */}
      <style jsx global>{`
        .input-filter {
          height: 36px;
          padding: 0 10px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          background: white;
          color: #334155;
          outline: none;
          min-width: 120px;
        }
        .input-filter:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgb(99 102 241 / 0.1); }
      `}</style>
    </div>
  )
}
