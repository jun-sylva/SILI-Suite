'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Search, MoreHorizontal, ShieldCheck, Info, Ban, Trash2, X,
  Settings2, Database, Briefcase, FileCode2, Save, Key, Loader2, Server,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Tenant {
  id: string; name: string; slug: string; status: string | null
  max_societes: number; max_licences: number; max_storage_gb: number; created_at: string | null
}
interface SysModule { id: string; key: string; name: string; description: string | null; is_active: boolean | null }

export default function TenantsManagementPage() {
  const t = useTranslations('tenants')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState<Tenant | null>(null)
  const [settingsModal, setSettingsModal] = useState<Tenant | null>(null)
  const [activeTab, setActiveTab] = useState<'permissions' | 'reglages'>('permissions')
  const [sysModules, setSysModules] = useState<SysModule[]>([])
  const [tenantModules, setTenantModules] = useState<Record<string, boolean>>({})
  const [editSocietes, setEditSocietes] = useState(1)
  const [editLicences, setEditLicences] = useState(1)
  const [currentSocietesCount, setCurrentSocietesCount] = useState(0)
  const [editStorage, setEditStorage] = useState(0.1)
  const [savingQuotas, setSavingQuotas] = useState(false)
  const accessTokenRef = useRef<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Chargement initial ───────────────────────────────────────────────────
  useEffect(() => {
    fetchTenants()
    // Stocker le token une seule fois pour éviter les conflits de lock auth
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null
    })
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchTenants() {
    setLoading(true)
    const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    if (error) { toast.error('Erreur SQL') } else { setTenants(data || []) }
    setLoading(false)
  }

  // ── Helper : audit + notifications via API service role ─────────────────

  async function auditAndNotify(
    action: string,
    level: 'info' | 'warning' | 'error',
    service: 'auth' | 'system' | 'database' | 'network',
    message: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
    notification: { titre: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; data?: Record<string, unknown> }
  ) {
    const token = accessTokenRef.current
    if (!token) {
      console.error('[auditAndNotify] pas de token en cache')
      return
    }
    const res = await fetch('/api/admin/audit-and-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, level, service, message, resourceType, resourceId, metadata, notification }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[auditAndNotify] error:', body.error ?? res.statusText)
    }
  }

  // ── Actions Tenant ────────────────────────────────────────────────────────

  async function toggleBlockStatus(tenant: Tenant) {
    const newStatus = tenant.status === 'bloqué' ? 'actif' : 'bloqué'
    const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id)
    if (!error) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t))
      toast.success(t('toast_block_success', { name: tenant.name, status: newStatus.toUpperCase() }))
      const isBlocking = newStatus === 'bloqué'
      await auditAndNotify(
        isBlocking ? 'tenant.blocked' : 'tenant.unblocked',
        isBlocking ? 'warning' : 'info',
        'database',
        `Tenant "${tenant.name}" ${isBlocking ? 'bloqué' : 'débloqué'}`,
        'tenant',
        tenant.id,
        { tenant_name: tenant.name, new_status: newStatus },
        {
          titre: isBlocking ? 'Tenant bloqué' : 'Tenant débloqué',
          message: `${tenant.name} a été ${isBlocking ? 'bloqué' : 'débloqué'} par un administrateur.`,
          type: isBlocking ? 'warning' : 'success',
          data: { tenant_id: tenant.id, tenant_name: tenant.name },
        }
      )
    } else {
      toast.error(t('toast_block_error'))
    }
    setDropdownOpen(null)
  }

  async function deleteTenant(tenantId: string) {
    const tenant = tenants.find(t => t.id === tenantId)
    if (!confirm(t('confirm_delete'))) return
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId)
    if (!error) {
      setTenants(prev => prev.filter(tn => tn.id !== tenantId))
      toast.success(t('toast_delete_success'))
      await auditAndNotify(
        'tenant.deleted',
        'error',
        'database',
        `Tenant "${tenant?.name}" supprimé définitivement`,
        'tenant',
        tenantId,
        { tenant_name: tenant?.name },
        {
          titre: 'Tenant supprimé',
          message: `Le tenant "${tenant?.name}" a été définitivement supprimé.`,
          type: 'error',
          data: { tenant_name: tenant?.name },
        }
      )
    } else {
      toast.error(t('toast_delete_error'))
    }
    setDropdownOpen(null)
  }

  async function openSettings(tenant: Tenant) {
    setSettingsModal(tenant); setActiveTab('permissions')
    setEditSocietes(tenant.max_societes ?? 1)
    setEditLicences(tenant.max_licences ?? 1)
    setEditStorage(tenant.max_storage_gb ?? 0.1)
    const { count } = await supabase
      .from('societes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
    setCurrentSocietesCount(count ?? 0)
    if (sysModules.length === 0) {
      const { data: sysData } = await supabase.from('sys_modules').select('id, key, name, description, is_active')
      if (sysData) setSysModules(sysData)
    }
    const { data: tModules } = await supabase
      .from('tenant_modules').select('module, is_active').eq('tenant_id', tenant.id)
    const map: Record<string, boolean> = {}
    tModules?.forEach(r => { map[r.module] = r.is_active ?? false })
    setTenantModules(map)
    setDropdownOpen(null)
  }

  async function saveSettings() {
    if (!settingsModal) return
    setSavingQuotas(true)
    const updates = { max_societes: editSocietes, max_licences: editLicences, max_storage_gb: editStorage }
    const { error } = await supabase.from('tenants').update(updates).eq('id', settingsModal.id)
    if (!error) {
      toast.success(t('toast_save_success'))
      setTenants(prev => prev.map(tn => tn.id === settingsModal.id ? { ...tn, ...updates } : tn))
      await auditAndNotify(
        'tenant.quotas_updated',
        'info',
        'database',
        `Quotas mis à jour pour "${settingsModal.name}" — ${editSocietes} soc. / ${editLicences} lic. / ${editStorage} GB`,
        'tenant',
        settingsModal.id,
        { tenant_name: settingsModal.name, ...updates },
        {
          titre: 'Quotas modifiés',
          message: `Les quotas du tenant "${settingsModal.name}" ont été mis à jour : ${editSocietes} sociétés, ${editLicences} licences, ${editStorage} GB.`,
          type: 'info',
          data: { tenant_id: settingsModal.id, tenant_name: settingsModal.name, ...updates },
        }
      )
      setSettingsModal(null)
    } else {
      toast.error(t('toast_save_error'))
    }
    setSavingQuotas(false)
  }

  async function toggleTenantModule(moduleKey: string) {
    if (!settingsModal) return
    const currentStatus = tenantModules[moduleKey] ?? false
    const newStatus = !currentStatus
    setTenantModules(prev => ({ ...prev, [moduleKey]: newStatus }))
    const { error } = await supabase
      .from('tenant_modules')
      .upsert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { tenant_id: settingsModal.id, module: moduleKey as any, is_active: newStatus, activated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,module' }
      )
    if (error) {
      toast.error(t('toast_module_error'))
      setTenantModules(prev => ({ ...prev, [moduleKey]: currentStatus }))
      return
    }
    const modName = sysModules.find(m => m.key === moduleKey)?.name ?? moduleKey
    await auditAndNotify(
      newStatus ? 'tenant.module_enabled' : 'tenant.module_disabled',
      newStatus ? 'info' : 'warning',
      'system',
      `Module "${modName}" ${newStatus ? 'activé' : 'désactivé'} pour "${settingsModal.name}"`,
      'module',
      moduleKey,
      { tenant_id: settingsModal.id, tenant_name: settingsModal.name, module: moduleKey, module_name: modName },
      {
        titre: newStatus ? 'Module activé' : 'Module désactivé',
        message: `Le module "${modName}" a été ${newStatus ? 'activé' : 'désactivé'} pour "${settingsModal.name}".`,
        type: newStatus ? 'success' : 'warning',
        data: { tenant_id: settingsModal.id, module_key: moduleKey },
      }
    )
  }

  const filtered = tenants.filter(tn =>
    tn.name?.toLowerCase().includes(search.toLowerCase()) ||
    tn.slug?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <Database className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 w-full max-w-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400 text-slate-700 font-medium"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p>{t('loading')}</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">{t('col_name')}</th>
                    <th className="px-6 py-4">{t('col_status')}</th>
                    <th className="px-6 py-4">{t('col_created')}</th>
                    <th className="px-6 py-4 text-center">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-500 bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <Database className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-600">{t('empty_title')}</p>
                          <p className="text-xs mt-1">{t('empty_subtitle')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(tn => (
                    <tr key={tn.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{tn.name || 'Unknown'}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">/{tn.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tn.status === 'bloqué' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {tn.status === 'bloqué' ? t('status_blocked') : t('status_active')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{dayjs(tn.created_at).format('DD MMM YYYY, HH:mm')}</td>
                      <td className="px-6 py-4 text-center relative">
                        <button
                          onClick={() => setDropdownOpen(dropdownOpen === tn.id ? null : tn.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                        {dropdownOpen === tn.id && (
                          <div ref={dropdownRef} className="absolute right-12 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95">
                            <div className="py-1">
                              <button onClick={() => { setDetailModal(tn); setDropdownOpen(null) }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                <Info className="h-4 w-4" /> {t('action_details')}
                              </button>
                              <button onClick={() => openSettings(tn)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100">
                                <Settings2 className="h-4 w-4" /> {t('action_settings')}
                              </button>
                              <button onClick={() => toggleBlockStatus(tn)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50">
                                <Ban className="h-4 w-4" /> {tn.status === 'bloqué' ? t('action_unblock') : t('action_block')}
                              </button>
                              <button onClick={() => deleteTenant(tn.id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">
                                <Trash2 className="h-4 w-4" /> {t('action_delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL: Détails */}
      {detailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
            <button onClick={() => setDetailModal(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div className="p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 mb-6 mx-auto">
                <Briefcase className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-6">{detailModal.name}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <FileCode2 className="h-5 w-5 text-indigo-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">{t('detail_slug')}</p><p className="font-medium text-sm">{detailModal.slug}</p></div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">{t('detail_status')}</p><p className="font-medium text-sm capitalize">{detailModal.status}</p></div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Server className="h-5 w-5 text-purple-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">{t('detail_created')}</p><p className="font-medium text-sm">{dayjs(detailModal.created_at).format('DD MMMM YYYY - HH:mm')}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Paramètres */}
      {settingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Settings2 className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{t('settings_modal_title')}</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-0.5">{settingsModal.name}</p>
                </div>
              </div>
              <button onClick={() => setSettingsModal(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-slate-200 p-2 bg-slate-50">
              <button onClick={() => setActiveTab('permissions')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'permissions' ? 'bg-white shadow border border-slate-200 text-indigo-600' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                {t('tab_permissions')}
              </button>
              <button onClick={() => setActiveTab('reglages')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'reglages' ? 'bg-white shadow border border-slate-200 text-indigo-600' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                {t('tab_quotas')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeTab === 'permissions' ? (
                <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 p-4 rounded-xl text-sm flex gap-3">
                    <Info className="h-5 w-5 shrink-0" /><p>{t('permissions_info')}</p>
                  </div>
                  {sysModules.length === 0 ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {sysModules.map(mod => {
                        const isOn = !!tenantModules[mod.key]
                        const isGlobalOff = !mod.is_active
                        return (
                          <div
                            key={mod.key}
                            className={`flex items-center justify-between p-4 rounded-xl border bg-white shadow-sm transition-all ${isGlobalOff ? 'opacity-50 border-red-200' : 'border-slate-200 hover:border-indigo-300'}`}
                          >
                            <div className="mr-3">
                              <p className="font-bold text-sm text-slate-800">{mod.name}</p>
                              {isGlobalOff && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{t('module_global_off')}</p>}
                            </div>
                            <button
                              onClick={() => toggleTenantModule(mod.key)}
                              disabled={isGlobalOff}
                              className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${isOn ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto">
                    {[
                      { icon: Briefcase, color: 'indigo', titleKey: 'quota_societes_title', descKey: 'quota_societes_desc', value: editSocietes, onChange: (v: number) => setEditSocietes(Math.max(currentSocietesCount, v)), step: 1, min: Math.max(1, currentSocietesCount) },
                      { icon: Key,      color: 'emerald', titleKey: 'quota_licences_title', descKey: 'quota_licences_desc', value: editLicences, onChange: setEditLicences, step: 1, min: 1 },
                      { icon: Server,   color: 'blue',    titleKey: 'quota_storage_title',  descKey: 'quota_storage_desc',  value: editStorage,  onChange: setEditStorage,  step: 0.1, min: 0.1 },
                    ].map(({ icon: Icon, color, titleKey, descKey, value, onChange, step, min }) => (
                      <div key={titleKey} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 bg-${color}-50 text-${color}-600 rounded-lg flex items-center justify-center shrink-0`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{t(titleKey as any)}</p>
                            <p className="text-xs text-slate-500">{t(descKey as any)}</p>
                          </div>
                        </div>
                        <input
                          type="number" min={min} step={step} value={value}
                          onChange={(e) => onChange(Number(e.target.value))}
                          className="w-24 border border-slate-200 rounded-lg h-10 px-3 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-4 max-w-xl mx-auto">
                    <button
                      onClick={saveSettings}
                      disabled={savingQuotas}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-colors disabled:opacity-60"
                    >
                      {savingQuotas ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                      {t('save_quotas')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
