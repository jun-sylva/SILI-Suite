'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  GitMerge, Plus, Loader2, ChevronRight, X, AlertCircle,
  CheckCircle2, XCircle, Clock, Ban, FileText, ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type InstanceStatut = 'brouillon' | 'en_cours' | 'approuve' | 'refuse' | 'annule'
type TypeProcess =
  'note_de_frais' | 'bon_de_commande' | 'demande_recrutement' |
  'contrat_prestataire' | 'validation_budget' | 'deplacement_pro' |
  'demande_investissement' | 'onboarding' | 'offboarding' |
  'rapport_audit' | 'autre'

interface Template {
  id: string
  nom: string
  type_process: TypeProcess
  form_schema: FormField[]
}

interface FormField {
  id: string
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'file' | 'checkbox' | 'signature'
  required: boolean
  placeholder?: string
  options?: string[]
}

interface ProcessInstance {
  id: string
  titre: string
  statut: InstanceStatut
  current_step_ordre: number
  created_at: string
  template: { nom: string; type_process: TypeProcess } | null
  initiator: { full_name: string } | null
  step_count?: number
  completed_steps?: number
}

// ── Colors & icons ──────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<InstanceStatut, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  brouillon:  { color: 'bg-slate-100 text-slate-600',   icon: FileText },
  en_cours:   { color: 'bg-blue-50 text-blue-700',      icon: Clock },
  approuve:   { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  refuse:     { color: 'bg-red-50 text-red-700',        icon: XCircle },
  annule:     { color: 'bg-slate-100 text-slate-400',   icon: Ban },
}

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

