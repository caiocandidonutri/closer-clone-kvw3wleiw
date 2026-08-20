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
  infinitepay_link?: string
  infinitepay_order_nsu?: string
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
    infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/XfCDjEC9ln',
    infinitepay_order_nsu: 'nutri-weekly',
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
    infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/G21rZgmQ0b',
    infinitepay_order_nsu: 'nutri-monthly',
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
    infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/fGRzAl740t',
    infinitepay_order_nsu: 'nutri-quarterly',
    is_active: true,
    created: '',
    updated: '',
  },
]

export const INFINITEPAY_LINKS = {
  weekly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/XfCDjEC9ln',
  monthly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/G21rZgmQ0b',
  quarterly: 'https://invoice.infinitepay.io/plans/caio_candido_mac/fGRzAl740t',
} as const

export const INFINITEPAY_FALLBACK_LINKS = INFINITEPAY_LINKS

export async function createInfinitePayLinks(): Promise<{ success: boolean; message?: string }> {
  try {
    const { pb } = await import('@/lib/pocketbase/client')
    const res = await pb.send<{ success: boolean; message?: string }>(
      '/backend/v1/infinitepay/create-links',
      {
        method: 'POST',
      },
    )
    return res
  } catch (err: any) {
    return {
      success: false,
      message: err?.data?.message || err?.message || 'Falha ao gerar os links da InfinitePay',
    }
  }
}

export function resolveCheckoutUrl(
  plan: SubscriptionPlan | { slug: string; infinitepay_link?: string },
) {
  if (plan.infinitepay_link) return plan.infinitepay_link
  if (plan.slug === 'weekly') return INFINITEPAY_LINKS.weekly
  if (plan.slug === 'monthly') return INFINITEPAY_LINKS.monthly
  if (plan.slug === 'quarterly') return INFINITEPAY_LINKS.quarterly
  return ''
}
