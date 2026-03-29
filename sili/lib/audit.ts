import { supabase } from '@/lib/supabase/client'

/**
 * Insère un log dans audit_logs (journal tenant).
 * Ne lance jamais d'erreur — les logs sont best-effort.
 */
export async function writeLog(params: {
  tenantId:     string
  userId:       string
  action:       string
  resourceType: string
  resourceId?:  string | null
  metadata?:    Record<string, unknown>
}) {
  await supabase.from('audit_logs').insert({
    tenant_id:     params.tenantId,
    user_id:       params.userId,
    action:        params.action,
    resource_type: params.resourceType,
    resource_id:   params.resourceId ?? null,
    metadata:      (params.metadata ?? {}) as import('@/lib/supabase/types').Json,
  }).then(() => { /* best-effort */ })
}
