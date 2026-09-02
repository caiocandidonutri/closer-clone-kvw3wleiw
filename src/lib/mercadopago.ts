export interface SubscriptionPlan {
  id: string
  name: string
  slug: 'free_trial' | 'weekly' | 'monthly' | 'quarterly'
  description: string
  price_brl: number
  duration_days: number
  message_limit: number
  limit_type: 'daily' | 'total'
  has_all_features: boolean
  benefits: string[]
  mercadopago_init_point?: string
  mercadopago_preference_id?: string
  mercadopago_external_reference?: string
  is_active: boolean
  created: string
  updated: string
}

export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free_trial',
    name: 'Grátis',
    slug: 'free_trial',
    description: 'Experimente a Yasa com orientação nutricional básica.',
    price_brl: 0,
    duration_days: 3,
    message_limit: 3,
    limit_type: 'total',
    has_all_features: false,
    benefits: [
      'Orientação nutricional básica',
      '❌ Sem receitas',
      '❌ Sem estratégia de marmitas',
      '❌ Sem lista de compras',
      '❌ Sem geladeira inteligente',
    ],
    is_active: true,
    created: '',
    updated: '',
  },
  {
    id: 'plan_weekly',
    name: 'Semanal',
    slug: 'weekly',
    description: 'Ideal para uma rotina prática com receitas de lanches saudáveis.',
    price_brl: 29.9,
    duration_days: 7,
    message_limit: 15,
    limit_type: 'total',
    has_all_features: false,
    benefits: [
      'Orientação nutricional',
      'Receitas de lanches',
      '❌ Sem estratégia de marmitas',
      '❌ Sem lista de compras',
      '❌ Sem geladeira inteligente',
    ],
    mercadopago_external_reference: 'nutri-weekly',
    is_active: true,
    created: '',
    updated: '',
  },
  {
    id: 'plan_monthly',
    name: 'Mensal',
    slug: 'monthly',
    description: 'Plano completo com receitas, estratégias de marmitas e lista de compras.',
    price_brl: 79.9,
    duration_days: 30,
    message_limit: 25,
    limit_type: 'daily',
    has_all_features: true,
    benefits: [
      'Orientação nutricional',
      'Receitas de lanches',
      'Estratégia de marmitas + planos semanais',
      'Lista de compras inteligente',
      'Geladeira inteligente',
    ],
    mercadopago_external_reference: 'nutri-monthly',
    is_active: true,
    created: '',
    updated: '',
  },
  {
    id: 'plan_quarterly',
    name: 'Trimestral',
    slug: 'quarterly',
    description: 'Transformação contínua com acompanhamento premium e prioridade.',
    price_brl: 199.9,
    duration_days: 90,
    message_limit: 40,
    limit_type: 'daily',
    has_all_features: true,
    benefits: [
      'Tudo do Mensal',
      'Acompanhamento premium',
      'Prioridade no WhatsApp',
      'Relatórios semanais',
    ],
    mercadopago_external_reference: 'nutri-quarterly',
    is_active: true,
    created: '',
    updated: '',
  },
]

export async function createMercadoPagoLinks(): Promise<{
  success: boolean
  message?: string
  results?: Array<{ slug: string; ok: boolean; init_point?: string; error?: string }>
}> {
  try {
    const pb = (await import('@/lib/pocketbase/client')).default
    const res = await pb.send<{
      success: boolean
      message?: string
      results?: Array<{ slug: string; ok: boolean; init_point?: string; error?: string }>
    }>('/backend/v1/mercadopago/create-links', {
      method: 'POST',
    })
    return res
  } catch (err: any) {
    return {
      success: false,
      message:
        err?.data?.message ||
        err?.message ||
        'Falha ao gerar os links de pagamento do Mercado Pago',
    }
  }
}

export function resolveCheckoutUrl(
  plan: SubscriptionPlan | { slug: string; mercadopago_init_point?: string },
): string {
  if (plan.mercadopago_init_point) return plan.mercadopago_init_point
  return ''
}
