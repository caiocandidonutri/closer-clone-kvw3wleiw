import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  MessageSquare,
  AlertTriangle,
  Zap,
  TrendingUp,
  CreditCard,
  Plus,
  RefreshCw,
  Bell,
  Sparkles,
  ArrowRight,
  Send,
  Loader2,
  Calendar,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react'
import { useLanguage } from '@/hooks/use-language'
import { useRealtime } from '@/hooks/use-realtime'
import { listPatients } from '@/services/patients'
import { getConversations } from '@/services/contacts'
import { getNotifications } from '@/services/notifications'
import type { Patient, Contact, AppNotification } from '@/lib/types'
import { useNavigate } from 'react-router-dom'
import { RevenueTab } from '@/components/dashboard/RevenueTab'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

export default function Dashboard() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue'>('overview')

  const loadData = async () => {
    try {
      const [pats, convs, notifsRes] = await Promise.all([
        listPatients(),
        getConversations(),
        getNotifications(1, 20),
      ])
      setPatients(pats)
      setContacts(convs)
      setNotifications(notifsRes.items || [])
    } catch (err) {
      console.error('[Dashboard] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('patients', () => loadData())
  useRealtime('messages', () => loadData())
  useRealtime('notifications', () => loadData())

  const handleQuickRelease = async (patient: Patient) => {
    setReleasingId(patient.id)
    try {
      const res = await pb.send<{ success: boolean; message_count_limit: number }>(
        '/backend/v1/patients/release-messages',
        {
          method: 'POST',
          body: { patient_id: patient.id, amount: 5 },
        },
      )
      if (res && res.success) {
        toast.success(`+5 mensagens liberadas para ${patient.name}! 💚`)
        await loadData()
      } else {
        toast.error('Erro ao liberar mensagens')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao liberar mensagens')
    } finally {
      setReleasingId(null)
    }
  }

  // Estatísticas gerais
  const activePatients = useMemo(
    () => patients.filter((p) => p.status === 'active' || p.status === 'trial'),
    [patients],
  )
  const pendingTriage = useMemo(
    () => patients.filter((p) => !p.triaged && (p.status === 'active' || p.status === 'trial')),
    [patients],
  )
  const pendingContacts = useMemo(() => contacts.filter((c) => c.status === 'pending'), [contacts])

  // 1) Pacientes com limite quase cheio (>= 75% ou >= 80% do limite ou com menos de 5 msgs restantes)
  const nearLimitPatients = useMemo(() => {
    return patients
      .filter((p) => {
        const used = p.message_count_used || 0
        const limit = p.message_count_limit || 0
        if (limit <= 0) return false
        const pct = (used / limit) * 100
        return pct >= 75 || limit - used <= 5
      })
      .sort((a, b) => {
        const pctA = a.message_count_used / (a.message_count_limit || 1)
        const pctB = b.message_count_used / (b.message_count_limit || 1)
        return pctB - pctA
      })
      .slice(0, 3)
  }, [patients])

  // 2) Resumo do dia (cálculo de interações hoje, compras e expirando)
  const todaySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)

    // Pacientes que falaram hoje (baseado em last_message_at dos contatos ou last_interaction)
    const spokeTodayCount = contacts.filter((c) => {
      const d = c.last_message_at ? c.last_message_at.slice(0, 10) : ''
      return d === todayStr
    }).length

    // Compras / novos ativos hoje
    const purchasesToday = patients.filter((p) => {
      const s = p.subscription_start ? p.subscription_start.slice(0, 10) : ''
      const c = p.created ? p.created.slice(0, 10) : ''
      return (s === todayStr || c === todayStr) && p.status === 'active'
    }).length

    // Expirando nos próximos 3 dias
    const now = Date.now()
    const expiringSoonCount = patients.filter((p) => {
      if (!p.subscription_end || p.status !== 'active') return false
      const end = new Date(p.subscription_end).getTime()
      const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays <= 3
    }).length

    return {
      spokeTodayCount,
      purchasesToday,
      expiringSoonCount,
    }
  }, [contacts, patients])

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto bg-background min-h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Painel Nutri Responde
            </h1>
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
              <Sparkles className="h-3 w-3 mr-1 text-emerald-600" />
              Yasa AI Ativa
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe em tempo real as conversas, limites de mensagens e receitas da sua clínica.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Alternador Overview / Financeiro */}
          <div className="inline-flex rounded-xl p-1 bg-muted/60 border border-border">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === 'revenue'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              Receita & Planos
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => navigate('/app/pacientes/novo')}
            className="rounded-full shadow-subtle bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Paciente
          </Button>
        </div>
      </div>

      {activeTab === 'revenue' ? (
        <RevenueTab />
      ) : (
        <>
          {/* RESUMO DO DIA BANNER */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-emerald-500/5 to-primary/5 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Resumo do Dia
                    <span className="text-[11px] font-normal text-muted-foreground">
                      (
                      {new Date().toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                      )
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      {todaySummary.spokeTodayCount}{' '}
                      {todaySummary.spokeTodayCount === 1
                        ? 'paciente falou hoje'
                        : 'pacientes falaram hoje'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
                      {todaySummary.purchasesToday}{' '}
                      {todaySummary.purchasesToday === 1
                        ? 'compra/adesão hoje'
                        : 'compras/adesões hoje'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {todaySummary.expiringSoonCount}{' '}
                      {todaySummary.expiringSoonCount === 1
                        ? 'plano expirando'
                        : 'planos expirando'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/notifications')}
                  className="rounded-full text-xs font-semibold bg-background/80 hover:bg-background shadow-2xs"
                >
                  <Bell className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Ver Notificações
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/app/conversas')}
                  className="rounded-full text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                >
                  Abrir WhatsApp
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
              className="border-border shadow-subtle hover:border-primary/40 transition-colors cursor-pointer rounded-2xl"
              onClick={() => navigate('/app/pacientes')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pacientes Ativos
                </CardTitle>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">{activePatients.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {patients.length} pacientes cadastrados no total
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-border shadow-subtle hover:border-primary/40 transition-colors cursor-pointer rounded-2xl"
              onClick={() => navigate('/app/conversas')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Aguardando Resposta
                </CardTitle>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">{pendingContacts.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {contacts.length} conversas registradas
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-border shadow-subtle hover:border-primary/40 transition-colors cursor-pointer rounded-2xl"
              onClick={() => navigate('/app/notifications')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notificações Pendentes
                </CardTitle>
                <div className="p-2 rounded-xl bg-red-500/10 text-red-600">
                  <Bell className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">
                  {notifications.filter((n) => !n.read).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Alertas proativos gerados pela Yasa
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-border shadow-subtle hover:border-primary/40 transition-colors cursor-pointer rounded-2xl"
              onClick={() => navigate('/app/pacientes')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Triagem Pendente
                </CardTitle>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">{pendingTriage.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pacientes sem ficha de anamnese completa
                </p>
              </CardContent>
            </Card>
          </div>

          {/* SEÇÃO PRINCIPAL: Pacientes Limite Quase Cheio + Ações Rápidas */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* CARD: Pacientes com limite quase cheio (Ocupa 2 colunas) */}
            <Card className="lg:col-span-2 border-border shadow-subtle rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        Pacientes com Limite Quase Cheio
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Pacientes mais próximos de travar o limite. Libere +5 mensagens em 1 clique.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/app/pacientes')}
                    className="text-xs font-semibold text-primary hover:text-primary rounded-full"
                  >
                    Ver todos
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-border/60">
                {nearLimitPatients.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      Tudo sob controle! Nenhum paciente próximo do limite.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Os pacientes com &ge;75% de uso aparecerão aqui automaticamente.
                    </p>
                  </div>
                ) : (
                  nearLimitPatients.map((p) => {
                    const used = p.message_count_used || 0
                    const limit = p.message_count_limit || 0
                    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
                    const remaining = Math.max(0, limit - used)
                    const isReleasing = releasingId === p.id

                    return (
                      <div
                        key={p.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground truncate">
                              {p.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200"
                            >
                              {pct}% usado
                            </Badge>
                            {p.subscription_plan && (
                              <Badge variant="secondary" className="text-[10px]">
                                {p.subscription_plan}
                              </Badge>
                            )}
                          </div>

                          {/* Barra de progresso */}
                          <div className="space-y-1 max-w-md">
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span>
                                {used} de {limit} mensagens usadas
                              </span>
                              <span className="font-semibold text-amber-600">
                                Restam {remaining} msgs
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 90
                                    ? 'bg-red-500'
                                    : pct >= 75
                                      ? 'bg-amber-500'
                                      : 'bg-primary'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/app/pacientes/${p.id}/editar`)}
                            className="rounded-full text-xs font-semibold"
                          >
                            Ver ficha
                          </Button>

                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleQuickRelease(p)}
                            disabled={isReleasing}
                            className="rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-subtle flex items-center gap-1.5"
                          >
                            {isReleasing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5 text-amber-300" />
                            )}
                            Liberar +5 msgs
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* CARD: Ações Rápidas & Atalhos */}
            <Card className="border-border shadow-subtle rounded-2xl">
              <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Atalhos Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/app/conversas')}
                  className="w-full justify-between rounded-xl h-12 text-sm font-semibold hover:bg-muted"
                >
                  <span className="flex items-center gap-2.5">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    Conversas do WhatsApp
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/app/notifications')}
                  className="w-full justify-between rounded-xl h-12 text-sm font-semibold hover:bg-muted"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-amber-600" />
                    Central de Notificações
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/app/receitas')}
                  className="w-full justify-between rounded-xl h-12 text-sm font-semibold hover:bg-muted"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Banco de Receitas Fit
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/app/configuracoes')}
                  className="w-full justify-between rounded-xl h-12 text-sm font-semibold hover:bg-muted"
                >
                  <span className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-purple-600" />
                    Configuração da IA Yasa
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
