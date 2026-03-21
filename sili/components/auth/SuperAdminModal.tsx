'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ShieldCheck, Loader2, Check, X, Eye, EyeOff } from 'lucide-react'

interface SuperAdminModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SuperAdminModal({ isOpen, onClose }: SuperAdminModalProps) {
  const router = useRouter()
  
  // Étapes : 1 = PIN, 2 = Formulaire de création
  const [step, setStep] = useState<1 | 2>(1)
  
  // Code Secret (Illusion : 8 cases visuelles, mais la validation accepte dès qu'on valide)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(false)

  // Formulaire d'inscription
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)

  // Validation Robuste du mot de passe
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  const isRobust = hasMinLength && hasUpper && hasNumber && hasSpecial
  const isMatch = password === confirmPassword && password.length > 0

  if (!isOpen) return null

  // ---- Vérification du PIN ----
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError('')
    setLoading(true)

    // RPC Secure Call
    const { data: isValid, error } = await supabase.rpc('verify_superadmin_pin', { pin })

    if (error || !isValid) {
      setPinError('Code de sécurité incorrect.')
      setLoading(false)
      // Réinitialiser le pin après erreur pour l'UX
      setPin('')
      return
    }

    setStep(2)
    setLoading(false)
  }

  // ---- Création du Super Admin ----
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!isRobust) {
      setFormError('Le mot de passe ne respecte pas les critères de sécurité.')
      return
    }
    if (!isMatch) {
      setFormError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    // 1. Inscription classique
    const { error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: { data: { full_name: nom } }
    })

    if (signUpError) {
      setFormError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. Élévation immédiate des droits via RPC sécurisée
    const { error: rpcError } = await supabase.rpc('setup_first_superadmin', { target_email: email })

    if (rpcError) {
      setFormError("Privilèges bloqués : Il est possible qu'un Super Admin existe déjà.")
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    
    // Redirection après succès
    setTimeout(() => {
      onClose()
      router.push('/dashboard') // Route admin ou dashboard central
    }, 3000)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        
        {/* Fermeture du Modal */}
        {!success && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* --- ETAPE 1 : Leurre du PIN --- */}
        {step === 1 && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-4">
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Accès Restreint</h2>
              <p className="text-sm text-slate-500 mt-1">Saisissez le code de sécurité (8 chiffres requis)</p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-6">
              {/* Leurre visuel : L'input impose maxLength=8 pour illusion, mais on sait que c'est 4 */}
              <div className="flex justify-center">
                <input
                  type="password"
                  maxLength={8}
                  placeholder="• • • • • • • •"
                  className="w-full text-center text-3xl font-mono tracking-[1em] h-16 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
              </div>

              {pinError && <p className="text-center text-sm font-medium text-red-500">{pinError}</p>}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full h-12 flex items-center justify-center rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Vérifier"}
              </button>
            </form>
          </div>
        )}

        {/* --- ETAPE 2 : Formulaire de création --- */}
        {step === 2 && !success && (
          <div className="p-8">
            <div className="text-center mb-6">
              <ShieldCheck className="mx-auto h-10 w-10 text-indigo-600 mb-2" />
              <h2 className="text-xl font-bold text-slate-900">Nouveau Super Admin</h2>
              <p className="text-sm text-slate-500">Configuration du compte maître</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Nom Complet</label>
                <input
                  type="text"
                  required
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Email Administratif</label>
                <input
                  type="email"
                  required
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Champ Mot de passe avec checklist intégrée */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold uppercase text-slate-500">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full h-10 rounded-lg border border-slate-200 pl-3 pr-10 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Indicateurs de robustesse (en temps réel) */}
                {(password.length > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                    <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 8 caractères min.
                    </div>
                    <div className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasUpper ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 1 majuscule
                    </div>
                    <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 1 chiffre
                    </div>
                    <div className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 1 caractère spécial
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-slate-500">Confirmez le mot de passe</label>
                <input
                  type="password"
                  required
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none transition-colors ${
                    confirmPassword.length > 0 
                      ? (isMatch ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/30' : 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/30')
                      : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword.length > 0 && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${isMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} 
                    {isMatch ? "Les mots de passe correspondent" : "Les mots de passe sont différents"}
                  </p>
                )}
              </div>

              {formError && <p className="text-center text-sm font-medium text-red-500 bg-red-50 p-2 rounded">{formError}</p>}

              <button
                type="submit"
                disabled={loading || !isRobust || !isMatch}
                className="w-full h-11 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Terminer la configuration"}
              </button>
            </form>
          </div>
        )}

        {/* --- ETAPE 3 : Succès --- */}
        {success && (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Compte Maître Créé</h2>
            <p className="text-slate-500 text-sm">Le super administrateur est prêt. Ouverture automatique du système...</p>
          </div>
        )}

      </div>
    </div>
  )
}
