'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { BookUser, Plus, X, Loader2, Pencil, Trash2, Search, Mail, Phone } from 'lucide-react'

interface Contact {
  id: string; nom: string; prenom: string | null; email: string | null
  telephone: string | null; entreprise: string | null; poste: string | null; notes: string | null
}

const inputCls = 'block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function ContactsPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const societeId = params.societe_id as string

  const [loading,       setLoading]       = useState(true)
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [search,        setSearch]        = useState('')
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Contact | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [cNom,      setCNom]      = useState('')
  const [cPrenom,   setCPrenom]   = useState('')
  const [cEmail,    setCEmail]    = useState('')
  const [cTel,      setCTel]      = useState('')
  const [cEntreprise, setCEntreprise] = useState('')
  const [cPoste,    setCPoste]    = useState('')
  const [cNotes,    setCNotes]    = useState('')

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
      await loadContacts(); setLoading(false)
    }
    init()
  }, [societeId])

  const loadContacts = useCallback(async () => {
    const { data } = await supabase.from('crm_contacts').select('*').eq('societe_id', societeId).order('nom', { ascending: true })
    setContacts(data ?? [])
  }, [societeId])

  function openNew() {
    setEditing(null); setCNom(''); setCPrenom(''); setCEmail(''); setCTel(''); setCEntreprise(''); setCPoste(''); setCNotes(''); setShowModal(true)
  }
  function openEdit(c: Contact) {
    setEditing(c); setCNom(c.nom); setCPrenom(c.prenom ?? ''); setCEmail(c.email ?? ''); setCTel(c.telephone ?? ''); setCEntreprise(c.entreprise ?? ''); setCPoste(c.poste ?? ''); setCNotes(c.notes ?? ''); setShowModal(true)
  }

  async function save() {
    if (!cNom.trim()) return
    setSaving(true)
    const payload = {
      nom: cNom.trim(), prenom: cPrenom.trim() || null, email: cEmail.trim() || null,
      telephone: cTel.trim() || null, entreprise: cEntreprise.trim() || null,
      poste: cPoste.trim() || null, notes: cNotes.trim() || null,
      societe_id: societeId, tenant_id: fullTenantId, created_by: currentUserId,
    }
    if (editing) {
      const { error } = await supabase.from('crm_contacts').update({ ...payload, updated_at: new Date().toISOString() } as any).eq('id', editing.id)
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_contact_updated'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'contact_updated', resourceType: 'crm_contacts', resourceId: editing.id, metadata: { nom: cNom.trim() } })
    } else {
      const { data: newC, error } = await supabase.from('crm_contacts').insert(payload as any).select('id').single()
      if (error) { toast.error(t('toast_error')); setSaving(false); return }
      toast.success(t('toast_contact_created'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'contact_created', resourceType: 'crm_contacts', resourceId: newC?.id, metadata: { nom: cNom.trim() } })
    }
    setShowModal(false); setSaving(false); await loadContacts()
  }

  async function deleteContact(c: Contact) {
    if (!confirm(t('confirm_delete_contact'))) return
    const { error } = await supabase.from('crm_contacts').delete().eq('id', c.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_contact_deleted'))
    await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'contact_deleted', resourceType: 'crm_contacts', resourceId: c.id, metadata: { nom: c.nom } })
    await loadContacts()
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    return !q || c.nom.toLowerCase().includes(q) || (c.prenom ?? '').toLowerCase().includes(q) || (c.entreprise ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <BookUser className="h-5 w-5 text-teal-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('contacts_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 text-xs font-bold">{contacts.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-52">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-full" />
          </div>
          {canManage && (
            <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="h-4 w-4" /> {t('btn_new_contact')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16">
          <BookUser className="h-10 w-10 text-slate-200 mb-3" /><p className="text-slate-400 text-sm">{t('contacts_empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 hover:border-indigo-200 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{c.prenom ? `${c.prenom} ${c.nom}` : c.nom}</p>
                  {c.poste && <p className="text-xs text-slate-500">{c.poste}</p>}
                  {c.entreprise && <p className="text-xs text-indigo-600 font-medium">{c.entreprise}</p>}
                </div>
                <div className="flex gap-1">
                  {canManage && <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>}
                  {canDelete && <button onClick={() => deleteContact(c)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              <div className="space-y-1">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-600"><Mail className="h-3.5 w-3.5 text-slate-400" />{c.email}</a>}
                {c.telephone && <a href={`tel:${c.telephone}`} className="flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-600"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.telephone}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="font-bold text-slate-900">{editing ? t('modal_edit_contact') : t('modal_new_contact')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_prenom')}</label>
                  <input className={inputCls} value={cPrenom} onChange={e => setCPrenom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_nom')} *</label>
                  <input className={inputCls} value={cNom} onChange={e => setCNom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_email')}</label>
                  <input type="email" className={inputCls} value={cEmail} onChange={e => setCEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_telephone')}</label>
                  <input type="tel" className={inputCls} value={cTel} onChange={e => setCTel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_entreprise')}</label>
                  <input className={inputCls} value={cEntreprise} onChange={e => setCEntreprise(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_poste')}</label>
                  <input className={inputCls} value={cPoste} onChange={e => setCPoste(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('field_notes')}</label>
                  <textarea rows={2} className={inputCls} value={cNotes} onChange={e => setCNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={save} disabled={saving || !cNom.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
