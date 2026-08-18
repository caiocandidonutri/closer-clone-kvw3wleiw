/// <reference path="../pb_data/types.d.ts" />
// (Re)creates the InfinitePay checkout links for the 3 paid plans with the
// platform's webhook_url so payments are notified automatically.
//
// Route: POST /backend/v1/infinitepay/create-links  (auth required)
//
// Calls the InfinitePay Checkout API:
//   POST https://api.checkout.infinitepay.io/links
//   Authorization: Bearer {INFINITEPAY_API_KEY}   (optional — the public docs
//   do NOT require auth for link creation; only added when the secret is set)
//
// The link + slug are stored back on each subscription_plan record
// (infinitepay_link / infinitepay_order_nsu). The webhook matches incoming
// payments by order_nsu.
//
// Config (all optional — sensible defaults are used):
//   INFINITEPAY_HANDLE        e.g. caio_candido_mac
//   INFINITEPAY_WEBHOOK_URL   full public webhook URL (overrides auto-built one)
//   INFINITEPAY_REDIRECT_URL  post-checkout redirect URL (overrides auto-built one)
//   INFINITEPAY_API_KEY       Bearer token, only sent when present

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

    // Allow explicit overrides (the user configured these in the InfinitePay
    // dashboard, so we send exactly the same values to the API).
    const explicitWebhook =
      $os.getenv('INFINITEPAY_WEBHOOK_URL') || $secrets.get('INFINITEPAY_WEBHOOK_URL') || ''
    const explicitRedirect =
      $os.getenv('INFINITEPAY_REDIRECT_URL') || $secrets.get('INFINITEPAY_REDIRECT_URL') || ''

    // Prefer the explicit override, then the backend instance URL, then SITE_URL.
    const webhookUrl =
      explicitWebhook ||
      (instanceUrl || siteUrl) + '/backend/v1/webhook/infinitepay?handle=' + handle
    const redirectUrl =
      explicitRedirect || (siteUrl || 'https://nutriresponde.goskip.app') + '/?paid=1'

    console.log(
      '[infinitepay_create_links] handle=' +
        handle +
        ' webhookUrl=' +
        webhookUrl +
        ' redirectUrl=' +
        redirectUrl +
        ' apiKeyPresent=' +
        (apiKey ? true : false),
    )

    // ── Plan definitions (slug → { name, price_cents, order_nsu }) ──
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
        // Build a human-friendly error so the user knows what to fix.
        let friendly = 'InfinitePay retornou HTTP ' + status
        if (status === 401 || status === 403) {
          friendly =
            'InfinitePay exige autenticação (HTTP ' +
            status +
            '). Defina o secret INFINITEPAY_API_KEY com o token da InfinitePay e tente novamente.'
        } else if (status === 422) {
          friendly =
            'InfinitePay rejeitou os dados do link (HTTP 422). Verifique o handle "' +
            handle +
            '" e os preços enviados.'
        }
        results.push({
          slug: def.slug,
          ok: false,
          http: status,
          error: respJson,
          friendly_error: friendly,
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

    // If every plan failed with an auth error, surface one consolidated,
    // actionable message at the top level (the per-plan results still carry
    // the raw HTTP detail).
    let topMessage = null
    const authFailures = results.filter((r) => !r.ok && (r.http === 401 || r.http === 403))
    if (authFailures.length > 0) {
      topMessage =
        'A InfinitePay recusou a criação dos links por falta de autenticação. ' +
        'Defina o secret INFINITEPAY_API_KEY (token da InfinitePay) e execute novamente.'
    } else if (!allOk) {
      topMessage =
        'Alguns links não puderam ser criados. Veja os detalhes em results[].friendly_error.'
    }

    return e.json(allOk ? 200 : 502, {
      success: allOk,
      handle: handle,
      webhook_url: webhookUrl,
      redirect_url: redirectUrl,
      api_key_configured: apiKey ? true : false,
      message: topMessage,
      results: results,
    })
  },
  $apis.requireAuth(),
)
