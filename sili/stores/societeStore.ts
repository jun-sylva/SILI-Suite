import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Societe {
  id: string
  tenant_id: string
  raison_sociale: string
  devise: string
}

interface SocieteStore {
  currentSociete: Societe | null
  societes: Societe[]
  setSocietes: (societes: Societe[]) => void
  setCurrentSociete: (societe: Societe) => void
}

export const useSocieteStore = create<SocieteStore>()(
  persist(
    (set) => ({
      currentSociete: null,
      societes: [],
      setSocietes: (societes) => set({ societes }),
      setCurrentSociete: (societe) => set({ currentSociete: societe }),
    }),
    { name: 'sili-societe' }
  )
)
