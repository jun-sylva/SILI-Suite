'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { toast } from 'sonner'
import {
  FolderKanban, Plus, Loader2, X, Pencil, Trash2,
  ChevronRight, ChevronDown, Flag, CalendarDays, LayoutList, Kanban,
  Users, Check,
} from 'lucide-react'
import { writeLog } from '@/lib/audit'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProjetStatut  = 'brouillon' | 'actif' | 'en_pause' | 'termine' | 'annule'
type TacheStatut   = 'todo' | 'en_cours' | 'revue' | 'fait'
type Priorite      = 'basse' | 'normale' | 'haute' | 'critique'

interface Projet {
  id:               string
  titre:            string
  description:      string | null
  statut:           ProjetStatut
  priorite:         Priorite
  couleur:          string
  date_debut:       string | null
  date_fin:         string | null
  responsable_id:   string | null
  responsable:      { full_name: string } | null
  taches_total:     number
  taches_faites:    number
}

interface AssigneeItem {
  id:     string
  user?:  { id: string; full_name: string }
  group?: { id: string; nom: string }
}

interface Tache {
  id:            string
  titre:         string
  statut:        TacheStatut
  priorite:      Priorite
  date_echeance: string | null
  assigne:       { full_name: string } | null
  assignes:      AssigneeItem[]
}

