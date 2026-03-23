'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { Loader2, CheckCircle2, ShoppingCart, PackageSearch, Users, HardHat, CircleDollarSign, Shield, ArrowRight, Check, X, Eye, EyeOff } from 'lucide-react'
import { SuperAdminModal } from '@/components/auth/SuperAdminModal'

export default function UnifiedAuthPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const tLogin = useTranslations('login')
  const tReg = useTranslations('register')
  const tAuth = useTranslations('auth')

  const [isLoginView, setIsLoginView] = useState(true)
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false)

  // --- Login State ---
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // --- Register State ---
  const [regStep, setRegStep] = useState(1) // 1: form, 2: success
  const [raisonSociale, setRaisonSociale] = useState('')
  const [devise, setDevise] = useState('XAF')
  const [nom, setNom] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('+237')
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false)
  const isPhoneValid = phone.length === 9 && /^\d{9}$/.test(phone)
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  // Validation Robuste du mot de passe
  const hasMinLength = regPassword.length >= 8
  const hasUpper = /[A-Z]/.test(regPassword)
  const hasNumber = /[0-9]/.test(regPassword)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(regPassword)
  const isRobust = hasMinLength && hasUpper && hasNumber && hasSpecial
  const isMatch = regPassword === confirmPassword && regPassword.length > 0

  const modules = [
    { name: tAuth('module_vente'), desc: tAuth('module_vente_desc'), icon: ShoppingCart },
    { name: tAuth('module_achat'), desc: tAuth('module_achat_desc'), icon: PackageSearch },
    { name: tAuth('module_stock'), desc: tAuth('module_stock_desc'), icon: PackageSearch },
    { name: tAuth('module_rh'), desc: tAuth('module_rh_desc'), icon: Users },
    { name: tAuth('module_crm'), desc: tAuth('module_crm_desc'), icon: HardHat },
    { name: tAuth('module_compta'), desc: tAuth('module_compta_desc'), icon: CircleDollarSign },
  ]

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      setLoginError(tLogin('error_invalid_credentials'))
      setLoginLoading(false)
      return
    }

    if (data?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin, tenant_id')
        .eq('id', data.user.id)
        .single()

      if (profile?.is_super_admin) {
        const adminId = data.user.id.substring(0, 5)
        router.push(`/admin/${adminId}/dashboard`)
        router.refresh()
        return
      }

      if (profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('slug, status')
          .eq('id', profile.tenant_id)
          .single()

        if (tenant?.status === 'bloqué') {
          await supabase.auth.signOut()
          setLoginError("Accès suspendu. Veuillez contacter l'administrateur de la plateforme pour plus d'informations.")
          setLoginLoading(false)
          return
        }

        if (tenant?.slug) {
          const shortTenantId = profile.tenant_id.substring(0, 8)
          const shortUserId = data.user.id.substring(0, 8)
          router.push(`/${tenant.slug}/${shortTenantId}/${shortUserId}/dashboard`)
          router.refresh()
          return
        }
      }
    }

    router.push('/login')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegError('')
    
    if (!isRobust) {
      setRegError('Le mot de passe ne respecte pas les critères de sécurité.')
      return
    }
    if (!isMatch) {
      setRegError(tReg('error_password'))
      return
    }

    setRegLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
      email: regEmail, 
      password: regPassword,
      options: {
        data: {
          full_name: nom,
          phone: phone
        }
      }
    })

    if (signUpError) {
      setRegError(signUpError.message)
      setRegLoading(false)
      return
    }

    const { data: tenantResult, error: rpcError } = await supabase.rpc('register_new_tenant', { 
      p_raison_sociale: raisonSociale,
      p_devise: devise,
      p_admin_name: nom,
      p_phone: `${phoneCode}${phone}`,
      p_user_id: signUpData?.user?.id 
    })

    if (rpcError || !tenantResult) {
      console.error('Détails RPC Error:', rpcError)
      setRegError(tReg('error_generic'))
      setRegLoading(false)
      return
    }

    // Le résultat contient { id, slug } ✅
    const { id: tenantId, slug } = tenantResult as { id: string, slug: string }

    if (signUpData?.user && tenantId) {
       // Succès : On renvoie vers la vue de connexion au lieu d'entrer directement
       // pour s'assurer que la session et les droits sont bien synchronisés.
       setIsLoginView(true)
       setRegStep(1)
       setLoginEmail(regEmail)
       setLoginPassword('')
       setLoginError('Compte créé avec succès ! Veuillez vous connecter.')
       setRegLoading(false)
       return
    }

    setRegLoading(false)
    setRegStep(2)
  }

  // --- Helpers pour partager le code des formulates entre Mobile et Desktop ---
  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-600">{tLogin('email_label')}</label>
        <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
          className="w-full h-11 rounded-lg border border-slate-200 px-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-600 text-left">{tLogin('password_label')}</label>
        <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
          className="w-full h-11 rounded-lg border border-slate-200 px-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
      </div>
      {loginError && <p className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</p>}
      <button type="submit" disabled={loginLoading}
        className="w-full h-11 rounded-lg bg-indigo-600 font-bold text-white shadow hover:bg-indigo-700 transition">
        {loginLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : tLogin('submit_button')}
      </button>
      <div className="pt-6 text-center border-t border-slate-100 mt-6">
        <button type="button" onClick={() => setIsSuperAdminModalOpen(true)} className="text-sm font-semibold text-slate-400 hover:text-indigo-600 transition">Portail Super Admin</button>
      </div>
    </form>
  )

  const renderRegisterForm = () => {
    if (regStep === 2) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center pb-10">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{tReg('success_title')}</h2>
          <p className="text-slate-600 text-sm mb-8 leading-relaxed max-w-sm mx-auto">{tReg('success_msg')}</p>
          <button type="button" onClick={() => {setRegStep(1); setIsLoginView(true)}} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">{tReg('back_login')}</button>
        </div>
      )
    }

    return (
      <form onSubmit={handleRegister} className="space-y-4 pb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('company_name')} *</label>
            <input type="text" required value={raisonSociale} onChange={e => setRaisonSociale(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 py-0 focus:ring-1 outline-none shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('currency')} *</label>
            <select value={devise} onChange={e => setDevise(e.target.value)} required className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:border-indigo-500 focus:ring-1 outline-none shadow-sm">
              <option value="XAF">Franc CFA (XAF)</option>
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dollar ($)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('fullname')} *</label>
            <input type="text" required value={nom} onChange={e => setNom(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 outline-none shadow-sm" />
          </div>
          <div className="space-y-1 relative">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Téléphone *</label>
            <div className="flex relative items-center shadow-sm">
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)} 
                  className="w-[60px] h-10 flex flex-col items-center justify-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  <span className="text-[15px] leading-none mb-0.5">{phoneCode === '+237' ? '🇨🇲' : '🇫🇷'}</span>
                  <span className="text-[9px] font-bold text-slate-500 leading-none">{phoneCode}</span>
                </button>
                {phoneDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPhoneDropdownOpen(false)}></div>
                    <div className="absolute top-11 left-0 w-24 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                      <button type="button" onClick={() => { setPhoneCode('+237'); setPhoneDropdownOpen(false) }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100 transition-colors">
                        <span>🇨🇲</span> <span>+237</span>
                      </button>
                      <button type="button" onClick={() => { setPhoneCode('+33'); setPhoneDropdownOpen(false) }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors">
                        <span>🇫🇷</span> <span>+33</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input 
                type="tel" 
                maxLength={9}
                placeholder="Ex: 6XXXXXXXX"
                required 
                value={phone} 
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                className={`w-full min-w-0 h-10 rounded-r-lg border px-3 pr-10 text-sm outline-none transition-colors ${
                  phone.length > 0 && !isPhoneValid 
                    ? 'border-orange-300 bg-orange-50/50 focus:border-orange-400 focus:ring-1 focus:ring-orange-400' 
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                }`} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {isPhoneValid && <Check className="h-5 w-5 text-emerald-500 drop-shadow-sm" />}
              </div>
            </div>
            {phone.length > 0 && !isPhoneValid && (
              <p className="text-[10px] text-orange-500 font-medium absolute -bottom-4 left-0">
                Format invalide : 9 chiffres requis.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('email')} *</label>
          <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 outline-none shadow-sm" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1 relative">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('password')} *</label>
            <div className="relative">
              <input type={showRegPassword ? "text" : "password"} required className="w-full h-10 rounded-lg border border-slate-200 pl-3 pr-10 text-sm focus:border-indigo-500 focus:ring-1 outline-none shadow-sm" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
              <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {(regPassword.length > 0) && (
              <div className="mt-2 text-[10px] bg-slate-50/80 p-2 rounded-md border border-slate-100/50 space-y-1">
                <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 8 caractères min.
                </div>
                <div className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {hasUpper ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 1 majuscule
                </div>
                <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 1 chiffre
                </div>
                <div className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {'1 caractère spécial (!@#$%^&*(),.?":{}|<>)'}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{tReg('confirm_password')} *</label>
            <input 
              type="password" 
              required 
              className={`w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none transition-colors shadow-sm ${
                confirmPassword.length > 0 
                  ? (isMatch ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/30' : 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/30')
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
            {confirmPassword.length > 0 && (
              <p className={`text-[10px] mt-1.5 flex items-center gap-1 font-medium ${isMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                {isMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 
                {isMatch ? "Correspondance exacte" : "Différents"}
              </p>
            )}
          </div>
        </div>

        {regError && <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded-md border border-red-100">{regError}</p>}
        
        <button type="submit" disabled={regLoading || !isRobust || !isMatch} className="w-full h-11 mt-4 rounded-lg bg-indigo-600 font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {regLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : tReg('submit')}
        </button>
      </form>
    )
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 sm:p-6 md:p-8 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
      <div className="absolute top-4 right-4 z-[60]">
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-[1000px] h-auto md:h-[650px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:block">
        
        {/* =========================================================
            MOBILE VIEW
        ========================================================= */}
        <div className="md:hidden flex flex-col h-full bg-white relative p-5 pt-8">
           <div className="flex bg-slate-100 p-1 rounded-lg mb-6 shrink-0 mt-4">
             <button onClick={() => setIsLoginView(true)} className={`flex-1 py-2 text-xs uppercase tracking-wider font-bold rounded-md transition ${isLoginView ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Connexion</button>
             <button onClick={() => setIsLoginView(false)} className={`flex-1 py-2 text-xs uppercase tracking-wider font-bold rounded-md transition ${!isLoginView ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>S'inscrire</button>
           </div>
           
           {isLoginView ? (
             <div className="flex-1 animate-in fade-in slide-in-from-left-4 duration-500">
               <div className="text-center mb-8">
                 <div className="flex justify-center items-center mb-4">
                   <div className="relative w-40 h-12 shrink-0">
                     <Image src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/logo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvbG9nby53ZWJwIiwiaWF0IjoxNzc0MTA0NzQ5LCJleHAiOjMzMjc4NTY4NzQ5fQ.M17asTuCg79nEU3YWlxMl_UA4ROorgdC27SPSl46OUY" alt="SILI Logo" fill sizes="160px" className="object-contain" priority unoptimized />
                   </div>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">{tLogin('title')}</h2>
                 <p className="text-slate-500 text-sm mt-1">{tLogin('subtitle')}</p>
               </div>
               {renderLoginForm()}
             </div>
           ) : (
             <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold text-slate-800">{tReg('title')}</h2>
                 <p className="text-slate-500 text-sm mt-1">{tReg('subtitle')}</p>
               </div>
               {renderRegisterForm()}
             </div>
           )}
        </div>

        {/* =========================================================
            DESKTOP VIEW (SLIDING OVERLAY)
        ========================================================= */}
        <div className="hidden md:block w-full h-full relative bg-white">

           {/* 1. Sign In Form (Static Left Side) */}
           <div className={`absolute top-0 left-0 w-1/2 h-full p-12 flex flex-col justify-center transition-all duration-700 ease-in-out z-10 ${isLoginView ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-x-8'}`}>
             <div className="text-center mb-10">
               <div className="flex justify-center items-center mb-6">
                 <div className="relative w-48 h-12 shrink-0">
                   <Image src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/logo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvbG9nby53ZWJwIiwiaWF0IjoxNzc0MTA0NzQ5LCJleHAiOjMzMjc4NTY4NzQ5fQ.M17asTuCg79nEU3YWlxMl_UA4ROorgdC27SPSl46OUY" alt="SILI Logo" fill sizes="192px" className="object-contain" priority unoptimized />
                 </div>
               </div>
               <h2 className="text-3xl font-bold text-slate-800">{tLogin('title')}</h2>
               <p className="text-slate-500 text-sm mt-2">{tLogin('subtitle')}</p>
             </div>
             {renderLoginForm()}
           </div>

           {/* 2. Sign Up Form (Static Right Side) */}
           <div className={`absolute top-0 right-0 w-1/2 h-full p-10 flex flex-col justify-center transition-all duration-700 ease-in-out z-10 ${isLoginView ? 'opacity-0 pointer-events-none -translate-x-8' : 'opacity-100 pointer-events-auto'}`}>
              <div className="text-center mb-6">
                 <h2 className="text-2xl font-bold text-slate-800">{tReg('title')}</h2>
                 <p className="text-slate-500 text-sm mt-1">{tReg('subtitle')}</p>
              </div>
              <div className="overflow-y-auto pr-2 scrollbar-hide flex-1 max-h-[500px]">
                {renderRegisterForm()}
              </div>
           </div>

           {/* 3. The Sliding Overlay */}
           <div className={`absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-50 shadow-2xl ${isLoginView ? '' : '-translate-x-full'}`}>
              <div className={`bg-gradient-to-br from-indigo-600 to-indigo-900 relative left-[-100%] h-full w-[200%] transition-transform duration-700 ease-in-out ${isLoginView ? 'translate-x-0' : 'translate-x-1/2'}`}>
                
                {/* --- Overlay Sign In Content (Technically right side of the inner container) --- */}
                <div className="absolute top-0 right-0 w-1/2 h-full p-10 flex flex-col justify-center text-white">
                  <div className="text-center shrink-0 mb-6">
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">{tAuth('signin_overlay_title')}</h2>
                    <p className="text-indigo-100 text-sm max-w-sm mx-auto">{tAuth('signin_overlay_desc')}</p>
                  </div>
                  
                  {/* Modules List Scrollable */}
                  <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide space-y-3 my-2 border-y border-indigo-500/30 py-4 custom-scrollbar">
                    {modules.map((mod, i) => (
                      <div key={i} className="flex items-start bg-indigo-800/40 p-3 rounded-xl border border-indigo-400/20 backdrop-blur-sm">
                        <div className="bg-indigo-500/30 p-2 rounded-lg mr-4 shrink-0">
                          <mod.icon className="h-5 w-5 text-indigo-100" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm tracking-wide text-white">{mod.name}</h4>
                          <p className="text-[11px] text-indigo-200 mt-1 leading-relaxed">{mod.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center shrink-0 mt-6 pt-2">
                    <p className="text-xs text-indigo-200 mb-4 uppercase tracking-widest font-semibold">Nouveau sur SILI Suite ?</p>
                    <button onClick={() => setIsLoginView(false)} className="px-8 py-3 rounded-xl border border-white/40 bg-white/10 text-white font-bold hover:bg-white hover:text-indigo-900 shadow-lg backdrop-blur-md transition-all flex items-center justify-center mx-auto group">
                      Créer un compte <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* --- Overlay Sign Up Content (Technically left side of the inner container) --- */}
                <div className="absolute top-0 left-0 w-1/2 h-full p-10 flex flex-col justify-center text-white">
                  <div className="text-center shrink-0 mb-8">
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">{tAuth('signup_overlay_title')}</h2>
                    <p className="text-indigo-100 text-sm leading-relaxed max-w-sm mx-auto">{tAuth('signup_overlay_desc')}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide mb-6 text-sm">
                    <div className="bg-indigo-800/40 p-6 rounded-2xl border border-indigo-400/20 backdrop-blur-sm space-y-5">
                      <div className="flex gap-3">
                        <span className="text-xl">🏢</span><p className="text-indigo-50 leading-relaxed text-xs"><strong className="text-white">Organisation</strong><br/>Le nom officiel de votre groupe ou entreprise principale.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-xl">💱</span><p className="text-indigo-50 leading-relaxed text-xs"><strong className="text-white">Devise Souche</strong><br/>La monnaie par défaut pour vos transactions financières.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-xl">👤</span><p className="text-indigo-50 leading-relaxed text-xs"><strong className="text-white">Administrateur</strong><br/>Le premier responsable avec les pleins pouvoirs système.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-xl">📞</span><p className="text-indigo-50 leading-relaxed text-xs"><strong className="text-white">Contact & Sécurité</strong><br/>Téléphone, e-mail et mot de passe sécurisé.</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center shrink-0">
                    <p className="text-xs text-indigo-200 mb-4 uppercase tracking-widest font-semibold">Vous avez déjà un compte ?</p>
                    <button onClick={() => setIsLoginView(true)} className="px-8 py-3 rounded-xl border border-white/40 bg-white/10 text-white font-bold hover:bg-white hover:text-indigo-900 shadow-lg backdrop-blur-md transition-all flex items-center justify-center mx-auto group">
                      Se connecter <ArrowRight className="ml-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

              </div>
           </div>
        </div>
      </div>
      
      <SuperAdminModal isOpen={isSuperAdminModalOpen} onClose={() => setIsSuperAdminModalOpen(false)} />
    </div>
  )
}
