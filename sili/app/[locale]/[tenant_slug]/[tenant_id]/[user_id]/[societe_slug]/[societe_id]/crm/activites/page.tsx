'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { Activity, Plus, X, Loader2, Pencil, Trash2, CheckCircle2, Search } from 'lucide-react'
import dayjs from 'dayjs'

type TypeActivite   = 'appel' | 'email' | 'reunion' | 'autre'
type StatutActivite = 'a_faire' | 'fait' | 'annule'

interface Activite {
  id: string; type: TypeActivite; titre: string; description: string | null
  date_prevue: string | null; statut: StatutActivite; assigne_a: string | null
  assigne: { full_name: string } | null
  lead: { nom: string } | null
  opportunite: { titre: string } | null
}

interface CrmUser { id: string; full_name: string }

const TYPE_CONFIG: Record<TypeActivite, { label: string; color: string; bg: string }> = {
  appel:   { label: 'Appel',    color: 'text-blue-600',   bg: 'bg-blue-50'   },
  email:   { label: 'Email',    color: 'text-violet-600', bg: 'bg-violet-50' },
  reunion: { label: 'Réunion',  color: 'text-amber-600',  bg: 'bg-amber-50'  },
  autre:   { label: 'Autre',    color: 'text-slate-600',  bg: 'bg-slate-50'  },
}
const STATUT_COLOR: Record<StatutActivite, string> = {
  a_faire: 'bg-amber-100 text-amber-700',
  fait:    'bg-emerald-100 text-emerald-700',
  annule:  'bg-slate-100 text-slate-500',
}

