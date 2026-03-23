'use client'

import { useClients } from '@/hooks/useClients'
import { ModuleGuard } from '@/components/guards/ModuleGuard'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <ModuleGuard module="vente" required="contributeur">
          <Link href="/vente/clients/nouveau">
            <Button><Plus className="mr-2 h-4 w-4" /> Nouveau Client</Button>
          </Link>
        </ModuleGuard>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex w-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                </TableCell>
              </TableRow>
            ) : clients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                  Aucun client trouvé.
                </TableCell>
              </TableRow>
            ) : (
              clients?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.nom}</TableCell>
                  <TableCell>{client.email || '-'}</TableCell>
                  <TableCell>{client.telephone || '-'}</TableCell>
                  <TableCell>{client.ville || '-'}</TableCell>
                  <TableCell className="text-right">{client.solde_credit ? client.solde_credit.toLocaleString() : '0'} XAF</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
