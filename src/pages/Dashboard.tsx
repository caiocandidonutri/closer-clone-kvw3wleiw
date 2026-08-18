import { useEffect, useState } from 'react'
import { getContacts, Contact } from '@/services/contacts'
import { listPatients } from '@/services/patients'
import type { Patient } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { useLanguage } from '@/hooks/use-language'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  Clock,
  CheckCircle,
  Loader2,
  ArrowRight,
  UserPlus,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Dashboard() {
  const { t } = useLanguage()
  const dateLocale = ptBR
  const [contacts, setContacts] = useState<Contact[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const [data, pats] = await Promise.all([
        getContacts(),
        listPatients().catch(() => [] as Patient[]),
      ])
      setContacts(data)
      setPatients(pats)
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
  useRealtime('patients', () => {
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

  // Patient panel stats
  const activePatients = patients.filter((p) => p.status === 'active').length
  const expiredPatients = patients.filter((p) => p.status === 'expired').length
  const trialPatients = patients.filter((p) => p.status === 'trial').length
  const engaged = patients.filter((p) => (p.message_count_used || 0) > 0).length
  const engagementRate = patients.length ? Math.round((engaged / patients.length) * 100) : 0

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
                {t('dashboard_pending')}
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
                {t('dashboard_responded')}
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
                {t('dashboard_avg_wait')}
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

      {/* Patient panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            Pacientes
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/app/pacientes')}
          >
            Ver todos
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4 md:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                  Ativos
                </span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-3xl font-bold tracking-tighter text-foreground">
                {loading ? '-' : activePatients}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                  Inadimplentes
                </span>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-3xl font-bold tracking-tighter text-foreground">
                {loading ? '-' : expiredPatients}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                  Em Trial
                </span>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-3xl font-bold tracking-tighter text-foreground">
                {loading ? '-' : trialPatients}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                  Engajamento
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-3xl font-bold tracking-tighter text-foreground">
                {loading ? '-' : engagementRate}%
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">{t('top_leads')}</h3>
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
            {t('no_contacts')}
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
                      {contact.name || t('unknown')}
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
                  {contact.status === 'pending' ? t('status_pending') : t('status_responded')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
