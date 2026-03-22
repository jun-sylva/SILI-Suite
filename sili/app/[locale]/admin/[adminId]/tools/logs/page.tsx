'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { ScrollText, Search, Filter, ShieldAlert, AlertCircle, Info, FileSpreadsheet } from 'lucide-react'

type LogLevel = 'Info' | 'Warning' | 'Error'
type LogService = 'Auth' | 'System' | 'Database' | 'Network'

interface LogEvent {
  id: string
  date: string
  level: LogLevel
  service: LogService
  message: string
  actor: string
  ip: string
}

export default function LogsPage() {
  const [logs] = useState<LogEvent[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<'All' | LogLevel>('All')
  const [serviceFilter, setServiceFilter] = useState<'All' | LogService>('All')
  const [isExporting, setIsExporting] = useState(false)

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchLevel = levelFilter === 'All' || log.level === levelFilter
      const matchService = serviceFilter === 'All' || log.service === serviceFilter
      return matchSearch && matchLevel && matchService
    })
  }, [logs, searchQuery, levelFilter, serviceFilter])

  const getLevelBadge = (level: LogLevel) => {
    switch(level) {
      case 'Error': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><ShieldAlert className="h-3 w-3" /> ERREUR</span>
      case 'Warning': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><AlertCircle className="h-3 w-3" /> ALERTE</span>
      case 'Info': return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><Info className="h-3 w-3" /> INFO</span>
    }
  }

  const handleExport = () => {
    setIsExporting(true)
    setTimeout(() => setIsExporting(false), 1500)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-indigo-600" /> Journal d&apos;Audit & Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Registre inaltérable de sécurité. Suivi des actions de tous les locataires et admins.</p>
        </div>
        <button onClick={handleExport} disabled={isExporting || filteredLogs.length === 0} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting ? 'Génération...' : 'Exporter CSV'}
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Rechercher par ID, description ou acteur..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm" />
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as any)} className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer">
                <option value="All">Gravité (Toutes)</option>
                <option value="Info">Info</option>
                <option value="Warning">Alerte</option>
                <option value="Error">Erreur Critique</option>
              </select>
            </div>
            <div className="relative flex-1 lg:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value as any)} className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer">
                <option value="All">Service (Tous)</option>
                <option value="Auth">Authentification</option>
                <option value="Database">Base de Données</option>
                <option value="System">Système (Core)</option>
                <option value="Network">Réseau</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Horodatage (UTC)</th>
                <th className="px-5 py-4 font-bold">Niveau</th>
                <th className="px-5 py-4 font-bold min-w-[250px]">Événement / Description</th>
                <th className="px-5 py-4 font-bold">Acteur</th>
                <th className="px-5 py-4 font-bold text-right">Adresse IP / Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{log.date.split(' ')[0]}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{log.date.split(' ')[1]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getLevelBadge(log.level)}</td>
                    <td className="px-5 py-3.5 whitespace-normal min-w-[300px]">
                      <p className="font-bold text-slate-800">{log.message}</p>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">[{log.service}] — {log.id}</span>
                    </td>
                    <td className="px-5 py-3.5"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{log.actor}</span></td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-400">{log.ip}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500 bg-slate-50/50">
                    <ScrollText className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold">Aucun événement disponible.</p>
                    <p className="text-xs mt-1">Les logs d&apos;audit apparaîtront ici automatiquement.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between text-xs text-slate-500 font-medium">
          <p>Affichage de {filteredLogs.length} registre(s)</p>
          <div className="flex gap-2">
            <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50">Précédent</button>
            <button disabled className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50">Suivant</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
