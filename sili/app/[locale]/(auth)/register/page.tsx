'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/routing'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { Building2, Loader2, CheckCircle2 } from 'lucide-react'

export default function RegisterTenantPage() {
  const router = useRouter()
  const t = useTranslations('register')
  
  const [step, setStep] = useState(1) // 1: form, 2: success
  const [raisonSociale, setRaisonSociale] = useState('')
  const [devise, setDevise] = useState('XAF')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError(t('error_password'))
      return
    }

    setLoading(true)

    // 1. Inscription Auth
    const { error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: nom
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. Création de la Société + Liaison via notre RPC
    const { error: rpcError } = await supabase.rpc('register_new_tenant', { 
      p_raison_sociale: raisonSociale,
      p_devise: devise,
      p_admin_name: nom
    })

    if (rpcError) {
      console.error(rpcError)
      setError(t('error_generic'))
      setLoading(false)
      return
    }

    setLoading(false)
    setStep(2) // Écran de validation UI
  }

  // --- Écran de succès ---
  if (step === 2) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-indigo-50/30 p-4">
        <LanguageSwitcher />
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-indigo-100">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('success_title')}</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            {t('success_msg')}
          </p>
          <Link href="/login" className="inline-block w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
            {t('back_login')}
          </Link>
        </div>
      </div>
    )
  }

  // --- Formulaire Principal ---
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-500">
      <LanguageSwitcher />
      
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Colonne Design (Gauche) */}
        <div className="hidden md:flex flex-col col-span-2 bg-indigo-600 p-10 text-white justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">{t('title')}</h2>
            <p className="text-indigo-100 text-sm leading-relaxed">{t('subtitle')}</p>
          </div>
          <div className="relative z-10 mb-8">
            <Building2 className="h-32 w-32 opacity-20 transform -rotate-12" />
          </div>
          {/* Elements de design superposés */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500 blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-indigo-800 blur-2xl opacity-60"></div>
        </div>

        {/* Colonne Formulaire (Droite) */}
        <div className="col-span-3 p-8 sm:p-12 border-l border-slate-100">
          
          <div className="mb-8 md:hidden text-center">
            <h2 className="text-2xl font-bold text-slate-800">{t('title')}</h2>
            <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-8">
            
            <div className="space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 border-b border-indigo-50 pb-2">
                {t('company_details')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('company_name')} *</label>
                  <input type="text" required value={raisonSociale} onChange={e => setRaisonSociale(e.target.value)}
                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('currency')} *</label>
                  <select value={devise} onChange={e => setDevise(e.target.value)} required
                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white outline-none transition-all shadow-sm">
                    <option value="XAF">Franc CFA (XAF)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 border-b border-indigo-50 pb-2 mt-4">
                {t('admin_details')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('fullname')} *</label>
                  <input type="text" required value={nom} onChange={e => setNom(e.target.value)}
                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('email')} *</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('password')} *</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} minLength={6}
                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">{t('confirm_password')} *</label>
                  <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full h-11 rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none transition-all shadow-sm ${confirmPassword && confirmPassword !== password ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/30' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'}`} />
                </div>
              </div>
            </div>

            {error && <div className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">{error}</div>}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold order-2 sm:order-1 transition-colors">
                &larr; {t('back_login')}
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center rounded-lg bg-indigo-600 px-10 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 hover:shadow-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all order-1 sm:order-2"
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {loading ? t('submitting') : t('submit')}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
