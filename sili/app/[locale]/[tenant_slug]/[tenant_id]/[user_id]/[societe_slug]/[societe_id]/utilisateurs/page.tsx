'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  UserCog, Loader2, ShoppingCart, PackageSearch, Package, Users,
  CircleDollarSign, MessageSquare, FileText, PhoneCall, Layers, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'

interface AssignedUser {
  user_id: string
  full_name: string | null
  email: string | null
}

// userId → moduleKey → PermissionLevel
type PermMap = Record<string, Record<string, PermissionLevel>>

// ── Constantes ─────────────────────────────────────────────────────────────

const PERMISSION_LEVELS: PermissionLevel[] = ['aucun', 'lecteur', 'contributeur', 'gestionnaire', 'admin']

const PERM_STYLES: Record<PermissionLevel, string> = {
  aucun:        'bg-slate-100 text-slate-500',
  lecteur:      'bg-blue-100 text-blue-700',
  contributeur: 'bg-emerald-100 text-emerald-700',
  gestionnaire: 'bg-amber-100 text-amber-700',
  admin:        'bg-purple-100 text-purple-700',
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  vente:        ShoppingCart,
  achat:        PackageSearch,
  stock:        Package,
  rh:           Users,
  crm:          PhoneCall,
  comptabilite: CircleDollarSign,
  teams:        MessageSquare,
  rapports:     FileText,
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SocieteUsersPage() {
  const t    = useTranslations('societe_users')
  const tNav = useTranslations('navigation')
  const router = useRouter()
  const params = useParams()
  const societeId = params.societe_id as string

  const [loading, setLoading]           = useState(true)
  const [fullTenantId, setFullTenantId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [users, setUsers]               = useState<AssignedUser[]>([])
  const [perms, setPerms]               = useState<PermMap>({})
  const [resetting, setResetting]       = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()

    if (!profile || (profile.role !== 'tenant_admin' && profile.role !== 'super_admin')) {
      router.push('/login'); return
    }

    setFullTenantId(profile.tenant_id)
    setCurrentUserId(session.user.id)

    await Promise.all([
      fetchModules(),
      fetchUsers(profile.tenant_id),
    ])
    setLoading(false)
  }

  async function fetchModules() {
    const { data } = await supabase
      .from('societe_modules')
      .select('module')
      .eq('societe_id', societeId)
      .eq('is_active', true)
    setActiveModules(data?.map(r => r.module) ?? [])
  }

  async function fetchUsers(tenantId: string) {
    // Utilisateurs assignés à cette société (tenant_user uniquement)
    const { data: assignments } = await supabase
      .from('user_societes')
      .select('user_id, profiles!inner(full_name, tenant_id, role)')
      .eq('societe_id', societeId)
      .eq('is_active', true)

    const filtered: AssignedUser[] = (assignments ?? [])
      .filter((a: any) => a.profiles?.role === 'tenant_user' && a.profiles?.tenant_id === tenantId)
      .map((a: any) => ({
        user_id:   a.user_id,
        full_name: a.profiles?.full_name ?? null,
        email:     null,
      }))

    setUsers(filtered)

    if (filtered.length === 0) return

    // Permissions existantes pour ces utilisateurs sur cette société
    const userIds = filtered.map(u => u.user_id)
    const { data: existingPerms } = await supabase
      .from('user_module_permissions')
      .select('user_id, module, permission')
      .eq('societe_id', societeId)
      .in('user_id', userIds)

    const map: PermMap = {}
    filtered.forEach(u => { map[u.user_id] = {} })
    existingPerms?.forEach(r => {
      if (map[r.user_id]) map[r.user_id][r.module] = r.permission as PermissionLevel
    })
    setPerms(map)
  }

  async function setPermission(userId: string, moduleKey: string, level: PermissionLevel) {
    // Optimistic update
    setPerms(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [moduleKey]: level },
    }))

    const { error } = await supabase
      .from('user_module_permissions')
      .upsert(
        {
          user_id:    userId,
          tenant_id:  fullTenantId,
          societe_id: societeId,
          module:     moduleKey,
          permission: level,
          granted_by: currentUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,societe_id,module' }
      )

    if (error) {
      toast.error(t('toast_update_error'))
      // Rollback
      setPerms(prev => ({
        ...prev,
        [userId]: { ...prev[userId], [moduleKey]: prev[userId]?.[moduleKey] ?? 'aucun' },
      }))
    }
  }

  async function resetUser(userId: string) {
    setResetting(userId)
    const rows = activeModules.map(m => ({
      user_id:    userId,
      tenant_id:  fullTenantId,
      societe_id: societeId,
      module:     m,
      permission: 'aucun' as PermissionLevel,
      granted_by: currentUserId,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('user_module_permissions')
      .upsert(rows, { onConflict: 'user_id,societe_id,module' })

    if (error) {
      toast.error(t('toast_reset_error'))
    } else {
      toast.success(t('toast_reset_success'))
      setPerms(prev => {
        const reset: Record<string, PermissionLevel> = {}
        activeModules.forEach(m => { reset[m] = 'aucun' })
        return { ...prev, [userId]: reset }
      })
    }
    setResetting(null)
  }

  const getLevel = (userId: string, moduleKey: string): PermissionLevel =>
    perms[userId]?.[moduleKey] ?? 'aucun'

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <UserCog className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* État vide — aucun module */}
      {activeModules.length === 0 ? (
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="h-10 w-10 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">{t('empty_modules_title')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('empty_modules_subtitle')}</p>
          </CardContent>
        </Card>
      ) : users.length === 0 ? (
        /* État vide — aucun utilisateur */
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">{t('empty_title')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('empty_subtitle')}</p>
          </CardContent>
        </Card>
      ) : (
        /* Tableau croisé */
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('title')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  {users.length} utilisateur(s) · {activeModules.length} module(s)
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200">
                  {/* Colonne utilisateur — fixe */}
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px] sticky left-0 bg-slate-100/60 z-10">
                    {t('col_user')}
                  </th>
                  {/* Colonnes modules */}
                  {activeModules.map(moduleKey => {
                    const Icon = MODULE_ICONS[moduleKey] ?? Layers
                    return (
                      <th key={moduleKey} className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {tNav(moduleKey)}
                        </div>
                      </th>
                    )
                  })}
                  {/* Colonne actions */}
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[130px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map(user => (
                  <tr key={user.user_id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Cellule utilisateur */}
                    <td className="px-5 py-4 sticky left-0 bg-white hover:bg-slate-50/60 z-10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {(user.full_name ?? '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{user.full_name ?? '—'}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{user.user_id.substring(0, 8)}…</p>
                        </div>
                      </div>
                    </td>

                    {/* Cellules permissions */}
                    {activeModules.map(moduleKey => {
                      const level = getLevel(user.user_id, moduleKey)
                      return (
                        <td key={moduleKey} className="px-4 py-4 text-center">
                          <select
                            value={level}
                            onChange={e => setPermission(user.user_id, moduleKey, e.target.value as PermissionLevel)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 outline-none ring-1 ring-inset cursor-pointer transition-all appearance-none text-center ${PERM_STYLES[level]} ring-transparent focus:ring-2 focus:ring-indigo-400`}
                          >
                            {PERMISSION_LEVELS.map(lvl => (
                              <option key={lvl} value={lvl}>{t(`permission_${lvl}`)}</option>
                            ))}
                          </select>
                        </td>
                      )
                    })}

                    {/* Cellule action — tout désactiver */}
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => resetUser(user.user_id)}
                        disabled={resetting === user.user_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {resetting === user.user_id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <XCircle className="h-3.5 w-3.5" />
                        }
                        {t('btn_reset_user')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
