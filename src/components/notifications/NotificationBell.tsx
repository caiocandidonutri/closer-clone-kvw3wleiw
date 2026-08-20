import { useEffect, useState } from 'react'
import { Bell, AlertTriangle, Clock, Moon, Check, CheckCheck, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerNotificationCheck,
} from '@/services/notifications'
import type { AppNotification } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const loadNotifications = async () => {
    try {
      const res = await getNotifications()
      setNotifications(res.items || [])
      setUnreadCount(res.unread_count || 0)
    } catch (err) {
      console.error('[NotificationBell] load error:', err)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  // Subscribe to real-time changes on notifications collection
  useRealtime('notifications', () => {
    loadNotifications()
  })

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    await markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const handleMarkAllAsRead = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    setUnreadCount(0)
  }

  const handleTriggerCheck = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setLoading(true)
    try {
      await triggerNotificationCheck()
      await loadNotifications()
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'limit_80':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-red-500" />
      case 'inactivity_48h':
        return <Moon className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4 text-primary" />
    }
  }

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return 'bg-transparent hover:bg-muted/50'
    switch (type) {
      case 'limit_80':
        return 'bg-amber-500/10 hover:bg-amber-500/15'
      case 'expiring_soon':
        return 'bg-red-500/10 hover:bg-red-500/15'
      case 'inactivity_48h':
        return 'bg-blue-500/10 hover:bg-blue-500/15'
      default:
        return 'bg-primary/10 hover:bg-primary/15'
    }
  }

  const topNotifications = notifications.slice(0, 5)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center h-10 w-10 rounded-full border border-border bg-background/80 hover:bg-muted hover:scale-105 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-primary/20 shadow-subtle"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 rounded-2xl shadow-elevation border border-border p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleTriggerCheck}
              title="Verificar agora"
              disabled={loading}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                title="Marcar todas como lidas"
                className="text-xs text-primary hover:text-primary/80 font-semibold px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
              >
                Ler todas
              </button>
            )}
          </div>
        </div>

        {/* List of 5 items */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/60">
          {topNotifications.length === 0 ? (
            <div className="py-8 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Você será avisado sobre limites, expirações e inatividades.
              </p>
            </div>
          ) : (
            topNotifications.map((n) => {
              const timeAgo = n.created
                ? formatDistanceToNow(new Date(n.created), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : ''

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read) handleMarkAsRead(n.id)
                    setOpen(false)
                    navigate('/app/notifications')
                  }}
                  className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${getNotificationBg(
                    n.type,
                    n.read,
                  )}`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-full bg-background border border-border shadow-xs">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs ${n.read ? 'font-medium text-foreground/80' : 'font-bold text-foreground'}`}
                      >
                        {n.title || n.message}
                      </p>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                      <span>{timeAgo}</span>
                      {!n.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="text-primary hover:underline font-semibold flex items-center gap-0.5 text-[11px]"
                        >
                          <Check className="h-3 w-3" />
                          Marcar lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
            onClick={() => {
              setOpen(false)
              navigate('/app/notifications')
            }}
          >
            Ver todas as notificações
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
