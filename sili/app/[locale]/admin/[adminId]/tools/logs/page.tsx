'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { ScrollText, Search, Download, Filter, ShieldAlert, AlertCircle, Info, FileSpreadsheet } from 'lucide-react'

// --- Interfaces & Mock Data ---
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

const MOCK_LOGS: LogEvent[] = [
  { id: 'evt_9ax2', date: '2026-03-22 08:14:02', level: 'Error', service: 'Database', message: 'Échec de violation de contrainte NULL (table: tenants)', actor: 'system@sili.com', ip: '10.0.4.12' },
  { id: 'evt_9ax1', date: '2026-03-22 08:12:45', level: 'Warning', service: 'Auth', message: 'Multiples tentatives de connexion échouées (5)', actor: 'admin@acme.corp', ip: '192.168.1.45' },
  { id: 'evt_9ax0', date: '2026-03-22 08:10:10', level: 'Info', service: 'System', message: 'Génération du Snapshot Manuel réussie (#SNAP-2026)', actor: 'master@sili.com', ip: '192.168.1.71' },
  { id: 'evt_8by9', date: '2026-03-22 07:46:33', level: 'Error', service: 'Database', message: 'Exception RPC register_new_tenant (parameter mismatch)', actor: 'master@sili.com', ip: '192.168.1.71' },
  { id: 'evt_8by8', date: '2026-03-22 07:29:29', level: 'Info', service: 'System', message: 'Mise à jour des quotas Tenant ID: a1b2c3d4', actor: 'master@sili.com', ip: '192.168.1.71' },
  { id: 'evt_8by7', date: '2026-03-21 18:05:12', level: 'Info', service: 'Auth', message: 'Création de compte locataire "Tech Solutions"', actor: 'ceo@techsolutions.com', ip: '45.22.19.8' },
  { id: 'evt_8by6', date: '2026-03-21 17:33:00', level: 'Warning', service: 'Network', message: 'Latence excessive détectée sur la région eu-west-3 (>500ms)', actor: 'System Auto', ip: 'Local' },
  { id: 'evt_8by5', date: '2026-03-21 14:30:00', level: 'Info', service: 'System', message: 'Backup Automatique programmé terminé', actor: 'System Auto', ip: 'Local' },
]

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<'All' | LogLevel>('All')
  const [serviceFilter, setServiceFilter] = useState<'All' | LogService>('All')
  const [isExporting, setIsExporting] = useState(false)

  // --- Filtrage Croisé ---
  const filteredLogs = useMemo(() => {
    return MOCK_LOGS.filter(log => {
      const matchSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.actor.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchLevel = levelFilter === 'All' || log.level === levelFilter
      const matchService = serviceFilter === 'All' || log.service === serviceFilter
      
      return matchSearch && matchLevel && matchService
    })
  }, [searchQuery, levelFilter, serviceFilter])

  // --- Composants Visuels ---
  const getLevelBadge = (level: LogLevel) => {
    switch(level) {
      case 'Error':
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><ShieldAlert className="h-3 w-3" /> ERREUR</span>
      case 'Warning':
        return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><AlertCircle className="h-3 w-3" /> ALERTE</span>
      case 'Info':
        return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><Info className="h-3 w-3" /> INFO</span>
    }
  }

  const handleExport = () => {
    setIsExporting(true)
    setTimeout(() => {
      setIsExporting(false)
      alert(`Exportation CSV de ${filteredLogs.length} lignes réussie ! (Simulation)`)
    }, 1500)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-indigo-600" /> Journal d'Audit & Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Registre inaltérable de sécurité. Suivi des actions de tous les locataires et admins.</p>
        </div>
        
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isExporting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {isExporting ? 'Génération...' : 'Exporter CSV'}
        </button>
      </div>

      {/* Filtres & Recherche */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row gap-4">
          
          {/* Barre de Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par ID, description ou acteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-all shadow-sm"
            />
          </div>

          {/* Menus Déroulants (Filtres) */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-40">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select 
                value={levelFilter} 
                onChange={(e) => setLevelFilter(e.target.value as any)}
                className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
              >
                <option value="All">Gravité (Toutes)</option>
                <option value="Info">Info</option>
                <option value="Warning">Alerte</option>
                <option value="Error">Erreur Critique</option>
              </select>
            </div>
            
            <div className="relative flex-1 lg:w-40">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select 
                value={serviceFilter} 
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
              >
                <option value="All">Service (Tous)</option>
                <option value="Auth">Authentification</option>
                <option value="Database">Base de Données</option>
                <option value="System">Système (Core)</option>
                <option value="Network">Réseau</option>
              </select>
            </div>
          </div>
          
        </div>

        {/* Tableau d'Audit Ultra-Dense */}
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
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{log.date.split(' ')[0]}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{log.date.split(' ')[1]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col whitespace-normal min-w-[300px]">
                        <span className="font-bold text-slate-800 line-clamp-2">{log.message}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">[{log.service}] — {log.id}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{log.actor}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-400">
                      {log.ip}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500 bg-slate-50/50">
                    <Search className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold">Aucun événement ne correspond à vos filtres.</p>
                    <p className="text-xs">Essayez de modifier votre recherche ou de réinitialiser la gravité.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info pagination */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between text-xs text-slate-500 font-medium">
          <p>Affichage de {filteredLogs.length} registre(s) sur une base de 1 405 (Simulé)</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50">Précédent</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50">Suivant</button>
          </div>
        </div>

      </Card>
    </div>
  )
}

// Composant local pour le loader circulaire du bouton
function LoaderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
