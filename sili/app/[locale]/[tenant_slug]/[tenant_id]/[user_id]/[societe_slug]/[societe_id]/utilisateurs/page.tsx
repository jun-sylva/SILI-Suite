'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  UserCog, Loader2, ShoppingCart, PackageSearch, Package, Users,
  CircleDollarSign, MessageSquare, FileText, PhoneCall, Layers, XCircle, GitBranch,
  UsersRound, Plus, Pencil, Trash2, X, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'
type GroupType       = 'compte' | 'mixte'
type MemberRole      = 'membre' | 'manager'

interface AssignedUser {
  user_id: string
  full_name: string | null
  email: string | null
}

// userId → moduleKey → PermissionLevel
type PermMap = Record<string, Record<string, PermissionLevel>>

// groupId → moduleKey → PermissionLevel
type GroupPermMap = Record<string, Record<string, PermissionLevel>>

const PERM_RANK: Record<PermissionLevel, number> = {
  aucun: 0, lecteur: 1, contributeur: 2, gestionnaire: 3, admin: 4,
}

interface UserGroup {
  id: string
  nom: string
  description: string | null
  type: GroupType
  created_by: string
  created_at: string
  member_count?: number
}

interface GroupMember {
  id: string
  group_id: string
  user_id: string | null
  employe_id: string | null
  role: MemberRole
  display_name: string
}

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
  workflow:     GitBranch,
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SocieteUsersPage() {
  const t    = useTranslations('societe_users')
  const tNav = useTranslations('navigation')
  const router = useRouter()
  const params = useParams()
  const societeId = params.societe_id as string

  // ── auth / common state
  const [loading, setLoading]           = useState(true)
  const [fullTenantId, setFullTenantId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab]       = useState<'users' | 'groups'>('users')

  // ── users tab state
  const [activeModules, setActiveModules] = useState<string[]>([])
  const [users, setUsers]               = useState<AssignedUser[]>([])
  const [perms, setPerms]               = useState<PermMap>({})
  const [resetting, setResetting]       = useState<string | null>(null)

  // ── groups tab state
  const [groups, setGroups]             = useState<UserGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)

  // group create/edit modal
  const [showGroupModal, setShowGroupModal]   = useState(false)
  const [editingGroup, setEditingGroup]       = useState<UserGroup | null>(null)
  const [groupNom, setGroupNom]               = useState('')
  const [groupDesc, setGroupDesc]             = useState('')
  const [groupType, setGroupType]             = useState<GroupType>('compte')
  const [groupSaving, setGroupSaving]         = useState(false)

  // group delete modal
  const [deletingGroup, setDeletingGroup]     = useState<UserGroup | null>(null)

  // members modal
  const [membersGroup, setMembersGroup]       = useState<UserGroup | null>(null)
  const [members, setMembers]                 = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading]   = useState(false)
  const [availableUsers, setAvailableUsers]   = useState<AssignedUser[]>([])
  const [newMemberId, setNewMemberId]         = useState('')
  const [newMemberRole, setNewMemberRole]     = useState<MemberRole>('membre')
  const [addingMember, setAddingMember]       = useState(false)

  // group permissions modal
  const [permsGroup, setPermsGroup]           = useState<UserGroup | null>(null)
  const [groupPerms, setGroupPerms]           = useState<GroupPermMap>({})
  const [groupPermsLoading, setGroupPermsLoading] = useState(false)

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
      fetchGroups(profile.tenant_id),
    ])
    setLoading(false)
  }

  // ── Users tab helpers ───────────────────────────────────────────────────

  async function fetchModules() {
    const { data } = await supabase
      .from('societe_modules')
      .select('module')
      .eq('societe_id', societeId)
      .eq('is_active', true)
    setActiveModules(data?.map(r => r.module) ?? [])
  }

  async function fetchUsers(tenantId: string) {
    const { data: assignments, error: assignError } = await supabase
      .from('user_societes')
      .select('user_id')
      .eq('societe_id', societeId)
      .eq('is_active', true)

    if (assignError) console.error('[fetchUsers] user_societes:', assignError.message)
    if (!assignments || assignments.length === 0) { setUsers([]); return }

    const userIds = assignments.map((a: any) => a.user_id)

    const { data: profilesData, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, tenant_id, role')
      .in('id', userIds)
      .eq('role', 'tenant_user')
      .eq('tenant_id', tenantId)

    if (profError) console.error('[fetchUsers] profiles:', profError.message)

    const filtered: AssignedUser[] = (profilesData ?? []).map((p: any) => ({
      user_id:   p.id,
      full_name: p.full_name ?? null,
      email:     null,
    }))

    setUsers(filtered)

    if (filtered.length === 0) return

    // Perms individuelles
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

    // Perms héritées des groupes — merge (prend la plus haute)
    const { data: memberships } = await supabase
      .from('user_group_members')
      .select('user_id, group_id')
      .in('user_id', userIds)

    const groupIds = [...new Set((memberships ?? []).map((m: any) => m.group_id))]
    if (groupIds.length > 0) {
      const { data: gPerms } = await supabase
        .from('user_group_permissions')
        .select('group_id, module, permission')
        .in('group_id', groupIds)
        .eq('societe_id', societeId)

      memberships?.forEach((mb: any) => {
        if (!map[mb.user_id]) return
        gPerms?.forEach((gp: any) => {
          if (gp.group_id !== mb.group_id) return
          const cur  = PERM_RANK[map[mb.user_id][gp.module] ?? 'aucun']
          const from = PERM_RANK[gp.permission as PermissionLevel]
          if (from > cur) map[mb.user_id][gp.module] = gp.permission as PermissionLevel
        })
      })
    }

    setPerms(map)
  }

  async function setPermission(userId: string, moduleKey: string, level: PermissionLevel) {
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

  // ── Groups tab helpers ──────────────────────────────────────────────────

  async function fetchGroups(tenantId: string) {
    setGroupsLoading(true)
    const { data, error } = await supabase
      .from('user_groups')
      .select('id, nom, description, type, created_by, created_at')
      .eq('tenant_id', tenantId)
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[fetchGroups]', error.message); setGroupsLoading(false); return }

    // Count members per group
    const groupIds = (data ?? []).map((g: any) => g.id)
    let countMap: Record<string, number> = {}
    if (groupIds.length > 0) {
      const { data: membersData } = await supabase
        .from('user_group_members')
        .select('group_id')
        .in('group_id', groupIds)
      membersData?.forEach((m: any) => {
        countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
      })
    }

    setGroups((data ?? []).map((g: any) => ({ ...g, member_count: countMap[g.id] ?? 0 })))
    setGroupsLoading(false)
  }

  function openNewGroup() {
    setEditingGroup(null)
    setGroupNom('')
    setGroupDesc('')
    setGroupType('compte')
    setShowGroupModal(true)
  }

  function openEditGroup(g: UserGroup) {
    setEditingGroup(g)
    setGroupNom(g.nom)
    setGroupDesc(g.description ?? '')
    setGroupType(g.type)
    setShowGroupModal(true)
  }

  async function saveGroup() {
    if (!groupNom.trim()) return
    setGroupSaving(true)

    if (editingGroup) {
      const { error } = await supabase
        .from('user_groups')
        .update({ nom: groupNom.trim(), description: groupDesc.trim() || null, type: groupType, updated_at: new Date().toISOString() })
        .eq('id', editingGroup.id)

      if (error) { toast.error(t('toast_group_error')); setGroupSaving(false); return }
      toast.success(t('toast_group_updated'))
    } else {
      const { error } = await supabase
        .from('user_groups')
        .insert({
          tenant_id:  fullTenantId,
          societe_id: societeId,
          nom:        groupNom.trim(),
          description: groupDesc.trim() || null,
          type:       groupType,
          created_by: currentUserId,
        })

      if (error) { toast.error(t('toast_group_error')); setGroupSaving(false); return }
      toast.success(t('toast_group_created'))
    }

    setShowGroupModal(false)
    setGroupSaving(false)
    await fetchGroups(fullTenantId)
  }

  async function deleteGroup() {
    if (!deletingGroup) return
    const { error } = await supabase.from('user_groups').delete().eq('id', deletingGroup.id)
    if (error) { toast.error(t('toast_group_error')); return }
    toast.success(t('toast_group_deleted'))
    setDeletingGroup(null)
    await fetchGroups(fullTenantId)
  }

  // ── Group perms sync ────────────────────────────────────────────────────

  // Propage les permissions d'un groupe vers user_module_permissions d'un utilisateur
  // (prend la permission la plus haute entre individuelle et groupe)
  async function syncGroupPermsToUser(userId: string, groupId: string) {
    const [{ data: gPerms }, { data: userPerms }] = await Promise.all([
      supabase.from('user_group_permissions').select('module, permission').eq('group_id', groupId).eq('societe_id', societeId),
      supabase.from('user_module_permissions').select('module, permission').eq('user_id', userId).eq('societe_id', societeId),
    ])

    if (!gPerms || gPerms.length === 0) return

    const currentMap: Record<string, PermissionLevel> = {}
    userPerms?.forEach((p: any) => { currentMap[p.module] = p.permission as PermissionLevel })

    const toUpsert = gPerms
      .filter((gp: any) => PERM_RANK[gp.permission as PermissionLevel] > PERM_RANK[currentMap[gp.module] ?? 'aucun'])
      .map((gp: any) => ({
        user_id:    userId,
        tenant_id:  fullTenantId,
        societe_id: societeId,
        module:     gp.module,
        permission: gp.permission,
        granted_by: currentUserId,
        updated_at: new Date().toISOString(),
      }))

    if (toUpsert.length > 0) {
      await supabase.from('user_module_permissions').upsert(toUpsert, { onConflict: 'user_id,societe_id,module' })
    }
  }

  // ── Members helpers ─────────────────────────────────────────────────────

  async function openMembers(g: UserGroup) {
    setMembersGroup(g)
    setNewMemberId('')
    setNewMemberRole('membre')
    setMembersLoading(true)
    await Promise.all([loadMembers(g.id), loadAvailableUsers(g)])
    setMembersLoading(false)
  }

  async function loadMembers(groupId: string) {
    const { data, error } = await supabase
      .from('user_group_members')
      .select('id, group_id, user_id, employe_id, role')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error) { console.error('[loadMembers]', error.message); return }

    const enriched: GroupMember[] = []
    for (const m of (data ?? [])) {
      let display_name = '—'
      if (m.user_id) {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', m.user_id).single()
        display_name = p?.full_name ?? m.user_id.substring(0, 8)
      } else if (m.employe_id) {
        const { data: e } = await supabase.from('rh_employes').select('prenom, nom').eq('id', m.employe_id).single()
        display_name = e ? `${e.prenom} ${e.nom}` : m.employe_id.substring(0, 8)
      }
      enriched.push({ ...m, display_name })
    }
    setMembers(enriched)
  }

  async function loadAvailableUsers(g: UserGroup) {
    // Fetch users assigned to this société (same as users tab)
    const { data: assignments } = await supabase
      .from('user_societes')
      .select('user_id')
      .eq('societe_id', societeId)
      .eq('is_active', true)

    if (!assignments || assignments.length === 0) { setAvailableUsers([]); return }

    const userIds = assignments.map((a: any) => a.user_id)
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
      .eq('tenant_id', fullTenantId)

    setAvailableUsers((profilesData ?? []).map((p: any) => ({ user_id: p.id, full_name: p.full_name ?? null, email: null })))
  }

  async function addMember() {
    if (!membersGroup || !newMemberId) return
    setAddingMember(true)

    const { error } = await supabase.from('user_group_members').insert({
      group_id: membersGroup.id,
      user_id:  newMemberId,
      role:     newMemberRole,
    })

    if (error) { toast.error(t('toast_group_error')); setAddingMember(false); return }
    // Propager les permissions du groupe vers l'utilisateur
    await syncGroupPermsToUser(newMemberId, membersGroup.id)
    toast.success(t('toast_member_added'))
    setNewMemberId('')
    setNewMemberRole('membre')
    await loadMembers(membersGroup.id)
    setAddingMember(false)
    // Refresh member count + permissions affichées
    await Promise.all([fetchGroups(fullTenantId), fetchUsers(fullTenantId)])
  }

  async function removeMember(memberId: string) {
    if (!membersGroup) return
    const { error } = await supabase.from('user_group_members').delete().eq('id', memberId)
    if (error) { toast.error(t('toast_group_error')); return }
    toast.success(t('toast_member_removed'))
    setMembers(prev => prev.filter(m => m.id !== memberId))
    await fetchGroups(fullTenantId)
  }

  // ── Group Permissions helpers ───────────────────────────────────────────

  async function openGroupPerms(g: UserGroup) {
    setPermsGroup(g)
    setGroupPermsLoading(true)

    const { data } = await supabase
      .from('user_group_permissions')
      .select('module, permission')
      .eq('group_id', g.id)
      .eq('societe_id', societeId)

    const map: Record<string, PermissionLevel> = {}
    activeModules.forEach(m => { map[m] = 'aucun' })
    data?.forEach((r: any) => { map[r.module] = r.permission as PermissionLevel })
    setGroupPerms(prev => ({ ...prev, [g.id]: map }))
    setGroupPermsLoading(false)
  }

  async function setGroupPermission(groupId: string, moduleKey: string, level: PermissionLevel) {
    // Optimistic
    setGroupPerms(prev => ({
      ...prev,
      [groupId]: { ...prev[groupId], [moduleKey]: level },
    }))

    const { error } = await supabase
      .from('user_group_permissions')
      .upsert(
        {
          group_id:   groupId,
          tenant_id:  fullTenantId,
          societe_id: societeId,
          module:     moduleKey,
          permission: level,
          granted_by: currentUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,societe_id,module' }
      )

    if (error) {
      toast.error(t('toast_group_perm_error'))
      // Rollback
      setGroupPerms(prev => ({
        ...prev,
        [groupId]: { ...prev[groupId], [moduleKey]: prev[groupId]?.[moduleKey] ?? 'aucun' },
      }))
    } else {
      toast.success(t('toast_group_perm_updated'))
      // Propager la nouvelle perm à tous les membres du groupe
      const { data: mbrs } = await supabase
        .from('user_group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .not('user_id', 'is', null)
      if (mbrs && mbrs.length > 0) {
        await Promise.all(mbrs.map((m: any) => syncGroupPermsToUser(m.user_id, groupId)))
        await fetchUsers(fullTenantId)
      }
    }
  }

  const getGroupLevel = (groupId: string, moduleKey: string): PermissionLevel =>
    groupPerms[groupId]?.[moduleKey] ?? 'aucun'

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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'users'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          {t('tab_users')}
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'groups'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UsersRound className="h-4 w-4" />
          {t('tab_groups')}
        </button>
      </div>

      {/* ── Tab: Utilisateurs ───────────────────────────────────────── */}
      {activeTab === 'users' && (
        <>
          {activeModules.length === 0 ? (
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="h-10 w-10 text-slate-300 mb-3" />
                <p className="font-bold text-slate-600">{t('empty_modules_title')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('empty_modules_subtitle')}</p>
              </CardContent>
            </Card>
          ) : users.length === 0 ? (
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-slate-300 mb-3" />
                <p className="font-bold text-slate-600">{t('empty_title')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('empty_subtitle')}</p>
              </CardContent>
            </Card>
          ) : (
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
                      <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px] sticky left-0 bg-slate-100/60 z-10">
                        {t('col_user')}
                      </th>
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
                      <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[130px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {users.map(user => (
                      <tr key={user.user_id} className="hover:bg-slate-50/60 transition-colors">
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
        </>
      )}

      {/* ── Tab: Groupes ────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex justify-end">
            <button
              onClick={openNewGroup}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {t('btn_new_group')}
            </button>
          </div>

          {groupsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="ml-2 text-sm text-slate-500">{t('groups_loading')}</span>
            </div>
          ) : groups.length === 0 ? (
            <Card className="border-slate-200 shadow-sm rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <UsersRound className="h-10 w-10 text-slate-300 mb-3" />
                <p className="font-bold text-slate-600">{t('groups_empty_title')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('groups_empty_subtitle')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100/60 border-b border-slate-200">
                      <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_group_nom')}</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_group_type')}</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_group_members_count')}</th>
                      <th className="px-4 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_group_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {groups.map(g => (
                      <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                              <UsersRound className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{g.nom}</p>
                              {g.description && <p className="text-xs text-slate-400 truncate max-w-xs">{g.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            g.type === 'compte' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                          }`}>
                            {t(`group_type_${g.type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm font-semibold text-slate-700">{g.member_count ?? 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openMembers(g)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {t('btn_add_member')}
                            </button>
                            <button
                              onClick={() => openGroupPerms(g)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-violet-50 hover:text-violet-600 rounded-lg transition-colors"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Permissions
                            </button>
                            <button
                              onClick={() => openEditGroup(g)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingGroup(g)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Modal: Créer / Modifier groupe ─────────────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingGroup ? t('modal_edit_group_title') : t('modal_new_group_title')}
              </h2>
              <button onClick={() => setShowGroupModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('field_group_nom')}</label>
                <input
                  type="text"
                  value={groupNom}
                  onChange={e => setGroupNom(e.target.value)}
                  placeholder={t('field_group_nom_placeholder')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('field_group_description')}</label>
                <textarea
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  placeholder={t('field_group_description_placeholder')}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('field_group_type')}</label>
                <select
                  value={groupType}
                  onChange={e => setGroupType(e.target.value as GroupType)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="compte">{t('group_type_compte')}</option>
                  <option value="mixte">{t('group_type_mixte')}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupNom.trim() || groupSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {groupSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Supprimer groupe ─────────────────────────────────── */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('modal_delete_group_title')}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('confirm_delete_group_desc')}</p>
                <p className="text-sm font-semibold text-slate-700 mt-2">« {deletingGroup.nom} »</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingGroup(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={deleteGroup}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Permissions du groupe ───────────────────────────── */}
      {permsGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('modal_group_perms_title')}</h2>
                <p className="text-sm text-slate-500">{permsGroup.nom} — {t('group_perms_subtitle')}</p>
              </div>
              <button onClick={() => setPermsGroup(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {groupPermsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : activeModules.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Layers className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">{t('empty_modules_subtitle')}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Module</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Permission du groupe</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-violet-600">
                          <ShieldCheck className="h-3 w-3" />
                          Héritage
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeModules.map(moduleKey => {
                      const Icon = MODULE_ICONS[moduleKey] ?? Layers
                      const level = getGroupLevel(permsGroup.id, moduleKey)
                      return (
                        <tr key={moduleKey} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-slate-400" />
                              <span className="font-medium text-slate-700">{tNav(moduleKey)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={level}
                              onChange={e => setGroupPermission(permsGroup.id, moduleKey, e.target.value as PermissionLevel)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border-0 outline-none ring-1 ring-inset cursor-pointer transition-all appearance-none ${PERM_STYLES[level]} ring-transparent focus:ring-2 focus:ring-violet-400`}
                            >
                              {PERMISSION_LEVELS.map(lvl => (
                                <option key={lvl} value={lvl}>{t(`permission_${lvl}`)}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-400">
                              Tous les membres du groupe héritent au minimum de{' '}
                              <span className="font-semibold text-slate-600">{t(`permission_${level}`)}</span>
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="shrink-0 flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setPermsGroup(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Membres du groupe ────────────────────────────────── */}
      {membersGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('modal_members_title')}</h2>
                <p className="text-sm text-slate-500">{membersGroup.nom}</p>
              </div>
              <button onClick={() => setMembersGroup(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Liste des membres */}
                {members.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Aucun membre pour l&apos;instant.</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 uppercase">{t('col_member_name')}</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 uppercase">{t('col_member_role')}</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {members.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-indigo-600">
                                  {m.display_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium text-slate-700">{m.display_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              m.role === 'manager' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {t(`member_role_${m.role}`)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => removeMember(m.id)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Ajouter un membre */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('btn_add_member')}</p>
                  <div className="flex gap-2">
                    <select
                      value={newMemberId}
                      onChange={e => setNewMemberId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                      <option value="">— Sélectionner un utilisateur —</option>
                      {availableUsers
                        .filter(u => !members.some(m => m.user_id === u.user_id))
                        .map(u => (
                          <option key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.substring(0, 8)}</option>
                        ))
                      }
                    </select>
                    <select
                      value={newMemberRole}
                      onChange={e => setNewMemberRole(e.target.value as MemberRole)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                      <option value="membre">{t('member_role_membre')}</option>
                      <option value="manager">{t('member_role_manager')}</option>
                    </select>
                    <button
                      onClick={addMember}
                      disabled={!newMemberId || addingMember}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {addingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
