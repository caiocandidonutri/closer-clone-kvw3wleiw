/// <reference path="../pb_data/types.d.ts" />
// Webhook do Mercado Pago para confirmação de pagamentos
// Valida a assinatura HMAC-SHA256 (MERCADO_PAGO_WEBHOOK_SECRET)
// Identifica paciente/plano, ativa o plano e envia WhatsApp de boas-vindas/confirmação
//
// Rota: POST /backend/v1/webhook/mercadopago (public)

routerAdd('POST', '/backend/v1/webhook/mercadopago', (e) => {
  const reqInfo = e.requestInfo()
  const headers = reqInfo.headers || {}
  const query = reqInfo.query || {}

  const xSignature =
    headers['x-signature'] || headers['X-Signature'] || headers['x-hub-signature-256'] || ''
  const xRequestId = headers['x-request-id'] || headers['X-Request-Id'] || ''

  const webhookSecret =
    $secrets.get('MERCADO_PAGO_WEBHOOK_SECRET') || $os.getenv('MERCADO_PAGO_WEBHOOK_SECRET') || ''

  // Validação de segurança: se o secret não estiver configurado, rejeitar em modo seguro
  if (!webhookSecret) {
    console.log(
      '[mercadopago_webhook] MERCADO_PAGO_WEBHOOK_SECRET não configurado. Rejeitando requisição por segurança.',
    )
    return e.json(401, {
      success: false,
      message: 'MERCADO_PAGO_WEBHOOK_SECRET não configurado no servidor.',
    })
  }

  // Validação de assinatura HMAC-SHA256 do Mercado Pago
  // Formato do x-signature do Mercado Pago: "ts=1700000000,v1=hash_hexadecimal"
  let isValidSignature = false

  if (xSignature) {
    let ts = ''
    let v1 = ''

    const parts = xSignature.split(',')
    for (const part of parts) {
      const kv = part.trim().split('=')
      if (kv.length === 2) {
        if (kv[0] === 'ts') ts = kv[1]
        if (kv[0] === 'v1') v1 = kv[1]
      }
    }

    // Mercado Pago template:
    // id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
    // Se o webhook vier pelo query param (ex: id=123 ou data.id=123)
    const rawBody =
      typeof reqInfo.body === 'string' ? reqInfo.body : JSON.stringify(reqInfo.body || {})
    let parsedBody = {}
    try {
      parsedBody = typeof reqInfo.body === 'string' ? JSON.parse(reqInfo.body) : reqInfo.body || {}
    } catch (_) {}

    const dataId =
      (parsedBody && parsedBody.data && parsedBody.data.id) ||
      (parsedBody && parsedBody.id) ||
      query['data.id'] ||
      query.id ||
      ''

    // Constrói manifest para validação
    let manifest = 'id:' + dataId + ';request-id:' + xRequestId + ';ts:' + ts + ';'

    if (v1 && ts) {
      const calculatedHash = $security.hs256(manifest, webhookSecret)
      if (calculatedHash && calculatedHash.toLowerCase() === v1.toLowerCase()) {
        isValidSignature = true
      } else {
        // Tentar também hash do rawBody como fallback se manifest diferir
        const rawBodyHash = $security.hs256(ts + '.' + rawBody, webhookSecret)
        if (rawBodyHash && rawBodyHash.toLowerCase() === v1.toLowerCase()) {
          isValidSignature = true
        }
      }
    }
  }

  // Se a assinatura for inválida, rejeitar
  if (!isValidSignature) {
    console.log(
      '[mercadopago_webhook] Assinatura HMAC inválida. x-signature="' +
        xSignature +
        '" x-request-id="' +
        xRequestId +
        '"',
    )
    return e.json(401, {
      success: false,
      message: 'Assinatura inválida',
    })
  }

  // Parse do evento
  let body = {}
  try {
    body = typeof reqInfo.body === 'string' ? JSON.parse(reqInfo.body) : reqInfo.body || {}
  } catch (_) {
    body = {}
  }

  const topic = (body.type || body.topic || query.topic || query.type || '').toString()
  const paymentId =
    (body.data && body.data.id ? body.data.id.toString() : '') ||
    (body.id ? body.id.toString() : '') ||
    (query['data.id'] || query.id || '').toString()

  console.log(
    '[mercadopago_webhook] Evento verificado com sucesso. topic="' +
      topic +
      '" paymentId="' +
      paymentId +
      '" action="' +
      (body.action || '') +
      '"',
  )

  // Se não for evento de pagamento ou não tiver paymentId, retorna 200 para confirmar recebimento
  if (
    !paymentId ||
    (topic &&
      topic !== 'payment' &&
      topic !== 'merchant_order' &&
      body.action !== 'payment.created' &&
      body.action !== 'payment.updated')
  ) {
    return e.json(200, { success: true, message: 'Evento recebido, sem ação necessária' })
  }

  const accessToken =
    $secrets.get('MERCADO_PAGO_ACCESS_TOKEN') || $os.getenv('MERCADO_PAGO_ACCESS_TOKEN') || ''

  if (!accessToken) {
    console.log('[mercadopago_webhook] MERCADO_PAGO_ACCESS_TOKEN não configurado')
    return e.json(500, { success: false, message: 'Configuração de pagamento ausente' })
  }

  // Buscar detalhes do pagamento na API do Mercado Pago
  let paymentData = null
  try {
    const paymentRes = $http.send({
      url: 'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId),
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
      timeout: 25,
    })

    if (paymentRes && paymentRes.statusCode === 200) {
      paymentData = paymentRes.json || {}
    } else {
      console.log(
        '[mercadopago_webhook] Falha ao consultar pagamento ' +
          paymentId +
          ' status=' +
          (paymentRes ? paymentRes.statusCode : 'null'),
      )
    }
  } catch (fetchErr) {
    console.log(
      '[mercadopago_webhook] Erro ao consultar pagamento no Mercado Pago: ' +
        (fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr)),
    )
  }

  if (!paymentData || !paymentData.id) {
    return e.json(200, { success: true, message: 'Pagamento não encontrado na API' })
  }

  const paymentStatus = (paymentData.status || '').toString()
  console.log(
    '[mercadopago_webhook] Detalhes do pagamento ' +
      paymentId +
      ': status="' +
      paymentStatus +
      '" external_reference="' +
      paymentData.external_reference +
      '" transaction_amount=' +
      paymentData.transaction_amount,
  )

  // Processamos somente pagamentos aprovados
  if (paymentStatus !== 'approved') {
    return e.json(200, {
      success: true,
      message: 'Pagamento recebido com status: ' + paymentStatus,
    })
  }

  // 1) Identificar o plano através do external_reference ou valor ou descrição
  const externalRef = (paymentData.external_reference || '').toString()
  const amount = Number(paymentData.transaction_amount) || 0
  const description = (paymentData.description || '').toLowerCase()

  let planSlug = ''
  if (externalRef.indexOf('weekly') >= 0 || externalRef === 'nutri-weekly') {
    planSlug = 'weekly'
  } else if (externalRef.indexOf('monthly') >= 0 || externalRef === 'nutri-monthly') {
    planSlug = 'monthly'
  } else if (externalRef.indexOf('quarterly') >= 0 || externalRef === 'nutri-quarterly') {
    planSlug = 'quarterly'
  }

  if (!planSlug) {
    if (Math.abs(amount - 29.9) < 0.5) planSlug = 'weekly'
    else if (Math.abs(amount - 79.9) < 0.5) planSlug = 'monthly'
    else if (Math.abs(amount - 199.9) < 0.5) planSlug = 'quarterly'
  }

  if (!planSlug) {
    if (description.indexOf('semanal') >= 0) planSlug = 'weekly'
    else if (description.indexOf('trimestral') >= 0) planSlug = 'quarterly'
    else if (description.indexOf('mensal') >= 0) planSlug = 'monthly'
  }

  if (!planSlug) {
    console.log(
      '[mercadopago_webhook] Plano não identificado para o pagamento ' +
        paymentId +
        ' ref=' +
        externalRef +
        ' amount=' +
        amount,
    )
    return e.json(200, {
      success: true,
      message: 'Plano não identificado para o pagamento aprovado',
    })
  }

  // Buscar definição do plano
  let planRec = null
  try {
    planRec = $app.findFirstRecordByData('subscription_plans', 'slug', planSlug)
  } catch (err) {
    console.log('[mercadopago_webhook] Plano não encontrado no banco: ' + planSlug)
    return e.json(200, { success: true, message: 'Plano não cadastrado no banco' })
  }

  // 2) Resolver owner (Dr. Caio)
  let ownerId = ''
  try {
    const integ = $app.findFirstRecordByFilter(
      'integrations',
      "status = 'CONNECTED'",
      '-created',
      1,
      0,
    )
    if (integ) ownerId = integ.getString('owner')
  } catch (_) {}

  if (!ownerId) {
    try {
      const adminEmail =
        $os.getenv('NUTRI_OWNER_EMAIL') ||
        $secrets.get('NUTRI_OWNER_EMAIL') ||
        'caiocandidonutri@hotmail.com'
      const admin = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
      if (admin) ownerId = admin.id
    } catch (_) {}
  }

  if (!ownerId) {
    console.log('[mercadopago_webhook] Owner não encontrado para vincular paciente')
    return e.json(500, { success: false, message: 'Owner não configurado' })
  }

  // 3) Extrair dados do pagador
  const payer = paymentData.payer || {}
  const payerPhoneObj = payer.phone || {}
  let customerPhoneRaw = (
    payerPhoneObj.number || payerPhoneObj.area_code
      ? (payerPhoneObj.area_code || '') + (payerPhoneObj.number || '')
      : ''
  ).toString()

  const customerName =
    ((payer.first_name || '') + ' ' + (payer.last_name || '')).trim() || payer.nickname || ''
  const customerEmail = (payer.email || '').toString()

  // Normalização do telefone (BR)
  let phone = customerPhoneRaw.replace(/\D/g, '')
  if (phone.length > 0 && phone.indexOf('55') !== 0 && phone.length <= 11) {
    phone = '55' + phone
  }

  // 4) Idempotência por mercadopago_payment_id
  let patient = null
  const paymentIdStr = paymentId.toString()

  try {
    patient = $app.findFirstRecordByData('patients', 'mercadopago_payment_id', paymentIdStr)
    if (patient) {
      console.log(
        '[mercadopago_webhook] Pagamento ' +
          paymentIdStr +
          ' já processado para o paciente ' +
          patient.id +
          ' — idempotente',
      )
      return e.json(200, {
        success: true,
        message: 'Pagamento já processado anteriormente',
        patient_id: patient.id,
      })
    }
  } catch (_) {}

  // Buscar paciente por email ou telefone se já existir
  if (!patient && phone) {
    try {
      patient = $app.findFirstRecordByFilter(
        'patients',
        'owner = {:uid} && phone = {:ph}',
        '-created',
        1,
        0,
        { uid: ownerId, ph: phone },
      )
    } catch (_) {}
  }

  if (!patient && customerEmail) {
    try {
      patient = $app.findFirstRecordByFilter(
        'patients',
        'owner = {:uid} && email = {:em}',
        '-created',
        1,
        0,
        { uid: ownerId, em: customerEmail },
      )
    } catch (_) {}
  }

  const durationDays = (planRec.get('duration_days') || 30) | 0
  const messageLimit = (planRec.get('message_limit') || 25) | 0
  const limitType = planRec.getString('limit_type') || 'daily'
  const now = new Date()
  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
  const startIso = now.toISOString()
  const endIso = end.toISOString()

  let createdNew = false
  if (!patient) {
    const patCol = $app.findCollectionByNameOrId('patients')
    patient = new Record(patCol)
    patient.set('owner', ownerId)
    patient.set('name', customerName || (phone ? 'Paciente WhatsApp ' + phone : 'Novo Assinante'))
    patient.set('phone', phone || '5500000000000')
    if (customerEmail) patient.set('email', customerEmail)
    patient.set('registration_date', startIso.slice(0, 10))
    patient.set('invited_by', ownerId)
    createdNew = true
  }

  // Ativar plano correspondente
  patient.set('subscription_plan', planSlug)
  patient.set('subscription_start', startIso)
  patient.set('subscription_end', endIso)
  patient.set('message_count_used', 0)
  patient.set('message_count_limit', messageLimit)
  patient.set('status', 'active')
  if (limitType === 'daily') {
    patient.set('message_reset_date', startIso)
  }
  patient.set('mercadopago_payment_id', paymentIdStr)
  if (
    customerName &&
    (!patient.getString('name') || patient.getString('name').startsWith('Paciente WhatsApp'))
  ) {
    patient.set('name', customerName)
  }
  if (customerEmail && !patient.getString('email')) {
    patient.set('email', customerEmail)
  }

  $app.save(patient)

  console.log(
    '[mercadopago_webhook] Paciente ' +
      patient.id +
      ' ativado com sucesso! Plano=' +
      planSlug +
      ' vencimento=' +
      endIso +
      ' criadoNovo=' +
      createdNew,
  )

  // 5) Enviar mensagem de confirmação no WhatsApp para o paciente
  const finalPhone = (patient.getString('phone') || '').replace(/\D/g, '')
  if (finalPhone && finalPhone.length >= 10 && finalPhone !== '5500000000000') {
    let integ = null
    try {
      integ = $app.findFirstRecordByFilter('integrations', 'owner = {:uid} && status = {:s}', {
        uid: ownerId,
        s: 'CONNECTED',
      })
    } catch (_) {}

    if (integ) {
      const instanceName = integ.getString('instance_name')
      let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
      if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
      const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''

      if (evoUrl && evoKey && instanceName) {
        const patientName = patient.getString('name') || ''
        const planName = planRec.getString('name') || planSlug
        const welcomeText =
          'Olá ' +
          patientName +
          '! 🎉 Seu pagamento do ' +
          planName +
          ' foi confirmado com sucesso pelo Mercado Pago! ' +
          'O Dr. Caio Cândido e sua assistente inteligente Yasa já liberaram o seu acesso completo. ' +
          'Como posso te ajudar hoje com a sua alimentação? 💚'

        try {
          $http.send({
            url: evoUrl + '/message/sendText/' + instanceName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({ number: finalPhone, text: welcomeText }),
            timeout: 30,
          })
          console.log('[mercadopago_webhook] WhatsApp de confirmação enviado para ' + finalPhone)
        } catch (msgErr) {
          console.log(
            '[mercadopago_webhook] Falha no envio do WhatsApp: ' +
              (msgErr && msgErr.message ? msgErr.message : String(msgErr)),
          )
        }
      }
    }
  }

  return e.json(200, {
    success: true,
    message: 'Pagamento processado e plano ativado com sucesso',
    patient_id: patient.id,
    plan: planSlug,
  })
})