const inputCls  = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const selectCls = 'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function ActivitesPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [activites,     setActivites]     = useState<Activite[]>([])
  const [search,        setSearch]        = useState('')
  const [filterStatut,  setFilterStatut]  = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [crmUsers,  setCrmUsers]  = useState<CrmUser[]>([])

  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Activite | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [aTitre,     setATitre]     = useState('')
  const [aType,      setAType]      = useState<TypeActivite>('appel')
  const [aDesc,      setADesc]      = useState('')
  const [aDate,      setADate]      = useState('')
  const [aStatut,    setAStatut]    = useState<StatutActivite>('a_faire')
  const [aAssigneA,  setAAssigneA]  = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'crm')
        setCanManage(['contributeur', 'gestionnaire', 'admin'].includes(perm))
        setCanDelete(['gestionnaire', 'admin'].includes(perm))
      } else { setCanManage(true); setCanDelete(true) }
      // Charger les membres CRM pour le sélecteur d'assignation
      const { data: perms } = await supabase.from('user_module_permissions').select('user_id').eq('societe_id', societeId).eq('module', 'crm').neq('permission', 'none')
      const uids = (perms ?? []).map((p: any) => p.user_id)
      if (uids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', uids)
        setCrmUsers((profs ?? []) as CrmUser[])
      }
      await loadActivites(); setLoading(false)
    }
    init()
  }, [societeId])

  const loadActivites = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('crm_activites')
      .select('id, type, titre, description, date_prevue, statut, assigne_a, assigne:profiles!assigne_a(full_name), lead:crm_leads!lead_id(nom), opportunite:crm_opportunites!opportunite_id(titre)')
      .eq('societe_id', societeId)
      .order('date_prevue', { ascending: true, nullsFirst: false })
    setActivites(data ?? [])
  }, [societeId])

  function openNew() {
    setEditing(null); setATitre(''); setAType('appel'); setADesc(''); setADate(''); setAStatut('a_faire'); setAAssigneA(currentUserId); setShowModal(true)
  }
  function openEdit(a: Activite) {
    setEditing(a); setATitre(a.titre); setAType(a.type); setADesc(a.description ?? ''); setADate(a.date_prevue ? dayjs(a.date_prevue).format('YYYY-MM-DDTHH:mm') : ''); setAStatut(a.statut); setAAssigneA(a.assigne_a ?? currentUserId); setShowModal(true)
  }

  async function save() {
    if (!aTitre.trim()) return
    setSaving(true)
    const assigneId = aAssigneA || currentUserId
    const payload = {
      titre: aTitre.trim(), type: aType, description: aDesc.trim() || null,
      date_prevue: aDate || null, statut: aStatut,
      assigne_a: assigneId,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    if (editing) {
      const { error } = await (supabase as any).from('crm_activites').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_activite_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'activite_updated', resourceType: 'crm_activites', resourceId: editing.id, metadata: { titre: aTitre.trim() } })
    } else {
      const { data: newA, error } = await (supabase as any).from('crm_activites').insert(payload).select('id').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_activite_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'activite_created', resourceType: 'crm_activites', resourceId: newA?.id, metadata: { titre: aTitre.trim(), type: aType } })
      // Notifier l'assigné si différent du créateur
      if (assigneId && assigneId !== currentUserId) {
        await supabase.from('notifications').insert({
          tenant_id: fullTenantId, user_id: assigneId, type: 'info',
          titre: 'Nouvelle activité assignée',
          message: `L'activité "${aTitre.trim()}" vous a été assignée.`,
        })
      }
    }
    setShowModal(false); setSaving(false); await loadActivites()
  }

  async function marquerFait(a: Activite) {
    await (supabase as any).from('crm_activites').update({ statut: 'fait', updated_at: new Date().toISOString() }).eq('id', a.id)
    setActivites(prev => prev.map(x => x.id === a.id ? { ...x, statut: 'fait' } : x))
    toast.success(t('toast_activite_fait'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'activite_completed', resourceType: 'crm_activites', resourceId: a.id, metadata: { titre: a.titre } })
  }

  async function deleteActivite(a: Activite) {
    if (!confirm(t('confirm_delete_activite'))) return
    const { error } = await (supabase as any).from('crm_activites').delete().eq('id', a.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_activite_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'activite_deleted', resourceType: 'crm_activites', resourceId: a.id, metadata: { titre: a.titre } })
    await loadActivites()
  }

  const filtered = activites.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.titre.toLowerCase().includes(q) || (a.opportunite?.titre ?? '').toLowerCase().includes(q)
    const matchStatut = !filterStatut || a.statut === filterStatut
    const matchType   = !filterType   || a.type   === filterType
    return matchSearch && matchStatut && matchType
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Activity className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('activites_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-bold">{activites.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[140px]">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-full" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tous types</option>
            {(['appel','email','reunion','autre'] as TypeActivite[]).map(t2 => <option key={t2} value={t2}>{TYPE_CONFIG[t2].label}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Tous statuts</option>
            <option value="a_faire">À faire</option>
            <option value="fait">Fait</option>
            <option value="annule">Annulé</option>
          </select>
          {canManage && (
            <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
              <Plus className="h-4 w-4" /> {t('btn_new_activite')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16"><Activity className="h-10 w-10 text-slate-200 mb-3" /><p className="text-slate-400 text-sm">{t('activites_empty')}</p></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(a => {
              const cfg = TYPE_CONFIG[a.type]
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Activity className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.titre}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {cfg.label}
                      {a.opportunite?.titre && ` · ${a.opportunite.titre}`}
                      {a.lead?.nom && ` · ${a.lead.nom}`}
                      {a.date_prevue && ` · ${dayjs(a.date_prevue).format('DD/MM/YYYY HH:mm')}`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUT_COLOR[a.statut]}`}>
                    {a.statut === 'a_faire' ? 'À faire' : a.statut === 'fait' ? 'Fait' : 'Annulé'}
                  </span>
                  <div className="flex items-center gap-1">
                    {canManage && a.statut === 'a_faire' && (
                      <button onClick={() => marquerFait(a)} title={t('btn_marquer_fait')} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
                    )}
                    {canManage && <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => deleteActivite(a)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{editing ? t('modal_edit_activite') : t('modal_new_activite')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_titre')} *</label>
                <input className={inputCls} value={aTitre} onChange={e => setATitre(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_type')}</label>
                  <select className={selectCls} value={aType} onChange={e => setAType(e.target.value as TypeActivite)}>
                    {(['appel','email','reunion','autre'] as TypeActivite[]).map(x => <option key={x} value={x}>{TYPE_CONFIG[x].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_statut')}</label>
                  <select className={selectCls} value={aStatut} onChange={e => setAStatut(e.target.value as StatutActivite)}>
                    <option value="a_faire">À faire</option>
                    <option value="fait">Fait</option>
                    <option value="annule">Annulé</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_date_prevue')}</label>
                <input type="datetime-local" className={inputCls} value={aDate} onChange={e => setADate(e.target.value)} />
              </div>
              {crmUsers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_assigne_a')}</label>
                  <select className={selectCls} value={aAssigneA} onChange={e => setAAssigneA(e.target.value)}>
                    {crmUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.id === currentUserId ? ' (moi)' : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                <textarea rows={3} className={inputCls} value={aDesc} onChange={e => setADesc(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={save} disabled={saving || !aTitre.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
