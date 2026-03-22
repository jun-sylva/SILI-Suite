'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ShieldCheck, HeartPulse, CheckCircle2, XCircle, AlertTriangle, Activity, Wrench, RefreshCw, Loader2 } from 'lucide-react'

interface ValidationRule { id: string; title: string; description: string; status: 'passed' | 'failed' | 'pending' }
interface Anomaly { id: string; tenant: string; rule: string; description: string; severity: string; fixed: boolean }

export default function ValidationPage() {
  const t = useTranslations('validation')

  const RULES_TEMPLATE: ValidationRule[] = [
    { id: 'R1', title: t('rule_quotas_title'), description: t('rule_quotas_desc'), status: 'pending' },
    { id: 'R2', title: t('rule_iam_title'), description: t('rule_iam_desc'), status: 'pending' },
    { id: 'R3', title: t('rule_modules_title'), description: t('rule_modules_desc'), status: 'pending' },
    { id: 'R4', title: t('rule_db_title'), description: t('rule_db_desc'), status: 'pending' },
  ]

  const [rules, setRules] = useState<ValidationRule[]>(RULES_TEMPLATE)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [fixingId, setFixingId] = useState<string | null>(null)

  const runIntegrityScan = async () => {
    setIsScanning(true); setScanProgress(0); setAnomalies([]); setHealthScore(null)
    setRules(RULES_TEMPLATE.map(r => ({ ...r, status: 'pending' })))
    let progress = 0
    const interval = setInterval(() => {
      progress += 12; setScanProgress(Math.min(100, progress))
      if (progress === 24) setRules(prev => prev.map(r => r.id === 'R4' ? { ...r, status: 'passed' } : r))
      if (progress === 48) setRules(prev => prev.map(r => r.id === 'R3' ? { ...r, status: 'passed' } : r))
      if (progress === 72) setRules(prev => prev.map(r => r.id === 'R2' ? { ...r, status: 'passed' } : r))
      if (progress === 96) setRules(prev => prev.map(r => r.id === 'R1' ? { ...r, status: 'passed' } : r))
      if (progress >= 100) { clearInterval(interval); setIsScanning(false); setScanProgress(100); setHealthScore(100); setLastScan(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })) }
    }, 400)
  }

  const fixAnomaly = (id: string) => {
    setFixingId(id)
    setTimeout(() => {
      setFixingId(null)
      setAnomalies(current => {
        const next = current.map(a => a.id === id ? { ...a, fixed: true } : a)
        if (next.every(a => a.fixed)) { setHealthScore(100); setRules(prev => prev.map(r => ({ ...r, status: 'passed' }))) }
        return next
      })
    }, 1500)
  }

  const displayScore = healthScore ?? 0
  const showScore = healthScore !== null

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        {isScanning && <div className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-300" style={{ width: `${scanProgress}%` }} />}
        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center rounded-full bg-slate-50 border-4 border-slate-100 shadow-inner">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path className={`${!showScore ? 'text-slate-200' : displayScore === 100 ? 'text-emerald-500' : 'text-amber-500'} transition-all duration-1000`} strokeDasharray={`${showScore ? displayScore : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
            <span className="text-lg font-black text-slate-700">{showScore ? `${displayScore}` : '--'}<span className="text-[10px]">{showScore ? '%' : ''}</span></span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><HeartPulse className="h-6 w-6 text-indigo-600" /> {t('title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('last_scan_label')} {lastScan ? <span className="font-bold text-slate-700">{lastScan}</span> : t('last_scan_never')}</p>
          </div>
        </div>
        <button onClick={runIntegrityScan} disabled={isScanning} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {isScanning ? t('scan_progress', { progress: Math.min(100, scanProgress) }) : t('scan_btn')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm rounded-2xl h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-500" /> {t('rules_title', { count: rules.length })}</h3></CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-5 flex gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="shrink-0 mt-1">
                      {rule.status === 'passed' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {rule.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                      {rule.status === 'pending' && <RefreshCw className={`h-5 w-5 ${isScanning ? 'animate-spin text-indigo-400' : 'text-slate-300'}`} />}
                    </div>
                    <div><h4 className="text-sm font-bold text-slate-800">{rule.title}</h4><p className="text-xs text-slate-500 mt-1 leading-relaxed">{rule.description}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-slate-200 shadow-sm rounded-2xl h-full">
            <CardHeader className="bg-white border-b border-slate-100 py-4 flex flex-row items-center justify-between">
              <h3 className="font-bold text-slate-800">{t('anomalies_title')}</h3>
              {anomalies.filter(a => !a.fixed).length > 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">{t('anomaly_count', { count: anomalies.filter(a => !a.fixed).length })}</span>}
            </CardHeader>
            <CardContent className="p-0">
              {isScanning ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-[300px]"><Activity className="h-10 w-10 mx-auto text-indigo-300 mb-4 animate-pulse" /><p className="font-bold text-slate-600">{t('scanning_label')}</p><p className="text-xs mt-1 text-slate-400">{t('scanning_sublabel')}</p></div>
              ) : anomalies.length === 0 && !lastScan ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-[300px]"><ShieldCheck className="h-10 w-10 mx-auto text-slate-300 mb-4" /><p className="font-bold text-slate-600">{t('empty_title')}</p><p className="text-xs mt-1 text-slate-400">{t('empty_subtitle')}</p></div>
              ) : anomalies.every(a => a.fixed) ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-[300px] bg-emerald-50/30"><CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" /><p className="text-lg font-black text-emerald-700">{t('all_fixed_title')}</p><p className="text-sm mt-1 font-medium text-emerald-600">{t('all_fixed_subtitle')}</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {anomalies.map((anomaly) => (
                    <div key={anomaly.id} className={`p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center transition-all ${anomaly.fixed ? 'opacity-50 grayscale bg-slate-50' : 'bg-white'}`}>
                      <div className="flex gap-4">
                        <div className="shrink-0 mt-1">{anomaly.fixed ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <AlertTriangle className={`h-6 w-6 ${anomaly.severity === t('severity_high') ? 'text-red-500' : 'text-amber-500'}`} />}</div>
                        <div>
                          <div className="flex items-center gap-2 mb-1"><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{anomaly.id}</span>{!anomaly.fixed && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${anomaly.severity === t('severity_high') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{anomaly.severity}</span>}</div>
                          <h4 className={`text-sm font-bold ${anomaly.fixed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>[{anomaly.tenant}] {anomaly.description}</h4>
                          <p className="text-xs text-slate-500 mt-1">{t('anomaly_source')} {anomaly.rule}</p>
                        </div>
                      </div>
                      {!anomaly.fixed && (
                        <button onClick={() => fixAnomaly(anomaly.id)} disabled={fixingId === anomaly.id} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50">
                          {fixingId === anomaly.id ? <><Loader2 className="h-3 w-3 animate-spin" /> {t('autofixing_btn')}</> : <><Wrench className="h-3 w-3" /> {t('autofix_btn')}</>}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
