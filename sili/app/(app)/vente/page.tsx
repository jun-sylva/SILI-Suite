import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { Users, FileText, Receipt } from "lucide-react"

export default function VenteDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Module Vente</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/vente/clients">
          <Card className="hover:border-black transition-colors">
            <CardHeader>
              <Users className="h-8 w-8 mb-2 text-zinc-600" />
              <CardTitle>Clients</CardTitle>
              <CardDescription>Gérer vos clients et prospects.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/vente/devis">
          <Card className="hover:border-black transition-colors">
            <CardHeader>
              <FileText className="h-8 w-8 mb-2 text-zinc-600" />
              <CardTitle>Devis</CardTitle>
              <CardDescription>Créer et envoyer des propositions commerciales.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/vente/factures">
          <Card className="hover:border-black transition-colors">
            <CardHeader>
              <Receipt className="h-8 w-8 mb-2 text-zinc-600" />
              <CardTitle>Factures</CardTitle>
              <CardDescription>Facturation et suivi des paiements.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
