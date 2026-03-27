'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { Users, Clock, Banknote, BarChart3, Monitor, ChevronRight, Pencil, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function RHDashboard() {
  const t      = useTranslations('rh')
  const params = useParams()

  const societeId = params.societe_id as string
  const base = `/${params.tenant_slug}/${params.tenant_id}/${params.user_id}/${params.societe_slug}/${societeId}/rh`

  const [canManage,    setCanManage]    = useState(false)
  const [fullTenantId, setFullTenantId] = useState('')
  const [portailPin,   setPortailPin]   = useState('0000')
  const [pinEdit,      setPinEdit]      = useState(false)
  const [newPin,       setNewPin]       = useState('')
  const [savingPin,    setSavingPin]    = useState(false)

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

    setFullTenantId(profile.tenant_id)

    const isTenantAdmin = profile.role === 'tenant_admin' || profile.role === 'super_admin'
    if (isTenantAdmin) {
      setCanManage(true)
    } else {
      const { data: permData } = await supabase
        .from('user_module_permissions')
        .select('permission')
        .eq('user_id', session.user.id)
        .eq('societe_id', societeId)
        .eq('module', 'rh')
        .maybeSingle()
      const perm = permData?.permission ?? 'aucun'
      setCanManage(perm === 'gestionnaire' || perm === 'admin')
    }

    const { data: soc } = await supabase
      .from('societes')
      .select('portail_pin')
      .eq('id', societeId)
      .maybeSingle()
    if (soc?.portail_pin) setPortailPin(soc.portail_pin)
  }

  async function savePin() {
    if (!/^\d{4}$/.test(newPin)) { toast.error('Le PIN doit contenir exactement 4 chiffres.'); return }
    setSavingPin(true)
    const { error } = await supabase
      .from('societes')
      .update({ portail_pin: newPin })
      .eq('id', societeId)
    if (error) toast.error(t('portail_pin_save_error'))
    else { toast.success(t('portail_pin_saved')); setPortailPin(newPin); setPinEdit(false); setNewPin('') }
    setSavingPin(false)
  }

  const cards = [
    {
      key:    'employes',
      title:  t('dashboard_employes_title'),
      desc:   t('dashboard_employes_desc'),
      icon:   Users,
      href:   `${base}/employes`,
      color:  'bg-indigo-50 text-indigo-600 border-indigo-100',
      active: true,
    },
    {
      key:    'presences',
      title:  t('dashboard_presences_title'),
      desc:   t('dashboard_presences_desc'),
      icon:   Clock,
      href:   `${base}/presences`,
      color:  'bg-teal-50 text-teal-600 border-teal-100',
      active: true,
    },
    {
      key:    'paie',
      title:  t('dashboard_paie_title'),
      desc:   t('dashboard_paie_desc'),
      icon:   Banknote,
      href:   `${base}/paie`,
      color:  'bg-green-50 text-green-600 border-green-100',
      active: true,
    },
    {
      key:    'rapport',
      title:  t('dashboard_rapport_title'),
      desc:   t('dashboard_rapport_desc'),
      icon:   BarChart3,
      href:   `${base}/rapport`,
      color:  'bg-orange-50 text-orange-600 border-orange-100',
      active: true,
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('module_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('employes_subtitle')}</p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          if (card.active && card.href) {
            return (
              <Link
                key={card.key}
                href={card.href}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all p-6 flex flex-col gap-4"
              >
                <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-base">{card.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{card.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:gap-2 transition-all">
                  Accéder <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            )
          }
          return (
            <div
              key={card.key}
              className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4 opacity-60 cursor-not-allowed"
            >
              <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-500 text-base">{card.title}</p>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                    {t('nav_soon')}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{card.desc}</p>
              </div>
            </div>
          )
        })}

        {/* ── Carte Portail (gestionnaire+ uniquement) ── */}
        {canManage && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl border bg-violet-50 text-violet-600 border-violet-100 flex items-center justify-center">
                <Monitor className="h-6 w-6" />
              </div>
            </div>

            <div className="flex-1">
              <p className="font-bold text-slate-800 text-base">{t('portail_card_title')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('portail_card_desc')}</p>
            </div>

            {/* PIN */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              {!pinEdit ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {t('portail_pin_label')} : <span className="font-mono font-bold text-slate-700">••••</span>
                  </p>
                  <button
                    onClick={() => { setPinEdit(true); setNewPin('') }}
                    className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> {t('portail_pin_change')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder={t('portail_pin_new_placeholder')}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 tracking-widest"
                  />
                  <button
                    onClick={savePin}
                    disabled={savingPin || newPin.length !== 4}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 disabled:opacity-40 transition"
                  >
                    {savingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('portail_pin_save')}
                  </button>
                  <button
                    onClick={() => setPinEdit(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <Link
              href={`${base}/portail`}
              className="flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-700 transition shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              {t('portail_card_launch')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
