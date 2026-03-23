import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function RapportsDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Rapports & BI</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <BarChart3 className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Statistiques Globales</CardTitle>
            <CardDescription>Vue d'ensemble financière et activité.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
