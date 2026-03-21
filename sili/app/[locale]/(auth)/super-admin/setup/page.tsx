'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ShieldCheck, Loader2 } from 'lucide-react'

export default function SuperAdminSignup() {
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 1. Inscription classique
    const { error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // 2. Élévation immédiate des droits via RPC sécurisée
    const { error: rpcError } = await supabase.rpc('setup_first_superadmin', { target_email: email })

    if (rpcError) {
      console.error(rpcError)
      setError("Le compte a été créé, mais l'affectation du rôle Super Admin a échoué.")
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    
    // Redirection automatique vers le login
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  if (success) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
          <ShieldCheck className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white mb-2">Compte Super Admin Créé !</h2>
          <p className="text-slate-400">Le compte de gestion maître a été activé avec succès. Vous allez être redirigé vers la page de connexion.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-slate-950">
      <LanguageSwitcher />
      <div className="mx-4 sm:mx-0 w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="relative h-16 w-48 mb-4 opacity-90">
            <Image 
              src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/logo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvbG9nby53ZWJwIiwiaWF0IjoxNzc0MTA0NzQ5LCJleHAiOjMzMjc4NTY4NzQ5fQ.M17asTuCg79nEU3YWlxMl_UA4ROorgdC27SPSl46OUY" 
              alt="SILI Logo" 
              fill 
              sizes="200px"
              className="object-contain brightness-0 invert" 
              priority 
              unoptimized
            />
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Setup Super Admin</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1 text-center">Création du compte maître du SaaS</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none text-slate-300" htmlFor="nom">
              Nom complet
            </label>
            <input
              id="nom"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none text-slate-300" htmlFor="email">
              Email Administrateur
            </label>
            <input
              id="email"
              type="email"
              required
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none text-slate-300" htmlFor="password">
              Mot de passe sécurisé
            </label>
            <input
              id="password"
              type="password"
              required
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-red-400">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Créer le compte Maître
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
