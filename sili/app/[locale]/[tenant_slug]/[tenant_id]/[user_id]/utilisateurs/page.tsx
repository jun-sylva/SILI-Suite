'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Search, Users, X, Loader2, Shield, UserCheck, UserX,
  MoreHorizontal, Plus, ChevronDown, Key, Building2,
  Phone, Calendar, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Profile {
  id: string
  full_name: string | null
  email?: string | null
  phone: string | null
  role: string | null
  is_active: boolean | null
  last_login_at: string | null
  created_at: string | null
}

interface Societe {
  id: string
  raison_sociale: string
}

type CreateForm = {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: 'tenant_admin' | 'tenant_user'
  assignedSocietes: string[]
}

const defaultForm: CreateForm = {
  fullName: '', email: '', phone: '', password: '', confirmPassword: '', role: 'tenant_user', assignedSocietes: [],
}

function checkPasswordStrength(pwd: string) {
  return {
    minLength:   pwd.length >= 8,
    hasUppercase: /[A-Z]/.test(pwd),
    hasDigit:     /[0-9]/.test(pwd),
    hasSpecial:   /[^A-Za-z0-9]/.test(pwd),
  }
}

function isPasswordStrong(pwd: string) {
  const c = checkPasswordStrength(pwd)
  return c.minLength && c.hasUppercase && c.hasDigit && c.hasSpecial
}

