'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Loader2, FileText, X, Trash2, Eye, GitBranch, Download, Paperclip, UsersRound,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Statut = 'en_attente' | 'assigne' | 'approuve' | 'refuse'
type Priorite = 'basse' | 'normale' | 'haute' | 'urgente'
type TypeDemande = 'materiel_it' | 'finance' | 'formation' | 'deplacement' | 'rh' | 'autre'
type AssignType = 'individual' | 'group'

interface WorkflowRequest {
  id: string
  titre: string
  type_demande: TypeDemande
  description: string | null
  statut: Statut
  priorite: Priorite
  assigned_to: string | null
  assigned_to_group: string | null
  assigned_profile?: { full_name: string | null } | null
  assigned_group?: { nom: string } | null
  justificatif_path: string | null
  created_at: string
}

interface WorkflowComment {
  id: string
  action: string | null
  contenu: string
  created_at: string
  author_profile?: { full_name: string | null } | null
}

interface Gestionnaire {
  id: string
  full_name: string | null
}

interface UserGroup {
  id: string
  nom: string
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

const TYPES: TypeDemande[] = ['materiel_it', 'finance', 'formation', 'deplacement', 'rh', 'autre']
const PRIORITES: Priorite[] = ['basse', 'normale', 'haute', 'urgente']

// ── Composant principal ────────────────────────────────────────────────────

export default function MesRequetesPage() {
  const t = useTranslations('workflow')
  const params = useParams()
  const societeId = params.societe_id as string

  const [requests, setRequests]           = useState<WorkflowRequest[]>([])
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([])
  const [groups, setGroups]               = useState<UserGroup[]>([])
  const [loading, setLoading]             = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentTenantId, setCurrentTenantId] = useState<string>('')

