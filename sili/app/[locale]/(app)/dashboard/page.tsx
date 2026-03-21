'use client'

import { useSocieteStore } from '@/stores/societeStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, ShoppingCart, CircleDollarSign } from 'lucide-react'

export default function DashboardPage() {
  const { currentSociete } = useSocieteStore()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
      </div>

      {!currentSociete ? (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Aucune société sélectionnée</CardTitle>
            <CardDescription className="text-yellow-700">
              Veuillez sélectionner une société pour voir les indicateurs.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 {currentSociete.devise}</div>
              <p className="text-xs text-muted-foreground">+0% depuis le mois dernier</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+0</div>
              <p className="text-xs text-muted-foreground">+0 depuis la semaine dernière</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventes</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+0</div>
              <p className="text-xs text-muted-foreground">+0 depuis hier</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Actif</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 Produits</div>
              <p className="text-xs text-muted-foreground">Valeur estimée : 0 {currentSociete.devise}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
