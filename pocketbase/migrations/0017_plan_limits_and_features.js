/// <reference path="../pb_data/types.d.ts" />
// Rework subscription plans: total vs daily message limits + feature gating.
//
// - subscription_plans gains `limit_type` (select: total | daily) and
//   `has_all_features` (bool: lista de compras + modo geladeira).
// - patients gains `message_reset_date` (date) used to reset the daily
//   counter every 24h for monthly/quarterly plans.
// - The 4 seed plan records are updated with the new commercial rules:
//     free_trial : 5  msgs total,   sem recursos premium
//     weekly     : 15 msgs total,   sem recursos premium
//     monthly    : 25 msgs/dia,     todos os recursos
//     quarterly  : 40 msgs/dia,     todos os recursos

migrate(
  (app) => {
    // ── Add new fields to subscription_plans ──
    const plansCol = app.findCollectionByNameOrId('subscription_plans')
    if (!plansCol.fields.getByName('limit_type')) {
      plansCol.fields.add(
        new SelectField({
          name: 'limit_type',
          values: ['total', 'daily'],
          maxSelect: 1,
        }),
      )
    }
    if (!plansCol.fields.getByName('has_all_features')) {
      plansCol.fields.add(new BoolField({ name: 'has_all_features' }))
    }
    app.save(plansCol)

    // ── Add message_reset_date to patients (daily counter reset anchor) ──
    const patientsCol = app.findCollectionByNameOrId('patients')
    if (!patientsCol.fields.getByName('message_reset_date')) {
      patientsCol.fields.add(new DateField({ name: 'message_reset_date' }))
    }
    app.save(patientsCol)

    // ── Helper to update a plan by slug ──
    const updatePlan = (slug, fields) => {
      try {
        const rec = app.findFirstRecordByData('subscription_plans', 'slug', slug)
        for (const k of Object.keys(fields)) rec.set(k, fields[k])
        app.save(rec)
        console.log('[0017] updated plan ' + slug)
      } catch (err) {
        console.log(
          '[0017] failed to update plan ' +
            slug +
            ': ' +
            (err && err.message ? err.message : String(err)),
        )
      }
    }

    updatePlan('free_trial', {
      name: 'Free Trial',
      description: 'Período de teste gratuito para o paciente conhecer a Yasa.',
      price_brl: 0,
      duration_days: 3,
      message_limit: 5,
      limit_type: 'total',
      has_all_features: false,
      is_active: true,
      benefits: [
        '3 dias de acesso grátis',
        'Até 5 mensagens no total com a Yasa',
        'Orientação nutricional básica',
        'Sem cartão de crédito',
      ],
    })

    updatePlan('weekly', {
      name: 'Semanal',
      description: 'Plano semanal — ideal para experimentar o acompanhamento completo.',
      price_brl: 29.9,
      duration_days: 7,
      message_limit: 15,
      limit_type: 'total',
      has_all_features: false,
      is_active: true,
      benefits: [
        '7 dias de acesso',
        'Até 15 mensagens no total com a Yasa',
        'Orientação nutricional e dúvidas sobre o plano alimentar',
        '❌ Não inclui lista de compras inteligente',
        '❌ Não inclui modo "O que tenho na geladeira?"',
      ],
    })

    updatePlan('monthly', {
      name: 'Mensal',
      description: 'Plano mensal com todos os recursos — o mais popular.',
      price_brl: 79.9,
      duration_days: 30,
      message_limit: 25,
      limit_type: 'daily',
      has_all_features: true,
      is_active: true,
      benefits: [
        '30 dias de acesso',
        '25 mensagens por dia com a Yasa (reset diário)',
        '✅ Lista de compras inteligente',
        '✅ Modo "O que tenho na geladeira?"',
        'Acompanhamento completo do plano alimentar',
      ],
    })

    updatePlan('quarterly', {
      name: 'Trimestral',
      description: 'Plano trimestral com todos os recursos — o melhor custo-benefício.',
      price_brl: 199.9,
      duration_days: 90,
      message_limit: 40,
      limit_type: 'daily',
      has_all_features: true,
      is_active: true,
      benefits: [
        '90 dias de acesso',
        '40 mensagens por dia com a Yasa (reset diário)',
        '✅ Lista de compras inteligente',
        '✅ Modo "O que tenho na geladeira?"',
        'Acompanhamento completo do plano alimentar',
        'Melhor custo-benefício',
      ],
    })

    // ── Backfill message_count_limit for existing patients based on plan ──
    // (so the webhook enforces the new limits right away). Daily-plan counters
    // reset on first message after 24h; total-plan counters keep accumulating.
    const planLimits = {
      free_trial: 5,
      weekly: 15,
      monthly: 25,
      quarterly: 40,
    }
    try {
      const patients = app.findRecordsByFilter('patients', 'id != ""', 'created', 500, 0)
      for (const p of patients) {
        const plan = p.getString('subscription_plan')
        const limit = planLimits[plan]
        if (typeof limit === 'number') {
          p.set('message_count_limit', limit)
          // seed the daily reset anchor for daily plans if empty
          if ((plan === 'monthly' || plan === 'quarterly') && !p.getString('message_reset_date')) {
            p.set('message_reset_date', new Date().toISOString())
          }
          app.save(p)
        }
      }
    } catch (err) {
      console.log(
        '[0017] patient backfill error: ' + (err && err.message ? err.message : String(err)),
      )
    }
  },
  (app) => {
    // Best-effort revert: drop the added fields.
    try {
      const plansCol = app.findCollectionByNameOrId('subscription_plans')
      const lt = plansCol.fields.getByName('limit_type')
      if (lt) plansCol.fields.remove(lt)
      const haf = plansCol.fields.getByName('has_all_features')
      if (haf) plansCol.fields.remove(haf)
      app.save(plansCol)
    } catch (_) {}
    try {
      const patientsCol = app.findCollectionByNameOrId('patients')
      const mrd = patientsCol.fields.getByName('message_reset_date')
      if (mrd) patientsCol.fields.remove(mrd)
      app.save(patientsCol)
    } catch (_) {}
  },
)
