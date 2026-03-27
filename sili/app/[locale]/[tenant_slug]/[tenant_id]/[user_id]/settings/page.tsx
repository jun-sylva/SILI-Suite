'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Settings, Building2, Shield, Server, Loader2,
  Save, CheckCircle, XCircle, Globe, Mail, MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  max_societes: number
  max_licences: number
  max_storage_gb: number
  created_at: string
}

interface TenantModule {
  module: string
  is_active: boolean
}

interface ProfilePrefs {
  preferred_language: string
  preferred_currency: string
}

export default function TenantSettingsPage() {
  const t = useTranslations('tenant_settings')
  const router = useRouter()
  const params = useParams()
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [modules, setModules] = useState<TenantModule[]>([])
  const [prefs, setPrefs] = useState<ProfilePrefs>({ preferred_language: 'fr', preferred_currency: 'XAF' })
  const [timezone, setTimezone] = useState('Africa/Douala')
  const [savingTimezone, setSavingTimezone] = useState(false)
  const [fullTenantId, setFullTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSocietesCount, setActiveSocietesCount] = useState(0)
  const [usersCount, setUsersCount] = useState(0)

  useEffect(() => {
    checkAndFetch()
  }, [])

  async function checkAndFetch() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Récupère le tenant_id UUID complet depuis profiles (params.tenant_id est tronqué à 8 chars)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id, preferred_language, preferred_currency')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }

    const fullTenantId = profile?.tenant_id
    if (!fullTenantId) return
    setFullTenantId(fullTenantId)

    setPrefs({
      preferred_language: profile?.preferred_language || 'fr',
      preferred_currency: profile?.preferred_currency || 'XAF',
    })

    const [tenantRes, modulesRes, socRes, usrRes] = await Promise.all([
      supabase.from('tenants')
        .select('id, name, slug, status, max_societes, max_licences, max_storage_gb, created_at')
        .eq('id', fullTenantId)
        .single(),
      supabase.from('tenant_modules')
        .select('module, is_active')
        .eq('tenant_id', fullTenantId)
        .eq('is_active', true),
      supabase.from('societes')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', fullTenantId)
        .eq('is_active', true),
      supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', fullTenantId),
    ])

    if (tenantRes.data) setTenant(tenantRes.data)
    setModules(modulesRes.data || [])
    setActiveSocietesCount(socRes.count || 0)
    setUsersCount(usrRes.count || 0)

    const { data: tsData } = await supabase
      .from('tenants')
      .select('timezone')
      .eq('id', fullTenantId)
      .maybeSingle()
    if (tsData?.timezone) setTimezone(tsData.timezone)

    setLoading(false)
  }

  async function saveTimezone() {
    setSavingTimezone(true)
    const { error } = await supabase
      .from('tenants')
      .update({ timezone })
      .eq('id', fullTenantId)
    if (error) toast.error(t('toast_timezone_error'))
    else toast.success(t('toast_timezone_success'))
    setSavingTimezone(false)
  }

  async function savePreferences() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      preferred_language: prefs.preferred_language,
      preferred_currency: prefs.preferred_currency,
    }).eq('id', userId)
    if (error) toast.error(t('toast_save_error'))
    else toast.success(t('toast_save_success'))
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const quotas = tenant ? [
    { label: t('quota_companies_label'), value: activeSocietesCount, max: tenant.max_societes, color: 'indigo' },
    { label: t('quota_licences_label'), value: usersCount, max: tenant.max_licences, color: 'emerald' },
    { label: t('quota_storage_label'), value: 0, max: tenant.max_storage_gb, color: 'sky', unit: ' Go' },
  ] : []

  const infoFields = tenant ? [
    { label: t('field_name'), value: tenant.name },
    { label: t('field_slug'), value: `/${tenant.slug}`, mono: true },
    { label: t('field_created'), value: dayjs(tenant.created_at).format('DD MMMM YYYY') },
  ] : []

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

      {/* Tenant Info */}
      {tenant && (
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('section_info_title')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">{t('section_info_subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Static info fields */}
              {infoFields.map(({ label, value, mono }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
                  <p className={`font-bold text-slate-800 ${mono ? 'font-mono text-sm text-indigo-600' : ''}`}>{value}</p>
                </div>
              ))}
              {/* Status field */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('field_status')}</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tenant.status === 'actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {tenant.status === 'actif'
                    ? <><CheckCircle className="h-3 w-3" />{t('status_active')}</>
                    : <><XCircle className="h-3 w-3" />{t('status_blocked')}</>
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quotas */}
      {tenant && (
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('section_quotas_title')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">{t('section_quotas_subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-5 mt-4">
              {quotas.map(({ label, value, max, color, unit }) => {
                const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
                const isAlert = pct >= 80
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-slate-700">{label}</span>
                      <span className={`font-bold ${isAlert ? 'text-red-600' : 'text-slate-600'}`}>
                        {value}{unit ?? ''} {t('quota_of')} {max}{unit ?? ''}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isAlert ? 'bg-red-500'
                          : color === 'indigo' ? 'bg-indigo-500'
                          : color === 'emerald' ? 'bg-emerald-500'
                          : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modules */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-800">{t('section_modules_title')}</CardTitle>
              <CardDescription className="text-slate-500 text-sm">{t('section_modules_subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          {modules.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">{t('no_modules')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {modules.map(m => (
                <div
                  key={m.module}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold capitalize bg-indigo-50 border-indigo-200 text-indigo-700"
                >
                  <div className="h-2 w-2 rounded-full shrink-0 bg-indigo-500" />
                  {m.module}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-800">{t('section_profile_title')}</CardTitle>
              <CardDescription className="text-slate-500 text-sm">{t('section_profile_subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                {t('field_language')}
              </label>
              <select
                value={prefs.preferred_language}
                onChange={e => setPrefs(p => ({ ...p, preferred_language: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                {t('field_currency')}
              </label>
              <select
                value={prefs.preferred_currency}
                onChange={e => setPrefs(p => ({ ...p, preferred_currency: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
              >
                {['XAF', 'XOF', 'EUR', 'USD', 'GBP', 'NGN', 'GHS'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('btn_save')}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Localisation */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-xl">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-800">{t('section_localisation_title')}</CardTitle>
              <CardDescription className="text-slate-500 text-sm">{t('section_localisation_subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="mt-4 max-w-sm">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              {t('field_timezone')}
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
            >
              {[
                { value: 'Africa/Douala',       label: 'Afrique Centrale — UTC+1 (Cameroun, Congo, Gabon, Tchad)' },
                { value: 'Africa/Lagos',         label: 'Afrique de l\'Ouest + 1 — UTC+1 (Nigéria, Bénin, Niger, Togo)' },
                { value: 'Africa/Abidjan',       label: 'Afrique de l\'Ouest — UTC+0 (Côte d\'Ivoire, Sénégal, Mali, Ghana)' },
                { value: 'Africa/Nairobi',       label: 'Afrique de l\'Est — UTC+3 (Kenya, Éthiopie, Tanzanie, Ouganda)' },
                { value: 'Africa/Johannesburg',  label: 'Afrique du Sud — UTC+2' },
                { value: 'Africa/Cairo',         label: 'Afrique du Nord-Est — UTC+2 (Égypte)' },
                { value: 'Africa/Casablanca',    label: 'Maroc — UTC+1' },
                { value: 'Africa/Algiers',       label: 'Algérie / Tunisie — UTC+1' },
                { value: 'Europe/Paris',         label: 'Europe Centrale — UTC+1/+2 (France)' },
                { value: 'UTC',                  label: 'UTC+0' },
              ].map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={saveTimezone}
              disabled={savingTimezone}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-md transition-colors text-sm disabled:opacity-60"
            >
              {savingTimezone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('btn_save_timezone')}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Support banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-indigo-800">{t('contact_support')}</p>
            <p className="text-sm text-indigo-600 mt-0.5">{t('contact_support_desc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-14 shrink-0">Nom</span>
            <span className="text-sm font-bold text-indigo-800">Michael Biya</span>
          </div>
          <a
            href="tel:+237934806420"
            className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-indigo-100 hover:border-indigo-300 transition"
          >
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-14 shrink-0">Tél.</span>
            <span className="text-sm font-bold text-indigo-700">+237 93 48 06 42</span>
          </a>
          <a
            href="mailto:m.biya@bbmediatech.com"
            className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-indigo-100 hover:border-indigo-300 transition"
          >
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-14 shrink-0">Email</span>
            <span className="text-sm font-bold text-indigo-700 truncate">m.biya@bbmediatech.com</span>
          </a>
        </div>
      </div>
    </div>
  )
}
