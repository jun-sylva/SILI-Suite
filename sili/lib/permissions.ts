import { supabase } from '@/lib/supabase/client'

export type PermissionLevel = 'aucun' | 'lecteur' | 'contributeur' | 'gestionnaire' | 'admin'

export const PERM_RANK: Record<PermissionLevel, number> = {
  aucun:        0,
  lecteur:      1,
  contributeur: 2,
  gestionnaire: 3,
  admin:        4,
}

const RANK_TO_PERM: PermissionLevel[] = ['aucun', 'lecteur', 'contributeur', 'gestionnaire', 'admin']

/**
 * Résolution effective :
 *   MAX(permission individuelle via RPC, permission max des groupes de l'utilisateur)
 *
 * La permission individuelle ne peut jamais être réduite par un groupe.
 */
export async function getEffectivePermission(
  module: string,
  societeId: string,
): Promise<PermissionLevel> {
  // ── 1. Permission individuelle (via RPC existant) ───────────────────────
  const { data: indivRaw, error: indivErr } = await supabase.rpc('get_user_permission', {
    p_module:     module,
    p_societe_id: societeId,
  })
  const indivLevel: PermissionLevel = indivErr ? 'aucun' : ((indivRaw as PermissionLevel) ?? 'aucun')

  // ── 2. Groupes de l'utilisateur ─────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return indivLevel

  const { data: memberships } = await supabase
    .from('user_group_members')
    .select('group_id')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) return indivLevel

  // ── 3. Permissions des groupes pour ce module + société ─────────────────
  const groupIds = memberships.map((m: any) => m.group_id)
  const { data: groupPerms } = await supabase
    .from('user_group_permissions')
    .select('permission')
    .in('group_id', groupIds)
    .eq('societe_id', societeId)
    .eq('module', module)

  let groupMax = 0
  groupPerms?.forEach((p: any) => {
    const rank = PERM_RANK[p.permission as PermissionLevel] ?? 0
    if (rank > groupMax) groupMax = rank
  })

  // ── 4. MAX(individuel, groupe) ───────────────────────────────────────────
  const effectiveRank = Math.max(PERM_RANK[indivLevel], groupMax)
  return RANK_TO_PERM[effectiveRank]
}
