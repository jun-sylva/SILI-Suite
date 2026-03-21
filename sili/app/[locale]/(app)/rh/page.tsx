import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Clock } from "lucide-react"

export default function RHDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Ressources Humaines</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <Users className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Employés</CardTitle>
            <CardDescription>Gestion du personnel.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <Clock className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Présences</CardTitle>
            <CardDescription>Pointage et congés.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
