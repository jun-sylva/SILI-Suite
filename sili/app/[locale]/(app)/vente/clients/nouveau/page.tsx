'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateClient } from '@/hooks/useClients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NouveauClientPage() {
  const router = useRouter()
  const createClient = useCreateClient()
  
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [ville, setVille] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await createClient.mutateAsync({
        nom,
        email: email || null,
        telephone: telephone || null,
        ville: ville || null,
      })
      router.push('/vente/clients')
    } catch (err) {
      console.error('Erreur de création:', err)
      alert('Une erreur est survenue lors de la création du client.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/vente/clients">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau Client</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom / Raison sociale <span className="text-red-500">*</span></Label>
              <Input id="nom" value={nom} onChange={e => setNom(e.target.value)} required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" value={telephone} onChange={e => setTelephone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ville">Ville</Label>
              <Input id="ville" value={ville} onChange={e => setVille(e.target.value)} />
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Link href="/vente/clients">
                <Button variant="outline" type="button">Annuler</Button>
              </Link>
              <Button type="submit" disabled={createClient.isPending}>
                {createClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer le client
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
