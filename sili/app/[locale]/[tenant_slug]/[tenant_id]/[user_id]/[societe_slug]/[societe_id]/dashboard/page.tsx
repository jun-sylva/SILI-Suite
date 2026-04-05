'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  Building2, CalendarDays, CheckCircle2, Clock, Users, CircleDollarSign,
  ShoppingCart, PackageSearch, GitBranch, ArrowRight, TrendingDown,
  AlertTriangle, Target, ChevronRight, HardHat, LayoutDashboard,
  FileText, Briefcase, Bell, Flag,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiBlock {
  key: string
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  alert?: boolean
  href: string
}

interface TaskItem {
  id: string
  titre: string
  statut: string
  date_echeance: string | null
  projet_nom: string | null
}

interface TodayItem {
  id: string
  label: string
  type: 'jalon' | 'tache' | 'evenement'
  time?: string
  href: string
}

interface WorkflowItem {
  id: string
  titre: string
  statut: string
  created_at: string
  processus_nom: string | null
}

interface RecentNotif {
  id: string
  type: string
  titre: string
  message: string
  created_at: string
  is_read: boolean
}

type PermMap = Record<string, string>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function notifDotColor(type: string): string {
  if (type === 'success') return 'bg-emerald-500'
  if (type === 'warning') return 'bg-amber-500'
  if (type === 'error') return 'bg-red-500'
  return 'bg-indigo-500'
}

function statutBadge(statut: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    a_faire:      { label: 'À faire',      cls: 'bg-slate-100 text-slate-600' },
    en_cours:     { label: 'En cours',     cls: 'bg-blue-100 text-blue-700' },
    en_attente:   { label: 'En attente',   cls: 'bg-amber-100 text-amber-700' },
    fait:         { label: 'Terminé',      cls: 'bg-emerald-100 text-emerald-700' },
    assigne:      { label: 'Assigné',      cls: 'bg-indigo-100 text-indigo-700' },
    approuve:     { label: 'Approuvé',     cls: 'bg-emerald-100 text-emerald-700' },
    rejete:       { label: 'Rejeté',       cls: 'bg-red-100 text-red-700' },
  }
  return map[statut] ?? { label: statut, cls: 'bg-slate-100 text-slate-500' }
}

// ─── Module shortcuts config ───────────────────────────────────────────────────

