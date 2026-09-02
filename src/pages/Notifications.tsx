import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllReadNotifications,
  triggerNotificationCheck,
  generateNotificationAiDraft,
  sendNotificationWhatsapp,
} from '@/services/notifications'
import type { AppNotification, NotificationType } from '@/lib/types'
import { pb } from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Trash2,
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
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
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Dialog de envio com IA
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  // Confirmação de exclusão em lote de lidas
  const [isDeleteReadOpen, setIsDeleteReadOpen] = useState(false)
  const [deletingRead, setDeletingRead] = useState(false)

  // Confirmação de exclusão individual
  const [notifToDelete, setNotifToDelete] = useState<string | null>(null)

  const isAuth = pb.authStore.isValid

  const loadData = useCallback(async () => {
    if (!pb.authStore.isValid) {
      setLoading(false)
      setNotifications([])
      return
    }
    setLoading(true)
    try {
      // Carrega até 100 notificações mais recentes
      const res = await getNotifications(1, 100).catch(() => ({
        items: [],
        total: 0,
        unread_count: 0,
      }))
      setNotifications(res?.items || [])
    } catch {
      // Falha silenciosa
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuth) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [loadData, isAuth])

  useRealtime(
    'notifications',
    () => {
      if (!isAuth || !pb.authStore.isValid) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        loadData()
      }, 400)
    },
    isAuth,
  )

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

  const handleDeleteSingle = async (id: string) => {
    const success = await deleteNotification(id)
    if (success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      toast.success('Notificação excluída')
    } else {
      toast.error('Erro ao excluir notificação')
    }
    setNotifToDelete(null)
  }

  const handleDeleteAllRead = async () => {
    setDeletingRead(true)
    try {
      const res = await deleteAllReadNotifications()
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => !n.read))
        toast.success(`${res.deleted_count || 0} notificação(ões) lida(s) excluída(s)!`)
      } else {
        toast.error('Erro ao excluir notificações lidas')
      }
    } finally {
      setDeletingRead(false)
      setIsDeleteReadOpen(false)
    }
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
    } catch {
      toast.error('Erro ao verificar notificações')
    } finally {
      setChecking(false)
    }
  }

  // Abertura do modal de Preparar Mensagem da IA
  const handleOpenAiModal = async (n: AppNotification) => {
    setSelectedNotif(n)
    setDraftMessage('')
    setIsAiModalOpen(true)
    setGeneratingDraft(true)

    try {
      const res = await generateNotificationAiDraft({
        notification_id: n.id,
        patient_id: n.patient_id,
      })
      if (res.success && res.draft) {
        setDraftMessage(res.draft)
      } else {
        setDraftMessage(
          `Olá, ${n.metadata?.patient_name || 'paciente'}! 💚 Passando para saber como está sua rotina e se posso te ajudar com alguma dúvida da sua alimentação hoje! 🥗✨`,
        )
      }
    } catch (err) {
      console.error('[generateAiDraft] error:', err)
      setDraftMessage(
        `Olá, ${n.metadata?.patient_name || 'paciente'}! 💚 Como estão as suas refeições hoje? Estou à disposição para tirar qualquer dúvida alimentar! ✨`,
      )
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSendAiMessage = async () => {
    if (!selectedNotif || !draftMessage.trim()) return
    setSendingWhatsapp(true)
    try {
      const res = await sendNotificationWhatsapp({
        notification_id: selectedNotif.id,
        patient_id: selectedNotif.patient_id,
        message: draftMessage.trim(),
      })

      if (res.success && res.whatsapp_sent) {
        toast.success('Mensagem enviada com sucesso no WhatsApp do paciente! 💚')
        // Marca como lida localmente
        setNotifications((prev) =>
          prev.map((item) => (item.id === selectedNotif.id ? { ...item, read: true } : item)),
        )
        setIsAiModalOpen(false)
      } else {
        toast.error(res.error || 'Não foi possível enviar a mensagem pelo WhatsApp')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar mensagem pelo WhatsApp')
    } finally {
      setSendingWhatsapp(false)
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
  const readCount = notifications.filter((n) => n.read).length

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
            Alertas automáticos com mensagens personalizadas da IA prontas para envio aos pacientes
            no WhatsApp.
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

          {readCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteReadOpen(true)}
              className="rounded-full shadow-subtle text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir Lidas ({readCount})
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
          <Button
            variant={filterRead === 'read' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setFilterRead('read')
              setCurrentPage(1)
            }}
            className="rounded-full text-xs h-8"
          >
            Lidas ({readCount})
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
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-background border border-border shadow-xs shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
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

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                      {/* Botão Preparar Mensagem da IA */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenAiModal(n)}
                        className="h-8 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-subtle flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Preparar mensagem (IA)
                      </Button>

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
                        <span className="text-xs text-muted-foreground flex items-center gap-1 px-1">
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                          Lida
                        </span>
                      )}

                      {/* Botão de Excluir individual */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setNotifToDelete(n.id)}
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Excluir notificação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

      {/* Modal: Preparar e Editar Mensagem da IA */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Mensagem Personalizada da IA
            </DialogTitle>
            <DialogDescription>
              A Yasa gerou uma mensagem sob medida para o paciente com base nesta notificação. Você
              pode revisar e editar o texto antes de disparar pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedNotif && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    {selectedNotif.metadata?.patient_name || 'Paciente'}
                  </span>
                  {getTypeBadge(selectedNotif.type)}
                </div>
                <p className="text-muted-foreground">{selectedNotif.message}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Mensagem para o WhatsApp:</span>
                {generatingDraft && (
                  <span className="text-primary text-[11px] font-semibold flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Gerando sugestão da Yasa...
                  </span>
                )}
              </label>

              <Textarea
                rows={7}
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Carregando mensagem da IA..."
                disabled={generatingDraft}
                className="rounded-xl resize-none text-sm leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedNotif && handleOpenAiModal(selectedNotif)}
              disabled={generatingDraft || sendingWhatsapp}
              className="rounded-full text-xs font-semibold"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${generatingDraft ? 'animate-spin' : ''}`}
              />
              Regenerar com IA
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAiModalOpen(false)}
                disabled={sendingWhatsapp}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSendAiMessage}
                disabled={sendingWhatsapp || generatingDraft || !draftMessage.trim()}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 px-5 shadow-subtle"
              >
                {sendingWhatsapp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar no WhatsApp
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de todas as lidas */}
      <AlertDialog open={isDeleteReadOpen} onOpenChange={setIsDeleteReadOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir todas as notificações lidas?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente todas as {readCount} notificações já marcadas como
              lidas para manter seu painel leve e limpo. Notificações não lidas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllRead}
              disabled={deletingRead}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRead ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão individual */}
      <AlertDialog open={!!notifToDelete} onOpenChange={(open) => !open && setNotifToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir notificação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja remover esta notificação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => notifToDelete && handleDeleteSingle(notifToDelete)}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
