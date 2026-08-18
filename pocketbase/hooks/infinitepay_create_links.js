/// <reference path="../pb_data/types.d.ts" />
// (Re)creates the InfinitePay checkout links for the 3 paid plans with the
// platform's webhook_url so payments are notified automatically.
//
// Route: POST /backend/v1/infinitepay/create-links  (auth required)
//
// Calls the InfinitePay Checkout API:
//   POST https://api.checkout.infinitepay.io/links
//   Authorization: Bearer {INFINITEPAY_API_KEY}   (when the secret is set)
//
// The link + slug are stored back on each subscription_plan record
// (infinitepay_link / infinitepay_order_nsu). The webhook matches incoming
// payments by order_nsu.

routerAdd(
  'POST',
  '/backend/v1/infinitepay/create-links',
  (e) => {
    // ── Config ──
    const handle =
      $os.getenv('INFINITEPAY_HANDLE') || $secrets.get('INFINITEPAY_HANDLE') || 'caio_candido_mac'
    const apiKey = $os.getenv('INFINITEPAY_API_KEY') || $secrets.get('INFINITEPAY_API_KEY') || ''

    // Public webhook URL on this backend.
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
    // Prefer the backend instance URL (the hook lives on the backend).
    const webhookUrl = (instanceUrl || siteUrl) + '/backend/v1/webhook/infinitepay?handle=' + handle
    const redirectUrl = (siteUrl || 'https://nutriresponde.goskip.app') + '/?paid=1'

    console.log(
      '[infinitepay_create_links] handle=' +
        handle +
        ' webhookUrl=' +
        webhookUrl +
        ' apiKeyPresent=' +
        (apiKey ? true : false),
    )

    // ── Plan definitions (slug → { name, price_cents, order_nsu }) ──
    const planDefs = [
      {
        slug: 'weekly',
        name: 'Plano Semanal — Nutri Responde',
        priceCents: 2990,
        nsu: 'nutri-weekly',
      },
      {
        slug: 'monthly',
        name: 'Plano Mensal — Nutri Responde',
        priceCents: 7990,
        nsu: 'nutri-monthly',
      },
      {
        slug: 'quarterly',
        name: 'Plano Trimestral — Nutri Responde',
        priceCents: 19990,
        nsu: 'nutri-quarterly',
      },
    ]

    const results = []

    for (const def of planDefs) {
      // Resolve the plan record (and seed its order_nsu if missing).
      let planRec = null
      try {
        planRec = $app.findFirstRecordByData('subscription_plans', 'slug', def.slug)
      } catch (err) {
        console.log('[infinitepay_create_links] plan not found: ' + def.slug)
        results.push({ slug: def.slug, ok: false, error: 'plan not found' })
        continue
      }
      const nsu = planRec.getString('infinitepay_order_nsu') || def.nsu
      if (!planRec.getString('infinitepay_order_nsu')) {
        planRec.set('infinitepay_order_nsu', nsu)
        $app.save(planRec)
      }

      // Build the checkout link request body. InfinitePay accepts both
      // `items` and `itens`; we send `items` per the official docs.
      const reqBody = {
        handle: handle,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
        order_nsu: nsu,
        items: [
          {
            quantity: 1,
            price: def.priceCents,
            description: def.name,
          },
        ],
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
          '[infinitepay_create_links] ' +
            def.slug +
            ' request failed: ' +
            (err && err.message ? err.message : String(err)),
        )
        results.push({ slug: def.slug, ok: false, error: String(err) })
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
      console.log(
        '[infinitepay_create_links] ' +
          def.slug +
          ' http=' +
          status +
          ' body=' +
          (res && res.body ? res.body.toString().slice(0, 300) : ''),
      )

      if (!status || status >= 400) {
        results.push({
          slug: def.slug,
          ok: false,
          http: status,
          error: respJson,
        })
        continue
      }

      // The API may return the link under `url`, `link`, or `checkout_url`.
      const link = (respJson.url || respJson.link || respJson.checkout_url || '').toString()
      const slug = (respJson.slug || respJson.invoice_slug || '').toString()
      if (link) {
        planRec.set('infinitepay_link', link)
        $app.save(planRec)
      }
      results.push({ slug: def.slug, ok: true, link: link, invoice_slug: slug, http: status })
    }

    const allOk = results.every((r) => r.ok)
    return e.json(allOk ? 200 : 502, {
      success: allOk,
      handle: handle,
      webhook_url: webhookUrl,
      api_key_configured: apiKey ? true : false,
      results: results,
    })
  },
  $apis.requireAuth(),
)
