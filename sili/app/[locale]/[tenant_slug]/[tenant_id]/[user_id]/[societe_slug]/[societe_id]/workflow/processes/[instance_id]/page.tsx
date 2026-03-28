'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  GitMerge, Loader2, ChevronLeft, CheckCircle2, XCircle, Clock,
  Ban, FileText, PenLine, MessageSquare, ShieldCheck, AlertTriangle,
  X, ChevronRight, Users,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

type InstanceStatut = 'brouillon' | 'en_cours' | 'approuve' | 'refuse' | 'annule'
type StepStatut = 'en_attente' | 'en_cours' | 'approuve' | 'refuse' | 'signe' | 'avis_donne' | 'skipped'
type ActionType = 'approbation' | 'signature' | 'avis' | 'verification'
type ModeSignature = 'canvas' | 'approbation' | 'both'
type AssigneeType = 'user' | 'group' | 'role'

interface TemplateStep {
  id: string
  ordre: number
  nom: string
  action_type: ActionType
  mode_signature: ModeSignature | null
  assignee_type: AssigneeType
  assignee_id: string | null
  assignee_role: string | null
  deadline_days: number | null
  escalation_to: string | null
}

interface InstanceStep {
  id: string
  step_id: string
  ordre: number
  statut: StepStatut
  actor_id: string | null
  commentaire: string | null
  signature_data: string | null
  deadline_at: string | null
  escalated_at: string | null
  traite_le: string | null
  // joined
  step: TemplateStep | null
  actor: { full_name: string } | null
}

interface Instance {
  id: string
  titre: string
  statut: InstanceStatut
  current_step_ordre: number
  form_data: Record<string, string>
  created_at: string
  template: {
    id: string
    nom: string
    type_process: string
    form_schema: FormField[]
  } | null
  initiator: { full_name: string } | null
}

