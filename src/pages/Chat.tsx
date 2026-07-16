import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContact, Contact } from '@/services/contacts'
import { useMessages } from '@/hooks/use-messages'
import { sendMessage } from '@/services/integrations'
import { useLanguage } from '@/hooks/use-language'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const dateLocale = language === 'pt' ? ptBR : enUS

  const [contact, setContact] = useState<Contact | null>(null)
  const [loadingContact, setLoadingContact] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, loading } = useMessages(id)

  useEffect(() => {
    if (!id) return
    getContact(id)
      .then((data) => setContact(data))
      .catch((err) => {
        console.error('[Chat] contact fetch error:', err)
      })
      .finally(() => setLoadingContact(false))
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !id) return
    const text = newMessage.trim()
    setNewMessage('')
    setIsSending(true)
    try {
      await sendMessage(id, text)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (dateStr: string) => format(new Date(dateStr), 'HH:mm')
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return language === 'pt' ? 'Hoje' : 'Today'
    if (isYesterday(date)) return language === 'pt' ? 'Ontem' : 'Yesterday'
    return format(date, 'dd/MM/yyyy', { locale: dateLocale })
  }

  if (loadingContact) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground font-medium">
          {t('no_contacts_found') || 'Contact not found'}
        </p>
        <Button
          variant="outline"
          onClick={() => navigate('/app/contacts')}
          className="rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('return_home') || 'Back'}
        </Button>
      </div>
    )
  }

  const grouped: { [key: string]: typeof messages } = {}
  messages.forEach((msg) => {
    const dateKey = formatDate(msg.timestamp || msg.created)
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(msg)
  })

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-apple flex">
      <div className="flex-1 h-full flex flex-col bg-card border border-border/60 shadow-elevation rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-5 bg-background/50 backdrop-blur-xl border-b border-border/40 z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 -ml-2 hover:bg-muted"
              onClick={() => navigate('/app/contacts')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border shadow-sm">
              <AvatarImage src={contact.avatar_url || ''} />
              <AvatarFallback className="bg-muted text-foreground font-bold text-lg">
                {contact.name?.charAt(0) || '#'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col max-w-[180px] sm:max-w-[260px]">
              <span className="font-bold text-[15px] sm:text-[17px] tracking-tight truncate text-foreground leading-tight">
                {contact.name || 'Unknown'}
              </span>
              <span className="text-[12px] sm:text-[13px] font-semibold text-muted-foreground truncate">
                {contact.whatsapp_id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] sm:text-[13px] font-bold">Yasa AI</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-zinc-50/30 dark:bg-background/30">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, msgs]) => (
              <div key={date} className="space-y-4">
                <div className="flex justify-center my-2">
                  <span className="bg-card border border-border/40 text-muted-foreground text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>
                {msgs.map((msg) => {
                  const isMe = msg.role !== 'user'
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex w-full', isMe ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] sm:max-w-[70%] px-4 sm:px-5 py-2.5 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] flex flex-col shadow-sm text-[14px] sm:text-[15px] leading-relaxed font-medium',
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-card border border-border/60 text-foreground rounded-bl-sm',
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Yasa
                          </span>
                        )}
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        <span
                          className={cn(
                            'text-[10px] sm:text-[11px] mt-1.5 self-end font-bold opacity-70',
                            isMe ? 'text-primary-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {formatTime(msg.timestamp || msg.created)}
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

        <div className="p-3 sm:p-5 bg-background/50 backdrop-blur-xl border-t border-border/40 shrink-0 z-10">
          <form onSubmit={handleSend} className="flex gap-2.5 sm:gap-3 items-end">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('type_message') || 'Type a message...'}
              className="w-full bg-card border-border shadow-sm rounded-2xl sm:rounded-full h-12 sm:h-14 px-5 sm:px-6 text-[14px] sm:text-[15px] font-medium pr-12 focus-visible:ring-primary/20 transition-all"
            />
            <Button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              size="icon"
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl sm:rounded-full shrink-0 shadow-subtle hover:scale-105 transition-all duration-300"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
