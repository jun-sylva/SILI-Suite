'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Loader2, Server, Shield, HardHat, FileText, ShoppingCart, MessageSquare, Building2, PackageSearch, Users, CircleDollarSign } from 'lucide-react'

type SysModule = {
  id: string
  key: string
  name: string
  description: string
  icon: string
  is_active: boolean
}

// Map pour convertir la string de la BDD en Composant Lucide
const IconMap: Record<string, any> = {
  ShoppingCart,
  PackageSearch,
  Building2,
  Users,
  HardHat,
  CircleDollarSign,
  MessageSquare,
  FileText,
  Shield
}

export default function SuperAdminModulesPage() {
  const [modules, setModules] = useState<SysModule[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchModules()
  }, [])

  async function fetchModules() {
    const { data, error } = await supabase
      .from('sys_modules')
      .select('*')
      .order('name')

    if (error) {
      console.error(error)
      setErrorMsg("La table sys_modules n'est pas encore prête en base de données.")
    } else {
      setModules(data || [])
    }
    setLoading(false)
  }

  async function toggleModule(module: SysModule) {
    const newStatus = !module.is_active
    
    // Optimistic UI Update
    setModules(prev => prev.map(m => m.id === module.id ? { ...m, is_active: newStatus } : m))

    const { error } = await supabase
      .from('sys_modules')
      .update({ is_active: newStatus })
      .eq('id', module.id)

    if (error) {
      console.error(error)
      // Rollback
      setModules(prev => prev.map(m => m.id === module.id ? { ...m, is_active: !newStatus } : m))
      alert(`Erreur de modification pour le module ${module.name}`)
    }
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-indigo-500" /></div>

  if (errorMsg) return (
    <div className="flex h-[80vh] flex-col items-center justify-center text-center space-y-4">
      <Server className="h-16 w-16 text-slate-300" />
      <h2 className="text-xl font-bold text-slate-800">Base de données non synchronisée</h2>
      <p className="text-slate-500 max-w-md">{errorMsg}</p>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Moteur des Modules</h1>
          <p className="text-slate-500 text-sm mt-1">Activer ou désactiver un module impacte son accessibilité mondiale pour toutes les sociétés clientes (Tenants).</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <Server className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Grid des modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {modules.map((mod) => {
          const IconComponent = IconMap[mod.icon] || Server
          
          return (
            <div 
              key={mod.id} 
              className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                mod.is_active 
                  ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' 
                  : 'bg-slate-50/50 border-slate-100 opacity-60 grayscale-[0.5]'
              }`}
            >
              {/* Card Header (Icon + Switch) */}
              <div className="flex items-start justify-between mb-5">
                <div className={`p-3.5 rounded-xl transition-colors ${
                  mod.is_active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-200 text-slate-500'
                }`}>
                  <IconComponent className="h-6 w-6" />
                </div>
                
                {/* Custom Toggle Switch */}
                <button 
                  onClick={() => toggleModule(mod)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    mod.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mod.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Card Body */}
              <div className="flex-1">
                <h3 className="text-[17px] font-bold text-slate-800 flex items-center gap-2">
                  {mod.name}
                  {!mod.is_active && (
                    <span className="text-[9px] uppercase font-bold tracking-wider bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      Hors ligne
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{mod.description}</p>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