interface FormField {
  id: string
  key: string
  label: string
  type: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const STEP_STATUT_CONFIG: Record<StepStatut, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  en_attente: { color: 'bg-slate-100 text-slate-500', icon: Clock },
  en_cours:   { color: 'bg-blue-50 text-blue-700',   icon: Clock },
  approuve:   { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  refuse:     { color: 'bg-red-50 text-red-700',     icon: XCircle },
  signe:      { color: 'bg-violet-50 text-violet-700', icon: PenLine },
  avis_donne: { color: 'bg-sky-50 text-sky-700',     icon: MessageSquare },
  skipped:    { color: 'bg-slate-50 text-slate-400', icon: ChevronRight },
}

const INSTANCE_STATUT_CONFIG: Record<InstanceStatut, { color: string; label: string }> = {
  brouillon: { color: 'bg-slate-100 text-slate-600', label: 'Brouillon' },
  en_cours:  { color: 'bg-blue-50 text-blue-700',   label: 'En cours' },
  approuve:  { color: 'bg-emerald-50 text-emerald-700', label: 'Approuvé' },
  refuse:    { color: 'bg-red-50 text-red-700',     label: 'Refusé' },
  annule:    { color: 'bg-slate-100 text-slate-400', label: 'Annulé' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InstanceDetailPage() {
  const t = useTranslations('workflow_builder')
  const params = useParams()
  const router = useRouter()
  const tenantSlug  = params.tenant_slug   as string
  const tenantId    = params.tenant_id     as string
  const userId      = params.user_id       as string
  const societeSlug = params.societe_slug  as string
  const societeId   = params.societe_id    as string
  const instanceId  = params.instance_id  as string
  const base = `/${tenantSlug}/${tenantId}/${userId}/${societeSlug}/${societeId}/workflow`

  const [instance, setInstance]   = useState<Instance | null>(null)
  const [steps, setSteps]         = useState<InstanceStep[]>([])
  const [loading, setLoading]     = useState(true)
  const [currentUid, setCurrentUid] = useState('')
  const [isTenantAdmin, setIsTenantAdmin] = useState(false)
  const [canDelete, setCanDelete]         = useState(false)

  // Action modal
  const [actionStep, setActionStep] = useState<InstanceStep | null>(null)
  const [comment, setComment]       = useState('')
  const [signMode, setSignMode]     = useState<'canvas' | 'approbation'>('approbation')
  const [confirmed, setConfirmed]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing]   = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Cancel confirm
  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()

      setCurrentUid(session.user.id)
      const isTA = profile?.role === 'tenant_admin' || profile?.role === 'super_admin'
      setIsTenantAdmin(isTA)

      let perm = 'aucun'
      if (!isTA) {
        const { data: permData } = await supabase
          .from('user_module_permissions').select('permission')
          .eq('user_id', session.user.id).eq('societe_id', societeId).eq('module', 'workflow').maybeSingle()
        perm = permData?.permission ?? 'aucun'
      }
      setCanDelete(isTA || perm === 'admin')
      await load()
      setLoading(false)
    }
    init()
  }, [instanceId])

  async function load() {
    const { data: inst } = await supabase
      .from('workflow_instances')
      .select(`
        id, titre, statut, current_step_ordre, form_data, created_at, initiator_id,
        template:template_id ( id, nom, type_process, form_schema )
      `)
      .eq('id', instanceId)
      .single()

    // Fetch initiator name from profiles
    let initiatorName = '—'
    if (inst?.initiator_id) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', inst.initiator_id).single()
      initiatorName = prof?.full_name ?? '—'
    }

    setInstance(inst ? { ...inst, initiator: { full_name: initiatorName } } as any : null)

    const { data: isteps } = await supabase
      .from('workflow_instance_steps')
      .select(`
        id, step_id, ordre, statut, actor_id, commentaire, signature_data,
        deadline_at, escalated_at, traite_le,
        step:step_id ( id, ordre, nom, action_type, mode_signature, assignee_type, assignee_id, assignee_role, deadline_days, escalation_to )
      `)
      .eq('instance_id', instanceId)
      .order('ordre')

    // Fetch actor names
    const actorIds = [...new Set((isteps ?? []).map((s: any) => s.actor_id).filter(Boolean))]
    let actorMap: Record<string, string> = {}
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from('profiles').select('id, full_name').in('id', actorIds)
      actors?.forEach((a: any) => { actorMap[a.id] = a.full_name })
    }

    setSteps(((isteps ?? []) as any[]).map((s: any) => ({
      ...s,
      actor: s.actor_id ? { full_name: actorMap[s.actor_id] ?? '—' } : null,
    })))
  }

  // ── Canvas signature ──────────────────────────────────────────────────────

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    setIsDrawing(true)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    setHasSignature(true)
  }

  function stopDraw() { setIsDrawing(false) }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  // ── Can act ───────────────────────────────────────────────────────────────

  function canAct(step: InstanceStep): boolean {
    if (instance?.statut !== 'en_cours') return false
    if (step.statut !== 'en_cours') return false
    const ts = step.step
    if (!ts) return false
    if (ts.assignee_type === 'user') return ts.assignee_id === currentUid
    if (ts.assignee_type === 'role') return isTenantAdmin  // simplified: gestionnaire/admin check
    return true // group: accept for now, backend RLS enforces
  }

  // ── Submit action ─────────────────────────────────────────────────────────

  async function submitAction(decision: 'approve' | 'refuse' | 'sign' | 'avis' | 'verify') {
    if (!actionStep || !instance) return
    setSubmitting(true)

    let signature_data: string | null = null
    let newStatut: StepStatut = 'approuve'

    if (decision === 'refuse') newStatut = 'refuse'
    else if (decision === 'sign') {
      newStatut = 'signe'
      if (signMode === 'canvas') {
        signature_data = canvasRef.current?.toDataURL('image/png') ?? null
      } else {
        signature_data = 'approbation_confirmee'
      }
    } else if (decision === 'avis') newStatut = 'avis_donne'
    else if (decision === 'verify') newStatut = 'approuve'

    const { error: stepErr } = await supabase
      .from('workflow_instance_steps')
      .update({
        statut: newStatut,
        actor_id: currentUid,
        commentaire: comment.trim() || null,
        signature_data,
        traite_le: new Date().toISOString(),
      })
      .eq('id', actionStep.id)

    if (stepErr) { toast.error(t('toast_process_error')); setSubmitting(false); return }

    // Advance process if needed
    await advanceProcess(instance, actionStep.ordre, newStatut)

    // Toast
    const toastKey = decision === 'approve' ? 'toast_step_approved'
      : decision === 'refuse' ? 'toast_step_refused'
      : decision === 'sign' ? 'toast_step_signed'
      : decision === 'avis' ? 'toast_step_avis'
      : 'toast_step_verified'
    toast.success(t(toastKey))

    setActionStep(null)
    setComment('')
    setConfirmed(false)
    clearCanvas()
    setSubmitting(false)
    await load()
  }

  async function advanceProcess(inst: Instance, currentOrdre: number, stepResult: StepStatut) {
    // Reload all steps at this order
    const { data: parallelSteps } = await supabase
      .from('workflow_instance_steps')
      .select('statut')
      .eq('instance_id', inst.id)
      .eq('ordre', currentOrdre)

    const allDone = parallelSteps?.every(s =>
      ['approuve', 'signe', 'avis_donne', 'skipped'].includes(s.statut)
    )
    const anyRefused = parallelSteps?.some(s => s.statut === 'refuse')

    if (anyRefused) {
      // Refuse the whole instance
      await supabase.from('workflow_instances').update({ statut: 'refuse', updated_at: new Date().toISOString() }).eq('id', inst.id)
      return
    }

    if (!allDone) return

    // Find next step order
    const { data: nextSteps } = await supabase
      .from('workflow_instance_steps')
      .select('id, ordre')
      .eq('instance_id', inst.id)
      .eq('statut', 'en_attente')
      .order('ordre')
      .limit(1)

    if (!nextSteps || nextSteps.length === 0) {
      // All done — approve
      await supabase.from('workflow_instances').update({ statut: 'approuve', updated_at: new Date().toISOString() }).eq('id', inst.id)
      return
    }

    const nextOrdre = nextSteps[0].ordre

    // Activate all steps at next order
    await supabase
      .from('workflow_instance_steps')
      .update({ statut: 'en_cours' })
      .eq('instance_id', inst.id)
      .eq('ordre', nextOrdre)

    await supabase
      .from('workflow_instances')
      .update({ current_step_ordre: nextOrdre, updated_at: new Date().toISOString() })
      .eq('id', inst.id)
  }

  async function cancelProcess() {
    if (!instance) return
    setCancelling(true)
    const { error } = await supabase
      .from('workflow_instances')
      .update({ statut: 'annule', updated_at: new Date().toISOString() })
      .eq('id', instance.id)

    if (error) { toast.error(t('toast_process_error')); setCancelling(false); return }

    // Skip remaining en_attente / en_cours steps
    await supabase
      .from('workflow_instance_steps')
      .update({ statut: 'skipped' })
      .eq('instance_id', instance.id)
      .in('statut', ['en_attente', 'en_cours'])

    toast.success(t('toast_process_cancelled'))
    setCancelling(false)
    setShowCancel(false)
    await load()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="text-center py-16 text-slate-400">{t('process_not_found')}</div>
    )
  }

  const instCfg = INSTANCE_STATUT_CONFIG[instance.statut]
  // Group steps by ordre for parallel display
  const ordres = [...new Set(steps.map(s => s.ordre))].sort((a, b) => a - b)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push(`${base}/processes`)}
            className="mt-0.5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-800">{instance.titre}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${instCfg.color}`}>
                {instCfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {instance.template?.nom} · {t('col_process_initiator')} : {instance.initiator?.full_name ?? '—'} ·{' '}
              {new Date(instance.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        {instance.statut === 'en_cours' && canDelete && (
          <button
            onClick={() => setShowCancel(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Ban className="h-3.5 w-3.5" />
            {t('instance_btn_cancel')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form data */}
        {instance.template?.form_schema && instance.template.form_schema.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              {t('instance_form_data')}
            </h2>
            <dl className="space-y-2">
              {instance.template.form_schema.map((field: FormField) => (
                <div key={field.id}>
                  <dt className="text-xs font-medium text-slate-400">{field.label}</dt>
                  <dd className="text-sm text-slate-700 mt-0.5">
                    {instance.form_data[field.key] || <span className="text-slate-300">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Timeline */}
        <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 ${
          instance.template?.form_schema?.length ? 'lg:col-span-2' : 'lg:col-span-3'
        }`}>
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-slate-400" />
            {t('instance_timeline')}
          </h2>

          <div className="space-y-3">
            {ordres.map((ordre, idx) => {
              const ordreSteps = steps.filter(s => s.ordre === ordre)
              const isParallel = ordreSteps.length > 1
              const isCurrent = ordre === instance.current_step_ordre

              return (
                <div key={ordre} className="relative">
                  {idx < ordres.length - 1 && (
                    <div className="absolute left-4 top-full w-0.5 h-3 bg-slate-200 z-0" />
                  )}

                  {isParallel && (
                    <div className="mb-2 flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs font-semibold text-violet-600">{t('step_parallel_badge')} — {t('step_label')} {ordre}</span>
                    </div>
                  )}

                  <div className={`space-y-2 ${isParallel ? 'pl-4 border-l-2 border-violet-200' : ''}`}>
                    {ordreSteps.map(is => {
                      const cfg = STEP_STATUT_CONFIG[is.statut]
                      const Icon = cfg.icon
                      const ts = is.step
                      const canActNow = canAct(is)

                      return (
                        <div
                          key={is.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                            isCurrent && is.statut === 'en_cours'
                              ? 'border-indigo-200 bg-indigo-50/40'
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${cfg.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {ts?.nom ?? `Étape ${is.ordre}`}
                              </p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
                                <Icon className="h-3 w-3" />
                                {t(`step_statut_${is.statut}`)}
                              </span>
                            </div>
                            {ts && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {t(`action_${ts.action_type}`)}
                              </p>
                            )}
                            {is.actor && is.traite_le && (
                              <p className="text-xs text-slate-400 mt-1">
                                {is.actor.full_name} · {new Date(is.traite_le).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                            {is.commentaire && (
                              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1 mt-1 italic">
                                "{is.commentaire}"
                              </p>
                            )}
                            {is.escalated_at && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" />
                                {t('escalation_notified')}
                              </span>
                            )}
                            {is.deadline_at && is.statut === 'en_cours' && (
                              <DeadlineBadge deadline={is.deadline_at} t={t} />
                            )}
                          </div>
                          {canActNow && (
                            <button
                              onClick={() => { setActionStep(is); setComment(''); setConfirmed(false); setSignMode('approbation'); clearCanvas() }}
                              className="shrink-0 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                              {t('btn_agir')}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Action modal */}
      {actionStep && actionStep.step && (
        <ActionModal
          step={actionStep}
          t={t}
          comment={comment}
          onCommentChange={setComment}
          signMode={signMode}
          onSignModeChange={setSignMode}
          confirmed={confirmed}
          onConfirmedChange={setConfirmed}
          canvasRef={canvasRef}
          hasSignature={hasSignature}
          onStartDraw={startDraw}
          onDraw={draw}
          onStopDraw={stopDraw}
          onClearCanvas={clearCanvas}
          submitting={submitting}
          onClose={() => setActionStep(null)}
          onSubmit={submitAction}
        />
      )}

      {/* Cancel confirm */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-red-100">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{t('instance_btn_cancel')}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('instance_cancelled_confirm')}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancel(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                {t('btn_cancel')}
              </button>
              <button
                onClick={cancelProcess}
                disabled={cancelling}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('btn_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DeadlineBadge ─────────────────────────────────────────────────────────

function DeadlineBadge({ deadline, t }: { deadline: string; t: ReturnType<typeof useTranslations> }) {
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  const diffDays = Math.round((dl - now) / (1000 * 60 * 60 * 24))
  const overdue = diffDays < 0

  return (
    <span className={`inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
      overdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
    }`}>
      <Clock className="h-3 w-3" />
      {overdue
        ? t('deadline_overdue', { days: Math.abs(diffDays) })
        : t('deadline_in', { days: diffDays })
      }
    </span>
  )
}

// ── ActionModal ───────────────────────────────────────────────────────────

function ActionModal({
  step, t, comment, onCommentChange, signMode, onSignModeChange,
  confirmed, onConfirmedChange, canvasRef, hasSignature,
  onStartDraw, onDraw, onStopDraw, onClearCanvas,
  submitting, onClose, onSubmit,
}: {
  step: InstanceStep
  t: ReturnType<typeof useTranslations>
  comment: string
  onCommentChange: (v: string) => void
  signMode: 'canvas' | 'approbation'
  onSignModeChange: (v: 'canvas' | 'approbation') => void
  confirmed: boolean
  onConfirmedChange: (v: boolean) => void
  canvasRef: React.RefObject<HTMLCanvasElement>
  hasSignature: boolean
  onStartDraw: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onDraw: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onStopDraw: () => void
  onClearCanvas: () => void
  submitting: boolean
  onClose: () => void
  onSubmit: (decision: 'approve' | 'refuse' | 'sign' | 'avis' | 'verify') => void
}) {
  const ts = step.step!
  const actionType = ts.action_type
  const modeSignature = ts.mode_signature ?? 'both'

  const titleKey = `action_modal_title_${actionType}` as const

  // Effective sign mode
  const effectiveSignMode = modeSignature === 'canvas' ? 'canvas'
    : modeSignature === 'approbation' ? 'approbation'
    : signMode

  const canSign = effectiveSignMode === 'canvas' ? hasSignature : confirmed

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            {actionType === 'approbation' && <ShieldCheck className="h-5 w-5 text-indigo-500" />}
            {actionType === 'signature'   && <PenLine className="h-5 w-5 text-violet-500" />}
            {actionType === 'avis'        && <MessageSquare className="h-5 w-5 text-sky-500" />}
            {actionType === 'verification' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {t(titleKey)}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700">{ts.nom}</p>

          {/* Signature block */}
          {actionType === 'signature' && (
            <div className="space-y-3">
              {/* Mode selector if 'both' */}
              {modeSignature === 'both' && (
                <div className="flex gap-2">
                  {(['canvas', 'approbation'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => onSignModeChange(m)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        signMode === m
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'border-slate-200 text-slate-600 hover:border-violet-300'
                      }`}
                    >
                      {m === 'canvas' ? t('mode_canvas') : t('mode_approbation')}
                    </button>
                  ))}
                </div>
              )}

              {effectiveSignMode === 'canvas' ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">{t('action_signature_canvas_label')}</p>
                  <p className="text-[11px] text-slate-400">{t('action_signature_canvas_hint')}</p>
                  <canvas
                    ref={canvasRef}
                    width={360}
                    height={140}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl cursor-crosshair bg-slate-50"
                    onMouseDown={onStartDraw}
                    onMouseMove={onDraw}
                    onMouseUp={onStopDraw}
                    onMouseLeave={onStopDraw}
                  />
                  <button
                    onClick={onClearCanvas}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    {t('action_signature_clear')}
                  </button>
                </div>
              ) : (
                <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:border-violet-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => onConfirmedChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t('action_approval_confirm_label')}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t('action_approval_confirm_hint')}</p>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* Approbation confirm */}
          {actionType === 'approbation' && (
            <p className="text-xs text-slate-500">{t('action_approbation_hint')}</p>
          )}

          {/* Avis confirm */}
          {actionType === 'avis' && (
            <p className="text-xs text-slate-500">{t('action_avis_hint')}</p>
          )}

          {/* Verification */}
          {actionType === 'verification' && (
            <p className="text-xs text-slate-500">{t('action_verification_hint')}</p>
          )}

          {/* Comment */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">{t('action_field_comment')}</label>
            <textarea
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder={t('action_field_comment_placeholder')}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 justify-end p-6 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            {t('btn_cancel')}
          </button>

          {actionType === 'approbation' && (
            <>
              <button
                onClick={() => onSubmit('refuse')}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <XCircle className="h-3.5 w-3.5" />
                {t('action_btn_refuse')}
              </button>
              <button
                onClick={() => onSubmit('approve')}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('action_btn_approve')}
              </button>
            </>
          )}

          {actionType === 'signature' && (
            <button
              onClick={() => onSubmit('sign')}
              disabled={submitting || !canSign}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <PenLine className="h-3.5 w-3.5" />
              {t('action_btn_sign')}
            </button>
          )}

          {actionType === 'avis' && (
            <button
              onClick={() => onSubmit('avis')}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('action_btn_give_avis')}
            </button>
          )}

          {actionType === 'verification' && (
            <button
              onClick={() => onSubmit('verify')}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('action_btn_verify')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
