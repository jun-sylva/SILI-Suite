'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Search, MoreHorizontal, Building2, Plus, X, Loader2,
  ExternalLink, Edit2, Power, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import Link from 'next/link'

interface Societe {
  id: string
  raison_sociale: string
  sigle: string | null
  ville: string | null
  pays: string
  devise: string
  is_active: boolean
  created_at: string
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
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'tenant_admin' && profile?.role !== 'super_admin') { router.push('/login'); return }
    fetchSocietes()
  }

  async function fetchSocietes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('societes')
      .select('id, raison_sociale, sigle, ville, pays, devise, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) toast.error('Erreur chargement')
    else setSocietes(data || [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.raison_sociale.trim()) { toast.error(t('error_raison_sociale_required')); return }
    setSaving(true)
    const { error } = await supabase.from('societes').insert({ ...form, tenant_id: tenantId })
    if (error) toast.error(t('toast_create_error'))
    else { toast.success(t('toast_create_success')); setShowCreateModal(false); setForm(defaultForm); fetchSocietes() }
    setSaving(false)
  }

  async function handleUpdate() {
    if (!editModal) return
    setSaving(true)
    const { error } = await supabase.from('societes').update({
      raison_sociale: form.raison_sociale, sigle: form.sigle, adresse: form.adresse,
      ville: form.ville, pays: form.pays, telephone: form.telephone,
      email: form.email, devise: form.devise, forme_juridique: form.forme_juridique,
      secteur_activite: form.secteur_activite,
    }).eq('id', editModal.id)
    if (error) toast.error(t('toast_update_error'))
    else { toast.success(t('toast_update_success')); setEditModal(null); setForm(defaultForm); fetchSocietes() }
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
    if (!error) { setSocietes(prev => prev.filter(x => x.id !== s.id)); toast.success(t('toast_delete_success')) }
    else toast.error(t('toast_delete_error'))
    setDropdownOpen(null)
  }

  function openEdit(s: Societe) {
    setEditModal(s)
    setForm({ ...defaultForm, raison_sociale: s.raison_sociale, sigle: s.sigle || '', ville: s.ville || 'Yaoundé', pays: s.pays, devise: s.devise })
    setDropdownOpen(null)
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
          <button
            onClick={() => { setForm(defaultForm); setShowCreateModal(true) }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-sm text-sm"
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
                    <th className="px-6 py-4">{t('col_status')}</th>
                    <th className="px-6 py-4">{t('col_created')}</th>
                    <th className="px-6 py-4 text-center">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <Building2 className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-600">{t('empty_title')}</p>
                          <p className="text-xs mt-1 text-slate-400">{t('empty_subtitle')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{s.raison_sociale}</div>
                        {s.sigle && <div className="text-[11px] text-slate-400 font-mono mt-0.5">{s.sigle}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{s.ville || '—'}, {s.pays}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs font-bold">{s.devise}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.is_active ? t('status_active') : t('status_inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{dayjs(s.created_at).format('DD MMM YYYY')}</td>
                      <td className="px-6 py-4 text-center relative">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`${tenantBase}/${toSlug(s.raison_sociale)}/${s.id}/dashboard`}
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
                              <button onClick={() => openEdit(s)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
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
  t: ReturnType<typeof useTranslations>
}

function SocieteModal({ title, form, setForm, saving, onClose, onSubmit, submitLabel, cancelLabel, t }: ModalProps) {
  const fields: { key: keyof FormState; label: string; placeholder?: string; type?: string }[] = [
    { key: 'raison_sociale', label: t('field_raison_sociale'), placeholder: t('placeholder_raison_sociale') },
    { key: 'sigle', label: t('field_sigle'), placeholder: t('placeholder_sigle') },
    { key: 'ville', label: t('field_ville'), placeholder: t('placeholder_ville') },
    { key: 'pays', label: t('field_pays'), placeholder: t('placeholder_pays') },
    { key: 'telephone', label: t('field_telephone'), type: 'tel' },
    { key: 'email', label: t('field_email'), type: 'email' },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Raison Sociale full-width */}
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

            {fields.slice(1).map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
                <input
                  type={type || 'text'}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}

            {/* Forme juridique */}
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
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50/50">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            {cancelLabel}
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-colors text-sm disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
