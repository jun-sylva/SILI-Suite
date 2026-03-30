'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { FileText, Plus, Loader2, Search, ChevronRight, Trash2 } from 'lucide-react'

interface Devis {
  id: string; numero: string | null; objet: string; statut: string
  client_nom: string | null; montant_ht: number; montant_ttc: number
  date_emission: string; date_expiration: string | null
}

const STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire']

const statutColor: Record<string, string> = {
  brouillon:  'bg-slate-100  text-slate-600',
  envoye:     'bg-blue-50    text-blue-700',
  accepte:    'bg-green-50   text-green-700',
  refuse:     'bg-red-50     text-red-600',
  expire:     'bg-orange-50  text-orange-600',
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function DevisPage() {
  const t       = useTranslations('crm')
  const params  = useParams()
  const router  = useRouter()
  const societeId = params.societe_id as string
  const baseUrl   = `/${params.locale}/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${params.societe_id}/crm`

  const [loading,      setLoading]      = useState(true)
  const [devis,        setDevis]        = useState<Devis[]>([])
  const [search,       setSearch]       = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [canManage,    setCanManage]    = useState(false)
  const [canDelete,    setCanDelete]    = useState(false)
  const [fullTenantId, setFullTenantId] = useState('')
  const [userId,       setUserId]       = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', session.user.id).single()
      setFullTenantId(profile?.tenant_id ?? '')
      const isAdmin = profile?.role === 'tenant_admin'
      if (!isAdmin) {
        const perm = await fetchEffectiveModulePerm(session.user.id, societeId, 'crm')
        setCanManage(['contributeur', 'gestionnaire', 'admin'].includes(perm))
        setCanDelete(['gestionnaire', 'admin'].includes(perm))
      } else { setCanManage(true); setCanDelete(true) }
      await loadDevis()
      setLoading(false)
    }
    init()
  }, [societeId])

  const loadDevis = useCallback(async () => {
    const { data } = await supabase
      .from('crm_devis')
      .select('id,numero,objet,statut,client_nom,montant_ht,montant_ttc,date_emission,date_expiration')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
    setDevis(data ?? [])
  }, [societeId])

  async function deleteDevis(e: React.MouseEvent, d: Devis) {
    e.stopPropagation()
    if (!confirm(t('confirm_delete_devis'))) return
    const { error } = await supabase.from('crm_devis').delete().eq('id', d.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_devis_deleted'))
    await writeLog({ tenantId: fullTenantId, userId, action: 'devis_deleted', resourceType: 'crm_devis', resourceId: d.id, metadata: { objet: d.objet } })
    await loadDevis()
  }

  const filtered = devis.filter(d => {
    if (statutFilter && d.statut !== statutFilter) return false
    const q = search.toLowerCase()
    return !q || (d.numero ?? '').toLowerCase().includes(q) || d.objet.toLowerCase().includes(q) || (d.client_nom ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('devis_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-bold">{devis.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-52">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-full" />
          </div>
          <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-600">
            <option value="">Tous les statuts</option>
            {STATUTS.map(s => <option key={s} value={s}>{t(`statut_${s}` as any)}</option>)}
          </select>
          {canManage && (
            <button onClick={() => router.push(`${baseUrl}/devis/nouveau`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="h-4 w-4" /> {t('btn_new_devis')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16">
          <FileText className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-400 text-sm">{t('devis_empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">{t('col_numero')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_client')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_objet')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col_montant_ht')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col_montant_ttc')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_statut')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_date')}</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} onClick={() => router.push(`${baseUrl}/devis/${d.id}`)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">{d.numero ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{d.client_nom ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{d.objet}</td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">{fmt(d.montant_ht)}</td>
                  <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900">{fmt(d.montant_ttc)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statutColor[d.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                      {t(`statut_${d.statut}` as any)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.date_emission}</td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    {canDelete && d.statut === 'brouillon' && (
                      <button onClick={e => deleteDevis(e, d)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
