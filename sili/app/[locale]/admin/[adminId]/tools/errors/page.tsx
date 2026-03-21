'use client'

import { Card, CardContent } from "@/components/ui/card"

export default function GenericConstructionPage() {
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">Suivi des Erreurs</h2>
      <Card className="border-dashed border-2 bg-slate-50/50 shadow-sm">
        <CardContent className="flex flex-col h-64 items-center justify-center text-slate-500">
          <p className="text-lg font-medium">Gestion des Erreurs</p>
          <p className="text-sm mt-1 text-center max-w-md">Remontée des exceptions applicatives et erreurs de production en temps réel (Stack traces).</p>
        </CardContent>
      </Card>
    </div>
  )
}
