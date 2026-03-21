import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PackageSearch, Truck } from "lucide-react"

export default function AchatDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Module Achats</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <Truck className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Fournisseurs</CardTitle>
            <CardDescription>Gérer vos fournisseurs.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <PackageSearch className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Bons de commande</CardTitle>
            <CardDescription>Émettre des bons de commande.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
