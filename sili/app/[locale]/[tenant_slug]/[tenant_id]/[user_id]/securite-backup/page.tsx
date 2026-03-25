'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  ShieldCheck, Database, ScrollText,
  Plus, Loader2, RefreshCw, User,
  CheckCircle2, Clock, XCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

interface Permission {
  user_id: string
  societe_id: string
  module: string
  permission: string
  profiles: { full_name: string | null } | null
  societes: { raison_sociale: string } | null
}

interface Backup {
  id: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  size_mb: number | null
  created_at: string
  expires_at: string | null
  completed_at: string | null
  triggered_by: string | null
  profiles: { full_name: string | null } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function permColor(level: string) {
  switch (level) {
    case 'admin':       return 'bg-red-100 text-red-700'
    case 'manager':     return 'bg-orange-100 text-orange-700'
    case 'contributor': return 'bg-blue-100 text-blue-700'
    case 'viewer':      return 'bg-slate-100 text-slate-600'
    default:            return 'bg-slate-50 text-slate-400'
  }
}

function BackupStatusBadge({ status, t }: { status: Backup['status']; t: ReturnType<typeof useTranslations> }) {
  const map: Record<Backup['status'], { icon: React.ElementType; color: string }> = {
    pending:     { icon: Clock,         color: 'text-amber-600 bg-amber-50 border-amber-200' },
    in_progress: { icon: Loader2,       color: 'text-blue-600 bg-blue-50 border-blue-200' },
    completed:   { icon: CheckCircle2,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    failed:      { icon: XCircle,       color: 'text-red-600 bg-red-50 border-red-200' },
  }
  const { icon: Icon, color } = map[status]
  const label = t(`backup_status_${status}` as any)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'audit' | 'permissions' | 'backups'

export default function SecuriteBackupPage() {
  const t = useTranslations('securite')
  const params = useParams()

  const [activeTab, setActiveTab] = useState<Tab>('audit')
  const [fullTenantId, setFullTenantId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Data states
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [backups, setBackups] = useState<Backup[]>([])

  const [loadingAudit, setLoadingAudit] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [triggeringBackup, setTriggeringBackup] = useState(false)

  // ── Fetch tenant_id ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setCurrentUserId(data.user.id)
      const { data: p } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', data.user.id)
        .single()
      if (p?.tenant_id) setFullTenantId(p.tenant_id)
    })
  }, [])

  // ── Fetch audit logs ─────────────────────────────────────────────────────
  const fetchAudit = useCallback(async (tenantId: string) => {
    setLoadingAudit(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, user_id, action, resource_type, resource_id, ip_address, created_at, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)
    setAuditLogs((data as AuditLog[]) || [])
    setLoadingAudit(false)
  }, [])

  // ── Fetch permissions ────────────────────────────────────────────────────
  const fetchPermissions = useCallback(async (tenantId: string) => {
    setLoadingPerms(true)
    const { data } = await supabase
      .from('user_module_permissions')
      .select(`
        user_id, societe_id, module, permission,
        profiles(full_name),
        societes(raison_sociale)
      `)
      .neq('permission', 'none')
      .order('module')
    // Filter by tenant (join via societes.tenant_id not directly possible — filter client-side)
    // We rely on RLS to scope data correctly
    setPermissions((data as Permission[]) || [])
    setLoadingPerms(false)
  }, [])

  // ── Fetch backups ────────────────────────────────────────────────────────
  const fetchBackups = useCallback(async (tenantId: string) => {
    setLoadingBackups(true)
    const { data } = await supabase
      .from('tenant_backups')
      .select('id, status, size_mb, created_at, expires_at, completed_at, triggered_by, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    setBackups((data as Backup[]) || [])
    setLoadingBackups(false)
  }, [])

  // ── Load data on tab change ──────────────────────────────────────────────
  useEffect(() => {
    if (!fullTenantId) return
    if (activeTab === 'audit')       fetchAudit(fullTenantId)
    if (activeTab === 'permissions') fetchPermissions(fullTenantId)
    if (activeTab === 'backups')     fetchBackups(fullTenantId)
  }, [activeTab, fullTenantId, fetchAudit, fetchPermissions, fetchBackups])

  // ── Trigger backup ───────────────────────────────────────────────────────
  async function handleTriggerBackup() {
    if (!fullTenantId || !currentUserId) return
    setTriggeringBackup(true)
    const { error } = await supabase.from('tenant_backups').insert({
      tenant_id: fullTenantId,
      triggered_by: currentUserId,
      status: 'pending',
    })
    if (error) {
      toast.error(t('backup_error'))
    } else {
      toast.success(t('backup_triggered'))
      fetchBackups(fullTenantId)
    }
    setTriggeringBackup(false)
  }

  // ─── Tab config ──────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'audit',       label: t('tab_audit'),       icon: ScrollText },
    { key: 'permissions', label: t('tab_permissions'), icon: ShieldCheck },
    { key: 'backups',     label: t('tab_backups'),     icon: Database },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('page_title')}</h2>
        <p className="text-sm text-slate-500 mt-1">{t('page_subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Journal d'activité ── */}
      {activeTab === 'audit' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-slate-800">{t('audit_title')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('audit_subtitle')}</p>
              </div>
              <button
                onClick={() => fullTenantId && fetchAudit(fullTenantId)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualiser
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingAudit ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
            ) : auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ScrollText className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">{t('audit_empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('audit_col_user')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('audit_col_action')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('audit_col_resource')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('audit_col_ip')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('audit_col_date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {log.profiles?.full_name?.[0]?.toUpperCase() ?? <User className="h-3 w-3" />}
                            </div>
                            <span className="font-medium text-slate-700 truncate max-w-[120px]">
                              {log.profiles?.full_name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">{log.action}</code>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                          {log.resource_type ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id.substring(0, 8)}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs font-mono">
                          {log.ip_address ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {dayjs(log.created_at).format('DD/MM/YY HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Permissions ── */}
      {activeTab === 'permissions' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <p className="font-semibold text-slate-800">{t('permissions_title')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('permissions_subtitle')}</p>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPerms ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
            ) : permissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ShieldCheck className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">{t('permissions_empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('permissions_col_user')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('permissions_col_societe')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('permissions_col_module')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('permissions_col_level')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {permissions.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {p.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="font-medium text-slate-700">{p.profiles?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">
                          {p.societes?.raison_sociale ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">{p.module}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${permColor(p.permission)}`}>
                            {t(`perm_${p.permission}` as any)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Sauvegardes ── */}
      {activeTab === 'backups' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-slate-800">{t('backups_title')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('backups_subtitle')}</p>
              </div>
              <button
                onClick={handleTriggerBackup}
                disabled={triggeringBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {triggeringBackup
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" />
                }
                {t('backups_btn_new')}
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingBackups ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Database className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">{t('backups_empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('backups_col_date')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('backups_col_status')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('backups_col_size')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('backups_col_by')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">{t('backups_col_expires')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {backups.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 text-xs whitespace-nowrap">
                          {dayjs(b.created_at).format('DD/MM/YY HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <BackupStatusBadge status={b.status} t={t} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                          {b.size_mb != null ? `${b.size_mb} MB` : '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {b.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="text-slate-600 text-xs">{b.profiles?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">
                          {b.expires_at ? dayjs(b.expires_at).format('DD/MM/YY') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
