'use client'

import Link from 'next/link'
import Image from 'next/image'
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
          ? 'bg-indigo-600 text-white shadow-sm' 
          : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
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
    <div className="hidden md:flex h-full shrink-0 w-64 xl:w-72 flex-col bg-indigo-950 text-slate-50 border-r border-indigo-900/50">
      <div className="flex h-16 items-center px-6 text-xl font-bold border-b border-indigo-900/50">
        <div className="relative h-8 w-8 mr-3">
          <Image 
            src="https://bgjrbhzrwfxweidkxiyc.supabase.co/storage/v1/object/sign/img/bg-removed-result.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NjRiOGEyZC0zZjAwLTQyYWQtYjlmNy1iODAwODBjMWQ1NjciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWcvYmctcmVtb3ZlZC1yZXN1bHQucG5nIiwiaWF0IjoxNzc0MTExNjE5LCJleHAiOjMzMjc4NTc1NjE5fQ.ayB7A8-QO35h0sC8KhDzgMdwj-6OW0-JmHA5tgJhCNQ"
            alt="SILI Logo"
            fill
            sizes="32px"
            className="object-contain"
            unoptimized
          />
        </div>
        SILI
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
      <div className="p-4 border-t border-indigo-900/50">
        <Link href="/settings" className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-indigo-200 hover:text-white hover:bg-indigo-800/50 transition-colors">
          <Settings className="mr-3 h-5 w-5" /> Paramètres
        </Link>
      </div>
    </div>
  )
}
