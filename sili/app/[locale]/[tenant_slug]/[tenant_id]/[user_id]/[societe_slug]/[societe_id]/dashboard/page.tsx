'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, ShoppingCart, CircleDollarSign, ArrowUpRight, TrendingUp } from 'lucide-react'

export default function SocieteDashboardPage() {
  const params = useParams()
  const societeSlug = params.societe_slug as string
  const societeName = societeSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{societeName}</h1>
            <p className="text-slate-500 text-sm mt-1">Tableau de bord de performance et indicateurs clés.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700">Flux Temps Réel</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Chiffre d'Affaires</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">0.00 FCFA</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <p className="text-xs text-emerald-600 font-bold">+0% <span className="text-slate-400 font-normal">vsm</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Nouveaux Clients</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">+0</div>
            <p className="text-xs text-slate-400 mt-1">Objectif : 50/mois</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Ventes du jour</CardTitle>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">0</div>
            <p className="text-xs text-slate-400 mt-1">Commandes en attente</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Stock Critique</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">0</div>
            <p className="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full inline-block mt-1">Alerte rupture</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Activité Récente</CardTitle>
            <CardDescription>Les dernières actions menées sur vos modules.</CardDescription>
          </CardHeader>
          <CardContent className="h-48 flex items-center justify-center border-t border-slate-50 bg-slate-50/30 rounded-b-2xl">
            <p className="text-slate-400 text-sm font-medium italic">Aucune activité récente pour le moment.</p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Raccourcis Modules</CardTitle>
            <CardDescription>Accédez rapidement à vos outils préférés.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             {['Ventes', 'Stocks', 'Comptabilité'].map(mod => (
               <div key={mod} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                 <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                     <ArrowUpRight className="h-4 w-4" />
                   </div>
                   <span className="font-bold text-slate-700">{mod}</span>
                 </div>
                 <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
               </div>
             ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
