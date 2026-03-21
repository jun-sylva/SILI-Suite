import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Landmark } from "lucide-react"

export default function ComptaDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Comptabilité</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <Landmark className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Comptes Bancaires</CardTitle>
            <CardDescription>Trésorerie et rapprochements.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
