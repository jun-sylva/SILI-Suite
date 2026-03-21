'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSocieteStore, Societe } from '@/stores/societeStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Loader2 } from 'lucide-react'

export default function CompanySelectPage() {
  const [societes, setLocalSocietes] = useState<Societe[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { setSocietes, setCurrentSociete } = useSocieteStore()

  useEffect(() => {
    async function fetchSocietes() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Fetch user specific companies
      const { data, error } = await supabase
        .from('user_societes')
        .select(`
          societe_id,
          tenant_id,
          societes (
            id,
            raison_sociale,
            devise
          )
        `)
        .eq('user_id', session.user.id)

      if (error || !data) {
        console.error('Erreur chargement sociétés:', error)
        setLoading(false)
        return
      }

      const formatted = data.map((item: any) => ({
        id: item.societes.id,
        tenant_id: item.tenant_id,
        raison_sociale: item.societes.raison_sociale,
        devise: item.societes.devise || 'XAF'
      }))

      setLocalSocietes(formatted)
      setSocietes(formatted)
      setLoading(false)

      // Auto-select if only 1 company
      if (formatted.length === 1) {
        handleSelect(formatted[0])
      }
    }

    fetchSocietes()
  }, [])

  function handleSelect(societe: Societe) {
    setCurrentSociete(societe)
    router.push('/dashboard')
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Sélectionnez une société</h1>
          <p className="text-muted-foreground mt-2">Choisissez l'espace de travail avec lequel vous souhaitez interagir.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {societes.map((societe) => (
            <Card key={societe.id} className="cursor-pointer hover:border-black transition-colors" onClick={() => handleSelect(societe)}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-zinc-100 flex items-center justify-center border">
                  <Building2 className="h-6 w-6 text-zinc-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{societe.raison_sociale}</CardTitle>
                  <CardDescription>Devise: {societe.devise}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}

          {societes.length === 0 && (
            <div className="col-span-full text-center py-10 bg-white rounded-lg border">
              Vous n'êtes assigné à aucune société. Contactez votre administrateur.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
