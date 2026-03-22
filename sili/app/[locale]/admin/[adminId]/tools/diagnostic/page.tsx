'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Activity, Database, Server, RefreshCw, Cpu, HardDrive, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'

interface ChartData {
  time: string
  cpu: number
  ram: number
}

export default function DiagnosticPage() {
  const [dbLatency, setDbLatency] = useState<number | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cpuUsage, setCpuUsage] = useState(34)
  const [ramUsage, setRamUsage] = useState(42) // in percentage
  
  // Historique simulé des dernières 60 minutes
  const [history, setHistory] = useState<ChartData[]>([])

  useEffect(() => {
    generateInitialHistory()
    runDiagnostics()
  }, [])

  function generateInitialHistory() {
    const data: ChartData[] = []
    let currentCpu = 30
    let currentRam = 40
    for (let i = 20; i >= 0; i--) {
      data.push({
        time: dayjs().subtract(i * 3, 'minute').format('HH:mm'),
        cpu: currentCpu + Math.floor(Math.random() * 15 - 5),
        ram: currentRam + Math.floor(Math.random() * 8 - 4)
      })
    }
    setHistory(data)
  }

  async function runDiagnostics() {
    setIsScanning(true)
    
    // Simule la variation du CPU/RAM
    setCpuUsage(25 + Math.floor(Math.random() * 20))
    setRamUsage(40 + Math.floor(Math.random() * 10))

    // Ping réel Supabase pour la latence DB
    const start = performance.now()
    try {
      await supabase.from('tenants').select('id').limit(1)
      const end = performance.now()
      setDbLatency(Math.round(end - start))
    } catch (e) {
      setDbLatency(-1)
    }

    setTimeout(() => {
      setIsScanning(false)
    }, 600)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" /> Centre de Diagnostic
          </h1>
          <p className="text-slate-500 text-sm mt-1">Supervision de l'état de santé du cluster hébergeant le SAAS SILI.</p>
        </div>
        <button 
          onClick={runDiagnostics}
          disabled={isScanning}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Génération...' : 'Actualiser Rapport'}
        </button>
      </div>

      {/* Cartes Principales (4 KPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Statut Global */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Server className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Cluster SILI</p>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">En Ligne</h3>
            <p className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              Toutes les zones sont opérationnelles
            </p>
          </div>
        </div>

        {/* Base de Données */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Database className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">PostgreSQL DB</p>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-slate-800">{dbLatency !== null ? dbLatency : '--'}</h3>
              <span className="text-sm font-bold text-slate-400">ms</span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">Temps de réponse (Ping)</p>
          </div>
        </div>

        {/* CPU */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <Cpu className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Vercel Edge CPU</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-2xl font-black text-slate-800">{isScanning ? '--' : cpuUsage}<span className="text-lg text-slate-400">%</span></h3>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all duration-1000 ${cpuUsage > 80 ? 'bg-red-500' : cpuUsage > 50 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${isScanning ? 0 : cpuUsage}%` }}></div>
            </div>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
            <HardDrive className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <HardDrive className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Mémoire (RAM)</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-2xl font-black text-slate-800">{isScanning ? '--' : ((ramUsage / 100) * 8).toFixed(1)} <span className="text-sm font-bold text-slate-400">/ 8.0 GB</span></h3>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${isScanning ? 0 : ramUsage}%` }}></div>
            </div>
          </div>
        </div>

      </div>

      {/* Graphique et Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graphique Historique (Recharts) */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <h3 className="font-bold text-slate-800">Évolution de la charge matérielle (60 min)</h3>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" name="CPU (%)" />
                  <Area type="monotone" dataKey="ram" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRam)" name="RAM (%)" />
                </AreaChart>
              </ResponsiveContainer>
            {/* Légende */}
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm font-medium text-slate-600">Charge CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm font-medium text-slate-600">Usage RAM</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statuts des Micro-Services */}
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <h3 className="font-bold text-slate-800">Contrôle des Micro-Services</h3>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y divide-slate-100 h-full">
              
              {/* Service 1 */}
              <div className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Database className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">Supabase BDD</p>
                    <p className="text-xs text-slate-500">PostgreSQL (Relational)</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Ligne</span>
              </div>

              {/* Service 2 */}
              <div className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">GoTrue Auth</p>
                    <p className="text-xs text-slate-500">JWT & OAuth</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Ligne</span>
              </div>

              {/* Service 3 */}
              <div className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <HardDrive className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">Stockage S3</p>
                    <p className="text-xs text-slate-500">Supabase Storage</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Ligne</span>
              </div>

              {/* Service 4 */}
              <div className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Zap className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">Edge Functions</p>
                    <p className="text-xs text-slate-500">Deno Serverless</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Veille</span>
              </div>

            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  )
}