const MODULE_SHORTCUTS: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  crm:          { icon: HardHat,           color: 'text-orange-600',  bg: 'bg-orange-50',  label: 'CRM' },
  vente:        { icon: ShoppingCart,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  label: 'Ventes' },
  achat:        { icon: PackageSearch,     color: 'text-violet-600',  bg: 'bg-violet-50',  label: 'Achats' },
  stock:        { icon: Building2,         color: 'text-teal-600',    bg: 'bg-teal-50',    label: 'Stock' },
  rh:           { icon: Users,             color: 'text-rose-600',    bg: 'bg-rose-50',    label: 'RH' },
  comptabilite: { icon: CircleDollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Comptabilité' },
  workflow:     { icon: GitBranch,         color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Workflow' },
  planning:     { icon: CalendarDays,      color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', label: 'Planning' },
  rapports:     { icon: FileText,          color: 'text-slate-600',   bg: 'bg-slate-50',   label: 'Rapports' },
  teams:        { icon: Users,             color: 'text-cyan-600',    bg: 'bg-cyan-50',    label: 'Teams' },
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function SocieteDashboardPage() {
  const t    = useTranslations('dashboard')
  const navT = useTranslations('navigation')
  const params = useParams()

  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}`

  const [societeName,      setSocieteName]      = useState('')
  const [userDisplayName,  setUserDisplayName]  = useState('')
  const [kpis,             setKpis]             = useState<KpiBlock[]>([])
  const [myTasks,          setMyTasks]          = useState<TaskItem[]>([])
  const [todayItems,       setTodayItems]       = useState<TodayItem[]>([])
  const [workflowPending,  setWorkflowPending]  = useState<WorkflowItem[]>([])
  const [recentNotifs,     setRecentNotifs]     = useState<RecentNotif[]>([])
  const [activeModules,    setActiveModules]    = useState<string[]>([])
  const [perms,            setPerms]            = useState<PermMap>({})
  const [loading,          setLoading]          = useState(true)

  const greeting = (): string => {
    const h = new Date().getHours()
    if (h < 12) return t('greeting_morning')
    if (h < 18) return t('greeting_afternoon')
    return t('greeting_evening')
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societeId])

  async function init() {
    setLoading(true)

    // ── 1. Session & Profile ─────────────────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const uid = session.user.id

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id, full_name')
      .eq('id', uid)
      .single()

    const role   = profile?.role ?? ''
    const isAdmin = role === 'tenant_admin' || role === 'super_admin'
    setUserDisplayName(profile?.full_name ?? session.user.email?.split('@')[0] ?? 'Utilisateur')

    // ── 2. Societe name ──────────────────────────────────────────────────────
    const { data: soc } = await supabase
      .from('societes')
      .select('nom')
      .eq('id', societeId)
      .maybeSingle()
    setSocieteName(
      soc?.nom ?? societeSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    )

    // ── 3. Active modules for this societe ───────────────────────────────────
    const { data: modRows } = await supabase
      .from('societe_modules')
      .select('module')
      .eq('societe_id', societeId)
      .eq('is_active', true)
    const activeMods = modRows?.map(r => r.module) ?? []
    setActiveModules(activeMods)

    // ── 4. Permissions ───────────────────────────────────────────────────────
    const ALL_MODULES = ['crm', 'stock', 'rh', 'workflow', 'planning', 'vente', 'achat', 'comptabilite', 'rapports', 'teams']
    const permMap: PermMap = {}

    if (isAdmin) {
      ALL_MODULES.forEach(m => { permMap[m] = 'admin' })
    } else {
      await Promise.all(ALL_MODULES.map(async m => {
        permMap[m] = await fetchEffectiveModulePerm(uid, societeId, m)
      }))
    }
    setPerms(permMap)

    const canView    = (m: string) => activeMods.includes(m) && ['lecteur','contributeur','gestionnaire','admin'].includes(permMap[m] ?? 'aucun')
    const canManage  = (m: string) => activeMods.includes(m) && ['gestionnaire','admin'].includes(permMap[m] ?? 'aucun')

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    // ── 5. KPIs (parallel) ───────────────────────────────────────────────────
    const kpiBlocks: KpiBlock[] = []

    const [
      crmOpps, crmFactures,
      stockAlert,
      rhEmployes, rhConges,
      wfPending,
      planTaches, planJalons,
    ] = await Promise.all([
      // CRM: opportunités actives
      canView('crm')
        ? supabase.from('crm_opportunites').select('id', { count: 'exact', head: true })
            .eq('societe_id', societeId).not('etape', 'in', '("gagne","perdu")')
        : Promise.resolve({ count: null }),

      // CRM: factures en retard
      canView('crm')
        ? supabase.from('crm_factures').select('montant_restant')
            .eq('societe_id', societeId).eq('statut', 'en_retard')
        : Promise.resolve({ data: null }),

      // Stock: articles en rupture (stock_actuel <= stock_minimum, client-side filter)
      canView('stock')
        ? supabase.from('stock_articles').select('stock_actuel, stock_minimum')
            .eq('societe_id', societeId).eq('is_active', true)
        : Promise.resolve({ data: null }),

      // RH: employés actifs
      canView('rh')
        ? supabase.from('rh_employes').select('id', { count: 'exact', head: true })
            .eq('societe_id', societeId).eq('statut', 'actif')
        : Promise.resolve({ count: null }),

      // RH: congés en attente
      canView('rh')
        ? supabase.from('rh_conges').select('id', { count: 'exact', head: true })
            .eq('societe_id', societeId).eq('statut', 'en_attente')
        : Promise.resolve({ count: null }),

      // Workflow: requêtes en attente assignées à moi
      canView('workflow')
        ? supabase.from('workflow_requests').select('id', { count: 'exact', head: true })
            .eq('societe_id', societeId).eq('assigned_to', uid).in('statut', ['assigne', 'en_attente'])
        : Promise.resolve({ count: null }),

      // Planning: mes tâches actives
      canView('planning')
        ? supabase.from('plan_tache_assignes').select('plan_taches!inner(id, titre, statut, date_echeance, plan_projets!inner(nom))')
            .eq('user_id', uid)
            .not('plan_taches.statut', 'eq', 'fait')
            .limit(5)
        : Promise.resolve({ data: null }),

      // Planning: jalons du mois
      canView('planning')
        ? supabase.from('plan_jalons').select('id', { count: 'exact', head: true })
            .eq('societe_id', societeId).neq('statut', 'atteint').gte('date_cible', today).lte('date_cible', tomorrow)
        : Promise.resolve({ count: null }),
    ])

    // Build CRM block
    if (canView('crm')) {
      const oppCount = (crmOpps as any).count ?? 0
      const facturesData = (crmFactures as any).data as { montant_restant: number }[] | null
      const totalImpaye = facturesData?.reduce((s, f) => s + (f.montant_restant ?? 0), 0) ?? 0
      const factLateCount = facturesData?.length ?? 0

      kpiBlocks.push({
        key: 'crm_opps',
        label: t('kpi_opportunities'),
        value: oppCount,
        sub: t('kpi_opportunities_sub'),
        icon: Target,
        iconColor: 'text-orange-600',
        iconBg: 'bg-orange-50',
        href: base + '/crm',
      })

      if (factLateCount > 0) {
        kpiBlocks.push({
          key: 'crm_factures',
          label: t('kpi_invoices_late'),
          value: factLateCount,
          sub: totalImpaye > 0 ? `${totalImpaye.toLocaleString('fr-FR')} FCFA impayés` : undefined,
          icon: AlertTriangle,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-50',
          alert: true,
          href: base + '/crm/factures',
        })
      }
    }

    // Build Stock block
    if (canView('stock')) {
      const stockData = (stockAlert as any).data as { stock_actuel: number; stock_minimum: number }[] | null
      const alertCount = stockData?.filter(a => (a.stock_actuel ?? 0) <= (a.stock_minimum ?? 0)).length ?? 0
      kpiBlocks.push({
        key: 'stock_rupture',
        label: t('kpi_stock_alert'),
        value: alertCount,
        sub: t('kpi_stock_alert_sub'),
        icon: TrendingDown,
        iconColor: alertCount > 0 ? 'text-red-600' : 'text-teal-600',
        iconBg: alertCount > 0 ? 'bg-red-50' : 'bg-teal-50',
        alert: alertCount > 0,
        href: base + '/stock',
      })
    }

    // Build RH blocks
    if (canView('rh')) {
      const empCount = (rhEmployes as any).count ?? 0
      const congeCount = (rhConges as any).count ?? 0
      kpiBlocks.push({
        key: 'rh_employes',
        label: t('kpi_employees'),
        value: empCount,
        sub: t('kpi_employees_sub'),
        icon: Users,
        iconColor: 'text-rose-600',
        iconBg: 'bg-rose-50',
        href: base + '/rh',
      })
      if (canManage('rh') && congeCount > 0) {
        kpiBlocks.push({
          key: 'rh_conges',
          label: t('kpi_leaves_pending'),
          value: congeCount,
          sub: t('kpi_leaves_pending_sub'),
          icon: Clock,
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
          alert: true,
          href: base + '/rh/presences',
        })
      }
    }

    // Build Workflow block
    if (canView('workflow')) {
      const wfCount = (wfPending as any).count ?? 0
      kpiBlocks.push({
        key: 'workflow_pending',
        label: t('kpi_workflow_pending'),
        value: wfCount,
        sub: t('kpi_workflow_pending_sub'),
        icon: GitBranch,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-50',
        alert: wfCount > 0,
        href: base + '/workflow',
      })
    }

    // Build Planning block
    if (canView('planning')) {
      const tacheData = (planTaches as any).data as any[] | null
      const taskCount = tacheData?.length ?? 0
      const jalonsToday = (planJalons as any).count ?? 0
      kpiBlocks.push({
        key: 'planning_tasks',
        label: t('kpi_my_tasks'),
        value: taskCount,
        sub: jalonsToday > 0 ? `${jalonsToday} jalon(s) aujourd'hui` : t('kpi_my_tasks_sub'),
        icon: CheckCircle2,
        iconColor: 'text-fuchsia-600',
        iconBg: 'bg-fuchsia-50',
        href: base + '/planning/projets',
      })

      // Hydrate my tasks
      const tasks: TaskItem[] = tacheData?.map((row: any) => ({
        id: row.plan_taches.id,
        titre: row.plan_taches.titre,
        statut: row.plan_taches.statut,
        date_echeance: row.plan_taches.date_echeance,
        projet_nom: row.plan_taches.plan_projets?.nom ?? null,
      })) ?? []
      setMyTasks(tasks)
    }

    setKpis(kpiBlocks)

    // ── 6. Aujourd'hui ───────────────────────────────────────────────────────
    const todayArr: TodayItem[] = []

    if (canView('planning')) {
      const [{ data: jalonsToday }, { data: tachesToday }, { data: eventsToday }] = await Promise.all([
        supabase.from('plan_jalons').select('id, titre, date_cible').eq('societe_id', societeId)
          .eq('date_cible', today).neq('statut', 'atteint').order('date_cible'),
        supabase.from('plan_tache_assignes').select('plan_taches!inner(id, titre, date_echeance, statut)')
          .eq('user_id', uid).eq('plan_taches.date_echeance', today).neq('plan_taches.statut', 'fait'),
        supabase.from('plan_evenements').select('id, titre, heure_debut').eq('societe_id', societeId)
          .eq('date_debut', today).order('heure_debut'),
      ])

      jalonsToday?.forEach(j => {
        todayArr.push({ id: j.id, label: j.titre ?? `Jalon du ${formatDate(j.date_cible)}`, type: 'jalon', href: base + '/planning/projets' })
      })
      tachesToday?.forEach((row: any) => {
        const t2 = row.plan_taches
        todayArr.push({ id: t2.id, label: t2.titre, type: 'tache', href: base + '/planning/projets' })
      })
      eventsToday?.forEach((ev: any) => {
        todayArr.push({ id: ev.id, label: ev.titre, type: 'evenement', time: ev.heure_debut?.slice(0, 5), href: base + '/planning/calendrier' })
      })
    }

    setTodayItems(todayArr)

    // ── 7. Workflow en attente ────────────────────────────────────────────────
    if (canManage('workflow')) {
      const { data: wfRows } = await supabase
        .from('workflow_requests')
        .select('id, titre, statut, created_at, workflow_processus!inner(nom)')
        .eq('societe_id', societeId)
        .in('statut', ['en_attente', 'assigne'])
        .order('created_at', { ascending: false })
        .limit(5)
      setWorkflowPending(
        wfRows?.map((r: any) => ({
          id: r.id,
          titre: r.titre,
          statut: r.statut,
          created_at: r.created_at,
          processus_nom: r.workflow_processus?.nom ?? null,
        })) ?? []
      )
    }

    // ── 8. Recent notifications ───────────────────────────────────────────────
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, type, titre, message, created_at, is_read')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(6)
    setRecentNotifs((notifs as RecentNotif[]) ?? [])

    setLoading(false)
  }

  // ─── Accessible shortcuts ───────────────────────────────────────────────────
  const shortcuts = activeModules
    .filter(m => ['lecteur','contributeur','gestionnaire','admin'].includes(perms[m] ?? 'aucun') && MODULE_SHORTCUTS[m])
    .map(m => ({ key: m, ...MODULE_SHORTCUTS[m] }))

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-100 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-slate-100 rounded-xl" />
            <div className="h-40 bg-slate-100 rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-slate-100 rounded-xl" />
            <div className="h-40 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">{greeting()}, <span className="text-slate-600 font-semibold">{userDisplayName}</span></p>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{societeName}</h1>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{todayLabel}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700">{t('real_time_flux')}</span>
          </div>
          <Link
            href={base + '/dashboard'}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t('dashboard_label')}
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kpis.map(kpi => (
            <Link
              key={kpi.key}
              href={kpi.href}
              className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 p-5 flex items-start gap-4 ${kpi.alert ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-indigo-200'}`}
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${kpi.alert ? 'text-red-600' : 'text-slate-900'}`}>{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{kpi.sub}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors mt-1 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* ── Main 2-col layout ────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left col: Mes Tâches + Aujourd'hui */}
        <div className="lg:col-span-2 space-y-6">

          {/* Mes Tâches */}
          {perms['planning'] && perms['planning'] !== 'aucun' && activeModules.includes('planning') && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-fuchsia-500" />
                  <h2 className="text-sm font-bold text-slate-800">{t('my_tasks')}</h2>
                </div>
                <Link href={base + '/planning/projets'} className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1">
                  {t('view_all')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {myTasks.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">{t('no_tasks')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {myTasks.map(task => {
                    const badge = statutBadge(task.statut)
                    const isOverdue = task.date_echeance && task.date_echeance < new Date().toISOString().split('T')[0]
                    return (
                      <li key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="h-2 w-2 rounded-full bg-fuchsia-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{task.titre}</p>
                          {task.projet_nom && <p className="text-xs text-slate-400 truncate">{task.projet_nom}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.date_echeance && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(task.date_echeance)}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Aujourd'hui */}
          {perms['planning'] && perms['planning'] !== 'aucun' && activeModules.includes('planning') && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-slate-800">{t('today_section')}</h2>
                </div>
                <Link href={base + '/planning/calendrier'} className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1">
                  {t('view_calendar')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {todayItems.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CalendarDays className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">{t('no_events_today')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {todayItems.map(item => {
                    const typeConfig = {
                      jalon:      { dot: 'bg-violet-400', icon: Flag,         label: 'Jalon' },
                      tache:      { dot: 'bg-fuchsia-400', icon: CheckCircle2, label: 'Tâche' },
                      evenement:  { dot: 'bg-blue-400',   icon: CalendarDays, label: 'Événement' },
                    }[item.type]
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className={`h-2 w-2 rounded-full ${typeConfig.dot} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
                          <p className="text-xs text-slate-400">{typeConfig.label}</p>
                        </div>
                        {item.time && (
                          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            {item.time}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Activité Récente (notifications) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Bell className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800">{t('recent_activity')}</h2>
            </div>
            {recentNotifs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('no_recent_activity')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {recentNotifs.map(n => (
                  <li key={n.id} className={`flex items-start gap-3 px-5 py-3 transition-colors ${n.is_read ? 'hover:bg-slate-50' : 'bg-indigo-50/30 hover:bg-indigo-50/50'}`}>
                    <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${notifDotColor(n.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{n.titre}</p>
                      <p className="text-xs text-slate-400 truncate">{n.message}</p>
                    </div>
                    <span className="text-xs text-slate-300 shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right col: Workflow + Raccourcis */}
        <div className="space-y-6">

          {/* Workflow en attente */}
          {workflowPending.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/30">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-amber-800">{t('workflow_pending')}</h2>
                </div>
                <Link href={base + '/workflow'} className="text-xs text-amber-600 font-semibold hover:text-amber-800 flex items-center gap-1">
                  {t('view_all')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="divide-y divide-amber-50">
                {workflowPending.map(req => {
                  const badge = statutBadge(req.statut)
                  return (
                    <li key={req.id} className="px-5 py-3 hover:bg-amber-50/30 transition-colors">
                      <div className="flex items-center gap-2 justify-between">
                        <p className="text-sm font-medium text-slate-700 truncate flex-1">{req.titre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls} shrink-0`}>{badge.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {req.processus_nom && <p className="text-xs text-slate-400 truncate">{req.processus_nom}</p>}
                        <span className="text-xs text-slate-300 ml-auto shrink-0">{timeAgo(req.created_at)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Raccourcis Modules */}
          {shortcuts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <Briefcase className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-800">{t('module_shortcuts')}</h2>
              </div>
              <ul className="p-3 space-y-1">
                {shortcuts.map(cfg => (
                  <li key={cfg.key}>
                    <Link
                      href={base + '/' + cfg.key}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${cfg.bg} shrink-0`}>
                        <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 flex-1">{navT(cfg.key)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Info societe card */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="h-5 w-5 text-indigo-200" />
              <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">{t('your_company')}</p>
            </div>
            <p className="text-lg font-bold">{societeName}</p>
            <p className="text-xs text-indigo-200 mt-1">{activeModules.length} {t('active_modules')}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {activeModules.slice(0, 6).map(m => (
                <span key={m} className="text-[10px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {m}
                </span>
              ))}
              {activeModules.length > 6 && (
                <span className="text-[10px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full">
                  +{activeModules.length - 6}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}