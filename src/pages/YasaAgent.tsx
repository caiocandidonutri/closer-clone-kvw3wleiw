import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/use-language'
import { useYasaConfig } from '@/hooks/use-yasa-config'
import pb from '@/lib/pocketbase/client'
import type { Message, Contact } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Users,
  MessageCircle,
  Clock,
  CircleDot,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface PatientRow {
  contact: Contact
  lastMessage?: Message
}

export default function YasaAgent() {
  const { t } = useLanguage()
  const { config, loading: cfgLoading } = useYasaConfig()
  const [messages, setMessages] = useState<Message[]>([])
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const allMessages = (await pb.collection('messages').getFullList({
          sort: '-created',
        })) as unknown as Message[]
        setMessages(allMessages)

        const contacts = (await pb.collection('contacts').getFullList({
          sort: '-updated',
          filter: '',
        })) as unknown as Contact[]

        // Build last message per contact
        const lastByContact = new Map<string, Message>()
        for (const m of allMessages) {
          const cur = lastByContact.get(m.contact)
          if (!cur || new Date(m.created) > new Date(cur.created)) {
            lastByContact.set(m.contact, m)
          }
        }
        const rows: PatientRow[] = contacts
          .map((contact) => ({ contact, lastMessage: lastByContact.get(contact.id) }))
          .filter((r) => r.lastMessage)
          .sort(
            (a, b) =>
              new Date(b.lastMessage!.created).getTime() -
              new Date(a.lastMessage!.created).getTime(),
          )
        setPatients(rows)
      } catch (err) {
        console.error('[YasaAgent] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayMessages = messages.filter((m) => m.created >= startOfDay)
    const patientsAttended = new Set(messages.map((m) => m.contact)).size
    const aiMessages = messages.filter((m) => m.role === 'assistant')
    const responseTimes = aiMessages
      .map((m) => m.ai_response_seconds)
      .filter((n): n is number => typeof n === 'number' && n > 0)
    const avgResponse =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0
    return {
      patientsAttended,
      messagesToday: todayMessages.length,
      avgResponse,
    }
  }, [messages])

  const pending = useMemo(
    () => messages.filter((m) => m.needs_human && m.role === 'assistant'),
    [messages],
  )

  const aiOnline = !cfgLoading && !!config && (config.is_active || true) && !!config.gemini_api_key
  const initials = (name: string) =>
    (name || '?')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <span className="bg-primary/10 text-primary p-2 rounded-xl">
              <Bot className="h-6 w-6" />
            </span>
            {t('agent_nav')}
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">{t('agent_overview_title')}</p>
        </div>
        <Link to="/app/settings">
          <Button variant="outline" className="rounded-full">
            {t('settings')}
          </Button>
        </Link>
      </div>

      {/* Status + Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-[1.5rem] border-border/40 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-2xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.patientsAttended}</p>
              <p className="text-xs text-muted-foreground font-medium">
                {t('agent_patients_attended')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-border/40 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-2xl">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.messagesToday}</p>
              <p className="text-xs text-muted-foreground font-medium">
                {t('agent_messages_today')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-border/40 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-2xl">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.avgResponse > 0 ? `${stats.avgResponse}s` : '—'}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t('agent_avg_response')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-border/40 shadow-subtle">
          <CardContent className="p-5 flex items-center gap-4">
            <div
              className={`p-3 rounded-2xl ${
                aiOnline ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
              }`}
            >
              <CircleDot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {aiOnline ? t('agent_status_online') : t('agent_status_offline')}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t('agent_status')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending replies */}
      <Card className="rounded-[2rem] border-border/40 shadow-subtle overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 text-amber-600 p-2.5 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl tracking-tight">{t('agent_pending_title')}</CardTitle>
              <CardDescription className="mt-1">{t('agent_pending_desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CircleDot className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm font-semibold text-foreground">{t('agent_pending_empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.slice(0, 20).map((m) => {
                const patient = patients.find((p) => p.contact.id === m.contact)?.contact
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-border/50 bg-card"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials(patient?.name || '?')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">
                          {patient?.name || t('unknown')}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {t('agent_reply')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{m.content}</p>
                    </div>
                    <Link to={`/app/chat/${m.contact}`}>
                      <Button size="sm" className="rounded-full">
                        {t('agent_reply')}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patients list */}
      <Card className="rounded-[2rem] border-border/40 shadow-subtle overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl tracking-tight">{t('agent_patients_title')}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">{t('agent_patients_empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {patients.slice(0, 30).map(({ contact, lastMessage }) => (
                <Link
                  key={contact.id}
                  to={`/app/chat/${contact.id}`}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:shadow-subtle transition-all"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback>{initials(contact.name || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground truncate">{contact.name}</span>
                      {contact.meal_plan_photo && (
                        <Badge className="text-[10px] bg-green-500/10 text-green-700 hover:bg-green-500/10">
                          {t('agent_plan_photo')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                      <span className="font-semibold text-muted-foreground/80">
                        {t('agent_last_doubt')}:{' '}
                      </span>
                      {lastMessage?.content || t('no_messages')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {lastMessage ? new Date(lastMessage.created).toLocaleDateString('pt-BR') : ''}
                    </p>
                    {contact.meal_plan_photo ? (
                      <span className="text-[11px] text-green-600 font-semibold">
                        {t('agent_view_plan')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {t('agent_no_plan')}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
