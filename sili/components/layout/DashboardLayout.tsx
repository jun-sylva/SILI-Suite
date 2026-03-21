'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Main Content Area */}
      <div className={`flex flex-col flex-1 w-full overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'md:ml-20' : 'md:ml-64 xl:ml-72'}`}>
        <Header setIsMobileOpen={setIsMobileOpen} />
        
        <main className="flex-1 overflow-y-auto w-full px-4 py-8 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[2000px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
