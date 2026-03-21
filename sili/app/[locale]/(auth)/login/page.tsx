'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { SuperAdminModal } from '@/components/auth/SuperAdminModal'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations('login')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showAdminModal, setShowAdminModal] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-indigo-50/30">
      <LanguageSwitcher />
      <div className="mx-4 sm:mx-0 w-full max-w-sm rounded-xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-lg shadow-indigo-100/50">
        <div className="mb-8 flex flex-col items-center">
          <div className="relative h-16 w-48 mb-4">
            <Image 
              src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/logo.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvbG9nby53ZWJwIiwiaWF0IjoxNzc0MTA0NzQ5LCJleHAiOjMzMjc4NTY4NzQ5fQ.M17asTuCg79nEU3YWlxMl_UA4ROorgdC27SPSl46OUY" 
              alt="SILI Logo" 
              fill 
              sizes="200px"
              className="object-contain" 
              priority 
              unoptimized
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none" htmlFor="email">
              {t('email_label')}
            </label>
            <input
              id="email"
              type="email"
              placeholder={t('email_placeholder')}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                {t('password_label')}
              </label>
            </div>
            <input
              id="password"
              type="password"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            {error ? t('submit_retry') : t('submit_button')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm border-t border-slate-100 pt-6">
          <span className="text-slate-500">{t('need_account')}</span>{' '}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
            {t('create_account')} &rarr;
          </Link>
        </div>
      </div>

      {/* Coin bas gauche : Accès Super Admin (Invisible sur mobile) */}
      <div className="fixed bottom-4 left-4 z-50 hidden md:block group">
        <button 
          onClick={() => setShowAdminModal(true)}
          className="text-slate-300 hover:text-slate-900 transition-colors text-xs font-semibold cursor-pointer outline-none focus:text-slate-900"
        >
          Admin
        </button>
      </div>

      {/* Modal d'inscription caché */}
      <SuperAdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
    </div>
  )
}
