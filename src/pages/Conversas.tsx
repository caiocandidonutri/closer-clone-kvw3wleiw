import { useState, useRef, useEffect } from 'react'
import { useContacts } from '@/hooks/use-contacts'
import { useMessages } from '@/hooks/use-messages'
import { useIntegration } from '@/hooks/use-integration'
import { sendMessage, cleanupAndSyncWhatsapp } from '@/services/integrations'
import { toggleMessageFlag } from '@/services/messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Send,
  MessageSquare,
  Sparkles,
  Bot,
  User,
  Phone,
  RefreshCw,
  QrCode,
  Bookmark,
  BookmarkCheck,
  CheckCheck,
  Zap,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

const QUICK_REPLIES = [
  'Olá! 💚 Como estão indo suas refeições hoje?',
  'Vou verificar suas informações e já te retorno com uma orientação!',
  'Me manda uma foto do seu prato/refeição para eu avaliar? 🥗📸',
  'Lembre-se de beber água ao longo do dia! A hidratação é fundamental 💧',
  'Parabéns pela dedicação! Manter a constância é o segredo do sucesso ✨',
]

export function Conversas() {
  const navigate = useNavigate()
  const { contacts, loading: loadingContacts, reload: reloadContacts } = useContacts()
  const { integration, loading: loadingIntegration } = useIntegration()
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const { messages, loading: loadingMessages } = useMessages(selectedContactId)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'flagged'>('all')
  const [syncing, setSyncing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Otimização de Performance: Sincroniza via backend APENAS 1x por sessão (não em toda re-visita da aba)
  useEffect(() => {
    if (integration?.status === 'CONNECTED') {
      const sessionKey = `whatsapp_synced_${integration.instance_name || 'default'}`
      const alreadySynced = sessionStorage.getItem(sessionKey)
      if (!alreadySynced) {
        sessionStorage.setItem(sessionKey, 'true')
        cleanupAndSyncWhatsapp()
          .then((res) => {
            if (res?.success) reloadContacts()
          })
          .catch((err) => console.log('[Conversas] session sync warning:', err))
      }
    }
  }, [integration?.status, integration?.instance_name, reloadContacts])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Select first contact by default on load
  useEffect(() => {
    if (!selectedContactId && contacts.length > 0) {
      setSelectedContactId(contacts[0].id)
    }
  }, [contacts, selectedContactId])

  const selectedContact = contacts.find((c) => c.id === selectedContactId)

  const handleManualSync = async () => {
    setSyncing(true)
    try {
      const res = await cleanupAndSyncWhatsapp()
      if (res.success) {
        toast.success(
          `Sincronização concluída: ${res.synced_contacts || 0} contatos e ${res.synced_messages || 0} mensagens atualizadas!`,
        )
        reloadContacts()
      } else {
        toast.error('Não foi possível sincronizar o WhatsApp')
      }
    } catch {
      toast.error('Erro na sincronização')
    } finally {
      setSyncing(false)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || !selectedContactId || sending) return

    setSending(true)
    try {
      await sendMessage(selectedContactId, text)
      if (!textToSend) setInputText('')
      toast.success('Mensagem enviada')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const handleToggleFlag = async (messageId: string, currentFlag?: boolean) => {
    try {
      await toggleMessageFlag(messageId, !currentFlag)
      toast.success(
        !currentFlag ? 'Mensagem marcada para acompanhar 📌' : 'Marcação para acompanhar removida',
      )
    } catch {
      toast.error('Erro ao atualizar marcação')
    }
  }

  // Filtragem
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search)
    if (!matchesSearch) return false

    if (filter === 'pending') return c.status === 'pending'
    return true
  })

  // Se filtro 'flagged' estiver ativo nas mensagens do contato atual
  const displayedMessages = filter === 'flagged' ? messages.filter((m) => m.flagged) : messages

  const hasAnyFlaggedInCurrent = messages.some((m) => m.flagged)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Conversas do WhatsApp
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interações e suporte nutricional gerenciados pela Yasa AI e pelo Dr. Caio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {integration?.status === 'CONNECTED' ? (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-3"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              WhatsApp Conectado ({integration.instance_name || 'Yasa'})
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/onboarding')}
              className="text-xs rounded-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              Conectar WhatsApp
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={syncing}
            className="rounded-full text-xs font-semibold shadow-2xs hover:bg-muted"
            title="Sincronizar mensagens agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Main Chat Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 bg-card rounded-2xl border border-border shadow-elevation overflow-hidden">
        {/* Left column: Contact list (4 cols) */}
        <div className="md:col-span-4 lg:col-span-4 border-r border-border flex flex-col h-full bg-muted/10">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-border space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
                className="h-7 text-xs rounded-lg px-2.5 flex-1 font-semibold"
              >
                Todas ({contacts.length})
              </Button>
              <Button
                variant={filter === 'pending' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('pending')}
                className="h-7 text-xs rounded-lg px-2.5 flex-1 font-semibold text-amber-700 dark:text-amber-400"
              >
                Aguardando ({contacts.filter((c) => c.status === 'pending').length})
              </Button>
              <Button
                variant={filter === 'flagged' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('flagged')}
                className="h-7 text-xs rounded-lg px-2.5 flex-1 font-semibold text-purple-700 dark:text-purple-400"
                title="Mensagens marcadas para acompanhar"
              >
                <Bookmark className="h-3 w-3 mr-1" />
                Acompanhar
              </Button>
            </div>
          </div>

          {/* Contact List Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loadingContacts ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Carregando conversas...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                Nenhuma conversa encontrada.
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = c.id === selectedContactId
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm shadow-2xs">
                        {c.name ? c.name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                      </div>
                      {c.status === 'pending' && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-amber-500 rounded-full ring-2 ring-background animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs truncate ${
                            isSelected ? 'font-bold text-primary' : 'font-semibold text-foreground'
                          }`}
                        >
                          {c.name || c.phone_number}
                        </span>
                        {c.last_message_at && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(c.last_message_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.last_message_from_me ? 'Você: ' : ''}
                        {c.last_message || 'Sem mensagens recentes'}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        {c.status === 'pending' && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Pendente
                          </Badge>
                        )}
                        {c.patient_id && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1 text-muted-foreground"
                          >
                            Paciente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right column: Active Chat Area (8 cols) */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col h-full bg-background">
          {selectedContact ? (
            <>
              {/* Active Contact Header */}
              <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm shadow-2xs">
                    {selectedContact.name ? (
                      selectedContact.name.charAt(0).toUpperCase()
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {selectedContact.name || selectedContact.phone_number}
                      {selectedContact.patient_id && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Paciente Cadastrado
                        </Badge>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone_number}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedContact.patient_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/app/pacientes/${selectedContact.patient_id}/editar`)
                      }
                      className="rounded-full text-xs font-semibold h-8"
                    >
                      Abrir Ficha
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages Flow */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-muted/5">
                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Carregando mensagens...
                  </div>
                ) : displayedMessages.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground">
                    {filter === 'flagged' ? (
                      <p>Nenhuma mensagem marcada para acompanhar nesta conversa.</p>
                    ) : (
                      <p>Nenhuma mensagem registrada nesta conversa.</p>
                    )}
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
                    const isAssistant = msg.role === 'assistant'
                    const isUser = msg.role === 'user'

                    return (
                      <div
                        key={msg.id}
                        className={`group flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`relative max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-xs text-xs leading-relaxed ${
                            isUser
                              ? 'bg-muted text-foreground rounded-tl-xs'
                              : 'bg-primary text-primary-foreground rounded-tr-xs'
                          } ${msg.flagged ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1 pb-1 border-b border-current/15">
                            <span className="flex items-center gap-1 font-bold">
                              {isAssistant ? (
                                <>
                                  <Sparkles className="h-2.5 w-2.5" /> Yasa / Nutricionista
                                </>
                              ) : (
                                <>
                                  <User className="h-2.5 w-2.5" /> Paciente
                                </>
                              )}
                            </span>
                            <span>
                              {msg.timestamp
                                ? format(new Date(msg.timestamp), 'HH:mm', { locale: ptBR })
                                : ''}
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {/* Pin / Flag button on hover */}
                          <div className="absolute -top-2.5 -right-2.5 hidden group-hover:flex items-center">
                            <button
                              onClick={() => handleToggleFlag(msg.id, msg.flagged)}
                              className={`p-1 rounded-full shadow-md transition-colors ${
                                msg.flagged
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-background text-foreground hover:bg-purple-100 dark:hover:bg-purple-950'
                              }`}
                              title={
                                msg.flagged ? 'Desmarcar acompanhamento' : 'Marcar para acompanhar'
                              }
                            >
                              {msg.flagged ? (
                                <BookmarkCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Bookmark className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {msg.flagged && (
                          <span className="text-[10px] text-purple-600 font-bold mt-0.5 flex items-center gap-1 px-1">
                            <Bookmark className="h-2.5 w-2.5 fill-purple-600" />
                            Acompanhar
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies Chips */}
              <div className="px-3 pt-2 pb-1 border-t border-border/60 bg-muted/20">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 shrink-0 mr-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Respostas Rápidas:
                  </span>
                  {QUICK_REPLIES.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputText(reply)}
                      className="shrink-0 text-[11px] font-medium bg-background hover:bg-muted text-foreground border border-border/80 px-2.5 py-1 rounded-full transition-colors truncate max-w-[240px] shadow-2xs"
                      title={reply}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Footer */}
              <div className="p-3 border-t border-border bg-background flex items-center gap-2">
                <Input
                  placeholder="Digite sua mensagem ou escolha uma resposta rápida..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 rounded-xl h-10 text-xs"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={sending || !inputText.trim()}
                  className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-subtle shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-bold text-foreground">Nenhuma conversa selecionada</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Selecione um paciente na lista lateral para visualizar o histórico de mensagens e
                responder pelo WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
