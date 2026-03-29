'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import {
  Users, UserCheck, Plus, Loader2, X, CheckCircle2,
  AlertCircle, Pencil, ChevronDown, ShieldOff,
  FileText, Download, Trash2,
} from 'lucide-react'
import { uploadFile, deleteFiles, uniqueFilename } from '@/lib/storage'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import dayjs from 'dayjs'

// ── Types ────────────────────────────────────────────────────

type RhEmploye = {
  id: string
  matricule: string
  nom: string
  prenom: string
  sexe: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  adresse: string | null
  email: string | null
  telephone: string | null
  poste: string | null
  departement: string | null
  date_embauche: string | null
  type_contrat: string | null
  salaire_base: number | null
  cni_numero: string | null
  cnps_numero: string | null
  statut: string
  photo_url: string | null
  user_id: string | null
}

type EmployeAvecCompte = {
  user_id: string
  full_name: string | null
  phone: string | null
  role: string
  fiche: RhEmploye | null
}

type EmployeForm = {
  nom: string
  prenom: string
  sexe: string
  date_naissance: string
  lieu_naissance: string
  nationalite: string
  adresse: string
  email: string
  telephone: string
  poste: string
  departement: string
  date_embauche: string
  type_contrat: string
  salaire_base: string
  cni_numero: string
  cnps_numero: string
  statut: string
  etat_civil: string
  nb_enfants: string
}

const defaultForm: EmployeForm = {
  nom: '', prenom: '', sexe: '', date_naissance: '', lieu_naissance: '',
  nationalite: '', adresse: '', email: '', telephone: '', poste: '',
  departement: '', date_embauche: '', type_contrat: '', salaire_base: '',
  cni_numero: '', cnps_numero: '', statut: 'actif',
  etat_civil: '', nb_enfants: '0',
}

const ETATS_CIVILS = ['celibataire','marie','veuf','separe','divorce'] as const

type ModalMode = 'create' | 'edit' | 'fiche'

// ── Helpers ──────────────────────────────────────────────────

const STATUT_STYLES: Record<string, string> = {
  actif:     'bg-emerald-100 text-emerald-700',
  inactif:   'bg-slate-100 text-slate-500',
  suspendu:  'bg-red-100 text-red-600',
  conge:     'bg-amber-100 text-amber-700',
}

const DOC_TYPES = ['cni', 'passeport', 'cnps', 'diplome', 'contrat', 'autre'] as const
const ALLOWED_FORMATS = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_SIZE   = 5 * 1024 * 1024 // 5 MB

type RhDoc = {
  id: string
  type_doc: string
  nom_fichier: string
  storage_path: string
  taille_kb: number | null
  created_at: string
}

const CONTRATS     = ['CDI', 'CDD', 'Stage', 'Freelance', 'Consultant']
const STATUTS      = ['actif', 'inactif', 'suspendu', 'conge']
const POSTES       = ['Directeur', 'Manager', 'Chef de Projet', 'Développeur', 'Designer', 'Commercial', 'Comptable', 'Assistant', 'Technicien', 'Consultant', 'Autre']
const DEPARTEMENTS = ['Direction / Management', 'Ressources Humaines', 'Informatique / IT', 'Finance / Comptabilité', 'Commercial / Vente', 'Marketing', 'Opérations / Logistique']

function initials(nom: string | null, prenom: string | null) {
  const n = (prenom?.[0] ?? '') + (nom?.[0] ?? '')
  return n.toUpperCase() || '?'
}

// ── Page ─────────────────────────────────────────────────────

