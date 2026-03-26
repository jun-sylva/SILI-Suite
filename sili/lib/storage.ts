/**
 * Utilitaires de stockage multi-tenant — SILI Suite
 *
 * Bucket : sili-files
 * Structure des chemins :
 *   {tenant_id}/societes/{societe_id}/{category}/{filename}
 *   {tenant_id}/backups/{filename}
 *   {tenant_id}/shared/{filename}
 *
 * La RLS Supabase garantit l'isolation par tenant_id.
 */

import { supabase } from '@/lib/supabase/client'

export type StorageCategory = 'documents' | 'exports' | 'imports'

const BUCKET = 'sili-files'

// ── Helpers chemins ────────────────────────────────────────────────────────

export function societeFilePath(
  tenantId: string,
  societeId: string,
  category: StorageCategory,
  filename: string
): string {
  return `${tenantId}/societes/${societeId}/${category}/${filename}`
}

export function backupFilePath(tenantId: string, filename: string): string {
  return `${tenantId}/backups/${filename}`
}

export function sharedFilePath(tenantId: string, filename: string): string {
  return `${tenantId}/shared/${filename}`
}

/** Génère un nom de fichier unique en préfixant par un timestamp */
export function uniqueFilename(originalName: string): string {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : ''
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${Date.now()}_${base}${ext ? '.' + ext : ''}`
}

// ── Upload ─────────────────────────────────────────────────────────────────

interface UploadOptions {
  upsert?: boolean
  contentType?: string
}

interface UploadResult {
  path: string
  error: string | null
}

/**
 * Upload un fichier dans le bucket sili-files.
 * Le suivi du stockage est mis à jour automatiquement via trigger Supabase.
 */
export async function uploadFile(
  path: string,
  file: File | Blob | ArrayBuffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: options.upsert ?? false,
      contentType: options.contentType,
    })

  if (error) return { path: '', error: error.message }
  return { path: data.path, error: null }
}

// ── Suppression ────────────────────────────────────────────────────────────

/**
 * Supprime un ou plusieurs fichiers du bucket.
 * Le suivi du stockage est mis à jour automatiquement via trigger Supabase.
 */
export async function deleteFiles(paths: string[]): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) return { error: error.message }
  return { error: null }
}

// ── URL publique / signée ──────────────────────────────────────────────────

/**
 * Génère une URL signée (accès temporaire, durée en secondes).
 * Par défaut 1 heure.
 */
export async function getSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds)

  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}

// ── Quota ─────────────────────────────────────────────────────────────────

interface StorageUsage {
  files_mb: number
  database_mb: number
  logs_mb: number
  backups_mb: number
  total_mb: number
}

/**
 * Lit l'utilisation du stockage pour le tenant courant depuis tenant_storage_summary.
 */
export async function getStorageUsage(tenantId: string): Promise<StorageUsage | null> {
  const { data, error } = await supabase
    .from('tenant_storage_summary')
    .select('files_mb, database_mb, logs_mb, backups_mb, total_mb')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return null
  return {
    files_mb:    Number(data.files_mb),
    database_mb: Number(data.database_mb),
    logs_mb:     Number(data.logs_mb),
    backups_mb:  Number(data.backups_mb),
    total_mb:    Number(data.total_mb),
  }
}

/**
 * Vérifie si le tenant peut encore uploader `fileSizeBytes` octets
 * sans dépasser son quota `maxStorageGb`.
 */
export async function checkStorageQuota(
  tenantId: string,
  maxStorageGb: number,
  fileSizeBytes: number
): Promise<{ allowed: boolean; usedMb: number; limitMb: number }> {
  const usage = await getStorageUsage(tenantId)
  const usedMb  = usage?.total_mb ?? 0
  const limitMb = maxStorageGb * 1024
  const fileMb  = fileSizeBytes / 1048576

  return {
    allowed: usedMb + fileMb <= limitMb,
    usedMb,
    limitMb,
  }
}
