'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown,
  Info, FormInput, GitMerge, GripVertical, X,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

// ── Types ──────────────────────────────────────────────────────────────────

type TypeProcess =
  'note_de_frais' | 'bon_de_commande' | 'demande_recrutement' |
  'contrat_prestataire' | 'validation_budget' | 'deplacement_pro' |
  'demande_investissement' | 'onboarding' | 'offboarding' |
  'rapport_audit' | 'autre'

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'file' | 'checkbox' | 'signature'
type ActionType = 'approbation' | 'signature' | 'avis' | 'verification'
type ModeSignature = 'canvas' | 'approbation' | 'both'
type AssigneeType = 'user' | 'group' | 'role'

interface FormField {
  id: string
  key: string
  label: string
  type: FieldType
  required: boolean
  placeholder: string
  options: string   // newline-separated
}

interface StepDef {
  id: string        // local UUID
  db_id?: string    // UUID Supabase si déjà sauvegardé
  ordre: number
  nom: string
  description: string
  action_type: ActionType
  mode_signature: ModeSignature
  assignee_type: AssigneeType
  assignee_id: string
  assignee_role: string
  deadline_days: string
  escalation_to: string
  is_parallel: boolean  // vrai si même ordre que l'étape précédente
}

interface UserOpt { id: string; full_name: string | null }
interface GroupOpt { id: string; nom: string }

const PROCESS_TYPES: TypeProcess[] = [
  'note_de_frais','bon_de_commande','demande_recrutement','contrat_prestataire',
  'validation_budget','deplacement_pro','demande_investissement','onboarding',
  'offboarding','rapport_audit','autre',
]
const FIELD_TYPES: FieldType[] = ['text','textarea','number','date','select','multiselect','file','checkbox','signature']
const ACTION_TYPES: ActionType[] = ['approbation','signature','avis','verification']
const ASSIGNEE_TYPES: AssigneeType[] = ['user','group','role']
const ROLES = ['gestionnaire','admin']

