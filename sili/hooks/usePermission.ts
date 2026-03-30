import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { getEffectivePermission } from '@/lib/permissions'

export type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'
export type ModuleKey = 'comptabilite' | 'vente' | 'achat' | 'stock' | 'rh' | 'crm' | 'teams' | 'workflow' | 'rapports' | 'sauvegarde' | 'presence' | 'planning'

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  aucun:        0,
  lecteur:      1,
  contributeur: 2,
  gestionnaire: 3,
  admin:        4,
}

export function usePermission(module: ModuleKey, societeId?: string) {
  const { data: permission = 'aucun' } = useQuery({
    queryKey: ['permission', module, societeId],
    queryFn: async () => {
      // 1. Vérification globale — module désactivé par le Master
      const { data: sysModule } = await supabase
        .from('sys_modules')
        .select('is_active')
        .eq('key', module)
        .maybeSingle()

      if (sysModule && !sysModule.is_active) return 'aucun'

      // 2. Permission effective = MAX(individuelle, groupes)
      if (!societeId) return 'aucun'
      return getEffectivePermission(module, societeId)
    },
  })

  const level = PERMISSION_HIERARCHY[permission as PermissionLevel] ?? 0

  return {
    permission,
    canView:      level >= 1,
    canCreate:    level >= 2,
    canEdit:      level >= 2,
    canDelete:    level >= 3,
    canValidate:  level >= 3,
    canConfigure: level >= 4,
    isAdmin:      level >= 4,
    hasAtLeast: (required: PermissionLevel) => level >= PERMISSION_HIERARCHY[required],
  }
}
