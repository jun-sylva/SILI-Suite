'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  GitBranch, Users, Activity, FileText, Receipt,
  TrendingUp, AlertTriangle, Loader2, ChevronRight, Clock,
} from 'lucide-react'
import dayjs from 'dayjs'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

interface KpiData {
  opportunites:     number
  ca_previsionnel:  number
  leads:            number
  taux_conversion:  number
  devis_attente:    number
  factures_impayees:number
  ca_encaisse:      number
  montant_retard:   number
}

interface ActiviteItem {
  id: string; titre: string; type: string; opportunite_titre: string | null
}
interface FactureRetardItem {
  id: string; numero: string | null; client_nom: string | null
  montant_restant: number; date_echeance: string
}
interface PipelineEtape { etape: string; count: number; valeur: number }

const ETAPE_LABELS: Record<string, string> = {
  qualification: 'Qualification',
  proposition:   'Proposition',
  negociation:   'Négociation',
  gagnee:        'Gagnée',
  perdue:        'Perdue',
}
const ETAPE_COLOR: Record<string, string> = {
  qualification: 'bg-slate-400',
  proposition:   'bg-blue-400',
  negociation:   'bg-amber-400',
  gagnee:        'bg-emerald-500',
  perdue:        'bg-red-400',
}

export default function CrmDashboard() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const router    = useRouter()
  const societeId = params.societe_id as string
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string

  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/crm`

  const [loading,         setLoading]         = useState(true)
  const [kpi,             setKpi]             = useState<KpiData>({ opportunites: 0, ca_previsionnel: 0, leads: 0, taux_conversion: 0, devis_attente: 0, factures_impayees: 0, ca_encaisse: 0, montant_retard: 0 })
  const [activites,       setActivites]       = useState<ActiviteItem[]>([])
  const [facturesRetard,  setFacturesRetard]  = useState<FactureRetardItem[]>([])
  const [pipeline,        setPipeline]        = useState<PipelineEtape[]>([])
  const [currentUserId,   setCurrentUserId]   = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)
      await Promise.all([loadKpi(), loadActivites(session.user.id), loadFacturesRetard(), loadPipeline()])
      setLoading(false)
    }
    init()
  }, [societeId])

  async function loadKpi() {
    const now        = dayjs()
    const debutMois  = now.startOf('month').toISOString()
    const finMois    = now.endOf('month').toISOString()

    const [oppRes, leadsRes, devisRes, facturesRes, paiementsRes] = await Promise.all([
      (supabase as any).from('crm_opportunites').select('valeur, etape').eq('societe_id', societeId).not('etape', 'in', '("gagnee","perdue")'),
      (supabase as any).from('crm_leads').select('statut').eq('societe_id', societeId),
      (supabase as any).from('crm_devis').select('statut').eq('societe_id', societeId).eq('statut', 'envoye'),
      (supabase as any).from('crm_factures').select('statut, montant_restant').eq('societe_id', societeId).not('statut', 'in', '("payee","annulee","brouillon")'),
      (supabase as any).from('crm_paiements').select('montant, date_paiement').eq('societe_id', societeId).gte('date_paiement', debutMois.split('T')[0]).lte('date_paiement', finMois.split('T')[0]),
    ])

    const opps      = oppRes.data ?? []
    const leads     = leadsRes.data ?? []
    const ca_prev   = opps.reduce((s: number, o: any) => s + (o.valeur ?? 0) * ((o.probabilite ?? 50) / 100), 0)
    const total_leads     = leads.length
    const leads_convertis = leads.filter((l: any) => l.statut === 'converti').length
    const taux = total_leads > 0 ? Math.round((leads_convertis / total_leads) * 100) : 0
    const factures     = facturesRes.data ?? []
    const retard_total = factures.filter((f: any) => f.statut === 'en_retard').reduce((s: number, f: any) => s + (f.montant_restant ?? 0), 0)
    const ca_enc   = (paiementsRes.data ?? []).reduce((s: number, p: any) => s + (p.montant ?? 0), 0)

    setKpi({
      opportunites:      opps.length,
      ca_previsionnel:   ca_prev,
      leads:             leads.filter((l: any) => !['converti', 'perdu'].includes(l.statut ?? '')).length,
      taux_conversion:   taux,
      devis_attente:     (devisRes.data ?? []).length,
      factures_impayees: factures.length,
      ca_encaisse:       ca_enc,
      montant_retard:    retard_total,
    })
  }

  async function loadActivites(uid: string) {
    const today = dayjs().format('YYYY-MM-DD')
    const { data } = await (supabase as any)
      .from('crm_activites')
      .select('id, titre, type, opportunite:crm_opportunites!opportunite_id(titre)')
      .eq('societe_id', societeId)
      .eq('statut', 'a_faire')
      .eq('assigne_a', uid)
      .gte('date_prevue', `${today}T00:00:00`)
      .lte('date_prevue', `${today}T23:59:59`)
      .order('date_prevue', { ascending: true })
      .limit(5)
    setActivites((data ?? []).map((a: any) => ({
      id: a.id, titre: a.titre, type: a.type,
      opportunite_titre: a.opportunite?.titre ?? null,
    })))
  }

  async function loadFacturesRetard() {
    const today = dayjs().format('YYYY-MM-DD')
    const { data } = await (supabase as any)
      .from('crm_factures')
      .select('id, numero, client_nom, montant_restant, date_echeance')
      .eq('societe_id', societeId)
      .eq('statut', 'en_retard')
      .lt('date_echeance', today)
      .order('date_echeance', { ascending: true })
      .limit(5)
    setFacturesRetard(data ?? [])
  }

  async function loadPipeline() {
    const { data } = await (supabase as any)
      .from('crm_opportunites')
      .select('etape, valeur')
      .eq('societe_id', societeId)
    const map: Record<string, { count: number; valeur: number }> = {}
    for (const o of (data ?? [])) {
      const e = o.etape ?? 'qualification'
      if (!map[e]) map[e] = { count: 0, valeur: 0 }
      map[e].count++
      map[e].valeur += o.valeur ?? 0
    }
    setPipeline(Object.entries(map).map(([etape, v]) => ({ etape, ...v })))
  }

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  const KPIS = [
    { label: t('kpi_opportunites'),    value: kpi.opportunites,                  icon: GitBranch,  color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
    { label: t('kpi_ca_previsionnel'), value: `${fmt(kpi.ca_previsionnel)} FCFA`, icon: TrendingUp, color: 'text-blue-600',    bg: 'bg-blue-50'    },
    { label: t('kpi_leads'),           value: kpi.leads,                          icon: Users,      color: 'text-violet-600',  bg: 'bg-violet-50'  },
    { label: t('kpi_taux_conversion'), value: `${kpi.taux_conversion}%`,          icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t('kpi_devis_attente'),   value: kpi.devis_attente,                  icon: FileText,   color: 'text-amber-600',   bg: 'bg-amber-50'   },
    { label: t('kpi_factures_impayees'),value: kpi.factures_impayees,             icon: Receipt,    color: 'text-orange-600',  bg: 'bg-orange-50'  },
    { label: t('kpi_ca_encaisse'),     value: `${fmt(kpi.ca_encaisse)} FCFA`,     icon: TrendingUp, color: 'text-teal-600',    bg: 'bg-teal-50'    },
    { label: t('kpi_montant_retard'),  value: `${fmt(kpi.montant_retard)} FCFA`,  icon: AlertTriangle, color: kpi.montant_retard > 0 ? 'text-red-600' : 'text-slate-400', bg: kpi.montant_retard > 0 ? 'bg-red-50' : 'bg-slate-50' },
  ]

  const maxPipelineValeur = Math.max(...pipeline.map(p => p.valeur), 1)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('module_title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('nav_dashboard')}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <GitBranch className="h-5 w-5 text-indigo-600" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}>
                <Icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pipeline résumé + Activités */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t('section_pipeline_resume')}</h2>
            <button onClick={() => router.push(`${base}/pipeline`)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            {['qualification', 'proposition', 'negociation', 'gagnee', 'perdue'].map(etape => {
              const item = pipeline.find(p => p.etape === etape)
              const valeur = item?.valeur ?? 0
              const count  = item?.count  ?? 0
              const pct    = Math.round((valeur / maxPipelineValeur) * 100)
              return (
                <div key={etape} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">{ETAPE_LABELS[etape]}</span>
                    <span className="text-slate-400">{count} · {fmt(valeur)} FCFA</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${ETAPE_COLOR[etape]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activités du jour */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{t('section_activites_jour')}</h2>
            <button onClick={() => router.push(`${base}/activites`)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Voir <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {activites.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Clock className="h-7 w-7 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">{t('empty_activites')}</p>
              </div>
            ) : activites.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Activity className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{a.titre}</p>
                  {a.opportunite_titre && <p className="text-xs text-slate-400 truncate">{a.opportunite_titre}</p>}
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize shrink-0">{a.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Factures en retard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{t('section_factures_retard')}</h2>
          <button onClick={() => router.push(`${base}/factures`)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
            Voir <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {facturesRetard.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Receipt className="h-7 w-7 text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">{t('empty_factures_retard')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('col_numero')}</th>
                  <th className="px-5 py-3 text-left">{t('col_client')}</th>
                  <th className="px-5 py-3 text-left">{t('col_echeance')}</th>
                  <th className="px-5 py-3 text-right">{t('col_restant')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {facturesRetard.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`${base}/factures/${f.id}`)}>
                    <td className="px-5 py-3 font-mono text-xs text-indigo-600">{f.numero ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700">{f.client_nom ?? '—'}</td>
                    <td className="px-5 py-3 text-red-600 font-medium">{dayjs(f.date_echeance).format('DD/MM/YYYY')}</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{fmt(f.montant_restant)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
