'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

interface Notification {
  id: string
  type: string
  titre: string
  message: string
  is_read: boolean
  created_at: string
  data?: Record<string, unknown>
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

function typeColor(type: string): string {
  switch (type) {
    case 'success': return 'bg-emerald-100 text-emerald-700'
    case 'warning': return 'bg-amber-100 text-amber-700'
    case 'error': return 'bg-red-100 text-red-700'
    default: return 'bg-indigo-100 text-indigo-700'
  }
}

export function NotificationBell() {
  const t = useTranslations('navigation')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const fetchNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, titre, message, is_read, created_at, data')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as Notification[]) || [])
  }, [])

  // Chargement initial + souscription realtime
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)
      fetchNotifications(uid)

      // Realtime : nouvelles notifications
      const channel = supabase
        .channel('notifications-' + uid)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev].slice(0, 20))
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [fetchNotifications])

  // Clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
        aria-label={t('notifications')}
      >
        <Bell className="h-4 w-4 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('notifications')}</p>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                  title={t('notifications_mark_all_read')}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('notifications_mark_all_read')}</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">{t('notifications_empty')}</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.is_read ? 'bg-white' : 'bg-indigo-50/40'}`}
                >
                  <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-indigo-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{n.titre}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeColor(n.type)}`}>
                      {n.type}
                    </span>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="shrink-0 p-1 text-slate-300 hover:text-indigo-500 transition-colors rounded"
                      title={t('notifications_mark_read')}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
