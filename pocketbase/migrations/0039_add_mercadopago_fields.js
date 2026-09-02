/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar a coleção subscription_plans com campos do Mercado Pago
    const plansCol = app.findCollectionByNameOrId('subscription_plans')
    if (!plansCol.fields.getByName('mercadopago_init_point')) {
      plansCol.fields.add(new TextField({ name: 'mercadopago_init_point' }))
    }
    if (!plansCol.fields.getByName('mercadopago_preference_id')) {
      plansCol.fields.add(new TextField({ name: 'mercadopago_preference_id' }))
    }
    if (!plansCol.fields.getByName('mercadopago_external_reference')) {
      plansCol.fields.add(new TextField({ name: 'mercadopago_external_reference' }))
    }
    app.save(plansCol)

    // 2. Atualizar a coleção patients com campos de transação do Mercado Pago
    const patientsCol = app.findCollectionByNameOrId('patients')
    if (!patientsCol.fields.getByName('mercadopago_payment_id')) {
      patientsCol.fields.add(new TextField({ name: 'mercadopago_payment_id' }))
    }
    if (!patientsCol.fields.getByName('mercadopago_preference_id')) {
      patientsCol.fields.add(new TextField({ name: 'mercadopago_preference_id' }))
    }
    app.save(patientsCol)

    // 3. Atualizar planos existentes com external_reference padrão
    try {
      const weekly = app.findFirstRecordByData('subscription_plans', 'slug', 'weekly')
      weekly.set('mercadopago_external_reference', 'nutri-weekly')
      app.save(weekly)
    } catch (_) {}

    try {
      const monthly = app.findFirstRecordByData('subscription_plans', 'slug', 'monthly')
      monthly.set('mercadopago_external_reference', 'nutri-monthly')
      app.save(monthly)
    } catch (_) {}

    try {
      const quarterly = app.findFirstRecordByData('subscription_plans', 'slug', 'quarterly')
      quarterly.set('mercadopago_external_reference', 'nutri-quarterly')
      app.save(quarterly)
    } catch (_) {}
  },
  (app) => {
    try {
      const plansCol = app.findCollectionByNameOrId('subscription_plans')
      plansCol.fields.removeByName('mercadopago_init_point')
      plansCol.fields.removeByName('mercadopago_preference_id')
      plansCol.fields.removeByName('mercadopago_external_reference')
      app.save(plansCol)
    } catch (_) {}

    try {
      const patientsCol = app.findCollectionByNameOrId('patients')
      patientsCol.fields.removeByName('mercadopago_payment_id')
      patientsCol.fields.removeByName('mercadopago_preference_id')
      app.save(patientsCol)
    } catch (_) {}
  },
)
