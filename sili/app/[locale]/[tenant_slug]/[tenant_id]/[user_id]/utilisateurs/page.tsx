'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Search, Users, X, Loader2, Shield, UserCheck, UserX,
  MoreHorizontal, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

interface Societe {
  id: string
  raison_sociale: string
}

interface UserSociete {
  utilisateur_id: string
  societe_id: string
  role: string
  is_active: boolean
}

export default function UtilisateursPage() {
  const t = useTranslations('utilisateurs')
  const router = useRouter()
  const params = useParams()
  const tenantId = params.tenant_id as string

  const [users, setUsers] = useState<Profile[]>([])
  const [societes, setSocietes] = useState<Societe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [accessModal, setAccessModal] = useState<Profile | null>(null)
  const [userSocietes, setUserSocietes] = useState<UserSociete[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAndFetch()
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function checkAndFetch() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }
    fetchUsers()
    fetchSocietes()
  }

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, is_active, last_login_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function fetchSocietes() {
    const { data } = await supabase
      .from('societes')
      .select('id, raison_sociale')
      .eq('tenant_id', tenantId)
    setSocietes(data || [])
  }

  async function changeRole(user: Profile) {
    const newRole = user.role === 'tenant_admin' ? 'tenant_user' : 'tenant_admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
      toast.success(t('toast_role_update_success'))
    } else toast.error(t('toast_role_update_error'))
    setDropdownOpen(null)
  }

  async function toggleActive(user: Profile) {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (!error) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u))
    setDropdownOpen(null)
  }

  async function openAccessModal(user: Profile) {
    setAccessModal(user)
    setAccessLoading(true)
    const { data } = await supabase
      .from('utilisateurs_societe')
      .select('utilisateur_id, societe_id, role, is_active')
      .eq('utilisateur_id', user.id)
    setUserSocietes(data || [])
    setAccessLoading(false)
    setDropdownOpen(null)
  }

  async function toggleSocieteAccess(societeId: string, currentAccess: UserSociete | undefined) {
    if (!accessModal) return
    if (currentAccess) {
      const { error } = await supabase
        .from('utilisateurs_societe')
        .update({ is_active: !currentAccess.is_active })
        .eq('utilisateur_id', accessModal.id)
        .eq('societe_id', societeId)
      if (!error) {
        setUserSocietes(prev => prev.map(us =>
          us.societe_id === societeId ? { ...us, is_active: !us.is_active } : us
        ))
        toast.success(t('toast_access_update_success'))
      } else toast.error(t('toast_access_update_error'))
    } else {
      const { error } = await supabase.from('utilisateurs_societe').insert({
        utilisateur_id: accessModal.id, societe_id: societeId, role: 'viewer', is_active: true,
      })
      if (!error) {
        setUserSocietes(prev => [...prev, {
          utilisateur_id: accessModal.id, societe_id: societeId, role: 'viewer', is_active: true,
        }])
        toast.success(t('toast_access_update_success'))
      } else toast.error(t('toast_access_update_error'))
    }
  }

  async function updateSocieteRole(societeId: string, newRole: string) {
    if (!accessModal) return
    const { error } = await supabase
      .from('utilisateurs_societe')
      .update({ role: newRole })
      .eq('utilisateur_id', accessModal.id)
      .eq('societe_id', societeId)
    if (!error) setUserSocietes(prev => prev.map(us => us.societe_id === societeId ? { ...us, role: newRole } : us))
  }

  function getRoleBadge(role: string) {
    const map: Record<string, { label: string; cls: string }> = {
      super_admin: { label: t('role_super_admin'), cls: 'bg-purple-100 text-purple-700' },
      tenant_admin: { label: t('role_tenant_admin'), cls: 'bg-indigo-100 text-indigo-700' },
      tenant_user: { label: t('role_tenant_user'), cls: 'bg-sky-100 text-sky-700' },
    }
    return map[role] ?? { label: role, cls: 'bg-slate-100 text-slate-600' }
  }

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <Users className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 w-full max-w-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400 text-slate-700 font-medium"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm">{t('loading')}</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">{t('col_user')}</th>
                    <th className="px-6 py-4">{t('col_role')}</th>
                    <th className="px-6 py-4">{t('col_status')}</th>
                    <th className="px-6 py-4">{t('col_last_login')}</th>
                    <th className="px-6 py-4 text-center">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <Users className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-600">{t('empty_title')}</p>
                          <p className="text-xs mt-1 text-slate-400">{t('empty_subtitle')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(u => {
                    const badge = getRoleBadge(u.role)
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                              {(u.full_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{u.full_name || '—'}</div>
                              <div className="text-[11px] text-slate-400">{u.phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {u.is_active ? t('status_active') : t('status_inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {u.last_login_at
                            ? dayjs(u.last_login_at).format('DD MMM YYYY, HH:mm')
                            : <span className="text-slate-300 italic text-xs">{t('never_logged')}</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-center relative">
                          <button
                            onClick={() => setDropdownOpen(dropdownOpen === u.id ? null : u.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                          {dropdownOpen === u.id && (
                            <div ref={dropdownRef} className="absolute right-6 top-12 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95">
                              <div className="py-1">
                                <button onClick={() => openAccessModal(u)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                  <Building2 className="h-4 w-4" /> {t('action_manage_access')}
                                </button>
                                {u.role !== 'super_admin' && (
                                  <>
                                    <button onClick={() => changeRole(u)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 border-t border-slate-100">
                                      <Shield className="h-4 w-4" /> {t('action_change_role')}
                                    </button>
                                    <button
                                      onClick={() => toggleActive(u)}
                                      className={`flex items-center gap-2 w-full px-4 py-2 text-sm border-t border-slate-100 ${u.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                    >
                                      {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                      {t('action_toggle_active')}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Accès Sociétés */}
      {accessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">

            <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{t('modal_access_title')}</h3>
                  <p className="text-sm text-indigo-600 font-medium">{accessModal.full_name}</p>
                </div>
              </div>
              <button onClick={() => setAccessModal(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {accessLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : societes.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">{t('no_company_access')}</p>
              ) : societes.map(soc => {
                const access = userSocietes.find(us => us.societe_id === soc.id)
                const isActive = access?.is_active ?? false
                return (
                  <div
                    key={soc.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {soc.raison_sociale[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{soc.raison_sociale}</p>
                        {isActive && access && (
                          <select
                            value={access.role}
                            onChange={e => updateSocieteRole(soc.id, e.target.value)}
                            className="text-xs text-indigo-600 bg-transparent font-medium border-none outline-none mt-0.5 cursor-pointer"
                          >
                            <option value="viewer">{t('company_role_viewer')}</option>
                            <option value="contributor">{t('company_role_contributor')}</option>
                            <option value="manager">{t('company_role_manager')}</option>
                            <option value="admin">{t('company_role_admin')}</option>
                          </select>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSocieteAccess(soc.id, access)}
                      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
