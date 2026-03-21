import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { UserCog } from "lucide-react"

export default function SecuriteDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Paramètres de Sécurité</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <UserCog className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Utilisateurs & Rôles</CardTitle>
            <CardDescription>Gestion RBAC avancée pour la société courante.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
