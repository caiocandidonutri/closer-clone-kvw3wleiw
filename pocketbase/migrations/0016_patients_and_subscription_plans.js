/// <reference path="../pb_data/types.d.ts" />
// Patients + subscription plans — turns Nutri Responde into a commercial product
// with patient caps, plans, trial limits and expiration control.

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // ── subscription_plans ──
    const plansCol = new Collection({
      name: 'subscription_plans',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'price_brl', type: 'number' },
        { name: 'duration_days', type: 'number', onlyInt: true },
        // 0 (or null) = unlimited messages
        { name: 'message_limit', type: 'number', onlyInt: true },
        { name: 'is_active', type: 'bool' },
        { name: 'benefits', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_subscription_plans_slug ON subscription_plans (slug)'],
    })
    app.save(plansCol)

    // ── patients ──
    const patientsCol = new Collection({
      name: 'patients',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: usersId, maxSelect: 1 },
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'birth_date', type: 'date' },
        { name: 'nutritional_goal', type: 'text' },
        { name: 'registration_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['active', 'inactive', 'trial', 'expired'],
          maxSelect: 1,
        },
        {
          name: 'subscription_plan',
          type: 'select',
          values: ['free_trial', 'weekly', 'monthly', 'quarterly'],
          maxSelect: 1,
        },
        { name: 'subscription_start', type: 'date' },
        { name: 'subscription_end', type: 'date' },
        { name: 'message_count_used', type: 'number', onlyInt: true },
        { name: 'message_count_limit', type: 'number', onlyInt: true },
        // relation to the WhatsApp contact record (when the patient has one)
        {
          name: 'contact',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('contacts').id,
          maxSelect: 1,
        },
        // who invited this patient (relation to users)
        { name: 'invited_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_patients_owner ON patients (owner)',
        'CREATE INDEX idx_patients_status ON patients (status)',
        'CREATE INDEX idx_patients_subscription_end ON patients (subscription_end)',
      ],
    })
    app.save(patientsCol)

    // ── Seed the 4 subscription plans (idempotent) ──
    const seedPlan = (slug, name, description, price, days, limit, benefits) => {
      try {
        app.findFirstRecordByData('subscription_plans', 'slug', slug)
        return // already exists
      } catch (_) {}
      const rec = new Record(plansCol)
      rec.set('slug', slug)
      rec.set('name', name)
      rec.set('description', description)
      rec.set('price_brl', price)
      rec.set('duration_days', days)
      rec.set('message_limit', limit)
      rec.set('is_active', true)
      rec.set('benefits', benefits)
      app.save(rec)
    }

    seedPlan(
      'free_trial',
      'Free Trial',
      'Período de teste gratuito para o paciente conhecer a Yasa.',
      0,
      3,
      20,
      [
        '3 dias de acesso grátis',
        'Até 20 mensagens com a Yasa',
        'Acesso a todas as funcionalidades',
        'Sem cartão de crédito',
      ],
    )
    seedPlan('weekly', 'Semanal', 'Plano semanal com mensagens ilimitadas.', 29.9, 7, 0, [
      '7 dias de acesso',
      'Mensagens ilimitadas com a Yasa',
      'Lista de compras inteligente',
      'Modo "O que tenho na geladeira?"',
    ])
    seedPlan(
      'monthly',
      'Mensal',
      'Plano mensal com mensagens ilimitadas — o mais popular.',
      79.9,
      30,
      0,
      [
        '30 dias de acesso',
        'Mensagens ilimitadas com a Yasa',
        'Lista de compras inteligente',
        'Modo "O que tenho na geladeira?"',
        'Acompanhamento completo do plano alimentar',
      ],
    )
    seedPlan(
      'quarterly',
      'Trimestral',
      'Plano trimestral com mensagens ilimitadas e o melhor custo-benefício.',
      199.9,
      90,
      0,
      [
        '90 dias de acesso',
        'Mensagens ilimitadas com a Yasa',
        'Lista de compras inteligente',
        'Modo "O que tenho na geladeira?"',
        'Acompanhamento completo do plano alimentar',
        'Melhor custo-benefício',
      ],
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('patients'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('subscription_plans'))
    } catch (_) {}
  },
)
