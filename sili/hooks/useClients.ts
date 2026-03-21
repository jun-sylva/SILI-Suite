import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useSocieteStore } from '@/stores/societeStore'

export type VenteClient = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  solde_credit: number
  is_active: boolean
}

export function useClients() {
  const { currentSociete } = useSocieteStore()

  return useQuery({
    queryKey: ['clients', currentSociete?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vente_clients')
        .select('*')
        .eq('societe_id', currentSociete!.id)
        .order('nom')

      if (error) throw error
      return data as VenteClient[]
    },
    enabled: !!currentSociete,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { currentSociete } = useSocieteStore()

  return useMutation({
    mutationFn: async (data: Partial<VenteClient>) => {
      if (!currentSociete) throw new Error("Société non sélectionnée")
      const { data: client, error } = await supabase
        .from('vente_clients')
        .insert({ ...data, societe_id: currentSociete.id, tenant_id: currentSociete.tenant_id })
        .select()
        .single()

      if (error) throw error
      return client
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
