/// <reference path="../pb_data/types.d.ts" />
// InfinitePay checkout webhook — receives "payment approved" notifications and
// activates the patient's subscription on the Nutri Responde platform.
//
// Route: POST /backend/v1/webhook/infinitepay  (public — no auth)
//
// InfinitePay sends a JSON body shaped like:
//   {
//     "invoice_slug": "abc123",
//     "amount": 2990,
//     "paid_amount": 2990,
//     "installments": 1,
//     "capture_method": "credit_card" | "pix",
//     "transaction_nsu": "UUID",
//     "order_nsu": "nutri-weekly",          // what we sent when creating the link
//     "receipt_url": "https://...",
//     "items": [{ "quantity": 1, "price": 2990, "description": "..." }]
//   }
//
// We map the payment to a plan via the `order_nsu` (or the item price as a
// fallback), then create/update the patient record and send the WhatsApp
// invite — reusing the same Evolution sendText call as patient_invite.js.

routerAdd('POST', '/backend/v1/webhook/infinitepay', (e) => {
  const raw = e.requestInfo().body
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}

  const orderNsu = (body.order_nsu || '').toString()
  const transactionNsu = (body.transaction_nsu || '').toString()
  const invoiceSlug = (body.invoice_slug || body.slug || '').toString()
  const captureMethod = (body.capture_method || '').toString()
  const items = Array.isArray(body.items) ? body.items : []
  const firstItem = items.length > 0 ? items[0] : {}
  const itemPrice = firstItem.price
  const itemDesc = (firstItem.description || '').toString()
  // InfinitePay may include the buyer's phone/name in the webhook payload.
  const customer = body.customer || {}
  const customerName = (customer.name || body.customer_name || body.name || '').toString()
  const customerPhoneRaw = (
    customer.phone_number ||
    body.customer_phone ||
    body.phone ||
    body.phone_number ||
    ''
  ).toString()
  const customerEmail = (customer.email || body.customer_email || body.email || '').toString()

  console.log(
    '[infinitepay_webhook] received order_nsu="' +
      orderNsu +
      '" transaction_nsu="' +
      transactionNsu +
      '" invoice_slug="' +
      invoiceSlug +
      '" capture_method="' +
      captureMethod +
      '" amount=' +
      body.amount +
      ' paid_amount=' +
      body.paid_amount +
      ' customerName="' +
      customerName +
      '" customerPhone="' +
      customerPhoneRaw +
      '"',
  )

  // ── Validate the request ──
  // InfinitePay's checkout webhook is not signed, so we trust requests that
  // carry our handle as a query param (?handle=caio_candido_mac) OR that map
  // to one of our known order_nsu values / plan prices. Anything else is
  // rejected with 400 so InfinitePay can retry.
  const expectedHandle =
    $os.getenv('INFINITEPAY_HANDLE') || $secrets.get('INFINITEPAY_HANDLE') || 'caio_candido_mac'
  const queryHandle = (e.requestInfo().query && e.requestInfo().query.handle) || ''
  const handleOk = !queryHandle || queryHandle === expectedHandle

  // Resolve which subscription plan this payment is for.
  // 1) order_nsu → plan slug  (preferred, deterministic)
  // 2) item price (cents) → plan slug
  // 3) item description contains plan name
  let planSlug = ''
  if (orderNsu.indexOf('weekly') >= 0 || orderNsu === 'nutri-weekly') planSlug = 'weekly'
  else if (orderNsu.indexOf('monthly') >= 0 || orderNsu === 'nutri-monthly') planSlug = 'monthly'
  else if (orderNsu.indexOf('quarterly') >= 0 || orderNsu === 'nutri-quarterly')
    planSlug = 'quarterly'

  if (!planSlug) {
    const priceCents = typeof itemPrice === 'number' ? itemPrice : parseInt(itemPrice, 10) || 0
    if (priceCents === 2990) planSlug = 'weekly'
    else if (priceCents === 7990) planSlug = 'monthly'
    else if (priceCents === 19990) planSlug = 'quarterly'
  }
  if (!planSlug) {
    const d = itemDesc.toLowerCase()
    if (d.indexOf('semanal') >= 0) planSlug = 'weekly'
    else if (d.indexOf('trimestral') >= 0) planSlug = 'quarterly'
    else if (d.indexOf('mensal') >= 0) planSlug = 'monthly'
  }

  if (!handleOk || !planSlug) {
    console.log(
      '[infinitepay_webhook] rejected: handleOk=' +
        handleOk +
        ' planSlug="' +
        planSlug +
        '" order_nsu="' +
        orderNsu +
        '"',
    )
    return e.json(400, { success: false, message: 'Pedido não encontrado' })
  }

  // ── Resolve the plan record + owner (the Dr. Caio seed user) ──
  let planRec = null
  try {
    planRec = $app.findFirstRecordByData('subscription_plans', 'slug', planSlug)
  } catch (err) {
    console.log('[infinitepay_webhook] plan not found: ' + planSlug)
    return e.json(400, { success: false, message: 'Plano não encontrado' })
  }

  // The owner is the Dr. Caio seed user. Prefer the integration's owner; fall
  // back to the seed admin email.
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
    } catch (err) {
      console.log(
        '[infinitepay_webhook] could not resolve owner: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }
  if (!ownerId) {
    console.log('[infinitepay_webhook] no owner resolved — cannot create patient')
    return e.json(400, { success: false, message: 'Owner não configurado' })
  }

  // ── Normalize the phone number (BR) ──
  let phone = customerPhoneRaw.replace(/\D/g, '')
  if (phone.length > 0 && phone.indexOf('55') !== 0 && phone.length <= 11) phone = '55' + phone

  // ── Find or create the patient by transaction_nsu (idempotency) or phone ──
  let patient = null
  let createdNow = false

  // 1) Idempotency: same transaction_nsu → already processed.
  if (transactionNsu) {
    try {
      patient = $app.findFirstRecordByData(
        'patients',
        'infinitepay_transaction_nsu',
        transactionNsu,
      )
      if (patient) {
        console.log(
          '[infinitepay_webhook] duplicate transaction_nsu=' +
            transactionNsu +
            ' for patient ' +
            patient.id +
            ' — skipping (idempotent)',
        )
        return e.json(200, {
          success: true,
          message: null,
          patient_id: patient.id,
          duplicate: true,
        })
      }
    } catch (_) {}
  }

  // 2) Match by phone (same owner).
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

  const durationDays = (planRec.get('duration_days') || 7) | 0
  const messageLimit = (planRec.get('message_limit') || 0) | 0
  const limitType = planRec.getString('limit_type') || 'total'
  const now = new Date()
  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
  const startIso = now.toISOString()
  const endIso = end.toISOString()

  if (!patient) {
    if (!phone) {
      console.log('[infinitepay_webhook] no phone in payload — cannot create patient')
      return e.json(400, { success: false, message: 'Telefone do comprador ausente' })
    }
    const patCol = $app.findCollectionByNameOrId('patients')
    patient = new Record(patCol)
    patient.set('owner', ownerId)
    patient.set('name', customerName || phone)
    patient.set('phone', phone)
    if (customerEmail) patient.set('email', customerEmail)
    patient.set('registration_date', startIso.slice(0, 10))
    patient.set('invited_by', ownerId)
    createdNow = true
    console.log('[infinitepay_webhook] creating new patient phone=' + phone + ' plan=' + planSlug)
  } else {
    console.log(
      '[infinitepay_webhook] updating existing patient ' + patient.id + ' plan=' + planSlug,
    )
  }

  patient.set('subscription_plan', planSlug)
  patient.set('subscription_start', startIso)
  patient.set('subscription_end', endIso)
  patient.set('message_count_used', 0)
  patient.set('message_count_limit', messageLimit)
  patient.set('status', 'active')
  if (limitType === 'daily') patient.set('message_reset_date', startIso)
  if (transactionNsu) patient.set('infinitepay_transaction_nsu', transactionNsu)
  if (customerName && !patient.getString('name')) patient.set('name', customerName)
  if (customerEmail && !patient.getString('email')) patient.set('email', customerEmail)
  $app.save(patient)
  console.log(
    '[infinitepay_webhook] patient saved id=' +
      patient.id +
      ' plan=' +
      planSlug +
      ' end=' +
      endIso +
      ' created=' +
      createdNow,
  )

  // ── Send WhatsApp invite via Evolution API (same logic as patient_invite.js) ──
  let integ = null
  try {
    integ = $app.findFirstRecordByFilter('integrations', 'owner = {:uid} && status = {:s}', {
      uid: ownerId,
      s: 'CONNECTED',
    })
  } catch (_) {}
  if (!integ) {
    console.log('[infinitepay_webhook] no connected integration for owner=' + ownerId)
  } else {
    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
    if (!evoUrl || !evoKey || !instanceName) {
      console.log('[infinitepay_webhook] missing Evolution config — skipping invite')
    } else {
      const appUrl = (
        $secrets.get('SITE_URL') ||
        $secrets.get('APP_PUBLIC_URL') ||
        $secrets.get('FRONTEND_URL') ||
        ''
      ).replace(/\/$/, '')
      const inviteLink = appUrl ? appUrl + '/?invite=' + patient.id : 'https://nutriresponde.app'
      const planName = planRec.getString('name') || planSlug
      const text =
        'Olá ' +
        (patient.getString('name') || '') +
        '! 🎉\n\n' +
        'Recebemos seu pagamento do plano ' +
        planName +
        ' no Nutri Responde. Sua assinatura está ativa!\n\n' +
        'Para começar a conversar com a Yasa, sua assistente nutricional, clique aqui:\n' +
        inviteLink +
        '\n\nBem-vindo(a)! 🥗'
      try {
        $http.send({
          url: evoUrl + '/message/sendText/' + instanceName,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: phone, text: text }),
          timeout: 30,
        })
        console.log('[infinitepay_webhook] invite sent to ' + phone + ' for patient ' + patient.id)
      } catch (err) {
        console.log(
          '[infinitepay_webhook] invite send failed: ' +
            (err && err.message ? err.message : String(err)),
        )
      }
    }
  }

  return e.json(200, { success: true, message: null, patient_id: patient.id, plan: planSlug })
})
