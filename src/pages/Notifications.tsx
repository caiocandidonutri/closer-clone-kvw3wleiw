import { useEffect, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerNotificationCheck,
} from '@/services/notifications'
import type { AppNotification, NotificationType } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bell,
  AlertTriangle,
  Clock,
  Moon,
  CheckCheck,
  Check,
  RefreshCw,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRead, setFilterRead] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const navigate = useNavigate()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getNotifications()
      setNotifications(res.items || [])
    } catch (err) {
      console.error('[NotificationsPage] load error:', err)
      toast.error('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('notifications', () => {
    loadData()
  })

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    toast.success('Notificação marcada como lida')
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    toast.success('Todas as notificações foram marcadas como lidas')
  }

  const handleTriggerCheck = async () => {
    setChecking(true)
    try {
      const res = await triggerNotificationCheck()
      await loadData()
      if (res.created_count && res.created_count > 0) {
        toast.success(`${res.created_count} nova(s) notificação(ões) gerada(s)!`)
      } else {
        toast.info('Verificação concluída. Nenhuma nova pendência.')
      }
    } catch (err) {
      toast.error('Erro ao verificar notificações')
    } finally {
      setChecking(false)
    }
  }

  const getNotificationIcon = (type: NotificationType | string) => {
    switch (type) {
      case 'limit_80':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'expiring_soon':
        return <Clock className="h-5 w-5 text-red-500" />
      case 'inactivity_48h':
        return <Moon className="h-5 w-5 text-blue-500" />
      default:
        return <Bell className="h-5 w-5 text-primary" />
    }
  }

  const getTypeBadge = (type: NotificationType | string) => {
    switch (type) {
      case 'limit_80':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            80% Limite
          </Badge>
        )
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Expiração
          </Badge>
        )
      case 'inactivity_48h':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Inatividade 48h
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Geral
          </Badge>
        )
    }
  }

  // Filtering
  const filtered = notifications.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false
    if (filterRead === 'unread' && n.read) return false
    if (filterRead === 'read' && !n.read) return false
    return true
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 md:p-10 animate-in fade-in duration-500 bg-background min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app')}
            className="mb-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar para o Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bell className="h-7 w-7 text-primary" />
              Notificações Proativas
            </h2>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground font-bold">
                {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Alertas automáticos sobre consumo de mensagens, expiração de planos e inatividade dos
            pacientes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerCheck}
            disabled={checking}
            className="rounded-full shadow-subtle hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
            Verificar Agora
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAllRead}
              className="rounded-full shadow-subtle bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Marcar Todas como Lidas
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
        {/* Filter by Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" /> Tipo:
          </span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'limit_80', label: '80% Limite (⚠️)' },
            { id: 'expiring_soon', label: 'Expiração 3 dias (⏰)' },
            { id: 'inactivity_48h', label: 'Inatividade 48h (💤)' },
          ].map((item) => (
            <Button
              key={item.id}
              variant={filterType === item.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFilterType(item.id)
                setCurrentPage(1)
              }}
              className={`rounded-full text-xs h-8 ${
                filterType === item.id
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-background'
              }`}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Filter by Read/Unread */}
        <div className="flex items-center gap-2">
          <Button
            variant={filterRead === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setFilterRead('all')
              setCurrentPage(1)
            }}
            className="rounded-full text-xs h-8"
          >
            Todas ({notifications.length})
          </Button>
          <Button
            variant={filterRead === 'unread' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setFilterRead('unread')
              setCurrentPage(1)
            }}
            className="rounded-full text-xs h-8"
          >
            Não Lidas ({unreadCount})
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <Card className="border-border shadow-subtle overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Carregando notificações...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-base font-semibold text-foreground">
                Nenhuma notificação encontrada
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Não há notificações correspondentes aos filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginated.map((n) => {
                const timeAgo = n.created
                  ? formatDistanceToNow(new Date(n.created), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : ''
                const dateFull = n.created
                  ? format(new Date(n.created), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })
                  : ''

                return (
                  <div
                    key={n.id}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      n.read
                        ? 'bg-background hover:bg-muted/30'
                        : 'bg-primary/5 dark:bg-primary/10 hover:bg-primary/10'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-2 rounded-xl bg-background border border-border shadow-xs shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm ${
                              n.read ? 'font-semibold text-foreground' : 'font-bold text-foreground'
                            }`}
                          >
                            {n.title || n.message}
                          </span>
                          {getTypeBadge(n.type)}
                          {!n.read && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5 font-bold">
                              Nova
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                          <span>{timeAgo}</span>
                          <span>•</span>
                          <span>{dateFull}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {!n.read ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkRead(n.id)}
                          className="h-8 rounded-full text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Marcar lida
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                          Lida
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
            {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} notificações
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-foreground px-2">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
