'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Wrench, Plus, Loader2, Pencil, Trash2, ToggleLeft, ToggleRight,
  GitMerge, X, ChevronRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type TypeProcess =
  'note_de_frais' | 'bon_de_commande' | 'demande_recrutement' |
  'contrat_prestataire' | 'validation_budget' | 'deplacement_pro' |
  'demande_investissement' | 'onboarding' | 'offboarding' |
  'rapport_audit' | 'autre'

interface ProcessTemplate {
  id: string
  nom: string
  description: string | null
  type_process: TypeProcess
  societe_id: string | null
  is_active: boolean
  step_count?: number
  created_at: string
}

// ── Type badge colors ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<TypeProcess, string> = {
  note_de_frais:         'bg-emerald-50 text-emerald-700',
  bon_de_commande:       'bg-sky-50 text-sky-700',
  demande_recrutement:   'bg-violet-50 text-violet-700',
  contrat_prestataire:   'bg-indigo-50 text-indigo-700',
  validation_budget:     'bg-amber-50 text-amber-700',
  deplacement_pro:       'bg-orange-50 text-orange-700',
  demande_investissement:'bg-red-50 text-red-700',
  onboarding:            'bg-teal-50 text-teal-700',
  offboarding:           'bg-slate-100 text-slate-600',
  rapport_audit:         'bg-pink-50 text-pink-700',
  autre:                 'bg-slate-100 text-slate-500',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const t = useTranslations('workflow_builder')
  const params = useParams()
  const router = useRouter()
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`

  const [templates, setTemplates]   = useState<ProcessTemplate[]>([])
  const [loading, setLoading]       = useState(true)
  const [fullTenantId, setFullTenantId] = useState('')
  const [isTenantAdmin, setIsTenantAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toggling, setToggling]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ProcessTemplate | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      if (!profile) return

      const admin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
      setIsTenantAdmin(admin)
      if (!admin) { router.push(`${base}/builder`); return }

      setFullTenantId(profile.tenant_id)
      await loadTemplates(profile.tenant_id)
      setLoading(false)
    }
    init()
  }, [])

  async function loadTemplates(tid: string) {
    const { data, error } = await supabase
      .from('workflow_process_templates')
      .select('id, nom, description, type_process, societe_id, is_active, created_at')
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })

    if (error) { console.error('[loadTemplates]', error.message); return }

    // Compter les étapes par template
    const ids = (data ?? []).map((t: any) => t.id)
    let countMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: steps } = await supabase
        .from('workflow_process_steps')
        .select('template_id')
        .in('template_id', ids)
      steps?.forEach((s: any) => { countMap[s.template_id] = (countMap[s.template_id] ?? 0) + 1 })
    }

    setTemplates((data ?? []).map((t: any) => ({ ...t, step_count: countMap[t.id] ?? 0 })))
  }

  function openEditor(id?: string) {
    router.push(`${base}/builder/${id ?? 'new'}`)
  }

  async function toggleActive(tpl: ProcessTemplate) {
    setToggling(tpl.id)
    const { error } = await supabase
      .from('workflow_process_templates')
      .update({ is_active: !tpl.is_active, updated_at: new Date().toISOString() })
      .eq('id', tpl.id)
    if (error) { toast.error(t('toast_template_error')); setToggling(null); return }
    toast.success(t('toast_template_toggled'))
    setTemplates(prev => prev.map(tp => tp.id === tpl.id ? { ...tp, is_active: !tp.is_active } : tp))
    setToggling(null)
  }

  async function deleteTemplate() {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    const { error } = await supabase.from('workflow_process_templates').delete().eq('id', confirmDelete.id)
    if (error) { toast.error(t('toast_template_error')); setDeletingId(null); return }
    toast.success(t('toast_template_deleted'))
    setTemplates(prev => prev.filter(tp => tp.id !== confirmDelete.id))
    setConfirmDelete(null)
    setDeletingId(null)
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            {t('builder_title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('builder_subtitle')}</p>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('btn_new_template')}
        </button>
      </div>

      {/* Liste */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <Wrench className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-600">{t('templates_empty_title')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('templates_empty_subtitle')}</p>
          <button
            onClick={() => openEditor()}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('btn_new_template')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_nom')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_type')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_steps')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_scope')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_statut')}</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_template_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map(tpl => (
                  <tr key={tpl.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                          <GitMerge className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{tpl.nom}</p>
                          {tpl.description && (
                            <p className="text-xs text-slate-400 truncate max-w-xs">{tpl.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[tpl.type_process]}`}>
                        {t(`type_${tpl.type_process}`)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-semibold text-slate-700">{tpl.step_count}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium ${tpl.societe_id ? 'text-slate-500' : 'text-indigo-600'}`}>
                        {tpl.societe_id ? t('scope_societe') : t('scope_global')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => toggleActive(tpl)}
                        disabled={toggling === tpl.id}
                        className="inline-flex items-center gap-1.5"
                      >
                        {toggling === tpl.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          : tpl.is_active
                            ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                            : <ToggleLeft className="h-5 w-5 text-slate-300" />
                        }
                        <span className={`text-xs font-semibold ${tpl.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {tpl.is_active ? t('template_active') : t('template_inactive')}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditor(tpl.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('btn_edit_template')}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(tpl)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{t('btn_delete_template')}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('confirm_delete_template')}</p>
                <p className="text-sm font-semibold text-slate-700 mt-2">« {confirmDelete.nom} »</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={deleteTemplate}
                disabled={!!deletingId}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {deletingId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
