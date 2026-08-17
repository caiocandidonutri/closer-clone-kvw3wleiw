import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContacts } from '@/hooks/use-contacts'
import { useMessages } from '@/hooks/use-messages'
import { useLanguage } from '@/hooks/use-language'
import { getContact, Contact } from '@/services/contacts'
import { sendMessage } from '@/services/integrations'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Send,
  Loader2,
  Search,
  MessageCircle,
  Sparkles,
  Check,
  CheckCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Message } from '@/services/messages'

/** Layout de duas colunas espelhando o WhatsApp Web:
 *  - lista de pacientes (contatos) à esquerda, ordenados pela última mensagem
 *  - conversa à direita com bolhas estilo WhatsApp e campo de resposta
 * Usa dados reais do banco (contacts + messages) e envia pelo WhatsApp via Evolution API. */
export default function Conversas() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const dateLocale = ptBR

  const { contacts, loading: loadingContacts } = useContacts()
  const [search, setSearch] = useState('')

  // Conversa ativa
  const [contact, setContact] = useState<Contact | null>(null)
  const [loadingContact, setLoadingContact] = useState(false)
  const { messages, loading: loadingMessages } = useMessages(id)

  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mobile: alternar entre lista e chat
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Carrega o contato selecionado a partir do id da rota
  useEffect(() => {
    if (!id) {
      setContact(null)
      setMobileShowChat(false)
      return
    }
    setLoadingContact(true)
    getContact(id)
      .then((data) => {
        setContact(data)
        setMobileShowChat(true)
      })
      .catch((err) => {
        console.error('[Conversas] contato:', err)
        setContact(null)
      })
      .finally(() => setLoadingContact(false))
  }, [id])

  // Rola para o fim ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelect = (c: Contact) => {
    navigate(`/app/conversas/${c.id}`)
  }

  const handleBack = () => {
    setMobileShowChat(false)
    navigate('/app/conversas')
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !id) return
    const text = newMessage.trim()
    setNewMessage('')
    setIsSending(true)
    try {
      await sendMessage(id, text)
    } catch (err: any) {
      toast.error(err?.message || t('message_send_failed'))
      // devolve o texto para o campo caso falhe
      setNewMessage(text)
    } finally {
      setIsSending(false)
    }
  }

  // Lista ordenada por última mensagem (mais recente primeiro)
  const conversations = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    })
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.whatsapp_id?.includes(q) ||
        c.push_name?.toLowerCase().includes(q) ||
        c.phone_number?.includes(q),
    )
  }, [contacts, search])

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    return format(new Date(dateStr), 'HH:mm')
  }

  const formatDay = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return t('today')
    if (isYesterday(date)) return t('yesterday')
    return format(date, 'dd/MM/yyyy', { locale: dateLocale })
  }

  const formatListTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'HH:mm')
    if (isYesterday(date)) return t('yesterday')
    return format(date, 'dd/MM/yyyy', { locale: dateLocale })
  }

  // Agrupa mensagens por dia
  const grouped: { [key: string]: Message[] } = {}
  messages.forEach((msg) => {
    const dateKey = formatDay(msg.timestamp || msg.created)
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(msg)
  })

  const initial = (c: Contact) =>
    c.name?.charAt(0)?.toUpperCase() || c.push_name?.charAt(0)?.toUpperCase() || '#'
  const displayName = (c: Contact) => c.name || c.push_name || t('unknown')

  return (
    <div className="flex h-[calc(100vh-160px)] md:h-[calc(100vh-80px)] w-full overflow-hidden bg-background animate-in fade-in duration-500 ease-apple">
      {/* Coluna esquerda — lista de pacientes */}
      <aside
        className={cn(
          'flex flex-col w-full md:w-[360px] lg:w-[400px] shrink-0 border-r border-border bg-card',
          mobileShowChat && id ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t('conversas_title')}
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground mt-0.5">
            {t('conversas_desc')}
          </p>
        </div>

        <div className="px-4 py-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search_conversations')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-full bg-muted/60 border-transparent focus-visible:bg-background focus-visible:border-border text-[14px] font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/40" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{t('no_patients_yet')}</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === id
              const lastTime = c.last_message_at || c.updated || c.created
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors border-l-4',
                    isActive
                      ? 'bg-primary/10 border-primary'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <Avatar className="h-12 w-12 shrink-0 border border-border/60">
                    <AvatarImage src={c.profile_picture_url || c.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-foreground font-bold text-base">
                      {initial(c)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[15px] tracking-tight text-foreground truncate">
                        {displayName(c)}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                        {formatListTime(lastTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[13px] font-medium text-muted-foreground truncate">
                        {c.last_message_from_me ? t('last_message_you') : ''}
                        {c.last_message || t('no_last_message')}
                      </span>
                      {c.status === 'pending' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          {t('status_pending')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Coluna direita — conversa / estado vazio */}
      <section
        className={cn(
          'flex-1 flex flex-col bg-[#e5ddd5]/40 dark:bg-background/40 min-w-0',
          mobileShowChat && id ? 'flex' : 'hidden md:flex',
        )}
      >
        {!id || !contact ? (
          // Estado vazio — nenhum paciente selecionado
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="bg-muted/60 w-24 h-24 rounded-full flex items-center justify-center">
              <MessageCircle className="h-11 w-11 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {t('select_patient')}
            </h3>
            <p className="text-sm font-medium text-muted-foreground max-w-sm">
              {t('select_patient_desc')}
            </p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full shrink-0 -ml-1 md:hidden hover:bg-muted"
                onClick={handleBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10 shrink-0 border border-border/60">
                <AvatarImage src={contact.profile_picture_url || contact.avatar_url || ''} />
                <AvatarFallback className="bg-muted text-foreground font-bold">
                  {initial(contact)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="block font-bold text-[15px] tracking-tight text-foreground truncate">
                  {displayName(contact)}
                </span>
                <span className="block text-[12px] font-semibold text-primary">{t('online')}</span>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 shrink-0">
                <Sparkles className="h-4 w-4" />
                <span className="text-[11px] font-bold hidden sm:inline">{t('yasa_label')}</span>
              </div>
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-4">
              {loadingContact || loadingMessages ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center py-16">
                  <p className="text-sm text-muted-foreground font-medium bg-card/80 px-4 py-2 rounded-full shadow-sm">
                    {t('message_empty')}
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([day, msgs]) => (
                  <div key={day} className="space-y-2.5">
                    <div className="flex justify-center my-3">
                      <span className="bg-card border border-border/60 text-muted-foreground text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                        {day}
                      </span>
                    </div>
                    {msgs.map((msg, idx) => {
                      const isMe = msg.role !== 'user'
                      const isYasa = msg.role === 'assistant'
                      const prev = msgs[idx - 1]
                      const firstOfGroup = !prev || prev.role !== msg.role
                      return (
                        <div
                          key={msg.id}
                          className={cn('flex w-full', isMe ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] sm:max-w-[65%] px-3 py-2 flex flex-col shadow-sm text-[14px] leading-relaxed break-words whitespace-pre-wrap',
                              isMe
                                ? 'bg-[#dcf8c6] dark:bg-[#075E54] dark:text-white text-foreground rounded-2xl rounded-tr-sm'
                                : 'bg-card border border-border/60 text-foreground rounded-2xl rounded-tl-sm',
                              !firstOfGroup && (isMe ? 'rounded-tr-2xl' : 'rounded-tl-2xl'),
                            )}
                          >
                            {isYasa && firstOfGroup && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-primary dark:text-primary-foreground/80 mb-0.5 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> {t('yasa_label')}
                              </span>
                            )}
                            <span>{msg.content}</span>
                            <span
                              className={cn(
                                'text-[10px] mt-1 self-end flex items-center gap-1 font-semibold opacity-70',
                                isMe
                                  ? 'text-foreground/70 dark:text-white/70'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {formatTime(msg.timestamp || msg.created)}
                              {isMe &&
                                (isYasa ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                ))}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de resposta */}
            <div className="px-3 sm:px-6 py-3 bg-card border-t border-border shrink-0">
              <form onSubmit={handleSend} className="flex gap-2 items-end">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('type_message')}
                  className="flex-1 bg-muted/60 border-transparent rounded-full h-12 px-5 text-[14px] font-medium focus-visible:bg-background focus-visible:border-border"
                />
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  size="icon"
                  className="h-12 w-12 rounded-full shrink-0 shadow-subtle"
                  title={t('send_message')}
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
