import { useNavigate } from 'react-router-dom'
import { usePlans } from '@/hooks/use-patients'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, CreditCard, Sparkles, X } from 'lucide-react'
import type { SubscriptionPlan } from '@/lib/types'

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Planos() {
  const { plans, loading } = usePlans()
  const navigate = useNavigate()

  const sorted = [...plans].sort((a, b) => (a.price_brl || 0) - (b.price_brl || 0))

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Planos de assinatura
        </h2>
        <p className="text-muted-foreground mt-2 font-medium max-w-xl mx-auto">
          Escolha o plano ideal para cada paciente. A lista de compras inteligente e o modo
          geladeira são exclusivos dos planos Mensal e Trimestral.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {sorted.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onContract={() => navigate('/app/pacientes/novo')}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Sem fidelidade · Cancele quando quiser · Pagamento via WhatsApp
      </p>
    </div>
  )
}

function PlanCard({ plan, onContract }: { plan: SubscriptionPlan; onContract: () => void }) {
  const isFree = (plan.price_brl || 0) === 0
  const isPopular = plan.slug === 'monthly'
  const benefits: string[] = Array.isArray(plan.benefits) ? plan.benefits : []
  const isDaily = plan.limit_type === 'daily'
  const hasAllFeatures = !!plan.has_all_features

  // Descrição do limite de mensagens conforme a semântica do plano.
  const limitLabel = (() => {
    if (plan.slug === 'quarterly') return `${plan.message_limit} mensagens por dia (reset diário)`
    if (plan.slug === 'monthly') return `${plan.message_limit} mensagens por dia (reset diário)`
    if (plan.slug === 'weekly') return `${plan.message_limit} mensagens no total`
    if (plan.slug === 'free_trial') return `${plan.message_limit} mensagens no total`
    if (plan.message_limit > 0)
      return isDaily
        ? `${plan.message_limit} mensagens por dia`
        : `${plan.message_limit} mensagens no total`
    return 'Mensagens ilimitadas'
  })()

  return (
    <Card
      className={`relative rounded-[1.75rem] overflow-hidden border-2 transition-all hover:shadow-elevation ${
        isPopular ? 'border-primary shadow-elevation' : 'border-border/40'
      }`}
    >
      {isPopular && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Mais popular
        </div>
      )}
      <CardContent className="p-6 flex flex-col h-full">
        <div className="mb-4">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
          )}
        </div>

        <div className="mb-5">
          <span className="text-4xl font-bold tracking-tighter text-foreground">
            {isFree ? 'Grátis' : formatBRL(plan.price_brl)}
          </span>
          {!isFree && (
            <span className="text-sm text-muted-foreground font-medium">
              {' '}
              / {plan.duration_days} dias
            </span>
          )}
        </div>

        <div className="space-y-2.5 flex-1 mb-6">
          {/* Limite de mensagens em destaque */}
          <div className="flex items-start gap-2 mb-1">
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-sm text-foreground font-bold">{limitLabel}</span>
          </div>

          {benefits.length > 0 ? (
            benefits.map((b, i) => {
              const isExclusion = b.indexOf('❌') >= 0
              return (
                <div key={i} className="flex items-start gap-2">
                  {isExclusion ? (
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      isExclusion ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {b}
                  </span>
                </div>
              )
            })
          ) : (
            <>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-foreground font-medium">
                  {plan.duration_days} dias de acesso
                </span>
              </div>
              {hasAllFeatures ? (
                <>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground font-medium">
                      Lista de compras inteligente
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground font-medium">
                      Modo "O que tenho na geladeira?"
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground font-medium line-through">
                      Lista de compras inteligente
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground font-medium line-through">
                      Modo "O que tenho na geladeira?"
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <Button
          onClick={onContract}
          className={`rounded-full w-full ${isPopular ? 'shadow-elevation' : ''}`}
          variant={isPopular ? 'default' : 'outline'}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {isFree ? 'Começar grátis' : 'Contratar'}
        </Button>

        <Badge variant="outline" className="mt-3 self-center text-[10px]">
          {limitLabel}
        </Badge>
      </CardContent>
    </Card>
  )
}
