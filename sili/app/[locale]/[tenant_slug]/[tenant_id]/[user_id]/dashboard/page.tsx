'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSocieteStore, Societe } from '@/stores/societeStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Loader2, LayoutDashboard, Plus } from 'lucide-react'

export default function TenantDashboardPage() {
  const [societes, setLocalSocietes] = useState<Societe[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const { setSocietes, setCurrentSociete } = useSocieteStore()

  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Vérifier le rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') {
        // Rediriger vers une page d'erreur ou la première société accessible
        // Pour l'instant on bloque simplement ou on redirige vers le login
        console.warn("Accès refusé : rôle insuffisant pour l'espace tenant")
        router.push('/login') 
        return
      }

      setLoading(false)
    }
    checkSession()
  }, [router])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenue dans votre Espace de Travail</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez votre compte et préparez le lancement de vos activités.</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="grid gap-6">
        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Aucune société n'a encore été configurée</h2>
          <p className="text-slate-500 text-sm mt-1 mb-8 max-w-sm mx-auto">
            Commencez par créer votre première société pour accéder aux modules métier.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg">
            <Plus className="h-5 w-5" />
            Créer ma première société
          </button>
        </div>
      </div>
    </div>
  )
}
