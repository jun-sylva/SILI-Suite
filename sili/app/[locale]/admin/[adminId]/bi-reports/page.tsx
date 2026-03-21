'use client'

import { Card, CardContent } from "@/components/ui/card"

export default function GenericConstructionPage() {
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Page en Construction</h2>
      <Card className="border-dashed border-2 bg-slate-50/50">
        <CardContent className="flex flex-col h-64 items-center justify-center text-slate-500">
          <p className="text-lg font-medium">Bientôt disponible</p>
          <p className="text-sm mt-1 text-center max-w-md">La logique métier et les composants de cet outil seront implémentés dans la prochaine itération.</p>
        </CardContent>
      </Card>
    </div>
  )
}