  // Modal création
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [assignType, setAssignType] = useState<AssignType>('individual')
  const [form, setForm] = useState({
    titre: '', type_demande: 'autre' as TypeDemande, description: '',
    priorite: 'normale' as Priorite, assigned_to: '', assigned_to_group: '',
  })
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null)
  const [fileError, setFileError]               = useState<string>('')

  // Modal détail
  const [detailRequest, setDetailRequest] = useState<WorkflowRequest | null>(null)
  const [comments, setComments]           = useState<WorkflowComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)

  // Modal suppression
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadRequests = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('workflow_requests')
      .select(`
        id, titre, type_demande, description, statut, priorite,
        assigned_to, assigned_to_group, justificatif_path, created_at,
        assigned_profile:assigned_to(full_name),
        assigned_group:assigned_to_group(nom)
      `)
      .eq('created_by', userId)
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
    setRequests((data as WorkflowRequest[]) ?? [])
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

      // Charger les gestionnaires de cette société
      const { data: userPerms } = await supabase
        .from('user_module_permissions')
        .select('user_id, permission')
        .eq('societe_id', societeId)
        .eq('module', 'workflow')
        .in('permission', ['gestionnaire', 'admin'])

      if (userPerms && userPerms.length > 0) {
        const ids = userPerms.map(p => p.user_id)
        const { data: gProfiles } = await supabase
          .from('profiles').select('id, full_name').in('id', ids)
        setGestionnaires(gProfiles?.filter(p => p.id !== uid) ?? [])
      }

      // Charger uniquement les groupes avec permission gestionnaire/admin sur le module workflow
      const { data: groupPerms } = await supabase
        .from('user_group_permissions')
        .select('group_id')
        .eq('societe_id', societeId)
        .eq('module', 'workflow')
        .in('permission', ['gestionnaire', 'admin'])

      const groupIds = groupPerms?.map(p => p.group_id) ?? []
      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('user_groups')
          .select('id, nom')
          .in('id', groupIds)
          .order('nom', { ascending: true })
        setGroups(groupsData ?? [])
      } else {
        setGroups([])
      }

      await loadRequests(uid)
    }
    init()
  }, [societeId, loadRequests])

  // ── Création ──────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('')
    const file = e.target.files?.[0] ?? null
    if (file && file.size > 5 * 1024 * 1024) {
      setFileError(t('field_justificatif_hint'))
      e.target.value = ''
      return
    }
    setJustificatifFile(file)
  }

  function resetCreateModal() {
    setShowCreate(false)
    setAssignType('individual')
    setForm({ titre: '', type_demande: 'autre', description: '', priorite: 'normale', assigned_to: '', assigned_to_group: '' })
    setJustificatifFile(null)
    setFileError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) return
    setCreating(true)
    try {
      const hasAssignment = assignType === 'individual' ? !!form.assigned_to : !!form.assigned_to_group

      // 1. Créer la requête
      const { data: inserted, error } = await supabase
        .from('workflow_requests')
        .insert({
          tenant_id:         currentTenantId,
          societe_id:        societeId,
          titre:             form.titre.trim(),
          type_demande:      form.type_demande,
          description:       form.description.trim() || null,
          priorite:          form.priorite,
          statut:            hasAssignment ? 'assigne' : 'en_attente',
          assigned_to:       assignType === 'individual' ? (form.assigned_to || null) : null,
          assigned_to_group: assignType === 'group' ? (form.assigned_to_group || null) : null,
          created_by:        currentUserId,
        })
        .select('id')
        .single()
      if (error) throw error

      // 2. Upload du justificatif si présent
      if (justificatifFile && inserted?.id) {
        const ext = justificatifFile.name.split('.').pop()
        const path = `${currentTenantId}/societes/${societeId}/workflow/${inserted.id}/justificatif_${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('sili-files')
          .upload(path, justificatifFile, { upsert: false })
        if (uploadError) {
          toast.error(t('toast_upload_error'))
        } else {
          await supabase.from('workflow_requests')
            .update({ justificatif_path: path })
            .eq('id', inserted.id)
        }
      }

      toast.success(t('toast_created'))
      resetCreateModal()
      await loadRequests(currentUserId)
    } catch {
      toast.error(t('toast_error'))
    } finally {
      setCreating(false)
    }
  }

  // ── Détail + commentaires ─────────────────────────────────────────────────

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

  // ── Helper: nom d'assignation ─────────────────────────────────────────────

  function getAssigneeName(req: WorkflowRequest): string {
    if (req.assigned_group?.nom) return req.assigned_group.nom
    if (req.assigned_profile?.full_name) return req.assigned_profile.full_name
    return '—'
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" />
          {t('nav_mes_requetes')}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('btn_nouvelle_requete')}
        </button>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GitBranch className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{t('empty_mes_requetes')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 text-indigo-600 text-sm font-medium hover:underline"
          >
            {t('btn_nouvelle_requete')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_titre')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_type')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_priorite')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_assigne_a')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_date')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{req.titre}</td>
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
                    <td className="px-4 py-3.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {req.assigned_to_group && <UsersRound className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                        <span>{getAssigneeName(req)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">
                      {new Date(req.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetail(req)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={t('btn_voir')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
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

      {/* ── Modal création ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-bold text-slate-800">{t('modal_title_new')}</h2>
              <button onClick={resetCreateModal} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_titre')} *</label>
                <input
                  type="text"
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder={t('field_titre_placeholder')}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Type + Priorité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_type')}</label>
                  <select
                    value={form.type_demande}
                    onChange={e => setForm(f => ({ ...f, type_demande: e.target.value as TypeDemande }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TYPES.map(type => (
                      <option key={type} value={type}>{t(`type_${type}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_priorite')}</label>
                  <select
                    value={form.priorite}
                    onChange={e => setForm(f => ({ ...f, priorite: e.target.value as Priorite }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PRIORITES.map(p => (
                      <option key={p} value={p}>{t(`priorite_${p}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_description')}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('field_description_placeholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Assignation — type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">{t('field_assign_to')}</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setAssignType('individual')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      assignType === 'individual'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {t('assign_type_individual')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignType('group')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      assignType === 'group'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {t('assign_type_group')}
                  </button>
                </div>

                {assignType === 'individual' ? (
                  <select
                    value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('select_gestionnaire')}</option>
                    {gestionnaires.length === 0 ? (
                      <option disabled>{t('no_gestionnaire')}</option>
                    ) : (
                      gestionnaires.map(g => (
                        <option key={g.id} value={g.id}>{g.full_name ?? g.id}</option>
                      ))
                    )}
                  </select>
                ) : (
                  <select
                    value={form.assigned_to_group}
                    onChange={e => setForm(f => ({ ...f, assigned_to_group: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('select_group')}</option>
                    {groups.length === 0 ? (
                      <option disabled>{t('no_group')}</option>
                    ) : (
                      groups.map(g => (
                        <option key={g.id} value={g.id}>{g.nom}</option>
                      ))
                    )}
                  </select>
                )}
              </div>

              {/* Justificatif */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('field_justificatif')}
                </label>
                <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-500 truncate">
                    {justificatifFile ? justificatifFile.name : t('field_justificatif_hint')}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.odt,.rtf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
                {justificatifFile && (
                  <button
                    type="button"
                    onClick={() => setJustificatifFile(null)}
                    className="text-xs text-slate-400 hover:text-red-500 mt-1"
                  >
                    × Retirer le fichier
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetCreateModal}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t('btn_annuler')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t('btn_soumettre')}
                </button>
              </div>
            </form>
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
                <p className="font-semibold text-slate-800">{detailRequest.titre}</p>
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
              {detailRequest.description && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('field_description')}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailRequest.description}</p>
                </div>
              )}
              {(detailRequest.assigned_profile?.full_name || detailRequest.assigned_group?.nom) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('assigned_to')}</p>
                  <div className="flex items-center gap-1.5">
                    {detailRequest.assigned_to_group && <UsersRound className="h-3.5 w-3.5 text-indigo-400" />}
                    <p className="text-sm text-slate-700">{getAssigneeName(detailRequest)}</p>
                  </div>
                </div>
              )}

              {/* Justificatif — visible par le créateur (cette page) */}
              {detailRequest.justificatif_path && (
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
    </div>
  )
}
