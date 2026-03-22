'use client'

import { useState } from 'react'
import { Bug, ChevronDown, ChevronRight, XCircle, CheckCircle2, EyeOff, AlertOctagon, Zap, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type ErrorStatus = 'open' | 'resolved' | 'ignored'

interface AppError {
  id: string
  type: string
  message: string
  file: string
  tenant: string
  count: number
  lastSeen: string
  status: ErrorStatus
  stack: string
}

const statusConfig: Record<ErrorStatus, { label: string; className: string }> = {
  open: { label: 'Actif', className: 'bg-red-100 text-red-700' },
  resolved: { label: 'Résolu', className: 'bg-emerald-100 text-emerald-700' },
  ignored: { label: 'Ignoré', className: 'bg-slate-100 text-slate-500' },
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<AppError[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const updateStatus = (id: string, status: ErrorStatus) => {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  const openCount = errors.filter(e => e.status === 'open').length
  const resolvedCount = errors.filter(e => e.status === 'resolved').length
  const reliability = errors.length === 0 ? 100 : Math.max(0, (100 - openCount * 0.1)).toFixed(2)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Zap className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fiabilité (24h)</p>
            <p className="text-3xl font-black text-slate-800">{reliability}<span className="text-lg text-slate-400">%</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0"><AlertOctagon className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Exceptions Actives</p>
            <p className="text-3xl font-black text-slate-800">{openCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><TrendingDown className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Incidents Résolus</p>
            <p className="text-3xl font-black text-slate-800">{resolvedCount}</p>
          </div>
        </div>
      </div>

      {/* Error List */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 flex flex-row items-center gap-2">
          <Bug className="h-5 w-5 text-slate-500" />
          <h3 className="font-bold text-slate-800">Journal des exceptions</h3>
          {openCount > 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-md ml-auto">{openCount} ouvertes</span>}
        </CardHeader>
        <CardContent className="p-0">
          {errors.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-300 mb-4" />
              <p className="font-bold text-slate-700">Aucune exception de production détectée.</p>
              <p className="text-xs mt-1 text-slate-400">Les erreurs applicatives remonteront automatiquement ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {errors.map((error) => (
                <div key={error.id} className={`transition-colors ${error.status !== 'open' ? 'opacity-60' : ''}`}>
                  <div className="p-4 md:p-5 flex items-start gap-3 cursor-pointer hover:bg-slate-50/70 group" onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}>
                    <span className="mt-1 shrink-0 text-slate-400 group-hover:text-indigo-500 transition-colors">
                      {expandedId === error.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{error.type}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig[error.status].className}`}>{statusConfig[error.status].label}</span>
                        <span className="text-xs text-slate-400 hidden md:block">{error.lastSeen}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate">{error.message}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{error.file}</p>
                    </div>
                    <div className="shrink-0 text-right ml-3 hidden md:block">
                      <div className="text-lg font-black text-slate-700">{error.count}x</div>
                      <p className="text-[11px] text-slate-400">{error.tenant}</p>
                    </div>
                  </div>

                  {expandedId === error.id && (
                    <div className="border-t border-slate-100 bg-slate-950 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="w-3 h-3 rounded-full bg-amber-400"></span><span className="w-3 h-3 rounded-full bg-emerald-500"></span></div>
                        <span className="text-slate-500 text-xs font-mono">Stack Trace — {error.file}</span>
                        <span className="text-slate-500 text-xs">{error.tenant}</span>
                      </div>
                      <pre className="p-5 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">{error.stack}</pre>
                      {error.status === 'open' ? (
                        <div className="flex items-center gap-3 px-5 pb-4">
                          <button onClick={() => updateStatus(error.id, 'resolved')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all"><CheckCircle2 className="h-4 w-4" /> Marquer comme résolu</button>
                          <button onClick={() => updateStatus(error.id, 'ignored')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-600 transition-all"><EyeOff className="h-4 w-4" /> Ignorer</button>
                        </div>
                      ) : (
                        <div className="px-5 pb-4">
                          <button onClick={() => updateStatus(error.id, 'open')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-600"><XCircle className="h-4 w-4" /> Réouvrir l&apos;incident</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
