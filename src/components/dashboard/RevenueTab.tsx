import { useEffect, useState } from 'react'
import { getRevenueMetrics } from '@/services/revenue'
import type { RevenueMetrics } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

export function RevenueTab() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getRevenueMetrics()
      setMetrics(data)
    } catch (err) {
      console.error('[RevenueTab] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatBrl = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  const planLabels: Record<string, string> = {
    free: 'Free Trial',
    free_trial: 'Free Trial',
    weekly: 'Semanal (R$ 29,90)',
    monthly: 'Mensal (R$ 79,90)',
    quarterly: 'Trimestral (R$ 199,90)',
  }

  const planColors: Record<string, { bg: string; fill: string; text: string }> = {
    free: { bg: 'bg-muted', fill: 'bg-slate-400', text: 'text-slate-600' },
    weekly: { bg: 'bg-blue-50', fill: 'bg-blue-500', text: 'text-blue-700' },
    monthly: { bg: 'bg-emerald-50', fill: 'bg-primary', text: 'text-emerald-700' },
    quarterly: { bg: 'bg-purple-50', fill: 'bg-purple-500', text: 'text-purple-700' },
  }

  // Calculate total distribution for % calculation
  const totalPatientsInDist = metrics
    ? (metrics.plan_distribution.free || 0) +
      (metrics.plan_distribution.weekly || 0) +
      (metrics.plan_distribution.monthly || 0) +
      (metrics.plan_distribution.quarterly || 0)
    : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Métricas de Receita e Assinaturas
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o faturamento mensal recorrente (MRR), planos ativos e alertas de vencimento.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-full shadow-subtle hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/app/planos')}
            className="rounded-full shadow-subtle bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Gerenciar Planos
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* MRR */}
        <Card className="border-border shadow-subtle hover:shadow-elevation transition-all">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                MRR Estimado
              </span>
              <div className="bg-emerald-100 dark:bg-emerald-950/50 p-2.5 rounded-full text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {loading ? '...' : formatBrl(metrics?.mrr || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Receita Recorrente Mensal
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Faturamento Total */}
        <Card className="border-border shadow-subtle hover:shadow-elevation transition-all">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Faturamento Total
              </span>
              <div className="bg-blue-100 dark:bg-blue-950/50 p-2.5 rounded-full text-blue-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {loading ? '...' : formatBrl(metrics?.total_revenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Soma dos planos em vigência
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Planos Ativos */}
        <Card className="border-border shadow-subtle hover:shadow-elevation transition-all">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Planos Ativos
              </span>
              <div className="bg-purple-100 dark:bg-purple-950/50 p-2.5 rounded-full text-purple-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {loading ? '...' : metrics?.active_plans || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Pacientes com assinatura paga
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplentes / Vencidos */}
        <Card className="border-border shadow-subtle hover:shadow-elevation transition-all">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Vencidos / Pendentes
              </span>
              <div className="bg-red-100 dark:bg-red-950/50 p-2.5 rounded-full text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {loading ? '...' : metrics?.overdue?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Assinaturas que expiraram
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Plan Distribution + Next Expiring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição de Planos (Gráfico de Barras CSS Puro) */}
        <Card className="border-border shadow-subtle lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Distribuição de Planos</span>
              <span className="text-xs font-semibold text-muted-foreground">
                {totalPatientsInDist} total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { key: 'monthly', label: 'Mensal', count: metrics?.plan_distribution.monthly || 0 },
              {
                key: 'quarterly',
                label: 'Trimestral',
                count: metrics?.plan_distribution.quarterly || 0,
              },
              { key: 'weekly', label: 'Semanal', count: metrics?.plan_distribution.weekly || 0 },
              { key: 'free', label: 'Free Trial', count: metrics?.plan_distribution.free || 0 },
            ].map((item) => {
              const pct =
                totalPatientsInDist > 0 ? Math.round((item.count / totalPatientsInDist) * 100) : 0
              const styling = planColors[item.key] || planColors.free

              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${styling.fill}`} />
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${styling.fill} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}

            <div className="pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/app/pacientes')}
              >
                Ver todos os pacientes
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela Planos Próximos de Expirar (<= 3 dias) */}
        <Card className="border-border shadow-subtle lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Planos Próximos de Expirar (≤ 3 dias)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pacientes com vencimento iminente para renovação preventiva
                </p>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {metrics?.expiring_soon?.length || 0} pendentes
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : !metrics?.expiring_soon || metrics.expiring_soon.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <Clock className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  Nenhum plano expirando nos próximos 3 dias
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos os planos ativos estão com prazo em dia.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3">Paciente</th>
                      <th className="px-5 py-3">Plano</th>
                      <th className="px-5 py-3">Data Vencimento</th>
                      <th className="px-5 py-3">Dias Restantes</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.expiring_soon.map((p) => {
                      const isUrgent = p.days_left <= 1
                      return (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-foreground">
                            <div>{p.name}</div>
                            {p.phone && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {p.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="secondary" className="capitalize text-xs font-medium">
                              {planLabels[p.plan] || p.plan}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {p.subscription_end
                                ? format(new Date(p.subscription_end), 'dd/MM/yyyy', {
                                    locale: ptBR,
                                  })
                                : '-'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge
                              variant="outline"
                              className={
                                isUrgent
                                  ? 'bg-red-100 text-red-700 border-red-200 font-bold text-xs'
                                  : 'bg-amber-100 text-amber-700 border-amber-200 font-bold text-xs'
                              }
                            >
                              {p.days_left === 0
                                ? 'Hoje'
                                : p.days_left === 1
                                  ? '1 dia'
                                  : `${p.days_left} dias`}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg text-primary hover:text-primary hover:bg-primary/10 text-xs font-semibold"
                              onClick={() => navigate('/app/pacientes')}
                            >
                              Ver Detalhes
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Inadimplentes / Vencidos (se houver) */}
      {metrics?.overdue && metrics.overdue.length > 0 && (
        <Card className="border-border shadow-subtle border-red-200 dark:border-red-950/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Assinaturas Vencidas ({metrics.overdue.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pacientes cuja assinatura passou do prazo e requer renovação ou novo link
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Paciente</th>
                    <th className="px-5 py-3">Último Plano</th>
                    <th className="px-5 py-3">Expirou em</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metrics.overdue.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-semibold text-foreground">
                        <div>{p.name}</div>
                        {p.phone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="capitalize text-xs">
                          {planLabels[p.plan] || p.plan}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {p.subscription_end
                          ? format(new Date(p.subscription_end), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })
                          : '-'}
                        <span className="text-[11px] text-red-600 ml-1">
                          (há {p.days_overdue} {p.days_overdue === 1 ? 'dia' : 'dias'})
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200 text-xs font-semibold"
                        >
                          Vencido
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs font-semibold"
                          onClick={() => navigate('/app/pacientes')}
                        >
                          Renovar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
