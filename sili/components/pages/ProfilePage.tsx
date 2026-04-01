'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  User, Mail, Shield, Calendar, Clock,
  Loader2, Save, Edit3, X, ExternalLink, CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: 'tenant_admin' | 'tenant_user' | 'super_admin' | null
  is_active: boolean | null
  created_at: string | null
  last_login_at: string | null
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string
  const societeSlug = params.societe_slug as string | undefined
  const societeId = params.societe_id as string | undefined

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '' })

  const localePrefix = locale !== 'fr' ? `/${locale}` : ''
  const tenantBase = `${localePrefix}/${tenantSlug}/${tenantId}/${userId}`
  // Lien "Paramètres du compte" contextuel
  const compteHref = societeSlug && societeId
    ? `${tenantBase}/${societeSlug}/${societeId}/compte`
    : `${tenantBase}/compte`

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setEmail(session.user.email || '')

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, is_active, created_at, last_login_at')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setProfile(data)
      setForm({ full_name: data.full_name || '', phone: data.phone || '' })
    }
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() })
      .eq('id', profile!.id)

    if (error) {
      toast.error(t('toast_save_error'))
    } else {
      setProfile(p => p ? { ...p, full_name: form.full_name.trim(), phone: form.phone.trim() } : p)
      setEditing(false)
      toast.success(t('toast_save_success'))
    }
    setSaving(false)
  }

  function cancelEdit() {
    setForm({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
    setEditing(false)
  }

  function getInitials(name: string | null) {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  function getRoleLabel(role: string | null) {
    if (role === 'tenant_admin') return t('role_tenant_admin')
    if (role === 'super_admin') return t('role_super_admin')
    return t('role_tenant_user')
  }

  function getRoleBadgeClass(role: string | null) {
    if (role === 'tenant_admin') return 'bg-indigo-100 text-indigo-700'
    if (role === 'super_admin') return 'bg-purple-100 text-purple-700'
    return 'bg-slate-100 text-slate-700'
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <User className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Hero Card */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="h-20 w-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md select-none">
              {getInitials(profile?.full_name ?? null)}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-slate-900">{profile?.full_name || '—'}</h2>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 justify-center sm:justify-start">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(profile?.role ?? null)}`}>
                  <Shield className="h-3 w-3" />
                  {getRoleLabel(profile?.role ?? null)}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${profile?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  <CheckCircle className="h-3 w-3" />
                  {t(profile?.is_active ? 'status_active' : 'status_inactive')}
                </span>
              </div>
            </div>
            <a
              href={compteHref}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
              {t('account_settings_btn')}
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Informations personnelles */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('section_identity_title')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">{t('section_identity_subtitle')}</CardDescription>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t('edit_btn')}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          {editing ? (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  {t('field_full_name')}
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder={t('placeholder_full_name')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  {t('field_email')}
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">{t('field_email_hint')}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  {t('field_phone')}
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder={t('placeholder_phone')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  {t('btn_cancel')}
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('btn_save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_full_name')}</p>
                <p className="font-bold text-slate-800">{profile?.full_name || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_email')}</p>
                <p className="font-bold text-slate-800 text-sm truncate">{email}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 sm:col-span-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_phone')}</p>
                <p className="font-bold text-slate-800">{profile?.phone || '—'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compte & Activité */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-800">{t('section_account_title')}</CardTitle>
              <CardDescription className="text-slate-500 text-sm">{t('section_account_subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('field_role')}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(profile?.role ?? null)}`}>
                <Shield className="h-3 w-3" />
                {getRoleLabel(profile?.role ?? null)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('field_status')}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${profile?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                <CheckCircle className="h-3 w-3" />
                {t(profile?.is_active ? 'status_active' : 'status_inactive')}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_created')}</p>
              <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {profile?.created_at ? dayjs(profile.created_at).format('DD MMM YYYY') : '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_last_login')}</p>
              <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {profile?.last_login_at
                  ? dayjs(profile.last_login_at).format('DD MMM YYYY, HH:mm')
                  : t('never')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}