export default function EmployesPage() {
  const t      = useTranslations('rh')
  const params = useParams()

  const societeId = params.societe_id as string

  const [loading, setLoading]             = useState(true)
  const [canAccessPage, setCanAccessPage] = useState(false)
  const [avecCompte, setAvecCompte]       = useState<EmployeAvecCompte[]>([])
  const [sansCompte, setSansCompte]       = useState<RhEmploye[]>([])
  const [fullTenantId, setFullTenantId]   = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [canEdit, setCanEdit]             = useState(false)

  // Drawer Documents
  const [docsOpen, setDocsOpen]           = useState(false)
  const [docsEmployee, setDocsEmployee]   = useState<{ id: string; nom: string; prenom: string; matricule: string } | null>(null)
  const [employeeDocs, setEmployeeDocs]   = useState<RhDoc[]>([])
  const [docsLoading, setDocsLoading]     = useState(false)
  const [uploadType, setUploadType]       = useState<string>('cni')
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)

  // Modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalMode, setModalMode]   = useState<ModalMode>('create')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null)
  const [form, setForm]             = useState<EmployeForm>(defaultForm)
  const [saving, setSaving]         = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) return

    setFullTenantId(profile.tenant_id ?? '')
    setCurrentUserId(session.user.id)

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'

    if (isTenantAdmin) {
      setCanEdit(true)
      setCanAccessPage(true)
    } else {
      const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'rh')
      const hasAccess = perm === 'gestionnaire' || perm === 'admin'
      setCanAccessPage(hasAccess)
      setCanEdit(hasAccess)
    }

    await fetchAll(profile.tenant_id)
    setLoading(false)
  }

  async function fetchAll(tenantId: string) {
    await Promise.all([
      fetchAvecCompte(tenantId),
      fetchSansCompte(),
    ])
  }

  async function fetchAvecCompte(tenantId: string) {
    // 1. user_ids assignés à la société
    const { data: assignments } = await supabase
      .from('user_societes')
      .select('user_id')
      .eq('societe_id', societeId)
      .eq('is_active', true)

    if (!assignments || assignments.length === 0) { setAvecCompte([]); return }

    const userIds = assignments.map((a: any) => a.user_id)

    // 2. Profils
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role')
      .in('id', userIds)
      .eq('tenant_id', tenantId)

    // 3. Fiches rh_employes existantes pour ces users
    const { data: fiches } = await supabase
      .from('rh_employes')
      .select('*')
      .eq('societe_id', societeId)
      .in('user_id', userIds)

    const ficheMap: Record<string, RhEmploye> = {}
    fiches?.forEach((f: RhEmploye) => { if (f.user_id) ficheMap[f.user_id] = f })

    const result: EmployeAvecCompte[] = (profiles ?? []).map((p: any) => ({
      user_id:   p.id,
      full_name: p.full_name,
      phone:     p.phone,
      role:      p.role,
      fiche:     ficheMap[p.id] ?? null,
    }))

    setAvecCompte(result)
  }

  async function fetchSansCompte() {
    const { data, error } = await supabase
      .from('rh_employes')
      .select('*')
      .eq('societe_id', societeId)
      .is('user_id', null)
      .order('nom')

    if (error) toast.error(t('toast_load_error'))
    setSansCompte(data ?? [])
  }

  // ── Ouvrir modal ──────────────────────────────────────────

  function openCreate() {
    setForm(defaultForm)
    setEditingId(null)
    setLinkedUserId(null)
    setModalMode('create')
    setModalOpen(true)
  }

  function openFiche(emp: EmployeAvecCompte) {
    if (emp.fiche) {
      // Modifier fiche existante
      setForm({
        nom:           emp.fiche.nom,
        prenom:        emp.fiche.prenom,
        sexe:          emp.fiche.sexe ?? '',
        date_naissance: emp.fiche.date_naissance ?? '',
        lieu_naissance: emp.fiche.lieu_naissance ?? '',
        nationalite:   emp.fiche.nationalite ?? '',
        adresse:       emp.fiche.adresse ?? '',
        email:         emp.fiche.email ?? '',
        telephone:     emp.fiche.telephone ?? '',
        poste:         emp.fiche.poste ?? '',
        departement:   emp.fiche.departement ?? '',
        date_embauche: emp.fiche.date_embauche ?? '',
        type_contrat:  emp.fiche.type_contrat ?? '',
        salaire_base:  emp.fiche.salaire_base?.toString() ?? '',
        cni_numero:    emp.fiche.cni_numero ?? '',
        cnps_numero:   emp.fiche.cnps_numero ?? '',
        statut:        emp.fiche.statut,
        etat_civil:    (emp.fiche as any).etat_civil ?? '',
        nb_enfants:    String((emp.fiche as any).nb_enfants ?? 0),
      })
      setEditingId(emp.fiche.id)
    } else {
      // Créer fiche pour un utilisateur avec compte (pré-remplir depuis profil)
      const nameParts = (emp.full_name ?? '').trim().split(' ')
      setForm({
        ...defaultForm,
        prenom:    nameParts[0] ?? '',
        nom:       (nameParts.slice(1).join(' ') || nameParts[0]) ?? '',
        telephone: emp.phone ?? '',
      })
      setEditingId(null)
    }
    setLinkedUserId(emp.user_id)
    setModalMode('fiche')
    setModalOpen(true)
  }

  function openEdit(emp: RhEmploye) {
    setForm({
      nom:           emp.nom,
      prenom:        emp.prenom,
      sexe:          emp.sexe ?? '',
      date_naissance: emp.date_naissance ?? '',
      lieu_naissance: emp.lieu_naissance ?? '',
      nationalite:   emp.nationalite ?? '',
      adresse:       emp.adresse ?? '',
      email:         emp.email ?? '',
      telephone:     emp.telephone ?? '',
      poste:         emp.poste ?? '',
      departement:   emp.departement ?? '',
      date_embauche: emp.date_embauche ?? '',
      type_contrat:  emp.type_contrat ?? '',
      salaire_base:  emp.salaire_base?.toString() ?? '',
      cni_numero:    emp.cni_numero ?? '',
      cnps_numero:   emp.cnps_numero ?? '',
      statut:        emp.statut,
      etat_civil:    (emp as any).etat_civil ?? '',
      nb_enfants:    String((emp as any).nb_enfants ?? 0),
    })
    setEditingId(emp.id)
    setLinkedUserId(null)
    setModalMode('edit')
    setModalOpen(true)
  }

  // ── Sauvegarder ───────────────────────────────────────────

  async function handleSave() {
    if (!form.nom.trim())    { toast.error(t('error_nom_required'));    return }
    if (!form.prenom.trim()) { toast.error(t('error_prenom_required')); return }

    setSaving(true)

    const payload = {
      nom:            form.nom.trim(),
      prenom:         form.prenom.trim(),
      sexe:           form.sexe || null,
      date_naissance: form.date_naissance || null,
      lieu_naissance: form.lieu_naissance || null,
      nationalite:    form.nationalite || null,
      adresse:        form.adresse || null,
      email:          form.email || null,
      telephone:      form.telephone || null,
      poste:          form.poste || null,
      departement:    form.departement || null,
      date_embauche:  form.date_embauche || null,
      type_contrat:   form.type_contrat || null,
      salaire_base:   form.salaire_base ? parseFloat(form.salaire_base) : null,
      cni_numero:     form.cni_numero || null,
      cnps_numero:    form.cnps_numero || null,
      statut:         form.statut,
      etat_civil:     form.etat_civil || null,
      nb_enfants:     parseInt(form.nb_enfants) || 0,
    }

    if (editingId) {
      // UPDATE
      const { error } = await supabase
        .from('rh_employes')
        .update(payload)
        .eq('id', editingId)

      if (error) { toast.error(t('toast_update_error')); setSaving(false); return }
      toast.success(t('toast_update_success'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'employe_updated', resourceType: 'rh_employes', resourceId: editingId, metadata: { nom: payload.nom, prenom: payload.prenom } })
    } else {
      // INSERT
      const { data: inserted, error } = await supabase
        .from('rh_employes')
        .insert({
          ...payload,
          societe_id: societeId,
          tenant_id:  fullTenantId,
          user_id:    linkedUserId ?? null,
          created_by: currentUserId,
        })
        .select('id')
        .single()

      if (error) { toast.error(t('toast_create_error')); setSaving(false); return }
      toast.success(t('toast_create_success'))
      await writeLog({ tenantId: fullTenantId, userId: currentUserId, action: 'employe_created', resourceType: 'rh_employes', resourceId: inserted?.id, metadata: { nom: payload.nom, prenom: payload.prenom, poste: payload.poste } })
    }

    setModalOpen(false)
    await fetchAll(fullTenantId)
    setSaving(false)
  }

  const f = (key: keyof EmployeForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  // ── Documents drawer ─────────────────────────────────────

  async function openDocsDrawer(emp: { id: string; nom: string; prenom: string; matricule: string }) {
    setDocsEmployee(emp)
    setDocsOpen(true)
    setUploadType('cni')
    setUploadFileObj(null)
    await fetchDocs(emp.id)
  }

  async function fetchDocs(employeId: string) {
    setDocsLoading(true)
    const { data } = await supabase
      .from('rh_employe_documents')
      .select('id, type_doc, nom_fichier, storage_path, taille_kb, created_at')
      .eq('employe_id', employeId)
      .order('created_at', { ascending: false })
    setEmployeeDocs(data ?? [])
    setDocsLoading(false)
  }

  async function handleUploadDoc() {
    if (!uploadFileObj || !docsEmployee) return
    if (!ALLOWED_FORMATS.includes(uploadFileObj.type)) { toast.error(t('docs_format_error')); return }
    if (uploadFileObj.size > MAX_FILE_SIZE) { toast.error(t('docs_size_error')); return }

    setUploading(true)
    const filename   = uniqueFilename(uploadFileObj.name)
    const storagePath = `${fullTenantId}/societes/${societeId}/rh/employes/${docsEmployee.id}/${uploadType}_${filename}`

    const { error: uploadError } = await uploadFile(storagePath, uploadFileObj)
    if (uploadError) { toast.error(t('docs_upload_error')); setUploading(false); return }

    const { error: dbError } = await supabase.from('rh_employe_documents').insert({
      tenant_id:    fullTenantId,
      societe_id:   societeId,
      employe_id:   docsEmployee.id,
      type_doc:     uploadType,
      nom_fichier:  uploadFileObj.name,
      storage_path: storagePath,
      taille_kb:    Math.round(uploadFileObj.size / 1024),
      uploaded_by:  currentUserId,
    })

    if (dbError) {
      await deleteFiles([storagePath])
      toast.error(t('docs_upload_error'))
    } else {
      toast.success(t('docs_upload_success'))
      setUploadFileObj(null)
      await fetchDocs(docsEmployee.id)
    }
    setUploading(false)
  }

  async function handleDeleteDoc(doc: RhDoc) {
    const { error: storageError } = await deleteFiles([doc.storage_path])
    if (storageError) { toast.error(t('docs_delete_error')); return }
    const { error: dbError } = await supabase.from('rh_employe_documents').delete().eq('id', doc.id)
    if (dbError) { toast.error(t('docs_delete_error')); return }
    toast.success(t('docs_delete_success'))
    if (docsEmployee) await fetchDocs(docsEmployee.id)
  }

  async function handleDownloadDoc(doc: RhDoc) {
    const { data } = await supabase.storage.from('sili-files').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!canAccessPage) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-500">
        <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800">{t('acces_refuse_title')}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">{t('acces_refuse_desc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('employes_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('employes_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
            <Users className="h-6 w-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* ── Section 1 : Avec Compte ── */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('section_avec_compte')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  {t('section_avec_compte_desc')} · {avecCompte.length} membre(s)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        {avecCompte.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck className="h-10 w-10 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">{t('empty_avec_compte_title')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('empty_avec_compte_subtitle')}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_employe')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_matricule')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_poste')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fiche</th>
                  {canEdit && <th className="px-4 py-3.5" />}
                  {canEdit && <th className="px-4 py-3.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {avecCompte.map(emp => (
                  <tr key={emp.user_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-sm text-indigo-700 shrink-0">
                          {(emp.full_name ?? '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{emp.full_name ?? '—'}</p>
                          <p className="text-[11px] text-slate-400">{emp.phone ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-slate-600">
                      {emp.fiche?.matricule ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {emp.fiche?.poste
                        ? <><p className="font-medium">{emp.fiche.poste}</p><p className="text-[11px] text-slate-400">{emp.fiche.departement ?? ''}</p></>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-4">
                      {emp.fiche
                        ? <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${STATUT_STYLES[emp.fiche.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                            {t(`statut_${emp.fiche.statut}` as any)}
                          </span>
                        : <span className="text-slate-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-4">
                      {emp.fiche
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t('fiche_complete')}
                          </span>
                        : <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                            <AlertCircle className="h-3.5 w-3.5" /> {t('fiche_incomplete')}
                          </span>
                      }
                    </td>
                    {canEdit && (
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openFiche(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {emp.fiche ? t('btn_voir_fiche') : t('btn_completer_fiche')}
                        </button>
                      </td>
                    )}
                    {canEdit && emp.fiche && (
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openDocsDrawer({ id: emp.fiche!.id, nom: emp.fiche!.nom ?? '', prenom: emp.fiche!.prenom ?? '', matricule: emp.fiche!.matricule })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {t('btn_documents')}
                        </button>
                      </td>
                    )}
                    {canEdit && !emp.fiche && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Section 2 : Sans Compte ── */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-800">{t('section_sans_compte')}</CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  {t('section_sans_compte_desc')} · {sansCompte.length} employé(s)
                </CardDescription>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {t('btn_ajouter')}
              </button>
            )}
          </div>
        </CardHeader>

        {sansCompte.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">{t('empty_sans_compte_title')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('empty_sans_compte_subtitle')}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/60 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_employe')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_matricule')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_poste')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_contrat')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_embauche')}</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('col_statut')}</th>
                  {canEdit && <th className="px-4 py-3.5" />}
                  {canEdit && <th className="px-4 py-3.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sansCompte.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-sm text-emerald-700 shrink-0">
                          {initials(emp.nom, emp.prenom)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{emp.prenom} {emp.nom}</p>
                          <p className="text-[11px] text-slate-400">{emp.telephone ?? emp.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-slate-600">{emp.matricule}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {emp.poste
                        ? <><p className="font-medium">{emp.poste}</p><p className="text-[11px] text-slate-400">{emp.departement ?? ''}</p></>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {emp.type_contrat ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      {emp.date_embauche ? dayjs(emp.date_embauche).format('DD/MM/YYYY') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${STATUT_STYLES[emp.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                        {t(`statut_${emp.statut}` as any)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openEdit(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                      </td>
                    )}
                    {canEdit && (
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openDocsDrawer({ id: emp.id, nom: emp.nom, prenom: emp.prenom, matricule: emp.matricule })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {t('btn_documents')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Drawer Documents ── */}
      {docsOpen && docsEmployee && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDocsOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md z-[100] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-100 text-teal-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{t('docs_drawer_title')}</p>
                  <p className="text-xs text-slate-500">{docsEmployee.prenom} {docsEmployee.nom} · {docsEmployee.matricule}</p>
                </div>
              </div>
              <button onClick={() => setDocsOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Upload */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{t('docs_add_title')}</p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('docs_type_label')}</label>
                  <select
                    value={uploadType}
                    onChange={e => setUploadType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {DOC_TYPES.map(dt => (
                      <option key={dt} value={dt}>{t(`docs_type_${dt}` as any)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{t('docs_file_label')}</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setUploadFileObj(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleUploadDoc}
                  disabled={!uploadFileObj || uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white font-bold text-sm rounded-xl hover:bg-teal-700 disabled:opacity-40 transition shadow-sm"
                >
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('docs_uploading')}</> : t('docs_upload_btn')}
                </button>
              </div>

              {/* Liste documents */}
              {docsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
              ) : employeeDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <FileText className="h-10 w-10 text-slate-200" />
                  <p className="text-sm text-slate-400">{t('docs_empty')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {employeeDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                        <FileText className="h-4 w-4 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{doc.nom_fichier}</p>
                        <p className="text-[11px] text-slate-400">
                          {t(`docs_type_${doc.type_doc}` as any)} · {t('docs_uploaded_at')} {dayjs(doc.created_at).format('DD/MM/YY')}
                          {doc.taille_kb && ` · ${doc.taille_kb} Ko`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          title={t('docs_download')}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          title={t('docs_delete')}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modal Fiche Employé ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">

            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {modalMode === 'create' ? t('modal_create_title') : t('modal_edit_title')}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Identité */}
              <fieldset>
                <legend className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{t('section_identite')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label={t('field_prenom') + ' *'} {...f('prenom')} placeholder="Ex : Jean" />
                  <InputField label={t('field_nom') + ' *'}    {...f('nom')}    placeholder="Ex : Dupont" />
                  <SelectField label={t('field_sexe')} {...f('sexe')}>
                    <option value="">—</option>
                    <option value="M">{t('sexe_m')}</option>
                    <option value="F">{t('sexe_f')}</option>
                  </SelectField>
                  <InputField label={t('field_date_naissance')} type="date" {...f('date_naissance')} />
                  <InputField label={t('field_lieu_naissance')} {...f('lieu_naissance')} placeholder="Ex : Yaoundé" />
                  <InputField label={t('field_nationalite')}    {...f('nationalite')}   placeholder="Ex : Camerounaise" />
                  <div className="col-span-full">
                    <InputField label={t('field_adresse')} {...f('adresse')} placeholder="Ex : Rue Kennedy, Douala" />
                  </div>
                </div>
              </fieldset>

              <div className="border-t border-slate-100" />

              {/* Contact */}
              <fieldset>
                <legend className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{t('section_contact')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label={t('field_email')}     type="email" {...f('email')}     placeholder="jean@example.com" />
                  <InputField label={t('field_telephone')} type="tel"   {...f('telephone')} placeholder="+237 6XX XXX XXX" />
                </div>
              </fieldset>

              <div className="border-t border-slate-100" />

              {/* Situation familiale */}
              <fieldset>
                <legend className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{t('section_situation_familiale')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label={t('field_etat_civil')} {...f('etat_civil')}>
                    <option value="">— Sélectionner —</option>
                    {ETATS_CIVILS.map(e => <option key={e} value={e}>{t(`etat_civil_${e}` as any)}</option>)}
                  </SelectField>
                  <InputField label={t('field_nb_enfants')} type="number" {...f('nb_enfants')} placeholder="0" />
                </div>
              </fieldset>

              <div className="border-t border-slate-100" />

              {/* Poste */}
              <fieldset>
                <legend className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{t('section_poste')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label={t('field_poste')} {...f('poste')}>
                    <option value="">— Sélectionner —</option>
                    {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
                  </SelectField>
                  <SelectField label={t('field_departement')} {...f('departement')}>
                    <option value="">— Sélectionner —</option>
                    {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </SelectField>
                  <InputField label={t('field_date_embauche')} type="date" {...f('date_embauche')} />
                  <SelectField label={t('field_type_contrat')} {...f('type_contrat')}>
                    <option value="">— Sélectionner —</option>
                    {CONTRATS.map(c => <option key={c} value={c}>{t(`contrat_${c}` as any)}</option>)}
                  </SelectField>
                  <InputField label={t('field_salaire_base')} type="number" {...f('salaire_base')} placeholder="Ex : 150000" />
                  <SelectField label={t('field_statut')} {...f('statut')}>
                    {STATUTS.map(s => <option key={s} value={s}>{t(`statut_${s}` as any)}</option>)}
                  </SelectField>
                </div>
              </fieldset>

              <div className="border-t border-slate-100" />

              {/* Documents */}
              <fieldset>
                <legend className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{t('section_documents')}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label={t('field_cni_numero')}  {...f('cni_numero')}  placeholder="Ex : 123456789" />
                  <InputField label={t('field_cnps_numero')} {...f('cnps_numero')} placeholder="Ex : 987654321" />
                </div>
              </fieldset>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50/50 shrink-0">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition text-sm disabled:opacity-40"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sous-composants form ───────────────────────────────────────

function InputField({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (e: any) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (e: any) => void; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none appearance-none bg-white transition"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>
    </div>
  )
}
