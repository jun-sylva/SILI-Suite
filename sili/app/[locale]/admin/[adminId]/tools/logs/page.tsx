'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { ScrollText, Search, Filter, ShieldAlert, AlertCircle, Info, FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import dayjs from 'dayjs'

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
  const t = useTranslations('logs')
  const [rawLogs, setRawLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<'All' | LogLevel>('All')
  const [serviceFilter, setServiceFilter] = useState<'All' | LogService>('All')

  async function fetchLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('master_audit_logs')
      .select('id, action, level, service, message, ip_address, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setRawLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const levelMap: Record<string, LogLevel> = { info: 'Info', warning: 'Warning', error: 'Error' }
  const serviceMap: Record<string, LogService> = { auth: 'Auth', system: 'System', database: 'Database', network: 'Network' }

  const logs: LogEvent[] = useMemo(() =>
    rawLogs.map(r => ({
      id: r.id,
      date: dayjs(r.created_at).format('DD/MM/YY HH:mm:ss'),
      level: levelMap[r.level] ?? 'Info',
      service: serviceMap[r.service] ?? 'System',
      message: r.message,
      actor: (r.profiles as any)?.full_name ?? 'Système',
      ip: r.ip_address ?? '—',
    }))
  , [rawLogs])

  const filteredLogs = useMemo(() => logs.filter(log => {
    const matchSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch &&
      (levelFilter === 'All' || log.level === levelFilter) &&
      (serviceFilter === 'All' || log.service === serviceFilter)
  }), [logs, searchQuery, levelFilter, serviceFilter])

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'Error':   return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><ShieldAlert className="h-3 w-3" /> {t('badge_error')}</span>
      case 'Warning': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><AlertCircle className="h-3 w-3" /> {t('badge_warning')}</span>
      case 'Info':    return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 w-max"><Info className="h-3 w-3" /> {t('badge_info')}</span>
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-indigo-600" /> {t('title')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <button
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-4 w-4" /> {t('export_btn')}
          </button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
                className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
              >
                <option value="All">{t('filter_severity')}</option>
                <option value="Info">{t('filter_severity_info')}</option>
                <option value="Warning">{t('filter_severity_warning')}</option>
                <option value="Error">{t('filter_severity_error')}</option>
              </select>
            </div>
            <div className="relative flex-1 lg:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
              >
                <option value="All">{t('filter_service')}</option>
                <option value="Auth">{t('filter_service_auth')}</option>
                <option value="Database">{t('filter_service_db')}</option>
                <option value="System">{t('filter_service_system')}</option>
                <option value="Network">{t('filter_service_network')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-bold">{t('col_timestamp')}</th>
                <th className="px-5 py-4 font-bold">{t('col_level')}</th>
                <th className="px-5 py-4 font-bold min-w-[250px]">{t('col_event')}</th>
                <th className="px-5 py-4 font-bold">{t('col_actor')}</th>
                <th className="px-5 py-4 font-bold text-right">{t('col_ip')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Loader2 className="h-7 w-7 mx-auto animate-spin text-indigo-400" />
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? filteredLogs.map((log) => (
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
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">[{log.service}]</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{log.actor}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-400">{log.ip}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500 bg-slate-50/50">
                    <ScrollText className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold">{t('empty_title')}</p>
                    <p className="text-xs mt-1">{t('empty_subtitle')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between text-xs text-slate-500 font-medium">
          <p>{t('footer_count', { visible: filteredLogs.length })}</p>
        </div>
      </Card>
    </div>
  )
}
