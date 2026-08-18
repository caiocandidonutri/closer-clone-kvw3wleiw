/// <reference path="../pb_data/types.d.ts" />
// InfinitePay checkout integration: store the generated payment link and its
// order_nsu on each subscription_plan so the app can show the right checkout
// URL and the webhook can map an approved payment back to a plan.
//
// Adds to subscription_plans:
//   - infinitepay_link     (text)  checkout URL returned by the InfinitePay API
//   - infinitepay_order_nsu (text)  order_nsu we sent when creating the link
//
// Adds to patients:
//   - infinitepay_transaction_nsu (text) last transaction_nsu received from a
//        webhook (avoids processing the same payment twice)

migrate(
  (app) => {
    // ── subscription_plans ──
    const plansCol = app.findCollectionByNameOrId('subscription_plans')
    if (!plansCol.fields.getByName('infinitepay_link')) {
      plansCol.fields.add(new TextField({ name: 'infinitepay_link' }))
    }
    if (!plansCol.fields.getByName('infinitepay_order_nsu')) {
      plansCol.fields.add(new TextField({ name: 'infinitepay_order_nsu' }))
    }
    app.save(plansCol)

    // ── patients ──
    const patientsCol = app.findCollectionByNameOrId('patients')
    if (!patientsCol.fields.getByName('infinitepay_transaction_nsu')) {
      patientsCol.fields.add(new TextField({ name: 'infinitepay_transaction_nsu' }))
    }
    app.save(patientsCol)

    // ── Seed stable order_nsu values for the 3 paid plans so the link
    // creation route can send a deterministic order_nsu and the webhook can
    // match a payment to a plan even before links are (re)created. ──
    const seedNsu = (slug, nsu) => {
      try {
        const rec = app.findFirstRecordByData('subscription_plans', 'slug', slug)
        const cur = rec.getString('infinitepay_order_nsu')
        if (!cur) {
          rec.set('infinitepay_order_nsu', nsu)
          app.save(rec)
          console.log('[0018] set order_nsu for ' + slug + ' → ' + nsu)
        }
      } catch (err) {
        console.log(
          '[0018] could not set order_nsu for ' +
            slug +
            ': ' +
            (err && err.message ? err.message : String(err)),
        )
      }
    }
    seedNsu('weekly', 'nutri-weekly')
    seedNsu('monthly', 'nutri-monthly')
    seedNsu('quarterly', 'nutri-quarterly')
  },
  (app) => {
    try {
      const plansCol = app.findCollectionByNameOrId('subscription_plans')
      const a = plansCol.fields.getByName('infinitepay_link')
      if (a) plansCol.fields.remove(a)
      const b = plansCol.fields.getByName('infinitepay_order_nsu')
      if (b) plansCol.fields.remove(b)
      app.save(plansCol)
    } catch (_) {}
    try {
      const patientsCol = app.findCollectionByNameOrId('patients')
      const t = patientsCol.fields.getByName('infinitepay_transaction_nsu')
      if (t) patientsCol.fields.remove(t)
      app.save(patientsCol)
    } catch (_) {}
  },
)
