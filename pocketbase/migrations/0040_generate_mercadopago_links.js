/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Obter o token de acesso do Mercado Pago
    const accessToken =
      $secrets.get('MERCADO_PAGO_ACCESS_TOKEN') || $os.getenv('MERCADO_PAGO_ACCESS_TOKEN') || ''

    if (!accessToken) {
      console.log(
        '[migration 0040] AVISO: MERCADO_PAGO_ACCESS_TOKEN não configurado no momento da migração.',
      )
      return
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

    for (const def of planDefs) {
      let planRec = null
      try {
        planRec = app.findFirstRecordByData('subscription_plans', 'slug', def.slug)
      } catch (err) {
        console.log('[migration 0040] Plano não encontrado: ' + def.slug)
        continue
      }

      // Validade de 24h a partir de agora
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
          '[migration 0040] Erro HTTP ao gerar link Mercado Pago para ' +
            def.slug +
            ': ' +
            (err && err.message ? err.message : String(err)),
        )
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

      if (status >= 200 && status < 300) {
        const initPoint = (respJson.init_point || respJson.sandbox_init_point || '').toString()
        const prefId = (respJson.id || '').toString()

        if (initPoint && prefId) {
          planRec.set('mercadopago_init_point', initPoint)
          planRec.set('mercadopago_preference_id', prefId)
          planRec.set('mercadopago_external_reference', def.externalReference)
          app.save(planRec)
          console.log(
            '[migration 0040] Sucesso ao atualizar ' +
              def.slug +
              ' com init_point: ' +
              initPoint +
              ' prefId: ' +
              prefId,
          )
        }
      } else {
        console.log(
          '[migration 0040] Falha ao gerar link para ' +
            def.slug +
            ' status=' +
            status +
            ' resp=' +
            JSON.stringify(respJson),
        )
      }
    }
  },
  (app) => {
    // Reverter limpando os campos
    const slugs = ['weekly', 'monthly', 'quarterly']
    for (const slug of slugs) {
      try {
        const rec = app.findFirstRecordByData('subscription_plans', 'slug', slug)
        rec.set('mercadopago_init_point', '')
        rec.set('mercadopago_preference_id', '')
        app.save(rec)
      } catch (_) {}
    }
  },
)
