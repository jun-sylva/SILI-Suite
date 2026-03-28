'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { toast } from 'sonner'
import {
  Loader2, ClipboardList, CheckCircle2, XCircle, Eye, Trash2, X, GitBranch,
  Download, UsersRound, AlertTriangle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Statut = 'en_attente' | 'assigne' | 'approuve' | 'refuse'
type Priorite = 'basse' | 'normale' | 'haute' | 'urgente'
type TypeDemande = 'materiel_it' | 'finance' | 'formation' | 'deplacement' | 'rh' | 'autre'

interface WorkflowRequest {
  id: string
  titre: string
  type_demande: TypeDemande
  description: string | null
  statut: Statut
  priorite: Priorite
  assigned_to: string | null
  assigned_to_group: string | null
  justificatif_path: string | null
  created_at: string
  created_profile?: { full_name: string | null } | null
  // flag interne — non issu de Supabase directement
  via_group?: boolean
}

interface WorkflowComment {
  id: string
  action: string | null
  contenu: string
  created_at: string
  author_profile?: { full_name: string | null } | null
}

// ── Badges ─────────────────────────────────────────────────────────────────

const STATUT_STYLES: Record<Statut, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  assigne:    'bg-blue-100 text-blue-700',
  approuve:   'bg-emerald-100 text-emerald-700',
  refuse:     'bg-red-100 text-red-700',
}

const PRIORITE_STYLES: Record<Priorite, string> = {
  basse:    'bg-slate-100 text-slate-500',
  normale:  'bg-sky-100 text-sky-700',
  haute:    'bg-orange-100 text-orange-700',
  urgente:  'bg-red-100 text-red-700',
}

// ── Composant principal ────────────────────────────────────────────────────

