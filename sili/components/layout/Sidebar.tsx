'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  Users,
  Building2,
  FileText,
  MessageSquare,
  Shield,
  Settings,
  CircleDollarSign,
  HardHat
} from 'lucide-react'
import { usePermission, ModuleKey } from '@/hooks/usePermission'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  moduleKey?: ModuleKey
}

const modules: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Vente', href: '/vente', icon: ShoppingCart, moduleKey: 'vente' },
  { name: 'Achat', href: '/achat', icon: PackageSearch, moduleKey: 'achat' },
  { name: 'Stock', href: '/stock', icon: Building2, moduleKey: 'stock' },
  { name: 'RH', href: '/rh', icon: Users, moduleKey: 'rh' },
  { name: 'CRM', href: '/crm', icon: HardHat, moduleKey: 'crm' },
  { name: 'Comptabilité', href: '/comptabilite', icon: CircleDollarSign, moduleKey: 'comptabilite' },
  { name: 'Teams', href: '/teams', icon: MessageSquare, moduleKey: 'teams' },
  { name: 'Rapports', href: '/rapports', icon: FileText, moduleKey: 'rapports' },
  { name: 'Sécurité', href: '/securite', icon: Shield, moduleKey: 'securite' },
]

function ProtectedSidebarItem({ item, isActive }: { item: NavItem, isActive: boolean }) {
  const { canView } = usePermission(item.moduleKey!)
  if (!canView) return null
  return (
    <SidebarLink item={item} isActive={isActive} />
  )
}

function SidebarLink({ item, isActive }: { item: NavItem, isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
      {item.name}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-zinc-950 text-white border-r border-zinc-800">
      <div className="flex h-16 items-center px-6 text-xl font-bold border-b border-zinc-800">
        <div className="h-8 w-8 rounded bg-white text-black flex items-center justify-center mr-3 text-sm">S</div>
        SILI Suite
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {modules.map((item) => {
          const isActive = pathname.startsWith(item.href)
          if (item.moduleKey) {
            return <ProtectedSidebarItem key={item.href} item={item} isActive={isActive} />
          }
          return <SidebarLink key={item.href} item={item} isActive={isActive} />
        })}
      </nav>
      <div className="p-4 border-t border-zinc-800">
        <Link href="/settings" className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          <Settings className="mr-3 h-5 w-5" /> Paramètres
        </Link>
      </div>
    </div>
  )
}
