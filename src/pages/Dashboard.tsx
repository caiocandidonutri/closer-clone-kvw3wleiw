import { useEffect, useState } from 'react'
import { getContacts, Contact } from '@/services/contacts'
import { useRealtime } from '@/hooks/use-realtime'
import { useLanguage } from '@/hooks/use-language'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Clock, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'

export default function Dashboard() {
  const { t, language } = useLanguage()
  const dateLocale = language === 'pt' ? ptBR : enUS
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const data = await getContacts()
      setContacts(data)
    } catch (err) {
      console.error('[Dashboard] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useRealtime('contacts', () => {
    load()
  })

  const pending = contacts.filter((c) => c.status === 'pending')
  const responded = contacts.filter((c) => c.status === 'responded')

  const avgWaitSeconds = pending.length
    ? Math.round(pending.reduce((acc, c) => acc + (c.wait_time_seconds || 0), 0) / pending.length)
    : 0
  const avgWaitText =
    avgWaitSeconds === 0
      ? '-'
      : avgWaitSeconds >= 3600
        ? `${Math.round(avgWaitSeconds / 3600)}h`
        : `${Math.round(avgWaitSeconds / 60)}m`

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-6 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-apple bg-background min-h-full">
      <div>
        <h2 className="text-4xl font-bold tracking-tight text-foreground">{t('overview')}</h2>
        <p className="text-muted-foreground mt-2 font-medium text-base">{t('crm_health')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-muted-foreground tracking-tight uppercase">
                Pending
              </span>
              <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="text-5xl font-bold tracking-tighter text-foreground">
              {loading ? '-' : pending.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-muted-foreground tracking-tight uppercase">
                Responded
              </span>
              <div className="bg-green-100 p-3 rounded-full text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-5xl font-bold tracking-tighter text-foreground">
              {loading ? '-' : responded.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-muted-foreground tracking-tight uppercase">
                Avg Wait Time
              </span>
              <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="text-5xl font-bold tracking-tighter text-foreground">
              {loading && contacts.length === 0 ? '-' : avgWaitText}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {t('top_leads') || 'Recent Contacts'}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground"
            onClick={() => navigate('/app/contacts')}
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center font-semibold py-12">
            {t('no_contacts') || 'No contacts yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.slice(0, 6).map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between py-3.5 px-3 -mx-3 rounded-2xl hover:bg-muted transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/app/chat/${contact.id}`)}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-11 w-11 border-2 border-border shadow-sm">
                    <AvatarImage src={contact.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-foreground font-semibold text-sm">
                      {contact.name?.charAt(0) || '#'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {contact.name || 'Unknown'}
                    </p>
                    <p className="text-[13px] text-muted-foreground font-semibold truncate max-w-[260px]">
                      {contact.last_message ||
                        (contact.created
                          ? formatDistanceToNow(new Date(contact.created), {
                              addSuffix: true,
                              locale: dateLocale,
                            })
                          : '')}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    contact.status === 'pending'
                      ? 'bg-amber-100/50 text-amber-600 border-amber-200 text-[11px] px-2.5 py-0.5'
                      : 'bg-green-100/50 text-green-600 border-green-200 text-[11px] px-2.5 py-0.5'
                  }
                >
                  {contact.status === 'pending' ? 'Pending' : 'Responded'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