export default function AssigneesPage() {
  const t = useTranslations('workflow')
  const params = useParams()
  const router = useRouter()
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string

  const [requests, setRequests]               = useState<WorkflowRequest[]>([])
  const [loading, setLoading]                 = useState(true)
  const [accessDenied, setAccessDenied]       = useState(false)
  const [currentUserId, setCurrentUserId]     = useState('')
  const [currentTenantId, setCurrentTenantId] = useState('')
  const [isAdmin, setIsAdmin]                 = useState(false)
  // IDs des groupes dont l'utilisateur est manager
  const [managerGroupIds, setManagerGroupIds] = useState<string[]>([])

  // Modal détail
  const [detailRequest, setDetailRequest]     = useState<WorkflowRequest | null>(null)
  const [comments, setComments]               = useState<WorkflowComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)

  // Modal action (approuver / refuser)
  const [actionTarget, setActionTarget]   = useState<{ id: string; type: 'approuve' | 'refuse' } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Modal suppression
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // Conflit Realtime
  const [conflictRequestId, setConflictRequestId] = useState<string | null>(null)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadRequests = useCallback(async (uid: string, adminMode: boolean, groupIds: string[]) => {
    const baseSelect = `
      id, titre, type_demande, description, statut, priorite,
      assigned_to, assigned_to_group, justificatif_path, created_at,
      created_profile:created_by(full_name)
    `

    if (adminMode) {
      // Admin / tenant_admin : toutes les requêtes de la société
      const { data } = await supabase
        .from('workflow_requests')
        .select(baseSelect)
        .eq('societe_id', societeId)
        .order('created_at', { ascending: false })
      setRequests((data as WorkflowRequest[]) ?? [])
    } else {
      // Gestionnaire : requêtes directement assignées + requêtes de ses groupes
      const [directRes, groupRes] = await Promise.all([
        supabase
          .from('workflow_requests')
          .select(baseSelect)
          .eq('societe_id', societeId)
          .eq('assigned_to', uid)
          .order('created_at', { ascending: false }),
        groupIds.length > 0
          ? supabase
              .from('workflow_requests')
              .select(baseSelect)
              .eq('societe_id', societeId)
              .in('assigned_to_group', groupIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      const direct: WorkflowRequest[] = (directRes.data as WorkflowRequest[]) ?? []
      const viaGroup: WorkflowRequest[] = ((groupRes.data ?? []) as WorkflowRequest[])
        .map(r => ({ ...r, via_group: true }))

      // Merge + déduplique (une requête peut être dans les deux si l'assigné est aussi dans le groupe)
      const seen = new Set<string>()
      const merged: WorkflowRequest[] = []
      for (const r of [...direct, ...viaGroup]) {
        if (!seen.has(r.id)) { seen.add(r.id); merged.push(r) }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setRequests(merged)
    }

    setLoading(false)
  }, [societeId])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id
      setCurrentUserId(uid)

      const { data: profile } = await supabase
        .from('profiles').select('role, tenant_id').eq('id', uid).single()
      if (!profile) return
      const tid = profile.tenant_id
      setCurrentTenantId(tid)

      const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'

      if (!isTenantAdmin) {
        const perm = await fetchEffectiveModulePerm(uid, societeId, 'workflow')
        if (perm !== 'gestionnaire' && perm !== 'admin') {
          setAccessDenied(true)
          setLoading(false)
          return
        }
        setIsAdmin(perm === 'admin')

        // Charger les groupes dont l'utilisateur est manager
        const { data: groupMemberships } = await supabase
          .from('user_group_members')
          .select('group_id')
          .eq('user_id', uid)
          .eq('role', 'manager')
        const gIds = (groupMemberships ?? []).map((m: any) => m.group_id)
        setManagerGroupIds(gIds)

        await loadRequests(uid, false, gIds)
      } else {
        setIsAdmin(true)
        await loadRequests(uid, true, [])
      }
    }
    init()
  }, [societeId, loadRequests])

  // ── Realtime conflict detection ───────────────────────────────────────────

  useEffect(() => {
    if (!actionTarget) {
      // Unsubscribe quand le modal se ferme
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
      return
    }

    const channel = supabase
      .channel(`conflict-${actionTarget.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_requests',
          filter: `id=eq.${actionTarget.id}`,
        },
        (payload) => {
          const newRecord = payload.new as { statut: Statut; approved_by?: string; refused_by?: string }
          const wasHandledByOther =
            (newRecord.approved_by && newRecord.approved_by !== currentUserId) ||
            (newRecord.refused_by  && newRecord.refused_by  !== currentUserId)
          if (wasHandledByOther && (newRecord.statut === 'approuve' || newRecord.statut === 'refuse')) {
            setConflictRequestId(actionTarget.id)
            setActionTarget(null)
          }
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      realtimeChannelRef.current = null
    }
  }, [actionTarget, currentUserId])

  // ── Action approuver / refuser ────────────────────────────────────────────

  async function handleAction() {
    if (!actionTarget) return
    setActionLoading(true)
    try {
      const now = new Date().toISOString()
      const update: Record<string, unknown> = {
        statut: actionTarget.type,
        updated_at: now,
      }
      if (actionTarget.type === 'approuve') {
        update.approved_by = currentUserId
        update.approved_at = now
      } else {
        update.refused_by = currentUserId
        update.refused_at = now
      }

      const { error: updateErr } = await supabase
        .from('workflow_requests')
        .update(update)
        .eq('id', actionTarget.id)
      if (updateErr) throw updateErr

      await supabase.from('workflow_comments').insert({
        request_id: actionTarget.id,
        tenant_id:  currentTenantId,
        author_id:  currentUserId,
        action:     actionTarget.type,
        contenu:    actionComment.trim() || (actionTarget.type === 'approuve' ? t('action_approuve') : t('action_refuse')),
      })

      toast.success(actionTarget.type === 'approuve' ? t('toast_approved') : t('toast_refused'))
      setActionTarget(null)
      setActionComment('')
      setRequests(prev => prev.map(r =>
        r.id === actionTarget.id ? { ...r, statut: actionTarget.type } : r
      ))
    } catch {
      toast.error(t('toast_error'))
    } finally {
      setActionLoading(false)
    }
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  async function openDetail(req: WorkflowRequest) {
    setDetailRequest(req)
    setLoadingComments(true)
    const { data } = await supabase
      .from('workflow_comments')
      .select('id, action, contenu, created_at, author_profile:author_id(full_name)')
      .eq('request_id', req.id)
      .order('created_at', { ascending: true })
    setComments((data as WorkflowComment[]) ?? [])
    setLoadingComments(false)
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('workflow_requests').delete().eq('id', deleteTarget)
      if (error) throw error
      toast.success(t('toast_deleted'))
      setDeleteTarget(null)
      setRequests(prev => prev.filter(r => r.id !== deleteTarget))
    } catch {
      toast.error(t('toast_error'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Refresh après conflit ──────────────────────────────────────────────────

  async function refreshAfterConflict() {
    setConflictRequestId(null)
    setLoading(true)
    await loadRequests(currentUserId, isAdmin, managerGroupIds)
  }

  // ── Justificatif visible : assigné direct OU membre manager du groupe ─────

  function canSeeJustificatif(req: WorkflowRequest): boolean {
    if (req.assigned_to === currentUserId) return true
    if (req.assigned_to_group && managerGroupIds.includes(req.assigned_to_group)) return true
    if (isAdmin) return true
    return false
  }

  // ── Accès refusé ─────────────────────────────────────────────────────────

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-slate-100 p-4 rounded-2xl mb-4">
          <ClipboardList className="h-10 w-10 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">{t('acces_refuse_assignees')}</p>
        <button
          onClick={() => router.push(`/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`)}
          className="mt-4 text-indigo-600 text-sm font-medium hover:underline"
        >
          ← Retour au tableau de bord
        </button>
      </div>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-purple-500" />
          {t('nav_assignees')}
        </h1>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GitBranch className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{t('empty_assignees')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_titre')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_soumis_par')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_type')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_priorite')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[180px]">
                      <div className="flex items-start gap-1.5">
                        <span className="truncate">{req.titre}</span>
                        {req.via_group && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full">
                            <UsersRound className="h-2.5 w-2.5" />
                            {t('badge_groupe')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{req.created_profile?.full_name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500">{t(`type_${req.type_demande}`)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${PRIORITE_STYLES[req.priorite]}`}>
                        {t(`priorite_${req.priorite}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_STYLES[req.statut]}`}>
                        {t(`statut_${req.statut}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">
                      {new Date(req.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetail(req)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('btn_voir')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(req.statut === 'assigne' || req.statut === 'en_attente') && (
                          <>
                            <button
                              onClick={() => setActionTarget({ id: req.id, type: 'approuve' })}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title={t('btn_approuver')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setActionTarget({ id: req.id, type: 'refuse' })}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('btn_refuser')}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {req.assigned_to === currentUserId && (
                          <button
                            onClick={() => setDeleteTarget(req.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('btn_supprimer')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal détail ────────────────────────────────────────────────────── */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-bold text-slate-800">{t('modal_title_detail')}</h2>
              <button onClick={() => setDetailRequest(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-400 mb-1">{t('col_titre')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{detailRequest.titre}</p>
                  {detailRequest.via_group && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full">
                      <UsersRound className="h-2.5 w-2.5" />
                      {t('assigned_via_group')}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('col_type')}</p>
                  <p className="text-sm text-slate-700">{t(`type_${detailRequest.type_demande}`)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('col_priorite')}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${PRIORITE_STYLES[detailRequest.priorite]}`}>
                    {t(`priorite_${detailRequest.priorite}`)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('col_statut')}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_STYLES[detailRequest.statut]}`}>
                    {t(`statut_${detailRequest.statut}`)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">{t('submitted_by')}</p>
                <p className="text-sm text-slate-700">{detailRequest.created_profile?.full_name ?? '—'}</p>
              </div>
              {detailRequest.description && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('field_description')}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailRequest.description}</p>
                </div>
              )}

              {/* Justificatif — visible par l'assigné direct ou manager du groupe */}
              {detailRequest.justificatif_path && canSeeJustificatif(detailRequest) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('field_justificatif')}</p>
                  <button
                    onClick={async () => {
                      const { data } = await supabase.storage.from('sili-files')
                        .createSignedUrl(detailRequest.justificatif_path!, 60)
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('justificatif_download')}
                  </button>
                </div>
              )}

              {/* Historique */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('historique_title')}</p>
                {loadingComments ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">{t('historique_empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-1.5 bg-slate-200 rounded-full mt-1 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-600">
                            {c.author_profile?.full_name ?? '—'}
                            {c.action && <span className="ml-2 font-normal text-slate-400">· {t(`action_${c.action}`)}</span>}
                          </p>
                          <p className="text-sm text-slate-700 mt-0.5">{c.contenu}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{new Date(c.created_at).toLocaleString('fr-FR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions rapides depuis le détail */}
              {(detailRequest.statut === 'assigne' || detailRequest.statut === 'en_attente') && (
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setDetailRequest(null); setActionTarget({ id: detailRequest.id, type: 'approuve' }) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('btn_approuver')}
                  </button>
                  <button
                    onClick={() => { setDetailRequest(null); setActionTarget({ id: detailRequest.id, type: 'refuse' }) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    {t('btn_refuser')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal approuver / refuser ───────────────────────────────────────── */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {actionTarget.type === 'approuve' ? t('modal_title_approve') : t('modal_title_refuse')}
              </h2>
              <button onClick={() => setActionTarget(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_commentaire')}</label>
                <textarea
                  value={actionComment}
                  onChange={e => setActionComment(e.target.value)}
                  placeholder={t('field_commentaire_placeholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActionTarget(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t('btn_annuler')}
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionTarget.type === 'approuve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {actionTarget.type === 'approuve' ? t('btn_approuver') : t('btn_refuser')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ───────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-50 p-2.5 rounded-xl">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="font-bold text-slate-800">{t('modal_title_delete')}</h2>
            </div>
            <p className="text-sm text-slate-500">{t('confirm_delete_desc')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {t('btn_annuler')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup conflit Realtime ───────────────────────────────────────────── */}
      {conflictRequestId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-amber-50 p-2.5 rounded-xl shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{t('conflict_title')}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('conflict_body')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConflictRequestId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {t('conflict_btn_close')}
              </button>
              <button
                onClick={refreshAfterConflict}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {t('conflict_btn_refresh')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
