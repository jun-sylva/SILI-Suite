import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'
export type ModuleKey = 'comptabilite' | 'vente' | 'achat' | 'stock' | 'rh' | 'crm' | 'teams' | 'workflow' | 'rapports' | 'securite' | 'sauvegarde' | 'presence'

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  aucun: 0,
  lecteur: 1,
  contributeur: 2,
  gestionnaire: 3,
  admin: 4,
}

export function usePermission(module: ModuleKey, societeId?: string) {
  const { data: permission = 'aucun' } = useQuery({
    queryKey: ['permission', module, societeId],
    queryFn: async () => {
      // 1. Vérification "Planétaire" (Super Admin)
      const { data: sysModule, error: sysError } = await supabase
        .from('sys_modules')
        .select('is_active')
        .eq('key', module)
        .maybeSingle()
        
      // Si le Super Admin a désactivé le module globalement, on coupe tout accès
      if (sysModule && !sysModule.is_active) {
        return 'aucun'
      }

      // 2. Vérification locale (Tenant / Société)
      const { data, error } = await supabase.rpc('get_user_permission', {
        p_module: module,
        p_societe_id: societeId ?? null,
      })
      if (error) return 'aucun'
      return data as PermissionLevel
    },
  })

  // @ts-ignore
  const level = PERMISSION_HIERARCHY[permission] || 0

  return {
    permission,
    canView: level >= 1,
    canCreate: level >= 2,
    canEdit: level >= 2,
    canDelete: level >= 3,
    canValidate: level >= 3,
    canConfigure: level >= 4,
    isAdmin: level >= 4,
    // Utilitaire
    hasAtLeast: (required: PermissionLevel) => level >= PERMISSION_HIERARCHY[required],
  }
}
