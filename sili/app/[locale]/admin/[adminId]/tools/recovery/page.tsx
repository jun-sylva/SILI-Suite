'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DatabaseBackup, Download, AlertTriangle, ShieldAlert, History, KeyRound, Loader2 } from 'lucide-react'

interface Snapshot { id: string; date: string; size: string; type: 'auto' | 'manual'; status: 'done' }

export default function RecoveryPage() {
  const t = useTranslations('recovery')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [restoreCandidate, setRestoreCandidate] = useState<Snapshot | null>(null)
  const [confirmWord, setConfirmWord] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)

  const handleCreateSnapshot = () => {
    setIsCreating(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => { if (prev >= 100) { clearInterval(interval); return 100 } return Math.min(100, prev + Math.floor(Math.random() * 15)) })
    }, 500)
    setTimeout(() => {
      clearInterval(interval)
      const newSnap: Snapshot = {
        id: `#SNAP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-M${snapshots.length + 1}`,
        date: new Date().toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
        size: `${(Math.random() * 10 + 45).toFixed(1)} MB`, type: 'manual', status: 'done'
      }
      setSnapshots(prev => [newSnap, ...prev])
      setIsCreating(false)
      setProgress(0)
    }, 4000)
  }

  const executeRestore = () => {
    setIsRestoring(true)
    setTimeout(() => { setIsRestoring(false); setRestoreCandidate(null); setConfirmWord('') }, 3000)
  }

  // Confirm word matches either locale
  const CONFIRM_WORDS = ['RESTAURER', 'RESTORE']

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><DatabaseBackup className="h-6 w-6 text-indigo-600" /> {t('title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <div className="relative w-full md:w-auto">
          {isCreating ? (
            <div className="w-full md:w-64">
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>{t('creating_progress')}</span><span>{Math.min(100, progress)}%</span></div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${Math.min(100, progress)}%` }}></div></div>
            </div>
          ) : (
            <button onClick={handleCreateSnapshot} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95">
              <DatabaseBackup className="h-4 w-4" /> {t('create_btn')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm rounded-2xl">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="h-4 w-4 text-slate-500"/> {t('retention_title')}</h3></CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div><div><h4 className="text-sm font-bold text-slate-800">{t('retention_auto_title')}</h4><p className="text-xs text-slate-500 mt-1">{t('retention_auto_desc')}</p></div></div>
              <div className="flex gap-3"><div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div><div><h4 className="text-sm font-bold text-slate-800">{t('retention_manual_title')}</h4><p className="text-xs text-slate-500 mt-1">{t('retention_manual_desc')}</p></div></div>
              <div className="flex gap-3 bg-amber-50 p-3 rounded-xl border border-amber-100"><KeyRound className="h-5 w-5 text-amber-600 shrink-0" /><p className="text-xs font-medium text-amber-800">{t('retention_encryption')}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100 py-4 flex flex-row items-center justify-between">
            <h3 className="font-bold text-slate-800">{t('history_title')}</h3>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">{t('history_count', { count: snapshots.length })}</span>
          </CardHeader>
          {snapshots.length === 0 ? (
            <div className="p-12 text-center text-slate-500"><DatabaseBackup className="h-10 w-10 mx-auto text-slate-300 mb-3" /><p className="font-bold">Aucun snapshot créé.</p><p className="text-xs mt-1">Créez votre premier snapshot manuel pour l&apos;afficher ici.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 text-slate-500">
                  <tr><th className="px-5 py-3 font-medium">{t('col_id')}</th><th className="px-5 py-3 font-medium">{t('col_date')}</th><th className="px-5 py-3 font-medium">{t('col_type')}</th><th className="px-5 py-3 font-medium text-center">{t('col_size')}</th><th className="px-5 py-3 font-medium text-right">{t('col_actions')}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshots.map((snap) => (
                    <tr key={snap.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-700">{snap.id}</td>
                      <td className="px-5 py-4 text-slate-600">{snap.date}</td>
                      <td className="px-5 py-4"><span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-1 flex items-center gap-1.5 w-max rounded-md"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> {t('type_manual')}</span></td>
                      <td className="px-5 py-4 text-center font-medium text-slate-500">{snap.size}</td>
                      <td className="px-5 py-4 text-right space-x-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title={t('action_download')}><Download className="h-4 w-4" /></button>
                        <button onClick={() => setRestoreCandidate(snap)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('action_restore')}><ShieldAlert className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {restoreCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-red-600 p-6 text-white text-center"><AlertTriangle className="h-16 w-16 mx-auto mb-3 opacity-90 animate-bounce" /><h2 className="text-2xl font-black uppercase tracking-wide">{t('restore_modal_title')}</h2><p className="text-red-100 text-sm mt-2">{t('restore_modal_subtitle')}</p></div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800"><p><strong>{t('restore_modal_warning')}</strong></p><div className="mt-3 bg-white p-3 rounded-lg border border-red-200 font-mono text-xs">{restoreCandidate.id} — {restoreCandidate.date}</div></div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">{t('restore_modal_input_label')}</label>
                <input type="text" value={confirmWord} onChange={(e) => setConfirmWord(e.target.value.toUpperCase())} placeholder={t('restore_modal_input_placeholder')} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl uppercase font-black tracking-widest text-center focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button onClick={() => { setRestoreCandidate(null); setConfirmWord('') }} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl" disabled={isRestoring}>{t('restore_modal_cancel')}</button>
                <button onClick={executeRestore} disabled={!CONFIRM_WORDS.includes(confirmWord) || isRestoring} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 flex justify-center items-center gap-2">
                  {isRestoring ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('restore_modal_progress')}</> : t('restore_modal_confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
