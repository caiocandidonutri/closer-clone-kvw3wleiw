/// <reference path="../pb_data/types.d.ts" />
// Auto-creates the InfinitePay checkout links on a schedule (and once at boot),
// so the 3 paid plans always have a real, webhook-enabled payment link stored
// in subscription_plans.infinitepay_link — without anyone having to click a
// button in the UI.
//
// This is a thin wrapper: it performs an internal POST to the same
// /backend/v1/infinitepay/create-links route logic, but WITHOUT requiring an
// authenticated request (cron jobs run unauthenticated).
//
// Cron: every 30 minutes (*/30 * * * *). Idempotent and cheap: it only calls
// the InfinitePay API for plans whose `infinitepay_link` is still empty, so
// once all 3 links exist the cron becomes a no-op until a link is cleared.

cronAdd('infinitepay_auto_create', '*/30 * * * *', () => {
  const handle =
    $os.getenv('INFINITEPAY_HANDLE') || $secrets.get('INFINITEPAY_HANDLE') || 'caio_candido_mac'
  const apiKey = $os.getenv('INFINITEPAY_API_KEY') || $secrets.get('INFINITEPAY_API_KEY') || ''

  const instanceUrl = (
    $os.getenv('PB_INSTANCE_URL') ||
    $secrets.get('PB_INSTANCE_URL') ||
    ''
  ).replace(/\/$/, '')
  const siteUrl = (
    $secrets.get('SITE_URL') ||
    $secrets.get('APP_PUBLIC_URL') ||
    $secrets.get('FRONTEND_URL') ||
    ''
  ).replace(/\/$/, '')

  const explicitWebhook =
    $os.getenv('INFINITEPAY_WEBHOOK_URL') || $secrets.get('INFINITEPAY_WEBHOOK_URL') || ''
  const explicitRedirect =
    $os.getenv('INFINITEPAY_REDIRECT_URL') || $secrets.get('INFINITEPAY_REDIRECT_URL') || ''

  // The InfinitePay API uses the Portuguese spelling `itens` (NOT `items`).
  // Webhook + redirect URLs are the platform's public webhook endpoint, sent
  // verbatim (no query string) unless an explicit override is configured.
  const webhookUrl =
    explicitWebhook || 'https://nutriresponde.goskip.app/backend/v1/webhook/infinitepay'
  const redirectUrl =
    explicitRedirect || 'https://nutriresponde.goskip.app/backend/v1/webhook/infinitepay'

  const planDefs = [
    {
      slug: 'weekly',
      name: 'Plano Semanal - Nutri Responde',
      priceCents: 2990,
      nsu: 'nutri-weekly',
    },
    {
      slug: 'monthly',
      name: 'Plano Mensal - Nutri Responde',
      priceCents: 7990,
      nsu: 'nutri-monthly',
    },
    {
      slug: 'quarterly',
      name: 'Plano Trimestral - Nutri Responde',
      priceCents: 19990,
      nsu: 'nutri-quarterly',
    },
  ]

  let okCount = 0
  let failCount = 0

  for (const def of planDefs) {
    let planRec = null
    try {
      planRec = $app.findFirstRecordByData('subscription_plans', 'slug', def.slug)
    } catch (err) {
      console.log('[infinitepay_auto_create] plan not found: ' + def.slug)
      failCount++
      continue
    }
    // No-op once the API link exists (keeps the cron cheap & idempotent).
    if (planRec.getString('infinitepay_link')) {
      okCount++
      continue
    }
    const nsu = planRec.getString('infinitepay_order_nsu') || def.nsu
    if (!planRec.getString('infinitepay_order_nsu')) {
      planRec.set('infinitepay_order_nsu', nsu)
      $app.save(planRec)
    }

    // NOTE: InfinitePay uses `items` (English spelling).
    const reqBody = {
      handle: handle,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      order_nsu: nsu,
      items: [{ quantity: 1, price: def.priceCents, description: def.name }],
    }
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey

    let res = null
    try {
      res = $http.send({
        url: 'https://api.checkout.infinitepay.io/links',
        method: 'POST',
        headers: headers,
        body: JSON.stringify(reqBody),
        timeout: 20,
      })
    } catch (err) {
      console.log(
        '[infinitepay_auto_create] ' +
          def.slug +
          ' request failed: ' +
          (err && err.message ? err.message : String(err)),
      )
      failCount++
      continue
    }

    const status = (res && res.statusCode) || 0
    let respJson = {}
    try {
      respJson = res.json || {}
    } catch (_) {
      try {
        respJson = JSON.parse(res.body.toString())
      } catch (_) {
        respJson = {}
      }
    }

    if (!status || status >= 400) {
      const rawBodyStr = (res && res.body ? res.body.toString() : '').slice(0, 300)
      console.log(
        '[infinitepay_auto_create] ' + def.slug + ' failed http=' + status + ' body=' + rawBodyStr,
      )
      failCount++
      continue
    }

    const link = (respJson.url || respJson.link || respJson.checkout_url || '').toString()
    if (link) {
      planRec.set('infinitepay_link', link)
      $app.save(planRec)
      okCount++
    }
  }

  console.log(
    '[infinitepay_auto_create] done ok=' + okCount + ' fail=' + failCount + ' handle=' + handle,
  )
})
