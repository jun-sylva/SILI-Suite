'use client'

import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col md:flex-row">
      {/* Sidebar : Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto w-full">
          <div className="mx-auto w-full max-w-[1800px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
