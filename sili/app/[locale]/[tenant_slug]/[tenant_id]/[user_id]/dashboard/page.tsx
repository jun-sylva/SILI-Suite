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
    async function fetchSocietes() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Fetch user specific companies for this tenant
      const { data, error } = await supabase
        .from('utilisateurs_societe')
        .select(`
          societe_id,
          societes (
            id,
            raison_sociale,
            devise,
            tenant_id
          )
        `)
        .eq('utilisateur_id', session.user.id)

      if (error) {
        console.error('Erreur chargement associations sociétés:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        setLoading(false)
        return
      }

      const formatted = data
        .filter((item: any) => item.societes.tenant_id === tenantId || (tenantId.length === 8 && item.societes.tenant_id.startsWith(tenantId)))
        .map((item: any) => ({
          id: item.societes.id,
          tenant_id: item.societes.tenant_id,
          raison_sociale: item.societes.raison_sociale,
          devise: item.societes.devise || 'XAF'
        }))

      setLocalSocietes(formatted)
      setSocietes(formatted)
      setLoading(false)
    }

    fetchSocietes()
  }, [tenantId, router, setSocietes])

  function handleSelect(societe: Societe) {
    setCurrentSociete(societe)
    const societeSlug = societe.raison_sociale.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    router.push(`/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societe.id}/dashboard`)
  }

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Espace de Travail</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez votre compte tenant et accédez à vos sociétés.</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Mes Sociétés</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm">
            <Plus className="h-4 w-4" />
            Nouvelle Société
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {societes.map((societe) => (
            <Card 
              key={societe.id} 
              className="group cursor-pointer hover:border-indigo-500 transition-all hover:shadow-md border-slate-200 rounded-2xl overflow-hidden" 
              onClick={() => handleSelect(societe)}
            >
              <CardHeader className="flex flex-row items-center gap-4 bg-slate-50/50 border-b border-slate-100">
                <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-slate-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
                  <Building2 className="h-6 w-6 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">{societe.raison_sociale}</CardTitle>
                  <CardDescription>Devise: {societe.devise}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex justify-between items-center bg-white">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actif</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </CardContent>
            </Card>
          ))}

          {societes.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Vous n'avez pas encore de société.</p>
              <p className="text-slate-400 text-sm mt-1">Créez votre première société pour commencer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
