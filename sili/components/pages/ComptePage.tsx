'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings, Globe, Lock, Eye, EyeOff,
  Loader2, Save, ArrowLeft, CheckCircle, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface Prefs {
  preferred_language: string
}

function getPasswordStrength(pwd: string): number {
  if (pwd.length === 0) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  return score
}

export default function ComptePage() {
  const t = useTranslations('compte')
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string
  const societeSlug = params.societe_slug as string | undefined
  const societeId = params.societe_id as string | undefined

  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // Preferences
  const [prefs, setPrefs] = useState<Prefs>({ preferred_language: 'fr' })
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Security
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const localePrefix = locale !== 'fr' ? `/${locale}` : ''
  const tenantBase = `${localePrefix}/${tenantSlug}/${tenantId}/${userId}`
  // Lien "Retour au profil" contextuel
  const profileHref = societeSlug && societeId
    ? `${tenantBase}/${societeSlug}/${societeId}/profile`
    : `${tenantBase}/profile`

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserEmail(session.user.email || '')

    const { data } = await supabase
      .from('profiles')
      .select('id, preferred_language, preferred_currency')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setProfileId(data.id)
      setPrefs({ preferred_language: data.preferred_language || 'fr' })
    }
    setLoading(false)
  }

  async function savePreferences() {
    setSavingPrefs(true)
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: prefs.preferred_language })
      .eq('id', profileId)

    if (error) toast.error(t('toast_prefs_error'))
    else toast.success(t('toast_prefs_success'))
    setSavingPrefs(false)
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) {
      toast.error(t('toast_pwd_mismatch'))
      return
    }
    if (getPasswordStrength(newPwd) < 3) {
      toast.error(t('toast_pwd_error'))
      return
    }

    setSavingPwd(true)

    // Vérifie le mot de passe actuel
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPwd,
    })

    if (signInError) {
      toast.error(t('toast_pwd_wrong_current'))
      setSavingPwd(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd })

    if (error) {
      toast.error(t('toast_pwd_error'))
    } else {
      toast.success(t('toast_pwd_success'))
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    }
    setSavingPwd(false)
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const strength = getPasswordStrength(newPwd)
  const strengthLabels = ['', t('pwd_weak'), t('pwd_medium'), t('pwd_strong'), t('pwd_very_strong')]
  const strengthColors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
  const strengthTextColors = ['', 'text-red-600', 'text-orange-500', 'text-yellow-600', 'text-emerald-600']

  const requirements = [
    { label: t('req_length'), met: newPwd.length >= 8 },
    { label: t('req_uppercase'), met: /[A-Z]/.test(newPwd) },
    { label: t('req_number'), met: /[0-9]/.test(newPwd) },
    { label: t('req_special'), met: /[^a-zA-Z0-9]/.test(newPwd) },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href={profileHref}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500"
            title={t('back_to_profile')}
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200">
          <Settings className="h-6 w-6 text-slate-600" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preferences">
        <TabsList className="w-full bg-slate-100 rounded-xl p-1 h-auto">
          <TabsTrigger
            value="preferences"
            className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5"
          >
            <Globe className="h-4 w-4 mr-2" />
            {t('tab_preferences')}
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5"
          >
            <Lock className="h-4 w-4 mr-2" />
            {t('tab_security')}
          </TabsTrigger>
        </TabsList>

        {/* ── Préférences ── */}
        <TabsContent value="preferences" className="mt-4">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">{t('section_preferences_title')}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{t('section_preferences_subtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="mt-4 max-w-sm">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  {t('field_language')}
                </label>
                <select
                  value={prefs.preferred_language}
                  onChange={e => setPrefs({ preferred_language: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={savePreferences}
                  disabled={savingPrefs}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-60"
                >
                  {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('btn_save_prefs')}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sécurité ── */}
        <TabsContent value="security" className="mt-4">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">{t('section_security_title')}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{t('section_security_subtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="space-y-4 mt-4 max-w-md">

                {/* Mot de passe actuel */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    {t('field_current_password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      placeholder={t('placeholder_current')}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    {t('field_new_password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder={t('placeholder_new')}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {newPwd.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{t('pwd_strength_label')}</span>
                        <span className={`text-xs font-bold ${strengthTextColors[strength]}`}>
                          {strengthLabels[strength]}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : 'bg-slate-200'}`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {requirements.map(req => (
                          <div key={req.label} className="flex items-center gap-1.5">
                            {req.met
                              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                            }
                            <span className={`text-xs ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmation */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    {t('field_confirm_password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      placeholder={t('placeholder_confirm')}
                      className={`w-full border rounded-xl px-4 py-2.5 pr-11 text-sm focus:ring-2 outline-none bg-white transition-colors ${
                        confirmPwd && confirmPwd !== newPwd
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPwd && confirmPwd !== newPwd && (
                    <p className="text-xs text-red-500 mt-1">{t('toast_pwd_mismatch')}</p>
                  )}
                </div>

              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={changePassword}
                  disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd || strength < 3}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {t('btn_change_password')}
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}