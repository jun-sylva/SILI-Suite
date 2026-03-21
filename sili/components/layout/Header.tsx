'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User, Menu } from 'lucide-react'
import { useSocieteStore } from '@/stores/societeStore'

export function Header({ setIsMobileOpen }: { setIsMobileOpen?: (val: boolean) => void }) {
  const router = useRouter()
  const { currentSociete } = useSocieteStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex shrink-0 h-16 w-full items-center justify-center border-b bg-white shadow-sm z-10">
      <div className="mx-auto flex w-full max-w-[2000px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileOpen?.(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Breadcrumb ou société active par exemple */}
          {currentSociete ? (
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800 border">
              🏢 <span className="hidden sm:inline">{currentSociete.raison_sociale}</span>
            </div>
        ) : (
          <div className="text-sm text-zinc-500 italic">Aucune société sélectionnée</div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push('/profile')}
          className="p-2 rounded-full hover:bg-zinc-100 transition-colors"
          title="Mon profil"
        >
          <User className="h-5 w-5 text-zinc-600" />
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 p-2 rounded-md hover:bg-red-50 text-red-600 font-medium text-sm transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
      </div>
    </header>
  )
}
