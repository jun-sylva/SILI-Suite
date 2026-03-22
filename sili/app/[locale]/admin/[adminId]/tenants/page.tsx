'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Search, MoreHorizontal, ShieldCheck, Info, Ban, Trash2, X, Settings2, Database, Briefcase, FileCode2, Save, Key, Loader2, CheckCircle2, Server } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  max_societes: number
  max_licences: number
  max_storage_gb: number
  created_at: string
}

interface SysModule {
  id: string
  key: string
  name: string
  description: string
  is_active: boolean
}

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)

  // Modals state
  const [detailModal, setDetailModal] = useState<Tenant | null>(null)
  
  const [settingsModal, setSettingsModal] = useState<Tenant | null>(null)
  const [activeTab, setActiveTab] = useState<'permissions' | 'reglages'>('permissions')
  
  // Settings State
  const [sysModules, setSysModules] = useState<SysModule[]>([])
  const [tenantModules, setTenantModules] = useState<Record<string, boolean>>({})
  
  const [editSocietes, setEditSocietes] = useState(1)
  const [editLicences, setEditLicences] = useState(1)
  const [editStorage, setEditStorage] = useState(0.1)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchTenants()
    // Handler clique en dehors des dropdowns
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchTenants() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) {
      console.error(error)
      toast.error('Erreur SQL (Table modifiée ? Avez-vous lancé le script?)')
    } else {
      setTenants(data || [])
    }
    setLoading(false)
  }

  // Action: Bloquer/Débloquer
  async function toggleBlockStatus(tenant: Tenant) {
    const newStatus = tenant.status === 'bloqué' ? 'actif' : 'bloqué'
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenant.id)
      
    if (!error) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t))
      toast.success(`Le tenant ${tenant.name} a été ${newStatus.toUpperCase()}`)
    } else {
      toast.error("Erreur de mise à jour du statut")
    }
    setDropdownOpen(null)
  }

  // Action: Supprimer
  async function deleteTenant(tenantId: string) {
    if (!confirm("ATTENTION : Cette action effacera TOUTES les données (sociétés, utilisateurs, bases) de ce tenant. Êtes-vous sûr à 200% ?")) return
    
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId)
    if (!error) {
      setTenants(prev => prev.filter(t => t.id !== tenantId))
      toast.success("Tenant atomisé avec succès.")
    } else {
      toast.error("Échec critique de la suppression.")
    }
    setDropdownOpen(null)
  }

  // Ouvrir les paramètres et charger les quotas
  async function openSettings(tenant: Tenant) {
    setSettingsModal(tenant)
    setActiveTab('permissions')
    setEditSocietes(tenant.max_societes ?? 1)
    setEditLicences(tenant.max_licences ?? 1)
    setEditStorage(tenant.max_storage_gb ?? 0.1)
    
    // Charger les modules s'ils ne le sont pas
    if (sysModules.length === 0) {
      const { data: sysData } = await supabase.from('sys_modules').select('id, key, name, description, is_active')
      if (sysData) setSysModules(sysData)
    }

    // Charger les permissions de ce tenant
    const { data: tModules } = await supabase.from('tenant_modules').select('module_key, is_active').eq('tenant_id', tenant.id)
    const map: Record<string, boolean> = {}
    tModules?.forEach(r => map[r.module_key] = r.is_active)
    setTenantModules(map)
    setDropdownOpen(null)
  }

  // Sauvegarder les réglages (Quotas)
  async function saveSettings() {
    if (!settingsModal) return
    const { error } = await supabase.from('tenants').update({
      max_societes: editSocietes,
      max_licences: editLicences,
      max_storage_gb: editStorage
    }).eq('id', settingsModal.id)

    if (!error) {
      toast.success("Quotas mis à jour.")
      setTenants(prev => prev.map(t => t.id === settingsModal.id ? {
        ...t, max_societes: editSocietes, max_licences: editLicences, max_storage_gb: editStorage
      } : t))
      setSettingsModal(null)
    } else {
      toast.error("Erreur de sauvegarde.")
    }
  }

  // Toggle module pour le tenant (Permissions)
  async function toggleTenantModule(moduleKey: string) {
    if (!settingsModal) return
    const currentStatus = tenantModules[moduleKey] || false
    const newStatus = !currentStatus

    setTenantModules(prev => ({ ...prev, [moduleKey]: newStatus }))

    const { error } = await supabase.from('tenant_modules').upsert({
      tenant_id: settingsModal.id,
      module_key: moduleKey,
      is_active: newStatus,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id, module_key' })

    if (error) {
      toast.error("Erreur de synchronisation du module")
      setTenantModules(prev => ({ ...prev, [moduleKey]: currentStatus }))
    }
  }

  const filtered = tenants.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.slug?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 sm:p-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gestion des Tenants</h2>
          <p className="text-sm text-slate-500 mt-1">Gérez tous les groupes d'entreprises, leurs quotas et permissions d'accès.</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <Database className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 w-full max-w-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par raison sociale..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400 text-slate-700 font-medium"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p>Chargement des locataires...</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Raison Sociale</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4">Date de création</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-500 bg-slate-50/30">
                        <div className="flex flex-col items-center justify-center">
                          <Database className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-medium text-slate-600">Aucun tenant trouvé.</p>
                          <p className="text-xs mt-1">L'inscription des locataires se fait depuis l'écran de Login.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{t.name || "Inconnu"}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">/{t.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.status === 'bloqué' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {t.status === 'bloqué' ? 'Bloqué' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {dayjs(t.created_at).format('DD MMM YYYY, HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-center relative">
                        <button 
                          onClick={() => setDropdownOpen(dropdownOpen === t.id ? null : t.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>

                        {/* Dropdown Local */}
                        {dropdownOpen === t.id && (
                          <div 
                            ref={dropdownRef} 
                            className="absolute right-12 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95"
                          >
                            <div className="py-1">
                              <button onClick={() => { setDetailModal(t); setDropdownOpen(null) }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                <Info className="h-4 w-4" /> Détails
                              </button>
                              <button onClick={() => openSettings(t)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100">
                                <Settings2 className="h-4 w-4" /> Paramètres
                              </button>
                              <button onClick={() => toggleBlockStatus(t)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50">
                                <Ban className="h-4 w-4" /> {t.status === 'bloqué' ? 'Débloquer' : 'Bloquer'}
                              </button>
                              <button onClick={() => deleteTenant(t.id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">
                                <Trash2 className="h-4 w-4" /> Supprimer
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

      {/* MODAL: Détails */}
      {detailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
            <button onClick={() => setDetailModal(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
            <div className="p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 mb-6 mx-auto">
                <Briefcase className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-6">{detailModal.name}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <FileCode2 className="h-5 w-5 text-indigo-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">Identifiant (Slug)</p><p className="form-medium text-sm">{detailModal.slug}</p></div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">Statut Hôte</p><p className="form-medium text-sm capitalize">{detailModal.status}</p></div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Server className="h-5 w-5 text-purple-400" />
                  <div><p className="text-[10px] uppercase font-bold text-slate-400">Création Serveur</p><p className="form-medium text-sm">{dayjs(detailModal.created_at).format('DD MMMM YYYY - HH:mm')}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Paramètres (Permissions & Réglages) */}
      {settingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between border-b border-slate-200 p-6 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Settings2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Paramètres Locataire</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-0.5">{settingsModal.name}</p>
                </div>
              </div>
              <button onClick={() => setSettingsModal(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Config Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 p-2 bg-slate-50">
              <button 
                onClick={() => setActiveTab('permissions')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'permissions' ? 'bg-white shadow border border-slate-200 text-indigo-600' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                Permissions Modulaires
              </button>
              <button 
                onClick={() => setActiveTab('reglages')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'reglages' ? 'bg-white shadow border border-slate-200 text-indigo-600' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                Réglages et Quotas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {activeTab === 'permissions' ? (
                <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 p-4 rounded-xl text-sm flex gap-3">
                    <Info className="h-5 w-5 shrink-0" />
                    <p>Définissez les modules métier accessibles pour ce locataire. (Attention: un module désactivé par le Super Admin Master l'emportera toujours sur ces réglages).</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {sysModules.map(mod => {
                      const isOn = !!tenantModules[mod.key]
                      // Si inactive globalement, le griser un peu plus pour info
                      const isGlobalOff = !mod.is_active
                      
                      return (
                        <div key={mod.key} className={`flex items-center justify-between p-4 rounded-xl border bg-white shadow-sm transition-all ${isGlobalOff ? 'opacity-50 border-red-200' : 'border-slate-200 hover:border-indigo-300'}`}>
                          <div className="mr-3">
                            <p className="font-bold text-sm text-slate-800">{mod.name}</p>
                            {isGlobalOff && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Éteint Globalement</p>}
                          </div>
                          
                          <button 
                            onClick={() => toggleTenantModule(mod.key)}
                            disabled={isGlobalOff}
                            className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${isOn ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  
                  <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto">
                    
                    {/* Item : Sociétés */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Sociétés (Subscriptions)</p>
                          <p className="text-xs text-slate-500">Nombre max. de sociétés autorisées</p>
                        </div>
                      </div>
                      <input 
                        type="number" 
                        min={1} 
                        value={editSocietes} 
                        onChange={(e) => setEditSocietes(Number(e.target.value))}
                        className="w-24 border border-slate-200 rounded-lg h-10 px-3 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" 
                      />
                    </div>

                    {/* Item : Licences */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                          <Key className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Licences Employés</p>
                          <p className="text-xs text-slate-500">Maximum de comptes utilisateurs créables</p>
                        </div>
                      </div>
                      <input 
                        type="number" 
                        min={1} 
                        value={editLicences} 
                        onChange={(e) => setEditLicences(Number(e.target.value))}
                        className="w-24 border border-slate-200 rounded-lg h-10 px-3 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" 
                      />
                    </div>

                    {/* Item : Stockage */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Serveur & Stockage (GB)</p>
                          <p className="text-xs text-slate-500">Limite de poids sur le Cloud</p>
                        </div>
                      </div>
                      <input 
                        type="number" 
                        step="0.1" 
                        min={0.1}
                        value={editStorage} 
                        onChange={(e) => setEditStorage(Number(e.target.value))}
                        className="w-24 border border-slate-200 rounded-lg h-10 px-3 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" 
                      />
                    </div>

                  </div>

                  <div className="flex justify-end pt-4 max-w-xl mx-auto">
                    <button 
                      onClick={saveSettings}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-colors"
                    >
                      <Save className="h-5 w-5" /> Enregistrer les quotas
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
