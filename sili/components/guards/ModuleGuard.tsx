import { usePermission } from '@/hooks/usePermission'
import type { ModuleKey, PermissionLevel } from '@/hooks/usePermission'
import React from 'react'

interface ModuleGuardProps {
  module: ModuleKey
  required?: PermissionLevel
  societeId?: string
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function ModuleGuard({
  module,
  required = 'lecteur',
  societeId,
  fallback = null,
  children,
}: ModuleGuardProps) {
  const { hasAtLeast } = usePermission(module, societeId)

  if (!hasAtLeast(required)) return <>{fallback}</>
  return <>{children}</>
}
