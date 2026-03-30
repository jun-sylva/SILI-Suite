'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { fetchEffectiveModulePerm } from '@/lib/permissions'
import { writeLog } from '@/lib/audit'
import { toast } from 'sonner'
import { Receipt, Plus, Loader2, Search, ChevronRight, Trash2 } from 'lucide-react'

interface Facture {
  id: string; numero: string | null; objet: string; statut: string
  client_nom: string | null; montant_ttc: number; montant_paye: number
  montant_restant: number; date_emission: string; date_echeance: string | null
}

const STATUTS = ['brouillon', 'emise', 'partiellement_payee', 'payee', 'en_retard', 'annulee']

const statutColor: Record<string, string> = {
  brouillon:           'bg-slate-100  text-slate-600',
  emise:               'bg-blue-50    text-blue-700',
  partiellement_payee: 'bg-yellow-50  text-yellow-700',
  payee:               'bg-green-50   text-green-700',
  en_retard:           'bg-red-50     text-red-600',
  annulee:             'bg-slate-100  text-slate-400',
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function FacturesPage() {
  const t         = useTranslations('crm')
  const params    = useParams()
  const router    = useRouter()
  const societeId = params.societe_id as string
  const baseUrl   = `/${params.locale}/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${params.societe_id}/crm`

  const [loading,      setLoading]      = useState(true)
  const [factures,     setFactures]     = useState<Facture[]>([])
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
      await loadFactures()
      setLoading(false)
    }
    init()
  }, [societeId])

  const loadFactures = useCallback(async () => {
    const { data } = await supabase
      .from('crm_factures')
      .select('id,numero,objet,statut,client_nom,montant_ttc,montant_paye,montant_restant,date_emission,date_echeance')
      .eq('societe_id', societeId)
      .order('created_at', { ascending: false })
    setFactures(data ?? [])
  }, [societeId])

  async function deleteFacture(e: React.MouseEvent, f: Facture) {
    e.stopPropagation()
    if (!confirm(t('confirm_delete_facture'))) return
    const { error } = await supabase.from('crm_factures').delete().eq('id', f.id)
    if (error) { toast.error(t('toast_error')); return }
    toast.success(t('toast_facture_deleted'))
    await writeLog({ tenantId: fullTenantId, userId, action: 'facture_deleted', resourceType: 'crm_factures', resourceId: f.id, metadata: { objet: f.objet } })
    await loadFactures()
  }

  const filtered = factures.filter(f => {
    if (statutFilter && f.statut !== statutFilter) return false
    const q = search.toLowerCase()
    return !q || (f.numero ?? '').toLowerCase().includes(q) || f.objet.toLowerCase().includes(q) || (f.client_nom ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div className="flex h-60 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-violet-600" />
          </div>
          <h1 className="font-bold text-slate-900">{t('factures_title')}</h1>
          <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold">{factures.length}</span>
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
            <button onClick={() => router.push(`${baseUrl}/factures/nouveau`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="h-4 w-4" /> {t('btn_new_facture')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center py-16">
          <Receipt className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-400 text-sm">{t('factures_empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">{t('col_numero')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_client')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_objet')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col_montant_ttc')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col_paye')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('col_restant')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_statut')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('col_echeance')}</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const pct = f.montant_ttc > 0 ? Math.min(100, Math.round(f.montant_paye / f.montant_ttc * 100)) : 0
                return (
                  <tr key={f.id} onClick={() => router.push(`${baseUrl}/factures/${f.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-600">{f.numero ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{f.client_nom ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate">{f.objet}</td>
                    <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900">{fmt(f.montant_ttc)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">{fmt(f.montant_paye)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 font-semibold">{fmt(f.montant_restant)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statutColor[f.statut] ?? 'bg-slate-100 text-slate-500'}`}>
                          {t(`statut_${f.statut}` as any)}
                        </span>
                        {f.statut !== 'payee' && f.statut !== 'annulee' && pct > 0 && (
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{f.date_echeance ?? '—'}</td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      {canDelete && f.statut === 'brouillon' && (
                        <button onClick={e => deleteFacture(e, f)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
