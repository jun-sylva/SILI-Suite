'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Loader2, ChevronRight, TrendingDown,
} from 'lucide-react'

const fmt    = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtQte = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)

interface KpiData {
  valeurStock:   number
  articlesTotal: number
  rupture:       number
  sousMinimum:   number
  mouvJour:      number
}

interface AlerteItem {
  id: string; reference: string; designation: string
  stock_actuel: number; stock_minimum: number; unite: string
}

interface MouvItem {
  id: string; article_designation: string; type_mouvement: string
  quantite: number; stock_apres: number; created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  entree:      'text-emerald-600',
  sortie:      'text-red-500',
  ajustement:  'text-amber-600',
  inventaire:  'text-blue-600',
}
const TYPE_ICON: Record<string, React.ElementType> = {
  entree:     ArrowDownCircle,
  sortie:     ArrowUpCircle,
  ajustement: TrendingDown,
  inventaire: Package,
}
const TYPE_LABEL: Record<string, string> = {
  entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', inventaire: 'Inventaire',
}

export default function StockDashboard() {
  const t      = useTranslations('stock')
  const params = useParams()
  const router = useRouter()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base        = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/stock`

  const [loading,   setLoading]   = useState(true)
  const [kpi,       setKpi]       = useState<KpiData>({ valeurStock: 0, articlesTotal: 0, rupture: 0, sousMinimum: 0, mouvJour: 0 })
  const [alertes,   setAlertes]   = useState<AlerteItem[]>([])
  const [mouvements, setMouvements] = useState<MouvItem[]>([])

  useEffect(() => {
    async function init() {
      await Promise.all([loadKpi(), loadAlertes(), loadMouvements()])
      setLoading(false)
    }
    init()
  }, [societeId])

  async function loadKpi() {
    const today = new Date().toISOString().split('T')[0]

    const [{ data: articles }, { count: mouvJour }] = await Promise.all([
      (supabase as any).from('stock_articles').select('stock_actuel, stock_minimum, prix_achat, is_active').eq('societe_id', societeId).eq('is_active', true),
      (supabase as any).from('stock_mouvements').select('id', { count: 'exact', head: true }).eq('societe_id', societeId).gte('created_at', `${today}T00:00:00`),
    ])

    const arts = articles ?? []
    const valeurStock   = arts.reduce((s: number, a: any) => s + (a.stock_actuel ?? 0) * (a.prix_achat ?? 0), 0)
    const rupture       = arts.filter((a: any) => (a.stock_actuel ?? 0) <= 0).length
    const sousMinimum   = arts.filter((a: any) => (a.stock_actuel ?? 0) > 0 && (a.stock_actuel ?? 0) < (a.stock_minimum ?? 0)).length

    setKpi({ valeurStock, articlesTotal: arts.length, rupture, sousMinimum, mouvJour: mouvJour ?? 0 })
  }

  async function loadAlertes() {
    const { data } = await (supabase as any)
      .from('stock_articles')
      .select('id, reference, designation, stock_actuel, stock_minimum, unite')
      .eq('societe_id', societeId)
      .eq('is_active', true)
      .lt('stock_actuel', (supabase as any).raw('stock_minimum'))
      .order('stock_actuel', { ascending: true })
      .limit(5)
    setAlertes(data ?? [])
  }

  async function loadMouvements() {
    const { data } = await (supabase as any)
      .from('stock_mouvements')
      .select('id, type_mouvement, quantite, stock_apres, created_at, article:article_id(designation)')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
      .limit(8)
    setMouvements(
      (data ?? []).map((m: any) => ({
        ...m,
        article_designation: m.article?.designation ?? '—',
      }))
    )
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('module_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">Gestion des articles et des mouvements de stock</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
          <Package className="h-6 w-6 text-amber-600" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t('kpi_valeur_stock'),    value: fmt(kpi.valeurStock) + ' FCFA', color: 'text-amber-700',   bg: 'bg-amber-50'   },
          { label: t('kpi_articles_total'),  value: kpi.articlesTotal,              color: 'text-slate-800',   bg: 'bg-slate-50'   },
          { label: t('kpi_rupture'),         value: kpi.rupture,                    color: kpi.rupture > 0 ? 'text-red-600' : 'text-slate-800', bg: kpi.rupture > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: t('kpi_sous_minimum'),    value: kpi.sousMinimum,                color: kpi.sousMinimum > 0 ? 'text-orange-600' : 'text-slate-800', bg: kpi.sousMinimum > 0 ? 'bg-orange-50' : 'bg-slate-50' },
          { label: t('kpi_mouvements_jour'), value: kpi.mouvJour,                   color: 'text-blue-700',    bg: 'bg-blue-50'    },
        ].map((k, i) => (
          <div key={i} className={`rounded-2xl border border-slate-200 ${k.bg} p-5`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {t('section_alertes')}
            </h2>
            <button onClick={() => router.push(`${base}/alertes`)}
              className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {alertes.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">{t('empty_alertes')}</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {alertes.map(a => {
                const pct = a.stock_minimum > 0 ? Math.min(100, (a.stock_actuel / a.stock_minimum) * 100) : 0
                const isRupture = a.stock_actuel <= 0
                return (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                    <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${isRupture ? 'bg-red-50' : 'bg-orange-50'}`}>
                      <AlertTriangle className={`h-4 w-4 ${isRupture ? 'text-red-500' : 'text-orange-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{a.designation}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                          <div className={`h-1.5 rounded-full transition-all ${isRupture ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{fmtQte(a.stock_actuel)} / {fmtQte(a.stock_minimum)} {a.unite}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${isRupture ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                      {isRupture ? t('badge_rupture') : t('badge_alerte')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Derniers mouvements */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{t('section_mouvements')}</h2>
            <button onClick={() => router.push(`${base}/mouvements`)}
              className="text-xs text-amber-600 hover:underline flex items-center gap-0.5">
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {mouvements.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">{t('empty_mouvements')}</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {mouvements.map(m => {
                const Icon = TYPE_ICON[m.type_mouvement] ?? Package
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Icon className={`h-4 w-4 shrink-0 ${TYPE_COLOR[m.type_mouvement] ?? 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.article_designation}</p>
                      <p className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${TYPE_COLOR[m.type_mouvement] ?? 'text-slate-600'}`}>
                        {m.type_mouvement === 'sortie' ? '-' : '+'}{fmtQte(m.quantite)}
                      </p>
                      <p className="text-xs text-slate-400">→ {fmtQte(m.stock_apres)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
