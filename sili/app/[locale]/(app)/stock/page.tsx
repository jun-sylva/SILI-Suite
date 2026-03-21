import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Box, ArrowLeftRight } from "lucide-react"

export default function StockDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Module Stock</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <Box className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Produits</CardTitle>
            <CardDescription>Catalogue des articles en stock.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="hover:border-indigo-600 transition-colors cursor-pointer">
          <CardHeader>
            <ArrowLeftRight className="h-8 w-8 mb-2 text-indigo-600" />
            <CardTitle>Mouvements</CardTitle>
            <CardDescription>Entrées, sorties et transferts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
