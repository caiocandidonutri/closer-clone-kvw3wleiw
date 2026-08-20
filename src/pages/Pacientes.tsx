import { useState } from 'react'
import { usePatients } from '@/hooks/use-patients'
import { useRealtime } from '@/hooks/use-realtime'
import { useLanguage } from '@/hooks/use-language'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  Plus,
  Loader2,
  Search,
  Phone,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Patient, PatientStatus } from '@/lib/types'

const STATUS_LABELS: Record<PatientStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  trial: 'Trial',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}

const STATUS_BADGES: Record<PatientStatus, string> = {
  active: 'bg-green-100/60 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  trial: 'bg-blue-100/60 text-blue-700 border-blue-200',
  expired: 'bg-red-100/60 text-red-700 border-red-200',
  cancelled: 'bg-amber-100/60 text-amber-700 border-amber-200',
}

const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
}

export default function Pacientes() {
  const { patients, loading, remove, refetch } = usePatients()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  useRealtime('patients', () => refetch())

  const filtered = patients.filter(
    (p) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search),
  )

  const active = patients.filter((p) => p.status === 'active').length
  const trial = patients.filter((p) => p.status === 'trial').length
  const expired = patients.filter((p) => p.status === 'expired').length
  const engaged = patients.filter((p) => (p.message_count_used || 0) > 0).length
  const engagementRate = patients.length ? Math.round((engaged / patients.length) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <span className="bg-primary/10 text-primary p-2 rounded-xl">
              <Users className="h-6 w-6" />
            </span>
            Pacientes
          </h2>
          <p className="text-muted-foreground mt-1 font-medium max-w-xl">
            Cadastre seus pacientes, controle planos e acompanhe o engajamento.
          </p>
        </div>
        <Button
          onClick={() => navigate('/app/pacientes/novo')}
          className="rounded-full px-6 shadow-elevation shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo paciente
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4 md:p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                Ativos
              </span>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-3xl font-bold tracking-tighter text-foreground">
              {loading ? '-' : active}
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
              {loading ? '-' : trial}
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
              {loading ? '-' : expired}
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

      <Card className="border-border/40 shadow-subtle rounded-[2rem] overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl pl-9 h-11"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-bold text-foreground">Nenhum paciente cadastrado</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                Cadastre seu primeiro paciente para enviar o convite pelo WhatsApp.
              </p>
              <Button
                onClick={() => navigate('/app/pacientes/novo')}
                variant="outline"
                className="rounded-full mt-5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo paciente
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <PatientRow key={p.id} patient={p} onRemove={() => remove(p.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const PLAN_DAILY: Record<string, boolean> = {
  monthly: true,
  quarterly: true,
  free_trial: false,
  weekly: false,
}

function PatientRow({ patient, onRemove }: { patient: Patient; onRemove: () => void }) {
  const navigate = useNavigate()
  const lastInteraction = patient.updated || patient.created
  const limit = patient.message_count_limit || 0
  const used = patient.message_count_used || 0
  const isDaily = PLAN_DAILY[patient.subscription_plan] ?? false
  const hasLimit = limit > 0
  const reachedLimit = hasLimit && used >= limit

  return (
    <div className="flex items-center justify-between gap-3 py-3.5 px-3 -mx-1 rounded-2xl hover:bg-muted transition-all duration-300 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
          {patient.name?.charAt(0)?.toUpperCase() || '#'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] tracking-tight text-foreground truncate">
            {patient.name}
          </p>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-medium">
            <Phone className="h-3 w-3" />
            <span className="truncate">{patient.phone}</span>
            {lastInteraction && (
              <>
                <span>·</span>
                <span className="truncate">
                  {formatDistanceToNow(new Date(lastInteraction), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-[11px] px-2 py-0.5 hidden sm:inline-flex">
          {PLAN_LABELS[patient.subscription_plan] || patient.subscription_plan}
        </Badge>
        {hasLimit && (
          <span className="text-[11px] text-muted-foreground font-semibold hidden md:inline">
            {used}/{limit} {isDaily ? 'msgs/dia' : 'msgs'}
          </span>
        )}
        <Badge
          variant="outline"
          className={`text-[11px] px-2 py-0.5 ${STATUS_BADGES[patient.status]}`}
        >
          {reachedLimit ? 'Limite atingido' : STATUS_LABELS[patient.status]}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