interface Jalon {
  id:         string
  titre:      string
  date_cible: string
  statut:     'en_attente' | 'atteint' | 'manque'
  assignes:   AssigneeItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUT_PROJET_LABELS: Record<ProjetStatut, string> = {
  brouillon: 'Brouillon', actif: 'Actif', en_pause: 'En pause', termine: 'Terminé', annule: 'Annulé',
}
const STATUT_PROJET_COLOR: Record<ProjetStatut, string> = {
  brouillon: 'bg-slate-100 text-slate-500',
  actif:     'bg-emerald-100 text-emerald-700',
  en_pause:  'bg-amber-100 text-amber-700',
  termine:   'bg-blue-100 text-blue-700',
  annule:    'bg-red-100 text-red-500',
}
const TACHE_COLS: { id: TacheStatut; label: string; color: string }[] = [
  { id: 'todo',     label: 'À faire',   color: 'bg-slate-50 border-slate-200'  },
  { id: 'en_cours', label: 'En cours',  color: 'bg-blue-50 border-blue-200'    },
  { id: 'revue',    label: 'En revue',  color: 'bg-amber-50 border-amber-200'  },
  { id: 'fait',     label: 'Terminé',   color: 'bg-emerald-50 border-emerald-200' },
]
const PRIORITE_COLOR: Record<Priorite, string> = {
  basse:    'bg-slate-100 text-slate-500',
  normale:  'bg-blue-100 text-blue-600',
  haute:    'bg-orange-100 text-orange-600',
  critique: 'bg-red-100 text-red-600',
}
const COULEURS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']

// ── AssigneeSelect ─────────────────────────────────────────────────────────────

function AssigneeSelect({
  users, groups, selectedUsers, selectedGroups, onToggleUser, onToggleGroup, placeholder,
}: {
  users:         { id: string; full_name: string }[]
  groups:        { id: string; nom: string }[]
  selectedUsers:  string[]
  selectedGroups: string[]
  onToggleUser:  (id: string) => void
  onToggleGroup: (id: string) => void
  placeholder:   string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const total = selectedUsers.length + selectedGroups.length
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Users className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-slate-500">{total > 0 ? `${total} assigné${total > 1 ? 's' : ''}` : placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-52 overflow-y-auto">
          {users.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 sticky top-0">Utilisateurs</div>
              {users.map(u => {
                const checked = selectedUsers.includes(u.id)
                return (
                  <button key={u.id} type="button" onClick={() => onToggleUser(u.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${checked ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <div className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>
                      {u.full_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{u.full_name}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                  </button>
                )
              })}
            </>
          )}
          {groups.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50 border-t border-slate-100 sticky top-0">Groupes</div>
              {groups.map(g => {
                const checked = selectedGroups.includes(g.id)
                return (
                  <button key={g.id} type="button" onClick={() => onToggleGroup(g.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${checked ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <div className={`h-6 w-6 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 ${checked ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>G</div>
                    <span className="flex-1 truncate">{g.nom}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                  </button>
                )
              })}
            </>
          )}
          {users.length === 0 && groups.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">Aucun accès planning configuré</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjetsPage() {
  const t         = useTranslations('planning')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [projets,       setProjets]       = useState<Projet[]>([])
  const [vue,           setVue]           = useState<'kanban' | 'liste'>('kanban')
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Drag-and-drop
  const [draggedProjetId,  setDraggedProjetId]  = useState<string | null>(null)
  const [dragOverCol,      setDragOverCol]      = useState<ProjetStatut | null>(null)

  // Modal projet
  const [showProjetModal, setShowProjetModal] = useState(false)
  const [editingProjet,   setEditingProjet]   = useState<Projet | null>(null)
  const [savingProjet,    setSavingProjet]     = useState(false)
  const [pTitre,     setPTitre]     = useState('')
  const [pDesc,      setPDesc]      = useState('')
  const [pStatut,    setPStatut]    = useState<ProjetStatut>('actif')
  const [pPriorite,  setPPriorite]  = useState<Priorite>('normale')
  const [pCouleur,   setPCouleur]   = useState('#6366f1')
  const [pDateDebut, setPDateDebut] = useState('')
  const [pDateFin,   setPDateFin]   = useState('')

  // Panneau détail
  const [detailProjet, setDetailProjet]   = useState<Projet | null>(null)
  const [taches,       setTaches]         = useState<Tache[]>([])
  const [jalons,       setJalons]         = useState<Jalon[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modal tâche rapide
  const [showTacheModal,  setShowTacheModal]  = useState(false)
  const [tacheStatutCible, setTacheStatutCible] = useState<TacheStatut>('todo')
  const [tTitre,    setTTitre]    = useState('')
  const [tPriorite, setTPriorite] = useState<Priorite>('normale')
  const [tEcheance, setTEcheance] = useState('')
  const [savingTache, setSavingTache] = useState(false)

  // Modal jalon
  const [showJalonModal, setShowJalonModal] = useState(false)
  const [jTitre,   setJTitre]   = useState('')
  const [jDate,    setJDate]    = useState('')
  const [savingJalon, setSavingJalon] = useState(false)

  // Assignation planning
  const [planningUsers,  setPlanningUsers]  = useState<{ id: string; full_name: string }[]>([])
  const [planningGroups, setPlanningGroups] = useState<{ id: string; nom: string }[]>([])
  const [tAssigneUsers,  setTAssigneUsers]  = useState<string[]>([])
  const [tAssigneGroups, setTAssigneGroups] = useState<string[]>([])
  const [jAssigneUsers,  setJAssigneUsers]  = useState<string[]>([])
  const [jAssigneGroups, setJAssigneGroups] = useState<string[]>([])

  // Détail tâche (post-création)
  const [selectedTache, setSelectedTache] = useState<Tache | null>(null)
  const [selectedJalon, setSelectedJalon] = useState<Jalon | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'

      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'planning')
        setCanManage(['gestionnaire', 'admin'].includes(perm))
        setCanDelete(perm === 'admin')
      } else {
        setCanManage(true)
        setCanDelete(true)
      }

      await loadProjets()
      await loadPlanningAccessors()
      setLoading(false)
    }
    init()
  }, [societeId])

  const loadPlanningAccessors = useCallback(async () => {
    const [{ data: userPerms }, { data: groupPerms }] = await Promise.all([
      (supabase as any)
        .from('user_module_permissions')
        .select('user_id, profile:profiles!user_id(id, full_name)')
        .eq('societe_id', societeId)
        .eq('module', 'planning')
        .neq('permission', 'aucun'),
      (supabase as any)
        .from('user_group_permissions')
        .select('group_id, grp:user_groups!group_id(id, nom)')
        .eq('societe_id', societeId)
        .eq('module', 'planning')
        .neq('permission', 'aucun'),
    ])
    setPlanningUsers(((userPerms ?? []) as any[]).map((p: any) => p.profile).filter(Boolean))
    setPlanningGroups(((groupPerms ?? []) as any[]).map((p: any) => p.grp).filter(Boolean))
  }, [societeId])

  const loadProjets = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('plan_projets')
      .select(`id, titre, description, statut, priorite, couleur, date_debut, date_fin, responsable_id,
        responsable:profiles!responsable_id(full_name)`)
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    const ids = (data ?? []).map((p: any) => p.id)
    let tacheMap: Record<string, { total: number; faites: number }> = {}
    if (ids.length > 0) {
      const { data: tachesData } = await (supabase as any)
        .from('plan_taches').select('projet_id, statut').in('projet_id', ids)
      for (const t of (tachesData ?? [])) {
        if (!tacheMap[t.projet_id]) tacheMap[t.projet_id] = { total: 0, faites: 0 }
        tacheMap[t.projet_id].total++
        if (t.statut === 'fait') tacheMap[t.projet_id].faites++
      }
    }

    setProjets((data ?? []).map((p: any) => ({
      ...p,
      taches_total:  tacheMap[p.id]?.total  ?? 0,
      taches_faites: tacheMap[p.id]?.faites ?? 0,
    })))
  }, [societeId])

  async function loadDetail(projet: Projet) {
    setDetailProjet(projet)
    setLoadingDetail(true)
    const [tRes, jRes] = await Promise.all([
      (supabase as any).from('plan_taches').select('id, titre, statut, priorite, date_echeance, assigne:profiles!assigne_a(full_name)').eq('projet_id', projet.id).order('ordre'),
      (supabase as any).from('plan_jalons').select('id, titre, date_cible, statut').eq('projet_id', projet.id).order('date_cible'),
    ])

    const tacheIds = (tRes.data ?? []).map((t: any) => t.id)
    const jalonIds = (jRes.data ?? []).map((j: any) => j.id)

    const [taRes, jaRes] = await Promise.all([
      tacheIds.length > 0
        ? (supabase as any).from('plan_tache_assignes').select('id, tache_id, user_id, user:profiles!user_id(id, full_name), group_id, grp:user_groups!group_id(id, nom)').in('tache_id', tacheIds)
        : { data: [] },
      jalonIds.length > 0
        ? (supabase as any).from('plan_jalon_assignes').select('id, jalon_id, user_id, user:profiles!user_id(id, full_name), group_id, grp:user_groups!group_id(id, nom)').in('jalon_id', jalonIds)
        : { data: [] },
    ])

    const tacheAssignesMap: Record<string, AssigneeItem[]> = {}
    for (const ta of (taRes.data ?? [])) {
      if (!tacheAssignesMap[ta.tache_id]) tacheAssignesMap[ta.tache_id] = []
      tacheAssignesMap[ta.tache_id].push({ id: ta.id, user: ta.user ?? undefined, group: ta.grp ?? undefined })
    }
    const jalonAssignesMap: Record<string, AssigneeItem[]> = {}
    for (const ja of (jaRes.data ?? [])) {
      if (!jalonAssignesMap[ja.jalon_id]) jalonAssignesMap[ja.jalon_id] = []
      jalonAssignesMap[ja.jalon_id].push({ id: ja.id, user: ja.user ?? undefined, group: ja.grp ?? undefined })
    }

    setTaches((tRes.data ?? []).map((t: any) => ({ ...t, assignes: tacheAssignesMap[t.id] ?? [] })))
    setJalons((jRes.data ?? []).map((j: any) => ({ ...j, assignes: jalonAssignesMap[j.id] ?? [] })))
    setLoadingDetail(false)
  }

  function openNewProjet() {
    setEditingProjet(null)
    setPTitre(''); setPDesc(''); setPStatut('actif'); setPPriorite('normale')
    setPCouleur('#6366f1'); setPDateDebut(''); setPDateFin('')
    setShowProjetModal(true)
  }

  function openEditProjet(p: Projet) {
    setEditingProjet(p)
    setPTitre(p.titre); setPDesc(p.description ?? ''); setPStatut(p.statut)
    setPPriorite(p.priorite); setPCouleur(p.couleur)
    setPDateDebut(p.date_debut ?? ''); setPDateFin(p.date_fin ?? '')
    setShowProjetModal(true)
  }

  async function saveProjet() {
    if (!pTitre.trim()) return
    setSavingProjet(true)
    const payload = {
      titre: pTitre.trim(), description: pDesc.trim() || null,
      statut: pStatut, priorite: pPriorite, couleur: pCouleur,
      date_debut: pDateDebut || null, date_fin: pDateFin || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }

    if (editingProjet) {
      const { error } = await (supabase as any).from('plan_projets').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingProjet.id)
      if (error) { toast.error(t('toast_error')); setSavingProjet(false); return }
      toast.success(t('toast_projet_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'projet_updated', resourceType: 'plan_projets', resourceId: editingProjet.id, metadata: { titre: pTitre.trim() } })
    } else {
      const { data, error } = await (supabase as any).from('plan_projets').insert(payload).select('id').single()
      if (error) { toast.error(t('toast_error')); setSavingProjet(false); return }
      toast.success(t('toast_projet_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'projet_created', resourceType: 'plan_projets', resourceId: data?.id, metadata: { titre: pTitre.trim() } })
    }

    setShowProjetModal(false)
    setSavingProjet(false)
    await loadProjets()
  }

  async function deleteProjet(p: Projet) {
    if (!confirm(t('confirm_delete_projet'))) return
    const { error } = await (supabase as any).from('plan_projets').delete().eq('id', p.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_projet_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'projet_deleted', resourceType: 'plan_projets', resourceId: p.id, metadata: { titre: p.titre } })
    if (detailProjet?.id === p.id) setDetailProjet(null)
    await loadProjets()
  }

  async function updateProjetStatut(projetId: string, newStatut: ProjetStatut) {
    const projet = projets.find(p => p.id === projetId)
    if (!projet || projet.statut === newStatut) return
    // Optimistic update
    setProjets(prev => prev.map(p => p.id === projetId ? { ...p, statut: newStatut } : p))
    if (detailProjet?.id === projetId) setDetailProjet(prev => prev ? { ...prev, statut: newStatut } : prev)
    const { error } = await (supabase as any).from('plan_projets').update({ statut: newStatut, updated_at: new Date().toISOString() }).eq('id', projetId)
    if (error) {
      // Rollback
      setProjets(prev => prev.map(p => p.id === projetId ? { ...p, statut: projet.statut } : p))
      toast.error(t('toast_error'))
    } else {
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'projet_updated', resourceType: 'plan_projets', resourceId: projetId, metadata: { titre: projet.titre, nouveau_statut: newStatut } })
    }
  }

  async function saveTache() {
    if (!tTitre.trim() || !detailProjet) return
    setSavingTache(true)
    const { data: newTache, error } = await (supabase as any).from('plan_taches').insert({
      titre: tTitre.trim(), statut: tacheStatutCible, priorite: tPriorite,
      date_echeance: tEcheance || null, projet_id: detailProjet.id,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }).select('id').single()
    if (error) { toast.error(t('toast_error')); setSavingTache(false); return }
    toast.success(t('toast_tache_created'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'tache_created', resourceType: 'plan_taches', resourceId: newTache?.id, metadata: { titre: tTitre.trim(), projet_titre: detailProjet.titre, projet_id: detailProjet.id } })

    if (newTache?.id && (tAssigneUsers.length > 0 || tAssigneGroups.length > 0)) {
      const rows = [
        ...tAssigneUsers.map(uid => ({ tache_id: newTache.id, user_id: uid, tenant_id: fullTenantId })),
        ...tAssigneGroups.map(gid => ({ tache_id: newTache.id, group_id: gid, tenant_id: fullTenantId })),
      ]
      await (supabase as any).from('plan_tache_assignes').insert(rows)

      // Notifier les utilisateurs directs assignés
      const directUsers = tAssigneUsers.filter(uid => uid !== currentUserId)
      if (directUsers.length > 0) {
        await supabase.from('notifications').insert(
          directUsers.map(uid => ({
            tenant_id: fullTenantId,
            user_id:   uid,
            type:      'info',
            titre:     'Tâche assignée',
            message:   `Vous avez été assigné à la tâche "${tTitre.trim()}" sur le projet "${detailProjet.titre}".`,
          }))
        )
      }
      // Notifier les membres (user_id) des groupes assignés
      if (tAssigneGroups.length > 0) {
        const { data: members } = await (supabase as any)
          .from('user_group_members')
          .select('user_id')
          .in('group_id', tAssigneGroups)
          .not('user_id', 'is', null)
        const groupUserIds = (members ?? []).map((m: any) => m.user_id).filter((uid: string) => uid !== currentUserId)
        if (groupUserIds.length > 0) {
          await supabase.from('notifications').insert(
            groupUserIds.map((uid: string) => ({
              tenant_id: fullTenantId,
              user_id:   uid,
              type:      'info',
              titre:     'Tâche assignée via groupe',
              message:   `Votre groupe a été assigné à la tâche "${tTitre.trim()}" sur le projet "${detailProjet.titre}".`,
            }))
          )
        }
      }
    }

    setShowTacheModal(false); setTTitre(''); setTPriorite('normale'); setTEcheance('')
    setTAssigneUsers([]); setTAssigneGroups([])
    setSavingTache(false)
    await loadDetail(detailProjet)
  }

  async function updateTacheStatut(tacheId: string, newStatut: TacheStatut) {
    const tache = taches.find(t => t.id === tacheId)
    await (supabase as any).from('plan_taches').update({ statut: newStatut, updated_at: new Date().toISOString(), ...(newStatut === 'fait' ? { date_completee: new Date().toISOString() } : {}) }).eq('id', tacheId)
    setTaches(prev => prev.map(t => t.id === tacheId ? { ...t, statut: newStatut } : t))
    if (tache) {
      const action = newStatut === 'fait' ? 'tache_completed' : 'tache_updated'
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action, resourceType: 'plan_taches', resourceId: tacheId, metadata: { titre: tache.titre, nouveau_statut: newStatut, projet_id: detailProjet?.id, projet_titre: detailProjet?.titre } })
      // Notifier le responsable du projet si quelqu'un d'autre complète la tâche
      if (newStatut === 'fait' && detailProjet?.responsable_id && detailProjet.responsable_id !== currentUserId) {
        await supabase.from('notifications').insert({
          tenant_id: fullTenantId,
          user_id: detailProjet.responsable_id,
          type: 'info',
          titre: 'Tâche complétée',
          message: `La tâche "${tache.titre}" sur le projet "${detailProjet.titre}" a été complétée.`,
        })
      }
    }
  }

  async function deleteJalon(jalonId: string) {
    const jalon = jalons.find(j => j.id === jalonId)
    await (supabase as any).from('plan_jalons').delete().eq('id', jalonId)
    setJalons(prev => prev.filter(j => j.id !== jalonId))
    if (jalon) {
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'jalon_deleted', resourceType: 'plan_jalons', resourceId: jalonId, metadata: { titre: jalon.titre, projet_id: detailProjet?.id, projet_titre: detailProjet?.titre } })
    }
  }

  async function saveJalon() {
    if (!jTitre.trim() || !jDate || !detailProjet) return
    setSavingJalon(true)
    const { data: newJalon, error } = await (supabase as any).from('plan_jalons').insert({ titre: jTitre.trim(), date_cible: jDate, projet_id: detailProjet.id }).select('id').single()
    if (error) { toast.error(t('toast_error')); setSavingJalon(false); return }
    toast.success(t('toast_jalon_created'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'jalon_created', resourceType: 'plan_jalons', resourceId: newJalon?.id, metadata: { titre: jTitre.trim(), date_cible: jDate, projet_titre: detailProjet.titre, projet_id: detailProjet.id } })

    if (newJalon?.id && (jAssigneUsers.length > 0 || jAssigneGroups.length > 0)) {
      const rows = [
        ...jAssigneUsers.map(uid => ({ jalon_id: newJalon.id, user_id: uid, tenant_id: fullTenantId })),
        ...jAssigneGroups.map(gid => ({ jalon_id: newJalon.id, group_id: gid, tenant_id: fullTenantId })),
      ]
      await (supabase as any).from('plan_jalon_assignes').insert(rows)

      // Notifier les utilisateurs directs assignés
      const directUsers = jAssigneUsers.filter(uid => uid !== currentUserId)
      if (directUsers.length > 0) {
        await supabase.from('notifications').insert(
          directUsers.map(uid => ({
            tenant_id: fullTenantId,
            user_id:   uid,
            type:      'info',
            titre:     'Jalon assigné',
            message:   `Vous avez été assigné au jalon "${jTitre.trim()}" sur le projet "${detailProjet.titre}" (date cible : ${new Date(jDate).toLocaleDateString('fr-FR')}).`,
          }))
        )
      }
      // Notifier les membres des groupes assignés
      if (jAssigneGroups.length > 0) {
        const { data: members } = await (supabase as any)
          .from('user_group_members')
          .select('user_id')
          .in('group_id', jAssigneGroups)
          .not('user_id', 'is', null)
        const groupUserIds = (members ?? []).map((m: any) => m.user_id).filter((uid: string) => uid !== currentUserId)
        if (groupUserIds.length > 0) {
          await supabase.from('notifications').insert(
            groupUserIds.map((uid: string) => ({
              tenant_id: fullTenantId,
              user_id:   uid,
              type:      'info',
              titre:     'Jalon assigné via groupe',
              message:   `Votre groupe a été assigné au jalon "${jTitre.trim()}" sur le projet "${detailProjet.titre}" (date cible : ${new Date(jDate).toLocaleDateString('fr-FR')}).`,
            }))
          )
        }
      }
    }

    setShowJalonModal(false); setJTitre(''); setJDate('')
    setJAssigneUsers([]); setJAssigneGroups([])
    setSavingJalon(false)
    await loadDetail(detailProjet)
  }

  async function addTacheAssignee(tacheId: string, userId?: string, groupId?: string) {
    const row: any = { tache_id: tacheId, tenant_id: fullTenantId }
    if (userId)  row.user_id  = userId
    if (groupId) row.group_id = groupId
    await (supabase as any).from('plan_tache_assignes').insert(row)

    const tache = taches.find(t => t.id === tacheId)
    if (tache) {
      if (userId && userId !== currentUserId) {
        await supabase.from('notifications').insert({
          tenant_id: fullTenantId, user_id: userId, type: 'info',
          titre: 'Tâche assignée',
          message: `Vous avez été assigné à la tâche "${tache.titre}" sur le projet "${detailProjet?.titre}".`,
        })
      }
      if (groupId) {
        const { data: members } = await (supabase as any)
          .from('user_group_members').select('user_id').eq('group_id', groupId).not('user_id', 'is', null)
        const ids = (members ?? []).map((m: any) => m.user_id).filter((uid: string) => uid !== currentUserId)
        if (ids.length > 0) {
          await supabase.from('notifications').insert(
            ids.map((uid: string) => ({
              tenant_id: fullTenantId, user_id: uid, type: 'info',
              titre: 'Tâche assignée via groupe',
              message: `Votre groupe a été assigné à la tâche "${tache.titre}" sur le projet "${detailProjet?.titre}".`,
            }))
          )
        }
      }
    }

    if (detailProjet) await loadDetail(detailProjet)
  }

  async function removeTacheAssignee(assigneId: string) {
    await (supabase as any).from('plan_tache_assignes').delete().eq('id', assigneId)
    if (detailProjet) await loadDetail(detailProjet)
  }

  async function addJalonAssignee(jalonId: string, userId?: string, groupId?: string) {
    const row: any = { jalon_id: jalonId, tenant_id: fullTenantId }
    if (userId)  row.user_id  = userId
    if (groupId) row.group_id = groupId
    await (supabase as any).from('plan_jalon_assignes').insert(row)

    const jalon = jalons.find(j => j.id === jalonId)
    if (jalon) {
      if (userId && userId !== currentUserId) {
        await supabase.from('notifications').insert({
          tenant_id: fullTenantId, user_id: userId, type: 'info',
          titre: 'Jalon assigné',
          message: `Vous avez été assigné au jalon "${jalon.titre}" sur le projet "${detailProjet?.titre}" (date cible : ${new Date(jalon.date_cible).toLocaleDateString('fr-FR')}).`,
        })
      }
      if (groupId) {
        const { data: members } = await (supabase as any)
          .from('user_group_members').select('user_id').eq('group_id', groupId).not('user_id', 'is', null)
        const ids = (members ?? []).map((m: any) => m.user_id).filter((uid: string) => uid !== currentUserId)
        if (ids.length > 0) {
          await supabase.from('notifications').insert(
            ids.map((uid: string) => ({
              tenant_id: fullTenantId, user_id: uid, type: 'info',
              titre: 'Jalon assigné via groupe',
              message: `Votre groupe a été assigné au jalon "${jalon.titre}" sur le projet "${detailProjet?.titre}" (date cible : ${new Date(jalon.date_cible).toLocaleDateString('fr-FR')}).`,
            }))
          )
        }
      }
    }

    if (detailProjet) await loadDetail(detailProjet)
  }

  async function removeJalonAssignee(assigneId: string) {
    await (supabase as any).from('plan_jalon_assignes').delete().eq('id', assigneId)
    if (detailProjet) await loadDetail(detailProjet)
  }

  const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  // ── Kanban columns by statut projet ──
  const KANBAN_COLS: ProjetStatut[] = ['brouillon', 'actif', 'en_pause', 'termine']

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('projets_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">{projets.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Vue toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setVue('kanban')} className={`p-2 ${vue === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><Kanban className="h-4 w-4" /></button>
            <button onClick={() => setVue('liste')}  className={`p-2 ${vue === 'liste'  ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutList className="h-4 w-4" /></button>
          </div>
          {canManage && (
            <button onClick={openNewProjet} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="h-4 w-4" /> {t('btn_new_projet')}
            </button>
          )}
        </div>
      </div>

      {/* Kanban view */}
      {vue === 'kanban' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLS.map(col => {
            const colProjets = projets.filter(p => p.statut === col)
            const isOver = dragOverCol === col
            return (
              <div
                key={col}
                className="space-y-3"
                onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverCol(null)
                  if (draggedProjetId && canManage) updateProjetStatut(draggedProjetId, col)
                  setDraggedProjetId(null)
                }}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUT_PROJET_COLOR[col]}`}>{STATUT_PROJET_LABELS[col]}</span>
                  <span className="text-xs text-slate-400">{colProjets.length}</span>
                </div>
                {/* Zone de dépôt visible quand on survole avec un projet */}
                <div className={`min-h-[4px] rounded-xl transition-all ${isOver && draggedProjetId ? 'min-h-[60px] border-2 border-dashed border-indigo-300 bg-indigo-50/50' : ''}`} />
                {colProjets.map(p => {
                  const pct = p.taches_total > 0 ? Math.round((p.taches_faites / p.taches_total) * 100) : 0
                  const isDragging = draggedProjetId === p.id
                  return (
                    <div
                      key={p.id}
                      draggable={canManage}
                      onDragStart={() => setDraggedProjetId(p.id)}
                      onDragEnd={() => { setDraggedProjetId(null); setDragOverCol(null) }}
                      onClick={() => !isDragging && loadDetail(p)}
                      className={`bg-white rounded-xl border p-4 space-y-3 group transition-all ${
                        isDragging
                          ? 'opacity-40 scale-95 cursor-grabbing border-indigo-300 shadow-lg'
                          : 'border-slate-200 hover:shadow-md hover:border-indigo-200 cursor-grab'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.couleur }} />
                          <p className="font-semibold text-slate-900 text-sm truncate">{p.titre}</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${PRIORITE_COLOR[p.priorite]}`}>{p.priorite}</span>
                      </div>
                      {p.description && <p className="text-xs text-slate-400 line-clamp-2">{p.description}</p>}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{p.taches_faites}/{p.taches_total} tâches</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.couleur }} />
                        </div>
                      </div>
                      {p.date_fin && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(p.date_fin).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        {p.responsable && <span className="text-xs text-slate-500 truncate">{p.responsable.full_name}</span>}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 ml-auto transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Liste view */}
      {vue === 'liste' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">{t('col_titre')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">{t('col_statut')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">{t('col_priorite')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">{t('col_progression')}</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">{t('col_echeance')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projets.map(p => {
                const pct = p.taches_total > 0 ? Math.round((p.taches_faites / p.taches_total) * 100) : 0
                return (
                  <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => loadDetail(p)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.couleur }} />
                        <span className="font-medium text-slate-900">{p.titre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_PROJET_COLOR[p.statut]}`}>{STATUT_PROJET_LABELS[p.statut]}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[11px] font-bold ${PRIORITE_COLOR[p.priorite]}`}>{p.priorite}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.couleur }} />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.date_fin ? new Date(p.date_fin).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {canManage && <button onClick={() => openEditProjet(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="h-3.5 w-3.5" /></button>}
                        {canDelete  && <button onClick={() => deleteProjet(p)}  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panneau détail projet */}
      {detailProjet && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDetailProjet(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: detailProjet.couleur }} />
                <h2 className="font-bold text-slate-900">{detailProjet.titre}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_PROJET_COLOR[detailProjet.statut]}`}>{STATUT_PROJET_LABELS[detailProjet.statut]}</span>
              </div>
              <div className="flex items-center gap-2">
                {canManage && <button onClick={() => openEditProjet(detailProjet)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="h-4 w-4" /></button>}
                {canDelete  && <button onClick={() => deleteProjet(detailProjet)}  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                <button onClick={() => setDetailProjet(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
            ) : (
              <div className="p-6 space-y-6">

                {/* Mini-kanban tâches */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">{t('section_taches')}</h3>
                    {canManage && (
                      <button onClick={() => { setTacheStatutCible('todo'); setShowTacheModal(true) }} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        <Plus className="h-3.5 w-3.5" /> {t('btn_add_tache')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {TACHE_COLS.map(col => {
                      const colTaches = taches.filter(t => t.statut === col.id)
                      return (
                        <div key={col.id} className={`rounded-xl border p-3 space-y-2 ${col.color}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600">{col.label}</span>
                            <span className="text-xs text-slate-400">{colTaches.length}</span>
                          </div>
                          {colTaches.map(tache => (
                            <div key={tache.id} className="bg-white rounded-lg p-2.5 shadow-sm space-y-1.5">
                              <p
                                className="text-xs font-medium text-slate-900 leading-tight cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => setSelectedTache(tache)}
                              >{tache.titre}</p>
                              <div className="flex items-center justify-between gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITE_COLOR[tache.priorite]}`}>{tache.priorite}</span>
                                <div className="flex items-center gap-0.5 ml-auto">
                                  {tache.assignes.slice(0, 3).map(a => (
                                    <div key={a.id} title={a.user?.full_name ?? a.group?.nom}
                                      className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-bold flex items-center justify-center">
                                      {a.user ? a.user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'G'}
                                    </div>
                                  ))}
                                  {tache.assignes.length > 3 && <span className="text-[8px] text-slate-400">+{tache.assignes.length - 3}</span>}
                                </div>
                                {canManage && col.id !== 'fait' && (
                                  <button
                                    onClick={() => updateTacheStatut(tache.id, col.id === 'todo' ? 'en_cours' : col.id === 'en_cours' ? 'revue' : 'fait')}
                                    className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold shrink-0"
                                  >→</button>
                                )}
                              </div>
                            </div>
                          ))}
                          {canManage && (
                            <button onClick={() => { setTacheStatutCible(col.id); setShowTacheModal(true) }} className="w-full text-center text-xs text-slate-400 hover:text-indigo-500 py-1">
                              + Ajouter
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Jalons */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">{t('section_jalons')}</h3>
                    {canManage && (
                      <button onClick={() => setShowJalonModal(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        <Plus className="h-3.5 w-3.5" /> {t('btn_add_jalon')}
                      </button>
                    )}
                  </div>
                  {jalons.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('jalons_empty')}</p>
                  ) : (
                    <div className="space-y-2">
                      {jalons.map(j => {
                        const isPast = new Date(j.date_cible) < new Date()
                        return (
                          <div key={j.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <Flag className={`h-4 w-4 shrink-0 ${j.statut === 'atteint' ? 'text-emerald-500' : isPast ? 'text-red-400' : 'text-amber-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => setSelectedJalon(j)}
                              >{j.titre}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-slate-400">{new Date(j.date_cible).toLocaleDateString('fr-FR')}</p>
                                {j.assignes.length > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    {j.assignes.slice(0, 3).map(a => (
                                      <div key={a.id} title={a.user?.full_name ?? a.group?.nom}
                                        className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-bold flex items-center justify-center">
                                        {a.user ? a.user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'G'}
                                      </div>
                                    ))}
                                    {j.assignes.length > 3 && <span className="text-[8px] text-slate-400">+{j.assignes.length - 3}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            {canManage && (
                              <button onClick={() => deleteJalon(j.id)} className="p-1 text-slate-300 hover:text-red-400 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal projet */}
      {showProjetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowProjetModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{editingProjet ? t('modal_edit_projet') : t('modal_new_projet')}</h2>
              <button onClick={() => setShowProjetModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_titre')} *</label>
                <input value={pTitre} onChange={e => setPTitre(e.target.value)} className={inputCls} placeholder={t('placeholder_titre')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_description')}</label>
                <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} className={inputCls} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_statut')}</label>
                  <select value={pStatut} onChange={e => setPStatut(e.target.value as ProjetStatut)} className={selectCls}>
                    {(Object.keys(STATUT_PROJET_LABELS) as ProjetStatut[]).map(s => <option key={s} value={s}>{STATUT_PROJET_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_priorite')}</label>
                  <select value={pPriorite} onChange={e => setPPriorite(e.target.value as Priorite)} className={selectCls}>
                    {(['basse','normale','haute','critique'] as Priorite[]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_date_debut')}</label>
                  <input type="date" value={pDateDebut} onChange={e => setPDateDebut(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_date_fin')}</label>
                  <input type="date" value={pDateFin} onChange={e => setPDateFin(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_couleur')}</label>
                <div className="flex gap-2 flex-wrap">
                  {COULEURS.map(c => (
                    <button key={c} onClick={() => setPCouleur(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${pCouleur === c ? 'border-slate-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowProjetModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">{t('btn_cancel')}</button>
              <button onClick={saveProjet} disabled={!pTitre.trim() || savingProjet} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                {savingProjet && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tâche */}
      {showTacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowTacheModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{t('modal_new_tache')}</h2>
              <button onClick={() => setShowTacheModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input value={tTitre} onChange={e => setTTitre(e.target.value)} className={inputCls} placeholder={t('placeholder_tache_titre')} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_priorite')}</label>
                  <select value={tPriorite} onChange={e => setTPriorite(e.target.value as Priorite)} className={selectCls}>
                    {(['basse','normale','haute','critique'] as Priorite[]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('field_echeance')}</label>
                  <input type="date" value={tEcheance} onChange={e => setTEcheance(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Assignés</label>
                <AssigneeSelect
                  users={planningUsers} groups={planningGroups}
                  selectedUsers={tAssigneUsers} selectedGroups={tAssigneGroups}
                  onToggleUser={id => setTAssigneUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onToggleGroup={id => setTAssigneGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  placeholder="Assigner à..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTacheModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">{t('btn_cancel')}</button>
              <button onClick={saveTache} disabled={!tTitre.trim() || savingTache} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                {savingTache && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal jalon */}
      {showJalonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowJalonModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">{t('modal_new_jalon')}</h2>
              <button onClick={() => setShowJalonModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input value={jTitre} onChange={e => setJTitre(e.target.value)} className={inputCls} placeholder={t('placeholder_jalon_titre')} />
              <input type="date" value={jDate} onChange={e => setJDate(e.target.value)} className={inputCls} />
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Assignés</label>
                <AssigneeSelect
                  users={planningUsers} groups={planningGroups}
                  selectedUsers={jAssigneUsers} selectedGroups={jAssigneGroups}
                  onToggleUser={id => setJAssigneUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onToggleGroup={id => setJAssigneGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  placeholder="Assigner à..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowJalonModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">{t('btn_cancel')}</button>
              <button onClick={saveJalon} disabled={!jTitre.trim() || !jDate || savingJalon} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                {savingJalon && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail tâche — gestion assignés post-création */}
      {selectedTache && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTache(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${PRIORITE_COLOR[selectedTache.priorite]}`}>{selectedTache.priorite}</span>
                <h2 className="font-bold text-slate-900 truncate">{selectedTache.titre}</h2>
              </div>
              <button onClick={() => setSelectedTache(null)}><X className="h-5 w-5 text-slate-400 shrink-0" /></button>
            </div>
            {selectedTache.date_echeance && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                Échéance : {new Date(selectedTache.date_echeance).toLocaleDateString('fr-FR')}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Assignés</p>
              {selectedTache.assignes.length === 0 ? (
                <p className="text-xs text-slate-400 mb-2">Aucun assigné</p>
              ) : (
                <div className="space-y-1 mb-2">
                  {selectedTache.assignes.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {a.user ? a.user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'G'}
                      </div>
                      <span className="flex-1 text-sm text-slate-700 truncate">{a.user?.full_name ?? a.group?.nom}</span>
                      {canManage && (
                        <button onClick={() => { removeTacheAssignee(a.id); setSelectedTache(prev => prev ? { ...prev, assignes: prev.assignes.filter(x => x.id !== a.id) } : prev) }}
                          className="p-0.5 text-slate-300 hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage && (
                <AssigneeSelect
                  users={planningUsers.filter(u => !selectedTache.assignes.some(a => a.user?.id === u.id))}
                  groups={planningGroups.filter(g => !selectedTache.assignes.some(a => a.group?.id === g.id))}
                  selectedUsers={[]} selectedGroups={[]}
                  onToggleUser={uid => { addTacheAssignee(selectedTache.id, uid); setSelectedTache(null) }}
                  onToggleGroup={gid => { addTacheAssignee(selectedTache.id, undefined, gid); setSelectedTache(null) }}
                  placeholder="Ajouter un assigné..."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal détail jalon — gestion assignés post-création */}
      {selectedJalon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedJalon(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Flag className="h-4 w-4 text-amber-400 shrink-0" />
                <h2 className="font-bold text-slate-900 truncate">{selectedJalon.titre}</h2>
              </div>
              <button onClick={() => setSelectedJalon(null)}><X className="h-5 w-5 text-slate-400 shrink-0" /></button>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Date cible : {new Date(selectedJalon.date_cible).toLocaleDateString('fr-FR')}
            </p>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Assignés</p>
              {selectedJalon.assignes.length === 0 ? (
                <p className="text-xs text-slate-400 mb-2">Aucun assigné</p>
              ) : (
                <div className="space-y-1 mb-2">
                  {selectedJalon.assignes.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {a.user ? a.user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'G'}
                      </div>
                      <span className="flex-1 text-sm text-slate-700 truncate">{a.user?.full_name ?? a.group?.nom}</span>
                      {canManage && (
                        <button onClick={() => { removeJalonAssignee(a.id); setSelectedJalon(prev => prev ? { ...prev, assignes: prev.assignes.filter(x => x.id !== a.id) } : prev) }}
                          className="p-0.5 text-slate-300 hover:text-red-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage && (
                <AssigneeSelect
                  users={planningUsers.filter(u => !selectedJalon.assignes.some(a => a.user?.id === u.id))}
                  groups={planningGroups.filter(g => !selectedJalon.assignes.some(a => a.group?.id === g.id))}
                  selectedUsers={[]} selectedGroups={[]}
                  onToggleUser={uid => { addJalonAssignee(selectedJalon.id, uid); setSelectedJalon(null) }}
                  onToggleGroup={gid => { addJalonAssignee(selectedJalon.id, undefined, gid); setSelectedJalon(null) }}
                  placeholder="Ajouter un assigné..."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