export default function UtilisateursPage() {
  const t = useTranslations('utilisateurs')
  const router = useRouter()
  const params = useParams()
  const tenantId = params.tenant_id as string

  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [maxLicences, setMaxLicences] = useState(0)
  const [fullTenantId, setFullTenantId] = useState('')
  const [societes, setSocietes] = useState<Societe[]>([])
  const [detailUser, setDetailUser] = useState<Profile | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAndFetch()
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(null)
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node))
        setAddMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function checkAndFetch() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }
    const tid = profile?.tenant_id ?? ''
    setFullTenantId(tid)
    await fetchAll(tid)
  }

  async function fetchAll(tid?: string) {
    const realTid = tid ?? fullTenantId
    if (!realTid) return
    setLoading(true)

    const [tenantRes, usersRes, societesRes] = await Promise.all([
      supabase.from('tenants').select('max_licences').eq('id', realTid).single(),
      supabase
        .from('profiles')
        .select('id, full_name, phone, role, is_active, last_login_at, created_at')
        .eq('tenant_id', realTid)
        .in('role', ['tenant_admin', 'tenant_user'])
        .order('created_at', { ascending: false }),
      supabase
        .from('societes')
        .select('id, raison_sociale')
        .eq('tenant_id', realTid)
        .eq('is_active', true)
        .order('raison_sociale'),
    ])

    if (societesRes.data) setSocietes(societesRes.data)

    if (tenantRes.error) console.error('[tenants RLS]', tenantRes.error.message)
    else if (tenantRes.data) setMaxLicences(Number(tenantRes.data.max_licences) || 0)

    if (usersRes.error) toast.error(t('toast_load_error'))
    else setUsers((usersRes.data as Profile[]) || [])

    setLoading(false)
  }

  async function handleCreate() {
    if (!createForm.fullName.trim()) { toast.error(t('error_fullname_required')); return }
    if (!createForm.email.trim()) { toast.error(t('error_email_required')); return }
    if (!isPasswordStrong(createForm.password)) { toast.error(t('error_password_weak')); return }
    if (createForm.password !== createForm.confirmPassword) { toast.error(t('error_password_mismatch')); return }
    if (createForm.role === 'tenant_user' && createForm.assignedSocietes.length === 0) {
      toast.error(t('error_societe_required')); return
    }

    setSaving(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          fullName: createForm.fullName,
          phone: createForm.phone || null,
          role: createForm.role,
          tenantId: fullTenantId,
          assignedSocieteIds: createForm.role === 'tenant_user' ? createForm.assignedSocietes : [],
        }),
      })
      clearTimeout(timeout)

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('toast_create_error'))
      } else {
        toast.success(t('toast_create_success'))
        setShowCreateModal(false)
        setCreateForm(defaultForm)
        await fetchAll()
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.error('La requête a expiré (timeout 30s). Vérifie la configuration du serveur.')
      } else {
        toast.error(t('toast_create_error'))
      }
      console.error('[handleCreate]', err)
    } finally {
      setSaving(false)
    }
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

  function openCreate(role: 'tenant_admin' | 'tenant_user') {
    setCreateForm({ ...defaultForm, role })
    setAddMenuOpen(false)
    setShowCreateModal(true)
  }

  function getRoleBadge(role: string | null) {
    if (!role) return { label: '—', cls: 'bg-slate-100 text-slate-600' }
    const map: Record<string, { label: string; cls: string }> = {
      super_admin: { label: t('role_super_admin'), cls: 'bg-purple-100 text-purple-700' },
      tenant_admin: { label: t('role_tenant_admin'), cls: 'bg-indigo-100 text-indigo-700' },
      tenant_user: { label: t('role_tenant_user'), cls: 'bg-sky-100 text-sky-700' },
    }
    return map[role] ?? { label: role, cls: 'bg-slate-100 text-slate-600' }
  }

  const quotaAtteint = maxLicences > 0 && users.length >= maxLicences

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
        <div className="flex items-center gap-3">
          {/* Quota licences */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <Key className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <span className={`font-bold ${quotaAtteint ? 'text-red-600' : 'text-slate-700'}`}>{users.length}</span>
              {' / '}
              <span className="font-bold text-slate-700">{maxLicences}</span> {t('quota_label')}
            </span>
          </div>

          {/* Bouton Nouvel Utilisateur + dropdown choix rôle */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen(v => !v)}
              disabled={quotaAtteint}
              title={quotaAtteint ? t('quota_reached') : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Plus className="h-4 w-4" />
              {t('new_user')}
              <ChevronDown className={`h-4 w-4 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 top-12 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="py-1">
                  <button
                    onClick={() => openCreate('tenant_admin')}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-indigo-50 transition-colors"
                  >
                    <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{t('role_tenant_admin')}</p>
                      <p className="text-[11px] text-slate-400">{t('role_admin_desc')}</p>
                    </div>
                  </button>
                  <div className="border-t border-slate-100" />
                  <button
                    onClick={() => openCreate('tenant_user')}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-sky-50 transition-colors"
                  >
                    <div className="h-7 w-7 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-sky-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{t('role_tenant_user')}</p>
                      <p className="text-[11px] text-slate-400">{t('role_user_desc')}</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
            <Users className="h-6 w-6 text-indigo-600" />
          </div>
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
                      <tr key={u.id} onClick={() => setDetailUser(u)} className="hover:bg-indigo-50/40 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.role === 'tenant_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
                              {(u.full_name || u.email || '?')[0].toUpperCase()}
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
                        <td className="px-6 py-4 text-center relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setDropdownOpen(dropdownOpen === u.id ? null : u.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                          {dropdownOpen === u.id && (
                            <div ref={dropdownRef} className="absolute right-6 top-12 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95">
                              <div className="py-1">
                                <button onClick={() => changeRole(u)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                  <Shield className="h-4 w-4" />
                                  {u.role === 'tenant_admin' ? t('action_make_user') : t('action_make_admin')}
                                </button>
                                <button
                                  onClick={() => toggleActive(u)}
                                  className={`flex items-center gap-2 w-full px-4 py-2 text-sm border-t border-slate-100 ${u.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                >
                                  {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                  {t('action_toggle_active')}
                                </button>
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

      {/* Modal Création Utilisateur */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${createForm.role === 'tenant_admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'}`}>
                  {createForm.role === 'tenant_admin' ? <Shield className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{t('modal_create_title')}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${createForm.role === 'tenant_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
                    {getRoleBadge(createForm.role).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Nom complet */}
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_fullname')} *</label>
                  <input
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    placeholder={t('placeholder_fullname')}
                    value={createForm.fullName}
                    onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_email')} *</label>
                  <input
                    type="email"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    placeholder={t('placeholder_email')}
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                {/* Téléphone */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_phone')}</label>
                  <input
                    type="tel"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    placeholder={t('placeholder_phone')}
                    value={createForm.phone}
                    onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                {/* Mot de passe */}
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_password')} *</label>
                  <input
                    type="password"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                    placeholder={t('placeholder_password')}
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  />
                  {/* Indicateur de robustesse */}
                  {createForm.password.length > 0 && (() => {
                    const s = checkPasswordStrength(createForm.password)
                    const criteria = [
                      { key: 'minLength',    label: t('password_strength_min_chars'), ok: s.minLength },
                      { key: 'hasUppercase', label: t('password_strength_uppercase'), ok: s.hasUppercase },
                      { key: 'hasDigit',     label: t('password_strength_digit'),     ok: s.hasDigit },
                      { key: 'hasSpecial',   label: t('password_strength_special'),   ok: s.hasSpecial },
                    ]
                    const score = criteria.filter(c => c.ok).length
                    const barColor = score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-orange-400' : score === 3 ? 'bg-amber-400' : 'bg-emerald-500'
                    return (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1">
                          {[0,1,2,3].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < score ? barColor : 'bg-slate-200'}`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {criteria.map(c => (
                            <span key={c.key} className={`flex items-center gap-1 text-[11px] font-medium ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                              <span className={`h-3 w-3 rounded-full flex items-center justify-center shrink-0 ${c.ok ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                {c.ok && <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 8 8"><path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </span>
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Confirmer le mot de passe */}
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_confirm_password')} *</label>
                  <input
                    type="password"
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
                      createForm.confirmPassword.length === 0
                        ? 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                        : createForm.password === createForm.confirmPassword
                          ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-200 bg-emerald-50/30'
                          : 'border-red-400 focus:ring-2 focus:ring-red-200 bg-red-50/30'
                    }`}
                    placeholder={t('placeholder_confirm_password')}
                    value={createForm.confirmPassword}
                    onChange={e => setCreateForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  />
                  {createForm.confirmPassword.length > 0 && (
                    <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${createForm.password === createForm.confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                      {createForm.password === createForm.confirmPassword
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> {t('password_match')}</>
                        : <><XCircle className="h-3.5 w-3.5" /> {t('password_no_match')}</>
                      }
                    </p>
                  )}
                </div>

                {/* Rôle */}
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_role')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['tenant_admin', 'tenant_user'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, role: r, assignedSocietes: [] }))}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${createForm.role === r
                          ? r === 'tenant_admin'
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-sky-500 bg-sky-50'
                          : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${r === 'tenant_admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-sky-100 text-sky-600'}`}>
                          {r === 'tenant_admin' ? <Shield className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{t(`role_${r}` as any)}</p>
                          <p className="text-[10px] text-slate-400">{t(r === 'tenant_admin' ? 'role_admin_desc' : 'role_user_desc')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignation sociétés — obligatoire pour tenant_user */}
                {createForm.role === 'tenant_user' && (
                  <div className="col-span-full">
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      {t('field_societes')} *
                    </label>
                    {societes.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
                        <Building2 className="h-4 w-4 shrink-0" />
                        {t('no_societes_available')}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {societes.map(s => {
                          const checked = createForm.assignedSocietes.includes(s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setCreateForm(f => ({
                                ...f,
                                assignedSocietes: checked
                                  ? f.assignedSocietes.filter(id => id !== s.id)
                                  : [...f.assignedSocietes, s.id],
                              }))}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${checked ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                            >
                              <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}`}>
                                {checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                              </div>
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${checked ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                                {s.raison_sociale[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800 text-sm truncate">{s.raison_sociale}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {createForm.assignedSocietes.length > 0 && (
                      <p className="text-xs text-sky-600 font-medium mt-1.5">
                        {createForm.assignedSocietes.length} {t('societes_selected')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50/50">
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !isPasswordStrong(createForm.password) || createForm.password !== createForm.confirmPassword || (createForm.role === 'tenant_user' && createForm.assignedSocietes.length === 0)}
                title={createForm.role === 'tenant_user' && createForm.assignedSocietes.length === 0 ? t('error_societe_required') : undefined}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('btn_create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail Utilisateur */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          t={t}
        />
      )}
    </div>
  )
}

// ─── Modal Détail Utilisateur ────────────────────────────────────────────────

interface UserDetailModalProps {
  user: Profile
  onClose: () => void
  t: ReturnType<typeof useTranslations>
}

function UserDetailModal({ user, onClose, t }: UserDetailModalProps) {
  const roleBadge = getRoleBadgeStatic(user.role, t)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${user.role === 'tenant_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
              {(user.full_name || '?')[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{user.full_name || '—'}</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${roleBadge.cls}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">

          {/* Statut */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-slate-400 shrink-0">
              {user.is_active ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{t('col_status')}</p>
              <p className={`text-sm font-semibold ${user.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                {user.is_active ? t('status_active') : t('status_inactive')}
              </p>
            </div>
          </div>

          {/* Téléphone */}
          {user.phone && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{t('detail_phone')}</p>
                <p className="text-sm font-semibold text-slate-700">{user.phone}</p>
              </div>
            </div>
          )}

          {/* Dernière connexion */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{t('col_last_login')}</p>
              <p className="text-sm font-semibold text-slate-700">
                {user.last_login_at
                  ? dayjs(user.last_login_at).format('DD MMM YYYY, HH:mm')
                  : <span className="italic text-slate-400 font-normal">{t('never_logged')}</span>
                }
              </p>
            </div>
          </div>

          {/* Créé le */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{t('detail_created_at')}</p>
              <p className="text-sm font-semibold text-slate-700">{user.created_at ? dayjs(user.created_at).format('DD MMM YYYY') : '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getRoleBadgeStatic(role: string | null, t: ReturnType<typeof useTranslations>) {
  if (!role) return { label: '—', cls: 'bg-slate-100 text-slate-600' }
  const map: Record<string, { label: string; cls: string }> = {
    super_admin: { label: t('role_super_admin'), cls: 'bg-purple-100 text-purple-700' },
    tenant_admin: { label: t('role_tenant_admin'), cls: 'bg-indigo-100 text-indigo-700' },
    tenant_user: { label: t('role_tenant_user'), cls: 'bg-sky-100 text-sky-700' },
  }
  return map[role] ?? { label: role, cls: 'bg-slate-100 text-slate-600' }
}
