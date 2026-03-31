'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Search, MoreHorizontal, Building2, Plus, X, Loader2,
  ExternalLink, Edit2, Power, Trash2, HardDrive, Settings,
  MapPin, Phone, Mail, Globe, Briefcase, Scale, Hash, FileText,
  Calendar, CheckCircle2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import Link from 'next/link'

interface Societe {
  id: string
  raison_sociale: string
  sigle: string | null
  ville: string | null
  pays: string | null
  devise: string | null
  storage_gb: number
  is_active: boolean | null
  created_at: string | null
}

interface SocieteDetail {
  id: string
  raison_sociale: string
  sigle: string | null
  logo_url: string | null
  adresse: string | null
  ville: string | null
  pays: string | null
  telephone: string | null
  email: string | null
  site_web: string | null
  numero_contribuable: string | null
  numero_rccm: string | null
  capital_social: number | null
  devise: string | null
  secteur_activite: string | null
  forme_juridique: string | null
  exercice_fiscal_debut: string | null
  storage_gb: number
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type FormState = {
  raison_sociale: string
  sigle: string
  adresse: string
  ville: string
  pays: string
  telephone: string
  email: string
  devise: string
  forme_juridique: string
  secteur_activite: string
  numero_contribuable: string
  numero_rccm: string
  storage_gb: string
}

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const defaultForm: FormState = {
  raison_sociale: '', sigle: '', adresse: '', ville: 'Yaoundé',
  pays: 'Cameroun', telephone: '', email: '', devise: 'XAF',
  forme_juridique: 'SARL', secteur_activite: '',
  numero_contribuable: '', numero_rccm: '', storage_gb: '',
}

export default function SocietesPage() {
  const t = useTranslations('societes')
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params.tenant_slug as string
  const tenantId = params.tenant_id as string
  const userId = params.user_id as string

  const [societes, setSocietes] = useState<Societe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editModal, setEditModal] = useState<Societe | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [tenantMaxStorage, setTenantMaxStorage] = useState<number>(0)
  const [tenantMaxSocietes, setTenantMaxSocietes] = useState<number>(0)
  const [usedStorage, setUsedStorage] = useState<number>(0)
  // UUID complet du tenant, récupéré depuis le profil (tenant_id dans l'URL est tronqué)
  const [fullTenantId, setFullTenantId] = useState<string>('')
  const [detailModal, setDetailModal] = useState<SocieteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkSessionAndFetch()
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function checkSessionAndFetch() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }
    const realTenantId = profile?.tenant_id ?? ''
    setFullTenantId(realTenantId)
    await fetchAll(realTenantId)
  }

  async function fetchAll(realTenantId?: string) {
    const tid = realTenantId ?? fullTenantId
    if (!tid) return
    setLoading(true)
    const [tenantRes, societesRes] = await Promise.all([
      supabase.from('tenants').select('max_storage_gb, max_societes').eq('id', tid).single(),
      supabase.from('societes')
        .select('id, raison_sociale, sigle, ville, pays, devise, storage_gb, is_active, created_at')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: false }),
    ])

    if (tenantRes.error) {
      console.error('[tenants RLS]', tenantRes.error.message)
    } else if (tenantRes.data) {
      setTenantMaxStorage(Number(tenantRes.data.max_storage_gb) || 0)
      setTenantMaxSocietes(Number(tenantRes.data.max_societes) || 0)
    }

    if (societesRes.error) toast.error('Erreur chargement')
    else {
      const list = societesRes.data || []
      setSocietes(list)
      setUsedStorage(list.reduce((sum, s) => sum + (Number(s.storage_gb) || 0), 0))
    }
    setLoading(false)
  }

  // Stockage restant = max tenant - déjà alloué aux sociétés (hors édition courante)
  function getRemainingStorage(excludeId?: string) {
    const excluded = excludeId
      ? societes.find(s => s.id === excludeId)?.storage_gb || 0
      : 0
    return Math.max(0, tenantMaxStorage - usedStorage + Number(excluded))
  }

  async function handleCreate() {
    if (!form.raison_sociale.trim()) { toast.error(t('error_raison_sociale_required')); return }
    const storageVal = parseFloat(form.storage_gb)
    const remaining = getRemainingStorage()
    if (isNaN(storageVal) || storageVal <= 0) { toast.error(t('storage_error_zero')); return }
    if (storageVal > remaining) { toast.error(t('storage_error_exceeded', { available: remaining.toFixed(2) })); return }

    setSaving(true)
    const { error } = await supabase.from('societes').insert({
      raison_sociale: form.raison_sociale,
      sigle: form.sigle || null,
      adresse: form.adresse || null,
      ville: form.ville || null,
      pays: form.pays,
      telephone: form.telephone || null,
      email: form.email || null,
      devise: form.devise,
      forme_juridique: form.forme_juridique,
      secteur_activite: form.secteur_activite || null,
      numero_contribuable: form.numero_contribuable || null,
      numero_rccm: form.numero_rccm || null,
      storage_gb: storageVal,
      tenant_id: fullTenantId,
    })
    if (error) toast.error(t('toast_create_error'))
    else {
      toast.success(t('toast_create_success'))
      setShowCreateModal(false)
      setForm(defaultForm)
      await fetchAll()
    }
    setSaving(false)
  }

  async function handleUpdate() {
    if (!editModal) return
    setSaving(true)
    const { error } = await supabase.from('societes').update({
      raison_sociale: form.raison_sociale,
      sigle: form.sigle || null,
      adresse: form.adresse || null,
      ville: form.ville || null,
      pays: form.pays,
      telephone: form.telephone || null,
      email: form.email || null,
      devise: form.devise,
      forme_juridique: form.forme_juridique,
      secteur_activite: form.secteur_activite || null,
      numero_contribuable: form.numero_contribuable || null,
      numero_rccm: form.numero_rccm || null,
    }).eq('id', editModal.id)
    if (error) toast.error(t('toast_update_error'))
    else { toast.success(t('toast_update_success')); setEditModal(null); setForm(defaultForm); await fetchAll() }
    setSaving(false)
  }

  async function toggleStatus(s: Societe) {
    const { error } = await supabase.from('societes').update({ is_active: !s.is_active }).eq('id', s.id)
    if (!error) {
      setSocietes(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x))
      toast.success(t('toast_toggle_success'))
    }
    setDropdownOpen(null)
  }

  async function handleDelete(s: Societe) {
    if (!confirm(t('confirm_delete'))) return
    const { error } = await supabase.from('societes').delete().eq('id', s.id)
    if (!error) {
      setSocietes(prev => prev.filter(x => x.id !== s.id))
      setUsedStorage(prev => Math.max(0, prev - Number(s.storage_gb)))
      toast.success(t('toast_delete_success'))
    } else toast.error(t('toast_delete_error'))
    setDropdownOpen(null)
  }

  function openEdit(s: Societe) {
    setEditModal(s)
    setForm({
      ...defaultForm,
      raison_sociale: s.raison_sociale,
      sigle: s.sigle || '',
      ville: s.ville || 'Yaoundé',
      pays: s.pays || 'Cameroun',
      devise: s.devise || 'XAF',
      storage_gb: String(s.storage_gb),
    })
    setDropdownOpen(null)
  }

  async function openDetail(id: string) {
    setDetailModal(null)
    setDetailLoading(true)
    const { data, error } = await supabase
      .from('societes')
      .select('id, raison_sociale, sigle, logo_url, adresse, ville, pays, telephone, email, site_web, numero_contribuable, numero_rccm, capital_social, devise, secteur_activite, forme_juridique, exercice_fiscal_debut, storage_gb, is_active, created_at, updated_at')
      .eq('id', id)
      .single()
    setDetailLoading(false)
    if (!error && data) setDetailModal(data as SocieteDetail)
  }

  function openCreate() {
    const remaining = getRemainingStorage()
    setForm({ ...defaultForm, storage_gb: remaining > 0 ? String(remaining) : '' })
    setShowCreateModal(true)
  }

  const tenantBase = `/${tenantSlug}/${tenantId}/${userId}`
  const filtered = societes.filter(s =>
    s.raison_sociale?.toLowerCase().includes(search.toLowerCase()) ||
    s.sigle?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quota sociétés */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <span className={`font-bold ${societes.length >= tenantMaxSocietes ? 'text-red-600' : 'text-slate-700'}`}>{societes.length}</span>
              {' / '}
              <span className="font-bold text-slate-700">{tenantMaxSocietes}</span> sociétés
            </span>
          </div>
          {/* Quota stockage */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <HardDrive className="h-3.5 w-3.5 text-slate-400" />
            <span>
              <span className="font-bold text-slate-700">{usedStorage.toFixed(2)}</span>
              {' / '}
              <span className="font-bold text-slate-700">{tenantMaxStorage.toFixed(2)}</span> Go
            </span>
          </div>
          <button
            onClick={openCreate}
            disabled={tenantMaxSocietes > 0 && societes.length >= tenantMaxSocietes}
            title={tenantMaxSocietes > 0 && societes.length >= tenantMaxSocietes ? t('quota_societes_reached') : undefined}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Plus className="h-4 w-4" />{t('new_company')}
          </button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
            <Building2 className="h-6 w-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 w-full max-w-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400 text-slate-700 font-medium"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm">{t('loading')}</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">{t('col_name')}</th>
                    <th className="px-6 py-4">{t('col_ville')}</th>
                    <th className="px-6 py-4">{t('col_devise')}</th>
                    <th className="px-6 py-4">{t('col_storage')}</th>
                    <th className="px-6 py-4">{t('col_status')}</th>
                    <th className="px-6 py-4">{t('col_created')}</th>
                    <th className="px-6 py-4 text-center">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <Building2 className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-600">{t('empty_title')}</p>
                          <p className="text-xs mt-1 text-slate-400">{t('empty_subtitle')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => openDetail(s.id)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{s.raison_sociale}</div>
                        {s.sigle && <div className="text-[11px] text-slate-400 font-mono mt-0.5">{s.sigle}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{s.ville || '—'}, {s.pays ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs font-bold">{s.devise ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                          {Number(s.storage_gb).toFixed(2)} Go
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.is_active ? t('status_active') : t('status_inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{s.created_at ? dayjs(s.created_at).format('DD MMM YYYY') : '—'}</td>
                      <td className="px-6 py-4 text-center relative" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`${tenantBase}/${toSlug(s.raison_sociale)}/${s.id}/dashboard`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />{t('action_access')}
                          </Link>
                          <button
                            onClick={() => setDropdownOpen(dropdownOpen === s.id ? null : s.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </div>
                        {dropdownOpen === s.id && (
                          <div ref={dropdownRef} className="absolute right-4 top-12 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95">
                            <div className="py-1">
                              <Link
                                href={`${tenantBase}/${toSlug(s.raison_sociale)}/${s.id}/settings`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium"
                              >
                                <Settings className="h-4 w-4" /> {t('action_settings')}
                              </Link>
                              <button onClick={() => openEdit(s)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 border-t border-slate-100">
                                <Edit2 className="h-4 w-4" /> {t('action_edit')}
                              </button>
                              <button onClick={() => toggleStatus(s)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 border-t border-slate-100">
                                <Power className="h-4 w-4" /> {t('action_deactivate')}
                              </button>
                              <button onClick={() => handleDelete(s)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">
                                <Trash2 className="h-4 w-4" /> {t('action_delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Création */}
      {showCreateModal && (
        <SocieteModal
          title={t('modal_create_title')}
          form={form} setForm={setForm}
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          submitLabel={t('btn_create')}
          cancelLabel={t('btn_cancel')}
          remainingStorage={getRemainingStorage()}
          isCreate
          t={t}
        />
      )}

      {/* Modal Détail */}
      {(detailModal || detailLoading) && (
        <SocieteDetailModal
          societe={detailModal}
          loading={detailLoading}
          onClose={() => { setDetailModal(null); setDetailLoading(false) }}
          tenantBase={tenantBase}
          t={t}
        />
      )}

      {/* Modal Édition */}
      {editModal && (
        <SocieteModal
          title={t('modal_edit_title')}
          form={form} setForm={setForm}
          saving={saving}
          onClose={() => setEditModal(null)}
          onSubmit={handleUpdate}
          submitLabel={t('btn_save')}
          cancelLabel={t('btn_cancel')}
          remainingStorage={getRemainingStorage(editModal.id)}
          isCreate={false}
          t={t}
        />
      )}
    </div>
  )
}

interface ModalProps {
  title: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  cancelLabel: string
  remainingStorage: number
  isCreate: boolean
  t: ReturnType<typeof useTranslations>
}

function SocieteModal({ title, form, setForm, saving, onClose, onSubmit, submitLabel, cancelLabel, remainingStorage, isCreate, t }: ModalProps) {
  const storageVal = parseFloat(form.storage_gb)
  const storageValid = !isNaN(storageVal) && storageVal > 0 && storageVal <= remainingStorage
  const storageInvalid = form.storage_gb !== '' && !storageValid
  const canSubmit = !saving && (!isCreate || storageValid)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Raison Sociale — full width */}
            <div className="col-span-full">
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                {t('field_raison_sociale')} *
              </label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder={t('placeholder_raison_sociale')}
                value={form.raison_sociale}
                onChange={e => setForm(f => ({ ...f, raison_sociale: e.target.value }))}
              />
            </div>

            {/* Sigle */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_sigle')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder={t('placeholder_sigle')}
                value={form.sigle}
                onChange={e => setForm(f => ({ ...f, sigle: e.target.value }))}
              />
            </div>

            {/* Forme Juridique */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_forme_juridique')}</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                value={form.forme_juridique}
                onChange={e => setForm(f => ({ ...f, forme_juridique: e.target.value }))}
              >
                {['SARL', 'SA', 'GIE', 'ETS', 'SNC', 'Entreprise Individuelle', 'Autre'].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Numéro Contribuable */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_numero_contribuable')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none font-mono"
                placeholder={t('placeholder_numero_contribuable')}
                value={form.numero_contribuable}
                onChange={e => setForm(f => ({ ...f, numero_contribuable: e.target.value }))}
              />
            </div>

            {/* RCCM */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_numero_rccm')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none font-mono"
                placeholder={t('placeholder_numero_rccm')}
                value={form.numero_rccm}
                onChange={e => setForm(f => ({ ...f, numero_rccm: e.target.value }))}
              />
            </div>

            {/* Ville */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_ville')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder={t('placeholder_ville')}
                value={form.ville}
                onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
              />
            </div>

            {/* Pays */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_pays')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder={t('placeholder_pays')}
                value={form.pays}
                onChange={e => setForm(f => ({ ...f, pays: e.target.value }))}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_telephone')}</label>
              <input
                type="tel"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                value={form.telephone}
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_email')}</label>
              <input
                type="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* Devise */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_devise')}</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                value={form.devise}
                onChange={e => setForm(f => ({ ...f, devise: e.target.value }))}
              >
                {['XAF', 'XOF', 'EUR', 'USD', 'GBP', 'NGN', 'GHS'].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Secteur d'activité */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('field_secteur_activite')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                value={form.secteur_activite}
                onChange={e => setForm(f => ({ ...f, secteur_activite: e.target.value }))}
              />
            </div>

            {/* Stockage alloué — toujours visible, logique spéciale création */}
            {isCreate && (
              <div className="col-span-full">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  {t('field_storage_gb')} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors pr-12 ${
                      storageInvalid
                        ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
                        : storageValid
                          ? 'border-emerald-400 bg-emerald-50 focus:ring-2 focus:ring-emerald-200'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                    }`}
                    placeholder={`${remainingStorage.toFixed(2)} Go`}
                    value={form.storage_gb}
                    onChange={e => setForm(f => ({ ...f, storage_gb: e.target.value }))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Go</span>
                </div>
                <p className={`text-xs mt-1.5 flex items-center gap-1 ${storageInvalid ? 'text-red-500' : 'text-slate-400'}`}>
                  {storageInvalid
                    ? (storageVal <= 0
                        ? t('storage_error_zero')
                        : t('storage_error_exceeded', { available: remainingStorage.toFixed(2) }))
                    : t('storage_hint', { available: remainingStorage.toFixed(2) })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50/50">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            {cancelLabel}
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Détail Société ────────────────────────────────────────────────────

interface DetailModalProps {
  societe: SocieteDetail | null
  loading: boolean
  onClose: () => void
  tenantBase: string
  t: ReturnType<typeof useTranslations>
}

function SocieteDetailModal({ societe, loading, onClose, tenantBase, t }: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              {loading || !societe
                ? <div className="h-5 w-48 bg-slate-200 animate-pulse rounded-lg" />
                : <>
                    <h3 className="text-xl font-bold text-slate-800">{societe.raison_sociale}</h3>
                    {societe.sigle && <p className="text-xs font-mono text-slate-400 mt-0.5">{societe.sigle}</p>}
                  </>
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            {societe && (
              <Link
                href={`${tenantBase}/${toSlug(societe.raison_sociale)}/${societe.id}/dashboard`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />{t('action_access')}
              </Link>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading || !societe ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">

              {/* Statut + dates */}
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${societe.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {societe.is_active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {societe.is_active ? t('status_active') : t('status_inactive')}
                </span>
                {societe.forme_juridique && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                    <Scale className="h-3.5 w-3.5" />{societe.forme_juridique}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 font-mono">
                  {societe.devise}
                </span>
              </div>

              {/* Grille infos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Coordonnées */}
                {(societe.adresse || societe.ville) && (
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label={t('field_adresse')}>
                    {[societe.adresse, societe.ville, societe.pays].filter(Boolean).join(', ')}
                  </DetailRow>
                )}
                {!societe.adresse && societe.ville && null}
                {!societe.adresse && !societe.ville && (
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label={t('field_ville')}>
                    {[societe.ville, societe.pays].filter(Boolean).join(', ')}
                  </DetailRow>
                )}
                {societe.telephone && (
                  <DetailRow icon={<Phone className="h-4 w-4" />} label={t('field_telephone')}>
                    {societe.telephone}
                  </DetailRow>
                )}
                {societe.email && (
                  <DetailRow icon={<Mail className="h-4 w-4" />} label={t('field_email')}>
                    {societe.email}
                  </DetailRow>
                )}
                {societe.site_web && (
                  <DetailRow icon={<Globe className="h-4 w-4" />} label={t('detail_site_web')}>
                    {societe.site_web}
                  </DetailRow>
                )}
                {societe.secteur_activite && (
                  <DetailRow icon={<Briefcase className="h-4 w-4" />} label={t('field_secteur_activite')}>
                    {societe.secteur_activite}
                  </DetailRow>
                )}
                {societe.numero_contribuable && (
                  <DetailRow icon={<Hash className="h-4 w-4" />} label={t('field_numero_contribuable')}>
                    <span className="font-mono">{societe.numero_contribuable}</span>
                  </DetailRow>
                )}
                {societe.numero_rccm && (
                  <DetailRow icon={<FileText className="h-4 w-4" />} label={t('field_numero_rccm')}>
                    <span className="font-mono">{societe.numero_rccm}</span>
                  </DetailRow>
                )}
                {societe.capital_social != null && (
                  <DetailRow icon={<Scale className="h-4 w-4" />} label={t('detail_capital_social')}>
                    {Number(societe.capital_social).toLocaleString()} {societe.devise}
                  </DetailRow>
                )}
                <DetailRow icon={<HardDrive className="h-4 w-4" />} label={t('col_storage')}>
                  {Number(societe.storage_gb).toFixed(2)} Go
                </DetailRow>
                <DetailRow icon={<Calendar className="h-4 w-4" />} label={t('col_created')}>
                  {dayjs(societe.created_at).format('DD MMM YYYY')}
                </DetailRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-700 break-words">{children}</p>
      </div>
    </div>
  )
}
