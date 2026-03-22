'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Wrench, CheckCircle2, XCircle, RefreshCw, Loader2, AlertTriangle, Box, ShieldCheck, Building2, Settings2, BookOpen } from 'lucide-react'

interface RemediationCheck { id: string; icon: React.ElementType; title: string; description: string; status: 'pending' | 'passed' | 'failed' }
interface RemediationIssue { tenantId: string; tenantName: string; checkId: string; checkTitle: string; description: string; severity: string; fixed: boolean }

export default function RemediationPage() {
  const t = useTranslations('remediation')

  const CHECKS_BASE = [
    { id: 'modules', icon: Box },
    { id: 'admin', icon: ShieldCheck },
    { id: 'societes', icon: Building2 },
    { id: 'quotas', icon: Settings2 },
    { id: 'settings', icon: BookOpen },
  ]

  const buildChecks = (): RemediationCheck[] => CHECKS_BASE.map(c => ({
    ...c,
    title: t(`check_${c.id}`),
    description: t(`check_${c.id}_desc`),
    status: 'pending'
  }))

  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all')
  const [tenantsLoaded, setTenantsLoaded] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [checks, setChecks] = useState<RemediationCheck[]>(buildChecks())
  const [issues, setIssues] = useState<RemediationIssue[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasRun, setHasRun] = useState(false)
  const [fixingId, setFixingId] = useState<string | null>(null)

  const loadTenants = async () => {
    if (tenantsLoaded) return
    setLoadingTenants(true)
    const { data } = await supabase.from('tenants').select('id, name').order('name')
    if (data) setTenants(data)
    setTenantsLoaded(true)
    setLoadingTenants(false)
  }

  const runRemediation = async () => {
    setIsRunning(true); setProgress(0); setIssues([]); setHasRun(false)
    setChecks(buildChecks())
    let targetTenants: { id: string; name: string }[] = []
    if (selectedTenantId === 'all') { const { data } = await supabase.from('tenants').select('id, name'); targetTenants = data ?? [] }
    else { targetTenants = tenants.filter(t => t.id === selectedTenantId) }

    const detectedIssues: RemediationIssue[] = []
    const totalChecks = CHECKS_BASE.length

    for (let i = 0; i < CHECKS_BASE.length; i++) {
      const check = CHECKS_BASE[i]
      await new Promise(resolve => setTimeout(resolve, 600))
      let checkFailed = false

      for (const tenant of targetTenants) {
        let issue: string | null = null
        if (check.id === 'societes') {
          const { count } = await supabase.from('societes').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true)
          if ((count ?? 0) === 0) issue = 'Aucune société active trouvée pour ce tenant.'
        }
        if (check.id === 'quotas') {
          const { data: td } = await supabase.from('tenants').select('max_users, max_societes, max_storage_gb').eq('id', tenant.id).single()
          if (!td?.max_users || !td?.max_societes || !td?.max_storage_gb) issue = 'Un ou plusieurs champs de quotas non définis (NULL).'
        }
        if (issue) { checkFailed = true; detectedIssues.push({ tenantId: tenant.id, tenantName: tenant.name, checkId: check.id, checkTitle: t(`check_${check.id}`), description: issue, severity: t('severity_moderate'), fixed: false }) }
      }

      setChecks(prev => prev.map(c => c.id === check.id ? { ...c, status: checkFailed ? 'failed' : 'passed' } : c))
      setProgress(Math.round(((i + 1) / totalChecks) * 100))
    }
    setIssues(detectedIssues); setIsRunning(false); setHasRun(true)
  }

  const fixIssue = (tenantId: string, checkId: string) => {
    const key = `${tenantId}-${checkId}`
    setFixingId(key)
    setTimeout(() => {
      setFixingId(null)
      setIssues(prev => {
        const next = prev.map(i => (i.tenantId === tenantId && i.checkId === checkId) ? { ...i, fixed: true } : i)
        if (next.every(i => i.fixed)) setChecks(c => c.map(r => ({ ...r, status: 'passed' })))
        return next
      })
    }, 1500)
  }

  const openIssues = issues.filter(i => !i.fixed)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        {isRunning && <div className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wrench className="h-6 w-6 text-indigo-600" /> {t('title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
          </div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative">
              <select onFocus={loadTenants} value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} disabled={isRunning} className="w-full sm:w-56 appearance-none pl-4 pr-10 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer disabled:opacity-60">
                <option value="all">{t('scope_all')}</option>
                {loadingTenants && <option disabled>Chargement...</option>}
                {tenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</div>
            </div>
            <button onClick={runRemediation} disabled={isRunning} className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {isRunning ? `${progress}% ${t('running_btn')}` : t('run_btn')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-500" /> {t('checks_title', { count: checks.length })}</h3></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {checks.map(check => {
                const Icon = check.icon
                return (
                  <div key={check.id} className="p-4 flex gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      {check.status === 'passed' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {check.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                      {check.status === 'pending' && <RefreshCw className={`h-5 w-5 ${isRunning ? 'animate-spin text-indigo-400' : 'text-slate-300'}`} />}
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div><p className="text-sm font-bold text-slate-800">{check.title}</p><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{check.description}</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="bg-white border-b border-slate-100 py-4 flex flex-row items-center justify-between">
            <h3 className="font-bold text-slate-800">{t('results_title')}</h3>
            {openIssues.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">{openIssues.length} problème(s)</span>}
          </CardHeader>
          <CardContent className="p-0">
            {isRunning ? (
              <div className="p-14 flex flex-col items-center justify-center h-[300px]"><Loader2 className="h-10 w-10 text-indigo-400 animate-spin mb-4" /><p className="font-bold text-slate-600">{t('running_label')}</p><p className="text-xs text-slate-400 mt-1">{t('running_sublabel')}</p></div>
            ) : !hasRun ? (
              <div className="p-14 flex flex-col items-center justify-center h-[300px]"><Wrench className="h-10 w-10 text-slate-300 mb-4" /><p className="font-bold text-slate-600">{t('results_empty_title')}</p><p className="text-xs text-slate-400 mt-1">{t('results_empty_subtitle')}</p></div>
            ) : issues.every(i => i.fixed) || issues.length === 0 ? (
              <div className="p-14 flex flex-col items-center justify-center h-[300px] bg-emerald-50/30"><CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" /><p className="text-lg font-black text-emerald-700">{t('all_ok_title')}</p><p className="text-sm text-emerald-600 mt-1">{t('all_ok_subtitle')}</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {issues.map((issue) => {
                  const key = `${issue.tenantId}-${issue.checkId}`
                  return (
                    <div key={key} className={`p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all ${issue.fixed ? 'opacity-50 grayscale bg-slate-50' : 'bg-white hover:bg-slate-50/50'}`}>
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-1">{issue.fixed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700`}>{issue.severity}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{issue.checkTitle}</span></div>
                          <p className={`text-sm font-bold ${issue.fixed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>[{issue.tenantName}] {issue.description}</p>
                        </div>
                      </div>
                      {!issue.fixed && (
                        <button onClick={() => fixIssue(issue.tenantId, issue.checkId)} disabled={fixingId === key} className="shrink-0 flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-bold text-xs rounded-lg hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all disabled:opacity-50">
                          {fixingId === key ? <><Loader2 className="h-3 w-3 animate-spin" /> {t('fixing_btn')}</> : <><Wrench className="h-3 w-3" /> {t('fix_btn')}</>}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
