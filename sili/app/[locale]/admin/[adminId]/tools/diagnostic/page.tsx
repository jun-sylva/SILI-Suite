'use client'

import { Card, CardContent } from "@/components/ui/card"

export default function GenericConstructionPage() {
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Diagnostic</h2>
      <Card className="border-dashed border-2 bg-slate-50/50">
        <CardContent className="flex flex-col h-64 items-center justify-center text-slate-500">
          <p className="text-lg font-medium">Outil de Diagnostic</p>
          <p className="text-sm mt-1 text-center max-w-md">Contrôle de santé des clusters de serveurs, des connexions base de données et RAM/CPU du SAAS.</p>
        </CardContent>
      </Card>
    </div>
  )
}
