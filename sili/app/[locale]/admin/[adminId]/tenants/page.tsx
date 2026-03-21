'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, Search } from 'lucide-react'

export default function TenantsManagementPage() {
  const t = useTranslations('superadmin.tenants')

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          {t('add_tenant')}
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-md px-3 py-2 w-full max-w-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            <Search className="h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="bg-transparent border-none text-sm outline-none w-full placeholder:text-slate-400 font-medium text-slate-700"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">{t('table_name')}</th>
                  <th className="px-6 py-4">{t('table_status')}</th>
                  <th className="px-6 py-4">{t('table_created')}</th>
                  <th className="px-6 py-4 text-center">{t('table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Exemple vide ou maquette (vide pour l'instant) */}
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic bg-white">
                    Aucune société trouvée.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
