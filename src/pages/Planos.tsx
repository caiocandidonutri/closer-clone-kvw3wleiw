import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSubscriptionPlans } from '@/services/patients'
import { Check, X, ExternalLink, RefreshCw, Zap } from 'lucide-react'
import { resolveCheckoutUrl, SubscriptionPlan, FALLBACK_PLANS } from '@/lib/infinitepay'

export default function Planos() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const data = await getSubscriptionPlans()
      if (data && data.length > 0) {
        setPlans(data)
      }
    } catch {
      // Keep fallbacks
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleSyncPlans = async () => {
    setGenerating(true)
    try {
      await fetchPlans()
      toast({
        title: 'Planos atualizados',
        description: 'Os planos e links da InfinitePay foram sincronizados.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar os planos.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const getCheckoutLink = (plan: SubscriptionPlan) => {
    return resolveCheckoutUrl(plan)
  }

  const planTheme = (slug: string) => {
    switch (slug) {
      case 'weekly':
        return {
          border: 'border-emerald-500',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          highlight: true,
        }
      case 'monthly':
        return {
          border: 'border-teal-500/60',
          badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
          button: 'bg-teal-600 hover:bg-teal-700 text-white',
          highlight: false,
        }
      case 'quarterly':
        return {
          border: 'border-amber-500/60',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          button: 'bg-amber-600 hover:bg-amber-700 text-white',
          highlight: false,
        }
      default:
        return {
          border: 'border-border',
          badge: 'bg-muted text-muted-foreground',
          button: 'bg-primary hover:bg-primary/90 text-primary-foreground',
          highlight: false,
        }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Planos de Assinatura
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie e visualize os planos disponíveis e seus links diretos da InfinitePay
          </p>
        </div>
        <Button
          onClick={handleSyncPlans}
          disabled={generating || loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          Sincronizar Planos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const theme = planTheme(plan.slug)
          const checkoutUrl = getCheckoutLink(plan)

          return (
            <Card
              key={plan.id || plan.slug}
              className={`flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                theme.border
              } ${theme.highlight ? 'ring-2 ring-emerald-500/50 shadow-emerald-500/10' : ''}`}
            >
              {plan.slug === 'weekly' && (
                <div className="bg-emerald-600 text-white text-[11px] font-bold py-1 text-center tracking-wider uppercase">
                  ⭐ Mais Escolhido
                </div>
              )}

              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className={`text-xs ${theme.badge}`}>
                      {plan.duration_days} dias
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {plan.limit_type === 'daily'
                        ? `${plan.message_limit} msgs/dia`
                        : `${plan.message_limit} mensagens`}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-extrabold text-foreground">
                      {plan.price_brl === 0
                        ? 'Grátis'
                        : `R$ ${plan.price_brl.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price_brl > 0 && (
                      <span className="text-xs text-muted-foreground">
                        /{' '}
                        {plan.duration_days <= 7
                          ? 'sem'
                          : plan.duration_days <= 30
                            ? 'mês'
                            : 'trim'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      O que está incluso:
                    </p>
                    <ul className="space-y-2 text-xs">
                      {plan.benefits.map((benefit, idx) => {
                        const isBlocked = benefit.startsWith('❌')
                        const cleanText = benefit.replace(/^[✅❌]\s*/, '')

                        return (
                          <li
                            key={idx}
                            className={`flex items-start gap-2 ${
                              isBlocked
                                ? 'text-muted-foreground line-through opacity-70'
                                : 'text-foreground'
                            }`}
                          >
                            {isBlocked ? (
                              <X className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            )}
                            <span>{cleanText}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </CardContent>
              </div>

              <div className="p-6 pt-0">
                {checkoutUrl ? (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button className={`w-full gap-2 ${theme.button}`}>
                      <span>Link InfinitePay</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                ) : (
                  <Button variant="secondary" className="w-full" disabled>
                    Plano Gratuito
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
