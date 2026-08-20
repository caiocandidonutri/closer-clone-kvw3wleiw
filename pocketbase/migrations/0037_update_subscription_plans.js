/// <reference path="../pb_data/types.d.ts" />
// Migration 0037: Update subscription plans benefits, limits, and InfinitePay links
//
// Frentes 1, 2 e 3:
// - Free Trial: message_limit = 3, benefits: ["3 mensagens no total", "Orientação nutricional básica", "❌ Sem receitas", "❌ Sem estratégia de marmitas", "❌ Sem lista de compras", "❌ Sem geladeira inteligente"]
// - Semanal: message_limit = 15, price_brl = 29.90, infinitepay_link = "https://invoice.infinitepay.io/plans/caio_candido_mac/XfCDjEC9ln", benefits: ["15 mensagens no total", "Orientação nutricional", "✅ Receitas de lanches", "❌ Sem estratégia de marmitas", "❌ Sem lista de compras", "❌ Sem geladeira inteligente"]
// - Mensal: message_limit = 25, price_brl = 79.90, limit_type = 'daily', has_all_features = true, infinitepay_link = "https://invoice.infinitepay.io/plans/caio_candido_mac/G21rZgmQ0b", benefits: ["25 mensagens por dia", "Orientação nutricional", "✅ Receitas de lanches", "✅ Estratégia de marmitas + planos semanais", "✅ Lista de compras inteligente", "✅ Geladeira inteligente"]
// - Trimestral: message_limit = 40, price_brl = 199.90, limit_type = 'daily', has_all_features = true, infinitepay_link = "https://invoice.infinitepay.io/plans/caio_candido_mac/fGRzAl740t", benefits: ["40 mensagens por dia", "Tudo do plano Mensal", "✅ Receitas de lanches e refeições", "✅ Estratégia de marmitas + planos semanais", "✅ Lista de compras inteligente", "✅ Geladeira inteligente", "✅ Acompanhamento premium", "✅ Prioridade no WhatsApp", "✅ Relatórios semanais"]

migrate(
  (app) => {
    const planDefs = [
      {
        slug: 'free_trial',
        name: 'Free Trial',
        description: 'Período de teste gratuito para experimentar a Yasa.',
        price_brl: 0,
        duration_days: 3,
        message_limit: 3,
        limit_type: 'total',
        has_all_features: false,
        infinitepay_link: '',
        benefits: [
          '3 mensagens no total',
          'Orientação nutricional básica',
          '❌ Sem receitas',
          '❌ Sem estratégia de marmitas',
          '❌ Sem lista de compras',
          '❌ Sem geladeira inteligente',
        ],
      },
      {
        slug: 'weekly',
        name: 'Semanal',
        description: 'Plano semanal ideal para começar com receitas práticas.',
        price_brl: 29.9,
        duration_days: 7,
        message_limit: 15,
        limit_type: 'total',
        has_all_features: false,
        infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/XfCDjEC9ln',
        benefits: [
          '15 mensagens no total',
          'Orientação nutricional',
          '✅ Receitas de lanches',
          '❌ Sem estratégia de marmitas',
          '❌ Sem lista de compras',
          '❌ Sem geladeira inteligente',
        ],
      },
      {
        slug: 'monthly',
        name: 'Mensal',
        description: 'Plano mensal com todos os recursos inteligentes e marmitas.',
        price_brl: 79.9,
        duration_days: 30,
        message_limit: 25,
        limit_type: 'daily',
        has_all_features: true,
        infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/G21rZgmQ0b',
        benefits: [
          '25 mensagens por dia',
          'Orientação nutricional',
          '✅ Receitas de lanches',
          '✅ Estratégia de marmitas + planos semanais',
          '✅ Lista de compras inteligente',
          '✅ Geladeira inteligente',
        ],
      },
      {
        slug: 'quarterly',
        name: 'Trimestral',
        description: 'Acompanhamento premium com prioridade e relatórios.',
        price_brl: 199.9,
        duration_days: 90,
        message_limit: 40,
        limit_type: 'daily',
        has_all_features: true,
        infinitepay_link: 'https://invoice.infinitepay.io/plans/caio_candido_mac/fGRzAl740t',
        benefits: [
          '40 mensagens por dia',
          'Tudo do plano Mensal',
          '✅ Receitas de lanches e refeições',
          '✅ Estratégia de marmitas + planos semanais',
          '✅ Lista de compras inteligente',
          '✅ Geladeira inteligente',
          '✅ Acompanhamento premium',
          '✅ Prioridade no WhatsApp',
          '✅ Relatórios semanais',
        ],
      },
    ]

    for (const def of planDefs) {
      try {
        const rec = app.findFirstRecordByData('subscription_plans', 'slug', def.slug)
        rec.set('name', def.name)
        rec.set('description', def.description)
        rec.set('price_brl', def.price_brl)
        rec.set('duration_days', def.duration_days)
        rec.set('message_limit', def.message_limit)
        rec.set('limit_type', def.limit_type)
        rec.set('has_all_features', def.has_all_features)
        rec.set('benefits', def.benefits)
        if (def.infinitepay_link) {
          rec.set('infinitepay_link', def.infinitepay_link)
        }
        app.save(rec)
      } catch (_) {
        // If record didn't exist, create it
        const col = app.findCollectionByNameOrId('subscription_plans')
        const rec = new Record(col)
        rec.set('slug', def.slug)
        rec.set('name', def.name)
        rec.set('description', def.description)
        rec.set('price_brl', def.price_brl)
        rec.set('duration_days', def.duration_days)
        rec.set('message_limit', def.message_limit)
        rec.set('limit_type', def.limit_type)
        rec.set('has_all_features', def.has_all_features)
        rec.set('benefits', def.benefits)
        rec.set('is_active', true)
        if (def.infinitepay_link) {
          rec.set('infinitepay_link', def.infinitepay_link)
        }
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
  },
)