export default function ProcessesPage() {
  const t  = useTranslations('workflow_builder')
  const tw = useTranslations('workflow')
  const params = useParams()
  const router = useRouter()
  const tenantSlug  = params.tenant_slug  as string
  const tenantId    = params.tenant_id    as string
  const userId      = params.user_id      as string
  const societeSlug = params.societe_slug as string
  const societeId   = params.societe_id   as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`

  const [instances, setInstances]   = useState<ProcessInstance[]>([])
  const [loading, setLoading]       = useState(true)
  const [tenantIdFull, setTenantId] = useState('')
  const [canDelete, setCanDelete]   = useState(false)

  // Launch modal
  const [showLaunch, setShowLaunch]         = useState(false)
  const [templates, setTemplates]           = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formValues, setFormValues]         = useState<Record<string, string>>({})
  const [titre, setTitre]                   = useState('')
  const [launching, setLaunching]           = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      if (!profile) return

      const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
      let perm = 'aucun'
      if (!isTenantAdmin) {
        const { data: permData } = await supabase
          .from('user_module_permissions').select('permission')
          .eq('user_id', session.user.id).eq('societe_id', societeId).eq('module', 'workflow').maybeSingle()
        perm = permData?.permission ?? 'aucun'
      }

      const canAccess = isTenantAdmin || perm === 'gestionnaire' || perm === 'admin'
      if (!canAccess) { router.push(`${base}`); return }

      setCanDelete(isTenantAdmin || perm === 'admin')
      setTenantId(profile.tenant_id)
      await loadInstances(profile.tenant_id)
      setLoading(false)
    }
    init()
  }, [])

  async function loadInstances(tid: string) {
    const { data, error } = await supabase
      .from('workflow_instances')
      .select(`
        id, titre, statut, current_step_ordre, created_at, initiator_id,
        template:template_id ( nom, type_process )
      `)
      .eq('tenant_id', tid)
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })

    if (error) { console.error('[loadInstances]', error.message); return }

    // Fetch initiator names from profiles
    const initiatorIds = [...new Set((data ?? []).map((i: any) => i.initiator_id).filter(Boolean))]
    let nameMap: Record<string, string> = {}
    if (initiatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', initiatorIds)
      profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name })
    }

    // Count steps per instance
    const ids = (data ?? []).map((i: any) => i.id)
    let stepMap: Record<string, { total: number; done: number }> = {}
    if (ids.length > 0) {
      const { data: steps } = await supabase
        .from('workflow_instance_steps')
        .select('instance_id, statut')
        .in('instance_id', ids)
      steps?.forEach((s: any) => {
        if (!stepMap[s.instance_id]) stepMap[s.instance_id] = { total: 0, done: 0 }
        stepMap[s.instance_id].total++
        if (['approuve', 'refuse', 'signe', 'avis_donne', 'skipped'].includes(s.statut)) {
          stepMap[s.instance_id].done++
        }
      })
    }

    setInstances((data ?? []).map((i: any) => ({
      ...i,
      initiator: { full_name: nameMap[i.initiator_id] ?? '—' },
      step_count: stepMap[i.id]?.total ?? 0,
      completed_steps: stepMap[i.id]?.done ?? 0,
    })))
  }

  async function openLaunchModal() {
    setShowLaunch(true)
    setSelectedTemplate(null)
    setFormValues({})
    setTitre('')
    setLoadingTemplates(true)

    const { data } = await supabase
      .from('workflow_process_templates')
      .select('id, nom, type_process, form_schema')
      .eq('tenant_id', tenantIdFull)
      .eq('is_active', true)
      .or(`societe_id.is.null,societe_id.eq.${societeId}`)
      .order('nom')

    setTemplates(data ?? [])
    setLoadingTemplates(false)
  }

  function selectTemplate(tpl: Template) {
    setSelectedTemplate(tpl)
    setFormValues({})
    setTitre(tpl.nom)
  }

  async function launchProcess() {
    if (!selectedTemplate || !titre.trim()) return

    // Validate required fields
    for (const field of selectedTemplate.form_schema) {
      if (field.required && !formValues[field.key]?.trim()) {
        toast.error(t('error_field_required', { field: field.label }))
        return
      }
    }

    setLaunching(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Create instance
    const { data: instance, error: instError } = await supabase
      .from('workflow_instances')
      .insert({
        template_id: selectedTemplate.id,
        tenant_id: tenantIdFull,
        societe_id: societeId,
        titre: titre.trim(),
        statut: 'en_cours',
        current_step_ordre: 1,
        form_data: formValues,
        initiator_id: session.user.id,
      })
      .select('id')
      .single()

    if (instError || !instance) {
      toast.error(t('toast_process_error'))
      setLaunching(false)
      return
    }

    // Load template steps
    const { data: steps } = await supabase
      .from('workflow_process_steps')
      .select('id, ordre, deadline_days')
      .eq('template_id', selectedTemplate.id)
      .order('ordre')

    if (steps && steps.length > 0) {
      const instanceSteps = steps.map((s: any) => ({
        instance_id: instance.id,
        step_id: s.id,
        ordre: s.ordre,
        statut: s.ordre === 1 ? 'en_cours' : 'en_attente',
        deadline_at: s.deadline_days
          ? new Date(Date.now() + s.deadline_days * 24 * 3600 * 1000).toISOString()
          : null,
      }))

      const { error: stepsError } = await supabase
        .from('workflow_instance_steps')
        .insert(instanceSteps)

      if (stepsError) {
        toast.error(t('toast_process_error'))
        setLaunching(false)
        return
      }
    }

    toast.success(t('toast_process_launched'))
    setShowLaunch(false)
    setLaunching(false)
    await loadInstances(tenantIdFull)
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
            <GitMerge className="h-5 w-5 text-indigo-500" />
            {t('processes_title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('processes_subtitle')}</p>
        </div>
        <button
          onClick={openLaunchModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('btn_launch_process')}
        </button>
      </div>

      {/* List */}
      {instances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <GitMerge className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-600">{t('processes_empty_title')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('processes_empty_subtitle')}</p>
          <button
            onClick={openLaunchModal}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('btn_launch_process')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_titre')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_type')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_step')}</th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_statut')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_initiator')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_date')}</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_process_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instances.map(inst => {
                  const cfg = STATUT_CONFIG[inst.statut]
                  const StatutIcon = cfg.icon
                  const typeColor = inst.template ? TYPE_COLORS[inst.template.type_process as TypeProcess] : 'bg-slate-100 text-slate-500'
                  const progress = inst.step_count ? Math.round((inst.completed_steps! / inst.step_count) * 100) : 0
                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                            <GitMerge className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{inst.titre}</p>
                            {inst.template && (
                              <p className="text-xs text-slate-400">{inst.template.nom}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {inst.template && (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${typeColor}`}>
                            {t(`type_${inst.template.type_process}`)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {inst.completed_steps}/{inst.step_count}
                          </span>
                          {inst.step_count! > 0 && (
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                          <StatutIcon className="h-3.5 w-3.5" />
                          {t(`statut_${inst.statut}`)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {inst.initiator?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {new Date(inst.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => router.push(`${base}/processes/${inst.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                            {t('btn_voir')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Launch Modal */}
      {showLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-indigo-500" />
                {t('modal_launch_title')}
              </h2>
              <button onClick={() => setShowLaunch(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Step 1: template selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('modal_launch_select_template')}</label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('processes_loading')}
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {t('no_active_template')}
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedTemplate?.id ?? ''}
                      onChange={e => {
                        const tpl = templates.find(t => t.id === e.target.value)
                        if (tpl) selectTemplate(tpl)
                        else { setSelectedTemplate(null); setFormValues({}) }
                      }}
                      className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-9"
                    >
                      <option value="">{t('select_template_placeholder')}</option>
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>{tpl.nom}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Step 2: form fill */}
              {selectedTemplate && (
                <>
                  {/* Titre */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">{t('field_titre_process')} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={titre}
                      onChange={e => setTitre(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  {selectedTemplate.form_schema.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-700 border-t border-slate-100 pt-4">{t('modal_launch_fill_form')}</p>
                      {selectedTemplate.form_schema.map(field => (
                        <div key={field.id} className="space-y-1">
                          <label className="text-sm font-medium text-slate-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <FormFieldInput
                            field={field}
                            value={formValues[field.key] ?? ''}
                            onChange={val => setFormValues(prev => ({ ...prev, [field.key]: val }))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end p-6 border-t border-slate-200">
              <button
                onClick={() => setShowLaunch(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={launchProcess}
                disabled={!selectedTemplate || !titre.trim() || launching}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                {launching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('modal_launch_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FormFieldInput ──────────────────────────────────────────────────────────

function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: string
  onChange: (v: string) => void
}) {
  const base = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={base + ' resize-none'}
      />
    )
  }
  if (field.type === 'select' && field.options?.length) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={base}
      >
        <option value="">—</option>
        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }
  if (field.type === 'multiselect' && field.options?.length) {
    const selected = value ? value.split(',') : []
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = active ? selected.filter(s => s !== opt) : [...selected, opt]
                onChange(next.join(','))
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={e => onChange(e.target.checked ? 'true' : '')}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
        />
        <span className="text-sm text-slate-600">{field.placeholder || field.label}</span>
      </label>
    )
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={base}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={base}
      />
    )
  }
  // text, file (simplified), signature (text), default
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  )
}
