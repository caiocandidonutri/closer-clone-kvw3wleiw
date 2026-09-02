/// <reference path="../pb_data/types.d.ts" />
// Cria/Atualiza as preferências de pagamento Checkout Pro do Mercado Pago para os 3 planos pagos
// Links com validade de 24h, sem cobrança recorrente.
//
// Rota: POST /backend/v1/mercadopago/create-links (auth required)

routerAdd(
  'POST',
  '/backend/v1/mercadopago/create-links',
  (e) => {
    const accessToken =
      $secrets.get('MERCADO_PAGO_ACCESS_TOKEN') || $os.getenv('MERCADO_PAGO_ACCESS_TOKEN') || ''

    if (!accessToken) {
      console.log('[mercadopago_create_links] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado')
      return e.json(400, {
        success: false,
        message:
          'Token de acesso do Mercado Pago não configurado. Adicione o secret MERCADO_PAGO_ACCESS_TOKEN no painel.',
      })
    }

    const instanceUrl = (
      $os.getenv('PB_INSTANCE_URL') ||
      $secrets.get('PB_INSTANCE_URL') ||
      ''
    ).replace(/\/$/, '')

    const siteUrl = (
      $secrets.get('SITE_URL') ||
      $secrets.get('APP_PUBLIC_URL') ||
      $secrets.get('FRONTEND_URL') ||
      'https://nutriresponde.goskip.app'
    ).replace(/\/$/, '')

    const notificationUrl = instanceUrl
      ? instanceUrl + '/backend/v1/webhook/mercadopago'
      : 'https://warm-market-crm-clone-7c1f6.shrd00.internal.goskip.dev/backend/v1/webhook/mercadopago'

    const planDefs = [
      {
        slug: 'weekly',
        name: 'Nutri Responde - Plano Semanal',
        description: 'Acompanhamento nutricional com receitas e suporte Yasa AI por 7 dias',
        price: 29.9,
        externalReference: 'nutri-weekly',
      },
      {
        slug: 'monthly',
        name: 'Nutri Responde - Plano Mensal',
        description:
          'Acompanhamento completo, marmitas, receitas e geladeira inteligente por 30 dias',
        price: 79.9,
        externalReference: 'nutri-monthly',
      },
      {
        slug: 'quarterly',
        name: 'Nutri Responde - Plano Trimestral',
        description: 'Acompanhamento premium contínuo e prioritário por 90 dias',
        price: 199.9,
        externalReference: 'nutri-quarterly',
      },
    ]

    const results = []

    for (const def of planDefs) {
      let planRec = null
      try {
        planRec = $app.findFirstRecordByData('subscription_plans', 'slug', def.slug)
      } catch (err) {
        console.log('[mercadopago_create_links] plano não encontrado: ' + def.slug)
        results.push({ slug: def.slug, ok: false, error: 'Plano não encontrado no banco de dados' })
        continue
      }

      // Configuração de expiração de 24h a partir do momento de criação
      const now = new Date()
      const expirationDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const expirationDateFromIso = now.toISOString()
      const expirationDateToIso = expirationDate.toISOString()

      const preferencePayload = {
        items: [
          {
            id: def.slug,
            title: def.name,
            description: def.description,
            quantity: 1,
            unit_price: def.price,
            currency_id: 'BRL',
          },
        ],
        external_reference: def.externalReference,
        back_urls: {
          success: siteUrl + '/#planos',
          pending: siteUrl + '/#planos',
          failure: siteUrl + '/#planos',
        },
        auto_return: 'approved',
        notification_url: notificationUrl,
        expires: true,
        expiration_date_from: expirationDateFromIso,
        expiration_date_to: expirationDateToIso,
        statement_descriptor: 'NUTRIRESPONDE',
        payment_methods: {
          installments: 12,
        },
      }

      let res = null
      try {
        res = $http.send({
          url: 'https://api.mercadopago.com/checkout/preferences',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + accessToken,
          },
          body: JSON.stringify(preferencePayload),
          timeout: 25,
        })
      } catch (err) {
        console.log(
          '[mercadopago_create_links] Falha na chamada da API para ' +
            def.slug +
            ': ' +
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

      if (!status || status >= 400) {
        console.log(
          '[mercadopago_create_links] Erro Mercado Pago para ' +
            def.slug +
            ' status=' +
            status +
            ' body=' +
            JSON.stringify(respJson),
        )
        results.push({
          slug: def.slug,
          ok: false,
          http: status,
          error: respJson.message || respJson.error || 'Erro ao gerar preferência no Mercado Pago',
        })
        continue
      }

      const initPoint = (respJson.init_point || respJson.sandbox_init_point || '').toString()
      const prefId = (respJson.id || '').toString()

      if (initPoint && prefId) {
        planRec.set('mercadopago_init_point', initPoint)
        planRec.set('mercadopago_preference_id', prefId)
        planRec.set('mercadopago_external_reference', def.externalReference)
        $app.save(planRec)
        console.log('[mercadopago_create_links] Sucesso para ' + def.slug + ' -> ' + initPoint)
      }

      results.push({
        slug: def.slug,
        ok: true,
        init_point: initPoint,
        preference_id: prefId,
        http: status,
      })
    }

    const allOk = results.every((r) => r.ok)

    return e.json(allOk ? 200 : 502, {
      success: allOk,
      notification_url: notificationUrl,
      results: results,
      message: allOk
        ? 'Links do Mercado Pago gerados com sucesso.'
        : 'Alguns links não puderam ser gerados.',
    })
  },
  $apis.requireAuth(),
)
