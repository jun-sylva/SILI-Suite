'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2, ShieldOff, Users, Clock, Banknote, FileText,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, TrendingUp,
} from 'lucide-react'
import dayjs from 'dayjs'

// ── Types ──────────────────────────────────────────────────────

type Employe = {
  id: string
  nom: string
  prenom: string
  poste: string | null
  departement: string | null
  type_contrat: string | null
  salaire_base: number | null
}

type PresenceRow = {
  employe_id: string
  heure_entree: string | null
  statut: string | null
}

// ── Helpers ────────────────────────────────────────────────────

function countWorkingDays(year: number, month: number): number {
  let count = 0
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const day = date.getDay()
    if (day !== 0 && day !== 6) count++
    date.setDate(date.getDate() + 1)
  }
  return count
}

function formatSalary(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA'
}

function moisLabel(mois: number, annee: number): string {
  return new Date(annee, mois - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item) || 'Non défini'
    acc[k] = [...(acc[k] ?? []), item]
    return acc
  }, {} as Record<string, T[]>)
}

// ── Page ───────────────────────────────────────────────────────

export default function RapportPage() {
  const t      = useTranslations('rh')
  const params = useParams()

  const societeId = params.societe_id as string

  // ── Auth & permissions ─────────────────────────────────
  const [loading,    setLoading]    = useState(true)
  const [canAccess,  setCanAccess]  = useState(false)

  // ── Month selector ─────────────────────────────────────
  const [selectedMois,  setSelectedMois]  = useState(dayjs().month() + 1)
  const [selectedAnnee, setSelectedAnnee] = useState(dayjs().year())

  // ── Seuil conformité ───────────────────────────────────
  const [seuil, setSeuil] = useState(80)

  // ── Data ───────────────────────────────────────────────
  const [employes,      setEmployes]      = useState<Employe[]>([])
  const [presences,     setPresences]     = useState<PresenceRow[]>([])
  const [bulletinIds,   setBulletinIds]   = useState<Set<string>>(new Set())
  const [pendingConges, setPendingConges] = useState(0)
  const [dataLoading,   setDataLoading]   = useState(false)

  // ── Init ──────────────────────────────────────────────

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (!profile) return

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
    let access = isTenantAdmin

    if (!isTenantAdmin) {
      const { data: permData } = await supabase
        .from('user_module_permissions')
        .select('permission')
        .eq('user_id', session.user.id)
        .eq('societe_id', societeId)
        .eq('module', 'rh')
        .maybeSingle()
      const perm = permData?.permission ?? 'aucun'
      access = perm === 'gestionnaire' || perm === 'admin'
    }

    setCanAccess(access)
    setLoading(false)
  }

  // ── Fetch data ─────────────────────────────────────────

  useEffect(() => {
    if (loading || !canAccess) return
    fetchData()
  }, [loading, canAccess, selectedMois, selectedAnnee])

  async function fetchData() {
    setDataLoading(true)

    const firstDay = `${selectedAnnee}-${String(selectedMois).padStart(2, '0')}-01`
    const lastDay  = dayjs(firstDay).endOf('month').format('YYYY-MM-DD')

    const [empRes, presRes, bulRes, congesRes] = await Promise.all([
      supabase
        .from('rh_employes')
        .select('id, nom, prenom, poste, departement, type_contrat, salaire_base')
        .eq('societe_id', societeId)
        .eq('statut', 'actif'),
      supabase
        .from('rh_presences')
        .select('employe_id, heure_entree, statut')
        .eq('societe_id', societeId)
        .gte('date', firstDay)
        .lte('date', lastDay),
      supabase
        .from('rh_bulletins_paie')
        .select('employe_id')
        .eq('societe_id', societeId)
        .eq('mois', selectedMois)
        .eq('annee', selectedAnnee),
      supabase
        .from('rh_conges')
        .select('id', { count: 'exact', head: true })
        .eq('societe_id', societeId)
        .eq('statut', 'en_attente'),
    ])

    setEmployes(empRes.data ?? [])
    setPresences(presRes.data ?? [])
    setBulletinIds(new Set((bulRes.data ?? []).map(b => b.employe_id)))
    setPendingConges(congesRes.count ?? 0)
    setDataLoading(false)
  }

  // ── Computed ───────────────────────────────────────────

  const workingDays = useMemo(
    () => countWorkingDays(selectedAnnee, selectedMois),
    [selectedAnnee, selectedMois]
  )

  // Jours présents par employé : heure_entree OR statut conge/mission
  const employePresenceDays = useMemo(() => {
    const map: Record<string, number> = {}
    presences.forEach(p => {
      if (p.heure_entree || p.statut === 'conge' || p.statut === 'mission') {
        map[p.employe_id] = (map[p.employe_id] ?? 0) + 1
      }
    })
    return map
  }, [presences])

  const complianceData = useMemo(() => {
    return employes
      .map(emp => {
        const joursPresents = employePresenceDays[emp.id] ?? 0
        const taux = workingDays > 0 ? (joursPresents / workingDays) * 100 : 0
        return {
          ...emp,
          joursPresents,
          taux,
          presenceConforme: taux >= seuil,
          bulletinPresent:  bulletinIds.has(emp.id),
        }
      })
      .sort((a, b) => a.taux - b.taux) // pires en premier
  }, [employes, employePresenceDays, workingDays, seuil, bulletinIds])

  // KPIs
  const totalEffectif    = employes.length
  const masseSalariale   = employes.reduce((sum, e) => sum + (e.salaire_base ?? 0), 0)
  const nbConformes      = complianceData.filter(e => e.presenceConforme).length
  const nbBulletins      = employes.filter(e => bulletinIds.has(e.id)).length
  const tauxMoyen        = complianceData.length > 0
    ? complianceData.reduce((s, e) => s + e.taux, 0) / complianceData.length
    : 0

  // Répartitions
  const byDept    = useMemo(() => groupBy(employes, e => e.departement ?? ''), [employes])
  const byContrat = useMemo(() => groupBy(employes, e => e.type_contrat ?? ''), [employes])

  const salaryByDept = useMemo(() => {
    const result: Record<string, number> = {}
    employes.forEach(e => {
      const k = e.departement ?? 'Non défini'
      result[k] = (result[k] ?? 0) + (e.salaire_base ?? 0)
    })
    return result
  }, [employes])

  // ── Navigation mois ────────────────────────────────────

  function prevMonth() {
    if (selectedMois === 1) { setSelectedMois(12); setSelectedAnnee(y => y - 1) }
    else setSelectedMois(m => m - 1)
  }
  function nextMonth() {
    if (selectedMois === 12) { setSelectedMois(1); setSelectedAnnee(y => y + 1) }
    else setSelectedMois(m => m + 1)
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!canAccess) {
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

      {/* ── Header + sélecteur mois ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('rapport_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('rapport_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-slate-700 min-w-[160px] text-center capitalize">
            {moisLabel(selectedMois, selectedAnnee)}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t('rapport_kpi_effectif'),
                value: totalEffectif,
                sub:   `${totalEffectif} ${t('rapport_kpi_effectif_sub')}`,
                Icon:  Users,
                color: 'text-indigo-600 bg-indigo-50',
              },
              {
                label: t('rapport_kpi_presence'),
                value: `${tauxMoyen.toFixed(0)}%`,
                sub:   `${nbConformes}/${totalEffectif} ${t('rapport_conforme_count')}`,
                Icon:  TrendingUp,
                color: 'text-teal-600 bg-teal-50',
              },
              {
                label: t('rapport_kpi_conges'),
                value: pendingConges,
                sub:   t('rapport_kpi_conges_sub'),
                Icon:  Clock,
                color: 'text-amber-600 bg-amber-50',
              },
              {
                label: t('rapport_kpi_masse'),
                value: formatSalary(masseSalariale),
                sub:   t('rapport_kpi_masse_sub'),
                Icon:  Banknote,
                color: 'text-green-600 bg-green-50',
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  <card.Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                <p className="text-xl font-black text-slate-900 mt-1 leading-tight">{card.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Conformité ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-slate-800">{t('rapport_conformite_title')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{workingDays} {t('rapport_working_days')}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {nbConformes}/{totalEffectif} {t('rapport_presence_label')}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full">
                  <FileText className="h-3.5 w-3.5" />
                  {nbBulletins}/{totalEffectif} {t('rapport_bulletin_label')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">{t('rapport_seuil')}</span>
                  <select
                    value={seuil}
                    onChange={e => setSeuil(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    {[70, 80, 90, 100].map(v => (
                      <option key={v} value={v}>{v}%</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {complianceData.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-slate-400">{t('rapport_empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{t('rapport_col_employe')}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{t('rapport_col_presents')}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{t('rapport_col_taux')}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{t('rapport_col_presence')}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{t('rapport_col_bulletin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complianceData.map(emp => (
                      <tr
                        key={emp.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          !emp.presenceConforme || !emp.bulletinPresent ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-6 py-3.5">
                          <p className="font-bold text-slate-800">{emp.prenom} {emp.nom}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{emp.poste ?? '—'}</p>
                        </td>
                        <td className="px-6 py-3.5 text-center font-medium text-slate-600">
                          {emp.joursPresents} / {workingDays}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`font-black text-base ${emp.taux >= seuil ? 'text-emerald-600' : 'text-red-500'}`}>
                            {emp.taux.toFixed(0)}%
                          </span>
                          <div className="w-20 mx-auto bg-slate-100 rounded-full h-1.5 mt-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${emp.taux >= seuil ? 'bg-emerald-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(emp.taux, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {emp.presenceConforme ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />{t('rapport_conforme')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                              <XCircle className="h-3 w-3" />{t('rapport_non_conforme')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {emp.bulletinPresent ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                              <FileText className="h-3 w-3" />{t('rapport_uploaded')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                              <FileText className="h-3 w-3" />{t('rapport_manquant')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Répartition ── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Par Département */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-800 mb-5">{t('rapport_by_dept')}</h2>
              {Object.keys(byDept).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">{t('rapport_empty')}</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byDept)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([dept, emps]) => (
                      <div key={dept}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-slate-600 truncate max-w-[200px]">{dept}</span>
                          <span className="text-sm font-bold text-slate-800 shrink-0 ml-2">
                            {emps.length}
                            <span className="text-xs font-normal text-slate-400 ml-1">
                              ({totalEffectif > 0 ? Math.round((emps.length / totalEffectif) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-indigo-400 transition-all"
                            style={{ width: totalEffectif > 0 ? `${(emps.length / totalEffectif) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Par Type de Contrat */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-800 mb-5">{t('rapport_by_contrat')}</h2>
              {Object.keys(byContrat).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">{t('rapport_empty')}</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byContrat)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([contrat, emps]) => (
                      <div key={contrat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-slate-600">{contrat}</span>
                          <span className="text-sm font-bold text-slate-800 shrink-0 ml-2">
                            {emps.length}
                            <span className="text-xs font-normal text-slate-400 ml-1">
                              ({totalEffectif > 0 ? Math.round((emps.length / totalEffectif) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-teal-400 transition-all"
                            style={{ width: totalEffectif > 0 ? `${(emps.length / totalEffectif) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Masse Salariale ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h2 className="font-bold text-slate-800">{t('rapport_masse_title')}</h2>
              <span className="text-xl font-black text-green-600">{formatSalary(masseSalariale)}</span>
            </div>
            {Object.keys(salaryByDept).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('rapport_empty')}</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(salaryByDept)
                  .sort((a, b) => b[1] - a[1])
                  .map(([dept, total]) => (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-slate-600 truncate max-w-[200px]">{dept}</span>
                        <span className="text-sm font-bold text-slate-800 shrink-0 ml-2">
                          {formatSalary(total)}
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            ({masseSalariale > 0 ? Math.round((total / masseSalariale) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-400 transition-all"
                          style={{ width: masseSalariale > 0 ? `${(total / masseSalariale) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  )
}