// ── Page ───────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const t = useTranslations('workflow_builder')
  const params = useParams()
  const router = useRouter()

  const tenantSlug   = params.tenant_slug   as string
  const tenantId     = params.tenant_id     as string
  const userId       = params.user_id       as string
  const societeSlug  = params.societe_slug  as string
  const societeId    = params.societe_id    as string
  const templateId   = params.template_id   as string
  const isNew = templateId === 'new'
  const base  = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow/builder`

  const [loading, setLoading]         = useState(!isNew)
  const [saving, setSaving]           = useState(false)
  const [activeTab, setActiveTab]     = useState<'infos'|'form'|'steps'>('infos')
  const [fullTenantId, setFullTenantId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // Infos
  const [nom, setNom]                     = useState('')
  const [description, setDescription]     = useState('')
  const [typeProcess, setTypeProcess]     = useState<TypeProcess>('autre')
  const [isGlobal, setIsGlobal]           = useState(false)
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(isNew ? null : templateId)

  // Form fields
  const [fields, setFields] = useState<FormField[]>([])

  // Steps
  const [steps, setSteps]     = useState<StepDef[]>([])
  const [users, setUsers]     = useState<UserOpt[]>([])
  const [groups, setGroups]   = useState<GroupOpt[]>([])

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const uid = session.user.id
      setCurrentUserId(uid)

      const { data: profile } = await supabase
        .from('profiles').select('role, tenant_id').eq('id', uid).single()
      if (!profile || (profile.role !== 'tenant_admin' && profile.role !== 'super_admin')) {
        router.push(base); return
      }
      const tid = profile.tenant_id
      setFullTenantId(tid)

      // Charger utilisateurs et groupes pour les assignations
      const [usersRes, groupsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('tenant_id', tid).eq('role', 'tenant_user'),
        supabase.from('user_groups').select('id, nom').eq('tenant_id', tid).eq('societe_id', societeId),
      ])
      setUsers(usersRes.data ?? [])
      setGroups(groupsRes.data ?? [])

      // Charger le template si édition
      if (!isNew) {
        const { data: tpl } = await supabase
          .from('workflow_process_templates')
          .select('*')
          .eq('id', templateId)
          .single()
        if (!tpl) { router.push(base); return }

        setNom(tpl.nom)
        setDescription(tpl.description ?? '')
        setTypeProcess(tpl.type_process)
        setIsGlobal(!tpl.societe_id)
        setFields((tpl.form_schema ?? []).map((f: any) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options.join('\n') : (f.options ?? ''),
        })))

        // Charger les étapes
        const { data: stepsData } = await supabase
          .from('workflow_process_steps')
          .select('*')
          .eq('template_id', templateId)
          .order('ordre', { ascending: true })

        if (stepsData) {
          setSteps(stepsData.map((s: any, i: number) => ({
            id:             uuidv4(),
            db_id:          s.id,
            ordre:          s.ordre,
            nom:            s.nom,
            description:    s.description ?? '',
            action_type:    s.action_type,
            mode_signature: s.mode_signature ?? 'both',
            assignee_type:  s.assignee_type,
            assignee_id:    s.assignee_id ?? '',
            assignee_role:  s.assignee_role ?? '',
            deadline_days:  s.deadline_days?.toString() ?? '',
            escalation_to:  s.escalation_to ?? '',
            is_parallel:    i > 0 && s.ordre === stepsData[i - 1]?.ordre,
          })))
        }
        setLoading(false)
      }
    }
    init()
  }, [])

  // ── Save infos ────────────────────────────────────────────────────────────

  async function saveInfos() {
    if (!nom.trim()) { toast.error('Le nom est obligatoire.'); return }
    setSaving(true)
    try {
      const payload = {
        tenant_id:    fullTenantId,
        societe_id:   isGlobal ? null : societeId,
        nom:          nom.trim(),
        description:  description.trim() || null,
        type_process: typeProcess,
        updated_at:   new Date().toISOString(),
      }

      if (savedTemplateId) {
        const { error } = await supabase.from('workflow_process_templates')
          .update(payload).eq('id', savedTemplateId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('workflow_process_templates')
          .insert({ ...payload, form_schema: [], is_active: false, created_by: currentUserId })
          .select('id').single()
        if (error) throw error
        setSavedTemplateId(data.id)
      }

      toast.success(t(savedTemplateId ? 'toast_template_updated' : 'toast_template_created'))
      setActiveTab('form')
    } catch {
      toast.error(t('toast_template_error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Form fields CRUD ──────────────────────────────────────────────────────

  function addField() {
    setFields(prev => [...prev, {
      id:          uuidv4(),
      key:         '',
      label:       '',
      type:        'text',
      required:    false,
      placeholder: '',
      options:     '',
    }])
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function moveField(id: string, dir: 'up' | 'down') {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id)
      if (dir === 'up' && idx === 0) return prev
      if (dir === 'down' && idx === prev.length - 1) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  async function saveForm() {
    if (!savedTemplateId) { await saveInfos(); return }
    setSaving(true)
    try {
      const schema = fields.map(f => ({
        id:          f.id,
        key:         f.key || f.id.substring(0, 8),
        label:       f.label,
        type:        f.type,
        required:    f.required,
        placeholder: f.placeholder,
        options:     f.options ? f.options.split('\n').filter(Boolean) : [],
      }))
      const { error } = await supabase.from('workflow_process_templates')
        .update({ form_schema: schema, updated_at: new Date().toISOString() })
        .eq('id', savedTemplateId)
      if (error) throw error
      toast.success(t('toast_template_updated'))
      setActiveTab('steps')
    } catch {
      toast.error(t('toast_template_error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Steps CRUD ────────────────────────────────────────────────────────────

  function addStep(parallel = false) {
    setSteps(prev => {
      const maxOrdre = prev.length > 0 ? Math.max(...prev.map(s => s.ordre)) : 0
      const newOrdre = parallel && prev.length > 0 ? prev[prev.length - 1].ordre : maxOrdre + 1
      return [...prev, {
        id: uuidv4(), db_id: undefined,
        ordre: newOrdre, nom: '', description: '',
        action_type: 'approbation', mode_signature: 'both',
        assignee_type: 'role', assignee_id: '', assignee_role: 'gestionnaire',
        deadline_days: '', escalation_to: '', is_parallel: parallel,
      }]
    })
  }

  function updateStep(id: string, patch: Partial<StepDef>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function removeStep(id: string) {
    setSteps(prev => {
      const filtered = prev.filter(s => s.id !== id)
      // Renormaliser les ordres
      let order = 1
      return filtered.map((s, i) => {
        if (i > 0 && s.is_parallel) return { ...s, ordre: filtered[i - 1].ordre }
        const o = order++
        return { ...s, ordre: o }
      })
    })
  }

  function moveStep(id: string, dir: 'up' | 'down') {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id)
      if (dir === 'up' && idx === 0) return prev
      if (dir === 'down' && idx === prev.length - 1) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      // Renormaliser ordres
      let order = 1
      return next.map((s, i) => {
        if (i > 0 && s.is_parallel) return { ...s, ordre: next[i - 1].ordre }
        return { ...s, ordre: order++ }
      })
    })
  }

  async function saveSteps() {
    if (!savedTemplateId) { await saveInfos(); return }
    setSaving(true)
    try {
      // Supprimer toutes les étapes existantes puis réinsérer
      await supabase.from('workflow_process_steps').delete().eq('template_id', savedTemplateId)

      if (steps.length > 0) {
        const rows = steps.map(s => ({
          template_id:    savedTemplateId,
          ordre:          s.ordre,
          nom:            s.nom || `Étape ${s.ordre}`,
          description:    s.description || null,
          action_type:    s.action_type,
          mode_signature: s.action_type === 'signature' ? s.mode_signature : null,
          assignee_type:  s.assignee_type,
          assignee_id:    (s.assignee_type === 'user' || s.assignee_type === 'group') ? (s.assignee_id || null) : null,
          assignee_role:  s.assignee_type === 'role' ? (s.assignee_role || null) : null,
          deadline_days:  s.deadline_days ? parseInt(s.deadline_days) : null,
          escalation_to:  s.escalation_to || null,
        }))
        const { error } = await supabase.from('workflow_process_steps').insert(rows)
        if (error) throw error
      }

      // Activer le template
      await supabase.from('workflow_process_templates')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', savedTemplateId)

      toast.success(t('toast_template_updated'))
      router.push(base)
    } catch {
      toast.error(t('toast_template_error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
  }

  const tabs = [
    { id: 'infos',  label: t('editor_tab_infos'),  icon: Info },
    { id: 'form',   label: t('editor_tab_form'),   icon: FormInput },
    { id: 'steps',  label: t('editor_tab_steps'),  icon: GitMerge },
  ] as const

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push(base)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isNew ? t('editor_title_new') : t('editor_title_edit')}
          </h1>
          {nom && <p className="text-sm text-slate-500">{nom}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon
          const locked = tab.id !== 'infos' && !savedTemplateId
          return (
            <button
              key={tab.id}
              onClick={() => !locked && setActiveTab(tab.id)}
              disabled={locked}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Infos ──────────────────────────────────────────────────── */}
      {activeTab === 'infos' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('field_nom')} *</label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder={t('field_nom_placeholder')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('field_description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('field_description_placeholder')}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('field_type_process')}</label>
              <select
                value={typeProcess}
                onChange={e => setTypeProcess(e.target.value as TypeProcess)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {PROCESS_TYPES.map(tp => (
                  <option key={tp} value={tp}>{t(`type_${tp}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('field_scope')}</label>
              <select
                value={isGlobal ? 'global' : 'societe'}
                onChange={e => setIsGlobal(e.target.value === 'global')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="global">{t('scope_option_global')}</option>
                <option value="societe">{t('scope_option_societe')}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={saveInfos}
              disabled={saving || !nom.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('btn_save_continue')}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Form ───────────────────────────────────────────────────── */}
      {activeTab === 'form' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-800">{t('form_builder_title')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t('form_builder_subtitle')}</p>
              </div>
              <button
                onClick={addField}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('btn_add_field')}
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <FormInput className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('form_empty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
                    <div className="flex items-start gap-3">
                      <GripVertical className="h-4 w-4 text-slate-300 mt-3 shrink-0" />
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('field_label')}</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={e => updateField(field.id, { label: e.target.value })}
                            placeholder={t('field_label_placeholder')}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('field_type')}</label>
                          <select
                            value={field.type}
                            onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            {FIELD_TYPES.map(ft => (
                              <option key={ft} value={ft}>{t(`field_type_${ft}`)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('field_placeholder')}</label>
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={e => updateField(field.id, { placeholder: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={e => updateField(field.id, { required: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600"
                            />
                            <span className="text-sm text-slate-600">{t('field_required')}</span>
                          </label>
                        </div>
                        {(field.type === 'select' || field.type === 'multiselect') && (
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('field_options')}</label>
                            <textarea
                              value={field.options}
                              onChange={e => updateField(field.id, { options: e.target.value })}
                              placeholder={t('field_options_placeholder')}
                              rows={3}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white resize-none"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => moveField(field.id, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveField(field.id, 'down')} disabled={idx === fields.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeField(field.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={addField}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('btn_add_field')}
            </button>
            <button
              onClick={saveForm}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('btn_save_continue')}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Steps ──────────────────────────────────────────────────── */}
      {activeTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-800">{t('steps_builder_title')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t('steps_builder_subtitle')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addStep(true)}
                  disabled={steps.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('btn_add_parallel')}
                </button>
                <button
                  onClick={() => addStep(false)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t('btn_add_step')}
                </button>
              </div>
            </div>

            {steps.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <GitMerge className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('steps_empty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={step.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Step header */}
                    <div className={`flex items-center justify-between px-4 py-2.5 ${step.is_parallel ? 'bg-violet-50 border-b border-violet-100' : 'bg-slate-50 border-b border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.is_parallel ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {step.is_parallel ? t('step_parallel_badge') : `${t('step_label')} ${step.ordre}`}
                        </span>
                        {step.nom && <span className="text-sm font-semibold text-slate-700">{step.nom}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveStep(step.id, 'down')} disabled={idx === steps.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeStep(step.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Step body */}
                    <div className="p-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_nom')}</label>
                        <input
                          type="text"
                          value={step.nom}
                          onChange={e => updateStep(step.id, { nom: e.target.value })}
                          placeholder={t('step_field_nom_placeholder')}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_action')}</label>
                        <select
                          value={step.action_type}
                          onChange={e => updateStep(step.id, { action_type: e.target.value as ActionType })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          {ACTION_TYPES.map(at => (
                            <option key={at} value={at}>{t(`action_${at}`)}</option>
                          ))}
                        </select>
                      </div>

                      {step.action_type === 'signature' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_mode_signature')}</label>
                          <select
                            value={step.mode_signature}
                            onChange={e => updateStep(step.id, { mode_signature: e.target.value as ModeSignature })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="canvas">{t('mode_canvas')}</option>
                            <option value="approbation">{t('mode_approbation')}</option>
                            <option value="both">{t('mode_both')}</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_assignee_type')}</label>
                        <select
                          value={step.assignee_type}
                          onChange={e => updateStep(step.id, { assignee_type: e.target.value as AssigneeType, assignee_id: '', assignee_role: '' })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="user">{t('assignee_type_user')}</option>
                          <option value="group">{t('assignee_type_group')}</option>
                          <option value="role">{t('assignee_type_role')}</option>
                        </select>
                      </div>

                      {step.assignee_type === 'user' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_assignee_user')}</label>
                          <select
                            value={step.assignee_id}
                            onChange={e => updateStep(step.id, { assignee_id: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">{t('select_user')}</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.id.substring(0,8)}</option>)}
                          </select>
                        </div>
                      )}
                      {step.assignee_type === 'group' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_assignee_group')}</label>
                          <select
                            value={step.assignee_id}
                            onChange={e => updateStep(step.id, { assignee_id: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">{t('select_group')}</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                          </select>
                        </div>
                      )}
                      {step.assignee_type === 'role' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_assignee_role')}</label>
                          <select
                            value={step.assignee_role}
                            onChange={e => updateStep(step.id, { assignee_role: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">{t('select_role')}</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('step_field_deadline')}</label>
                        <input
                          type="number"
                          min="1"
                          value={step.deadline_days}
                          onChange={e => updateStep(step.id, { deadline_days: e.target.value })}
                          placeholder={t('no_deadline')}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {t('step_field_escalation')}
                          <span className="ml-1 font-normal text-slate-400 normal-case">— {t('step_field_escalation_hint')}</span>
                        </label>
                        <select
                          value={step.escalation_to}
                          onChange={e => updateStep(step.id, { escalation_to: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="">{t('select_escalation')}</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.id.substring(0,8)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => addStep(false)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('btn_add_step')}
            </button>
            <button
              onClick={saveSteps}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('btn_publish')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
