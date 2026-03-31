'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Settings, Loader2, ShoppingCart, PackageSearch, Package, Users,
  CircleDollarSign, MessageSquare, FileText, PhoneCall, Share2,
  AlertCircle, CheckCircle2, Layers, GitBranch, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { writeLog } from '@/lib/audit'

// ── Icônes par module ──────────────────────────────────────────────────────
const MODULE_ICONS: Record<string, React.ElementType> = {
  vente:        ShoppingCart,
  achat:        PackageSearch,
  stock:        Package,
  rh:           Users,
  crm:          PhoneCall,
  comptabilite: CircleDollarSign,
  teams:        MessageSquare,
  rapports:     FileText,
  workflow:     GitBranch,
  planning:     CalendarDays,
}

interface OtherSociete {
  id: string
  raison_sociale: string
}

export default function SocieteSettingsPage() {
  const t    = useTranslations('societe_settings')
  const tNav = useTranslations('navigation')
  const router = useRouter()
  const params = useParams()
  const societeId = params.societe_id as string

  const [loading, setLoading]     = useState(true)
  const [isAdmin, setIsAdmin]     = useState(false)
  const [activeTab, setActiveTab] = useState<'modules' | 'sharing'>('modules')
  const [currentUserId, setCurrentUserId] = useState('')
  const [fullTenantId, setFullTenantId]   = useState('')

  // Modules
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [societeModules, setSocieteModules]     = useState<Set<string>>(new Set())

  // Partage
  const [otherSocietes, setOtherSocietes]               = useState<OtherSociete[]>([])
  const [otherSocieteModules, setOtherSocieteModules]   = useState<Record<string, Set<string>>>({})
  const [sharingMap, setSharingMap]                     = useState<Record<string, Set<string>>>({})

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) { router.push('/login'); return }

    const admin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
    setIsAdmin(admin)
    setCurrentUserId(session.user.id)
    const tenantId = profile.tenant_id
    setFullTenantId(tenantId ?? '')

    await Promise.all([
      fetchModules(tenantId ?? ''),
      fetchSharing(tenantId ?? ''),
    ])
    setLoading(false)
  }

  async function fetchModules(tenantId: string) {
    const [tenantModsRes, societeModsRes] = await Promise.all([
      supabase.from('tenant_modules').select('module').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('societe_modules').select('module').eq('societe_id', societeId).eq('is_active', true),
    ])
    setAvailableModules(tenantModsRes.data?.map(r => r.module) ?? [])
    setSocieteModules(new Set(societeModsRes.data?.map(r => r.module) ?? []))
  }

  async function fetchSharing(tenantId: string) {
    const [otherSocRes, allModsRes, sharingRes] = await Promise.all([
      supabase.from('societes').select('id, raison_sociale').eq('tenant_id', tenantId).eq('is_active', true).neq('id', societeId),
      supabase.from('societe_modules').select('societe_id, module').eq('is_active', true),
      supabase.from('societe_data_sharing').select('target_societe_id, module').eq('source_societe_id', societeId).eq('is_active', true),
    ])

    setOtherSocietes(otherSocRes.data ?? [])

    const modsMap: Record<string, Set<string>> = {}
    allModsRes.data?.forEach(r => {
      if (!modsMap[r.societe_id]) modsMap[r.societe_id] = new Set()
      modsMap[r.societe_id].add(r.module)
    })
    setOtherSocieteModules(modsMap)

    const sharing: Record<string, Set<string>> = {}
    sharingRes.data?.forEach(r => {
      if (!sharing[r.target_societe_id]) sharing[r.target_societe_id] = new Set()
      sharing[r.target_societe_id].add(r.module)
    })
    setSharingMap(sharing)
  }

  async function toggleModule(moduleKey: string) {
    if (!isAdmin) return
    const wasActive = societeModules.has(moduleKey)
    const newActive = !wasActive

    setSocieteModules(prev => {
      const next = new Set(prev)
      newActive ? next.add(moduleKey) : next.delete(moduleKey)
      return next
    })

    const { error } = await supabase
      .from('societe_modules')
      .upsert(
        { societe_id: societeId, module: moduleKey, is_active: newActive, activated_at: new Date().toISOString() },
        { onConflict: 'societe_id,module' }
      )

    if (error) {
      toast.error(t('toast_module_error'))
      setSocieteModules(prev => {
        const next = new Set(prev)
        wasActive ? next.add(moduleKey) : next.delete(moduleKey)
        return next
      })
    } else {
      const action = newActive ? 'module_activated' : 'module_deactivated'
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action, resourceType: 'societe_modules', resourceId: societeId, metadata: { module: moduleKey } })
    }
  }

  async function toggleSharing(targetId: string, moduleKey: string) {
    if (!isAdmin) return
    const wasActive = sharingMap[targetId]?.has(moduleKey) ?? false
    const newActive = !wasActive

    setSharingMap(prev => {
      const next = { ...prev, [targetId]: new Set(prev[targetId] ?? []) }
      newActive ? next[targetId].add(moduleKey) : next[targetId].delete(moduleKey)
      return next
    })

    const { error } = await supabase
      .from('societe_data_sharing')
      .upsert(
        { source_societe_id: societeId, target_societe_id: targetId, module: moduleKey, is_active: newActive },
        { onConflict: 'source_societe_id,target_societe_id,module' }
      )

    if (error) {
      toast.error(t('toast_sharing_error'))
      setSharingMap(prev => {
        const next = { ...prev, [targetId]: new Set(prev[targetId] ?? []) }
        wasActive ? next[targetId].add(moduleKey) : next[targetId].delete(moduleKey)
        return next
      })
    } else {
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'data_sharing_configured', resourceType: 'societe_data_sharing', resourceId: societeId, metadata: { module: moduleKey, target_societe_id: targetId, is_active: newActive } })
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <Settings className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Read-only notice */}
      {!isAdmin && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('read_only_notice')}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['modules', 'sharing'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'modules'
              ? <span className="flex items-center gap-2"><Layers className="h-4 w-4" />{t('tab_modules')}</span>
              : <span className="flex items-center gap-2"><Share2 className="h-4 w-4" />{t('tab_sharing')}</span>
            }
          </button>
        ))}
      </div>

      {/* ── Onglet Modules ─────────────────────────────────────────────────── */}
      {activeTab === 'modules' && (
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('modules_title')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">{t('modules_subtitle')}</CardDescription>
              </div>
              <span className="ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {t('modules_active_count', { count: societeModules.size })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {availableModules.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">{t('modules_empty')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableModules.map(moduleKey => {
                  const Icon = MODULE_ICONS[moduleKey] ?? Layers
                  const active = societeModules.has(moduleKey)
                  return (
                    <button
                      key={moduleKey}
                      onClick={() => toggleModule(moduleKey)}
                      disabled={!isAdmin}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        active
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                      } ${!isAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className={`p-2 rounded-lg ${active ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                        <Icon className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm capitalize">{tNav(moduleKey)}</p>
                      </div>
                      <div className={`h-5 w-10 rounded-full flex items-center transition-all ${active ? 'bg-indigo-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                        <div className="h-4 w-4 bg-white rounded-full mx-0.5 shadow-sm" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Onglet Partage ─────────────────────────────────────────────────── */}
      {activeTab === 'sharing' && (
        <div className="space-y-4">
          {/* Info directionnelle */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t('sharing_direction_note')}</span>
          </div>

          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">{t('sharing_title')}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{t('sharing_subtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {otherSocietes.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">{t('sharing_empty')}</p>
              ) : (
                <div className="space-y-4">
                  {otherSocietes.map(other => {
                    // Modules communs : actifs dans CETTE société ET dans l'autre
                    const commonModules = availableModules.filter(m =>
                      societeModules.has(m) && (otherSocieteModules[other.id]?.has(m) ?? false)
                    )

                    return (
                      <div key={other.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Entête société cible */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600">
                              {other.raison_sociale.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800 text-sm">{other.raison_sociale}</p>
                          {commonModules.length > 0 && sharingMap[other.id]?.size > 0 && (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />{t('sharing_active_label')}
                            </span>
                          )}
                        </div>

                        {/* Modules communs */}
                        <div className="p-4">
                          {commonModules.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">{t('sharing_no_common_modules')}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {commonModules.map(moduleKey => {
                                const Icon = MODULE_ICONS[moduleKey] ?? Layers
                                const shared = sharingMap[other.id]?.has(moduleKey) ?? false
                                return (
                                  <button
                                    key={moduleKey}
                                    onClick={() => toggleSharing(other.id, moduleKey)}
                                    disabled={!isAdmin}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                      shared
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                    } ${!isAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tNav(moduleKey)}
                                    <div className={`h-3.5 w-7 rounded-full flex items-center ml-1 transition-all ${shared ? 'bg-emerald-400 justify-end' : 'bg-slate-300 justify-start'}`}>
                                      <div className="h-2.5 w-2.5 bg-white rounded-full mx-0.5 shadow-sm" />
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
