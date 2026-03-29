'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { uploadFile as storageUpload, uniqueFilename, getSignedUrl } from '@/lib/storage'
import {
  Loader2, ShieldOff, Banknote, Upload, Download,
  Trash2, FileText, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

// ── Types ──────────────────────────────────────────────────────

type Employe = {
  id: string
  nom: string
  prenom: string
  matricule: string
  poste: string | null
  user_id: string | null
}

type Bulletin = {
  id: string
  employe_id: string
  mois: number
  annee: number
  storage_path: string
  nom_fichier: string
  taille_kb: number | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────

function moisLabel(mois: number, annee: number): string {
  return new Date(annee, mois - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
}

// ── Page ───────────────────────────────────────────────────────

export default function PaiePage() {
  const t      = useTranslations('rh')
  const params = useParams()

  const societeId = params.societe_id as string

  // ── Auth & permissions ─────────────────────────────────
  const [loading,       setLoading]       = useState(true)
  const [canAccessPage, setCanAccessPage] = useState(false)
  const [canManage,     setCanManage]     = useState(false)
  const [canDelete,     setCanDelete]     = useState(false)
  const [myEmployeId,   setMyEmployeId]   = useState<string | null>(null)
  const [fullTenantId,  setFullTenantId]  = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  // ── Tab ────────────────────────────────────────────────
  const [tab, setTab] = useState<'mes_bulletins' | 'gestion'>('mes_bulletins')

  // ── Mes bulletins ──────────────────────────────────────
  const [mesBulletins,     setMesBulletins]     = useState<Bulletin[]>([])
  const [bulletinsLoading, setBulletinsLoading] = useState(false)

  // ── Gestion ────────────────────────────────────────────
  const [employes,       setEmployes]       = useState<Employe[]>([])
  const [moisBulletins,  setMoisBulletins]  = useState<Bulletin[]>([])
  const [gestionLoading, setGestionLoading] = useState(false)
  const [selectedMois,   setSelectedMois]   = useState(dayjs().month() + 1)
  const [selectedAnnee,  setSelectedAnnee]  = useState(dayjs().year())

  // ── Upload modal ───────────────────────────────────────
  const [uploadOpen,    setUploadOpen]    = useState(false)
  const [uploadEmploye, setUploadEmploye] = useState<Employe | null>(null)
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null)
  const [uploading,     setUploading]     = useState(false)

  // ── Delete confirmation ────────────────────────────────
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  // ── Init ──────────────────────────────────────────────

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setCurrentUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single()
    if (!profile) return

    setFullTenantId(profile.tenant_id)

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
    const perm = isTenantAdmin ? 'admin' : await fetchEffectiveModulePerm(session.user.id, societeId, 'rh')

    setCanAccessPage(perm !== 'aucun')
    setCanManage(perm === 'gestionnaire' || perm === 'admin' || isTenantAdmin)
    setCanDelete(perm === 'admin' || isTenantAdmin)

    if (perm === 'aucun') { setLoading(false); return }

    const { data: employe } = await supabase
      .from('rh_employes')
      .select('id')
      .eq('societe_id', societeId)
      .eq('user_id', session.user.id)
      .maybeSingle()
    setMyEmployeId(employe?.id ?? null)

    setLoading(false)
  }

  // ── Fetch mes bulletins ────────────────────────────────

  useEffect(() => {
    if (loading || !canAccessPage || !myEmployeId) return
    fetchMesBulletins()
  }, [loading, canAccessPage, myEmployeId])

  async function fetchMesBulletins() {
    setBulletinsLoading(true)
    const { data } = await supabase
      .from('rh_bulletins_paie')
      .select('id, employe_id, mois, annee, nom_fichier, taille_kb, created_at, storage_path')
      .eq('employe_id', myEmployeId!)
      .order('annee', { ascending: false })
      .order('mois', { ascending: false })
    setMesBulletins(data ?? [])
    setBulletinsLoading(false)
  }

  // ── Fetch gestion data ─────────────────────────────────

  useEffect(() => {
    if (loading || !canManage) return
    fetchGestionData()
  }, [loading, canManage, selectedMois, selectedAnnee])

  async function fetchGestionData() {
    setGestionLoading(true)
    const [empRes, bulRes] = await Promise.all([
      supabase
        .from('rh_employes')
        .select('id, nom, prenom, matricule, poste, user_id')
        .eq('societe_id', societeId)
        .eq('statut', 'actif')
        .order('nom', { ascending: true }),
      supabase
        .from('rh_bulletins_paie')
        .select('id, employe_id, mois, annee, nom_fichier, taille_kb, created_at, storage_path')
        .eq('societe_id', societeId)
        .eq('mois', selectedMois)
        .eq('annee', selectedAnnee),
    ])
    setEmployes(empRes.data ?? [])
    setMoisBulletins(bulRes.data ?? [])
    setGestionLoading(false)
  }

  // ── Download ───────────────────────────────────────────

  async function handleDownload(bulletin: Bulletin) {
    const { url, error } = await getSignedUrl(bulletin.storage_path, 60)
    if (error || !url) { toast.error(t('paie_download_error')); return }
    window.open(url, '_blank')
  }

  // ── Upload ─────────────────────────────────────────────

  function openUploadModal(emp: Employe) {
    setUploadEmploye(emp)
    setUploadFileObj(null)
    setUploadOpen(true)
  }

  async function handleUpload() {
    if (!uploadEmploye || !uploadFileObj || !fullTenantId) return

    if (uploadFileObj.type !== 'application/pdf') {
      toast.error(t('paie_format_error')); return
    }
    if (uploadFileObj.size > 5 * 1024 * 1024) {
      toast.error(t('paie_size_error')); return
    }

    setUploading(true)

    const filename  = uniqueFilename(uploadFileObj.name)
    const moisStr   = String(selectedMois).padStart(2, '0')
    const path      = `${fullTenantId}/societes/${societeId}/rh/paie/${uploadEmploye.id}/${selectedAnnee}_${moisStr}_${filename}`

    const { error: uploadError } = await storageUpload(path, uploadFileObj, { contentType: 'application/pdf' })
    if (uploadError) {
      toast.error(t('paie_upload_error'))
      setUploading(false)
      return
    }

    // Upsert : si bulletin existant pour ce mois → update, sinon insert
    const { data: existing } = await supabase
      .from('rh_bulletins_paie')
      .select('id')
      .eq('employe_id', uploadEmploye.id)
      .eq('mois', selectedMois)
      .eq('annee', selectedAnnee)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('rh_bulletins_paie')
        .update({
          storage_path: path,
          nom_fichier:  uploadFileObj.name,
          taille_kb:    Math.round(uploadFileObj.size / 1024),
          uploaded_by:  currentUserId,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('rh_bulletins_paie').insert({
        tenant_id:    fullTenantId,
        societe_id:   societeId,
        employe_id:   uploadEmploye.id,
        mois:         selectedMois,
        annee:        selectedAnnee,
        storage_path: path,
        nom_fichier:  uploadFileObj.name,
        taille_kb:    Math.round(uploadFileObj.size / 1024),
        uploaded_by:  currentUserId,
      })
    }

    toast.success(t('paie_upload_success'))
    setUploadOpen(false)
    setUploadFileObj(null)
    await Promise.all([fetchGestionData(), fetchMesBulletins()])
    // Notifier l'employé si il a un compte
    if (uploadEmploye.user_id && uploadEmploye.user_id !== currentUserId) {
      const moisLabel = new Date(selectedAnnee, selectedMois - 1, 1)
        .toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
      await supabase.from('notifications').insert({
        tenant_id: fullTenantId,
        user_id:   uploadEmploye.user_id,
        type:      'info',
        titre:     'Bulletin de paie disponible',
        message:   `Votre bulletin de paie de ${moisLabel} est disponible`,
      })
    }
    setUploading(false)
  }

  // ── Delete ─────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('rh_bulletins_paie').delete().eq('id', deleteId)
    if (error) toast.error(t('paie_delete_error'))
    else {
      toast.success(t('paie_delete_success'))
      setDeleteId(null)
      await Promise.all([fetchGestionData(), fetchMesBulletins()])
    }
    setDeleting(false)
  }

  // ── Month navigation ───────────────────────────────────

  function prevMonth() {
    if (selectedMois === 1) { setSelectedMois(12); setSelectedAnnee(y => y - 1) }
    else setSelectedMois(m => m - 1)
  }
  function nextMonth() {
    if (selectedMois === 12) { setSelectedMois(1); setSelectedAnnee(y => y + 1) }
    else setSelectedMois(m => m + 1)
  }

  function getBulletin(employeId: string): Bulletin | undefined {
    return moisBulletins.find(b => b.employe_id === employeId)
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!canAccessPage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldOff className="h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-bold text-slate-700">{t('acces_refuse_title')}</h2>
        <p className="text-sm text-slate-500 text-center max-w-sm">{t('acces_refuse_desc')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('paie_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('paie_subtitle')}</p>
      </div>

      {/* Tabs */}
      {canManage && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['mes_bulletins', 'gestion'] as const).map(tabId => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                tab === tabId ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(`paie_tab_${tabId}` as any)}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab Mes Bulletins ── */}
      {tab === 'mes_bulletins' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {!myEmployeId ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Banknote className="h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">{t('paie_no_fiche')}</p>
            </div>
          ) : bulletinsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : mesBulletins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">{t('paie_empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_col_mois')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_col_fichier')}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_col_ajoute')}</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mesBulletins.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 capitalize">{moisLabel(b.mois, b.annee)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <FileText className="h-4 w-4 text-red-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{b.nom_fichier}</span>
                          {b.taille_kb && <span className="text-xs text-slate-400 shrink-0">{b.taille_kb} Ko</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{dayjs(b.created_at).format('DD/MM/YYYY')}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDownload(b)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t('paie_download')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Gestion ── */}
      {tab === 'gestion' && canManage && (
        <div className="space-y-4">

          {/* Sélecteur mois */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex items-center gap-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">{t('paie_month_selector')}</p>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-bold text-slate-800 min-w-[160px] text-center capitalize">
                {moisLabel(selectedMois, selectedAnnee)}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Table employés */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {gestionLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : employes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Banknote className="h-10 w-10 text-slate-200" />
                <p className="text-sm text-slate-400">{t('paie_gestion_empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_employe_col')}</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_col_fichier')}</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paie_col_ajoute')}</th>
                      <th className="px-6 py-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employes.map(emp => {
                      const bulletin = getBulletin(emp.id)
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{emp.prenom} {emp.nom}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{emp.poste ?? '—'} · {emp.matricule}</p>
                          </td>
                          <td className="px-6 py-4">
                            {bulletin ? (
                              <div className="flex items-center gap-2 text-slate-600">
                                <FileText className="h-4 w-4 text-red-400 shrink-0" />
                                <span className="truncate max-w-[160px]">{bulletin.nom_fichier}</span>
                                {bulletin.taille_kb && <span className="text-xs text-slate-400 shrink-0">{bulletin.taille_kb} Ko</span>}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {bulletin ? dayjs(bulletin.created_at).format('DD/MM/YYYY') : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 justify-end">
                              {bulletin && (
                                <button
                                  onClick={() => handleDownload(bulletin)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  {t('paie_download')}
                                </button>
                              )}
                              <button
                                onClick={() => openUploadModal(emp)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {bulletin ? t('paie_replace_btn') : t('paie_upload_btn')}
                              </button>
                              {canDelete && bulletin && (
                                <button
                                  onClick={() => setDeleteId(bulletin.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {t('paie_delete')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Upload ── */}
      {uploadOpen && uploadEmploye && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{t('paie_upload_modal_title')}</h2>
              <button onClick={() => setUploadOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{t('paie_employe_col')}</p>
                <p className="font-bold text-slate-800 text-sm">{uploadEmploye.prenom} {uploadEmploye.nom}</p>
                <p className="text-xs text-slate-400 font-mono">{uploadEmploye.matricule}</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{t('paie_col_mois')}</p>
                <p className="font-bold text-slate-800 text-sm capitalize">{moisLabel(selectedMois, selectedAnnee)}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('paie_file_label')}</label>
              <input
                type="file"
                accept=".pdf"
                onChange={e => setUploadFileObj(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setUploadOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFileObj}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('paie_upload_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmation Suppression ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">{t('paie_delete_confirm')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('paie_delete_confirm_desc')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('paie_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
