'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AdminRootRedirect() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const adminId = data.user.id.substring(0, 5)
        router.replace(`/admin/${adminId}/dashboard`)
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )
}
