/// <reference path="../pb_data/types.d.ts" />
// Endpoint: POST /backend/v1/patients/send-payment-link
// Sends the Mercado Pago checkout link directly to the patient's WhatsApp in 1 click.
// Body: { patient_id: string, plan_slug?: string }

routerAdd(
  'POST',
  '/backend/v1/patients/send-payment-link',
  (e) => {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const userId = authRecord.id
    const raw = e.requestInfo().body
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
    const patientId = (body.patient_id || body.patientId || '').toString().trim()
    let planSlug = (body.plan_slug || body.planSlug || '').toString().trim()

    if (!patientId) {
      return e.badRequestError('patient_id é obrigatório')
    }

    let patient = null
    try {
      patient = $app.findRecordById('patients', patientId)
    } catch (_) {
      return e.notFoundError('Paciente não encontrado')
    }

    if (!planSlug) {
      planSlug = patient.getString('subscription_plan') || 'monthly'
      if (planSlug === 'free_trial' || planSlug === 'free') {
        planSlug = 'monthly' // default upgrade to monthly
      }
    }

    // Resolve plan record to get the checkout link
    let planRec = null
    try {
      planRec = $app.findFirstRecordByData('subscription_plans', 'slug', planSlug)
    } catch (_) {}

    const planName = planRec ? planRec.getString('name') : 'Nutri Responde'
    let paymentLink = planRec ? planRec.getString('mercadopago_init_point') : ''
    const priceBrl = planRec ? planRec.get('price_brl') : null
    const priceFormatted = priceBrl ? 'R$ ' + Number(priceBrl).toFixed(2).replace('.', ',') : ''

    const siteUrl = (
      $secrets.get('SITE_URL') ||
      $secrets.get('APP_PUBLIC_URL') ||
      'https://nutriresponde.goskip.app'
    ).replace(/\/$/, '')

    if (!paymentLink) {
      paymentLink = `${siteUrl}/#planos`
    }

    const patientName = patient.getString('name') || 'Paciente'
    const patientPhone = (patient.getString('phone') || '').replace(/\D/g, '')

    // Resolve contact
    let contact = null
    try {
      contact = $app.findFirstRecordByFilter('contacts', 'patient_id = {:pid}', { pid: patientId })
    } catch (_) {}

    if (!contact) {
      const cRel = patient.getString('contact')
      if (cRel) {
        try {
          contact = $app.findRecordById('contacts', cRel)
        } catch (_) {}
      }
    }

    let whatsappNumber = ''
    if (contact) {
      whatsappNumber = contact.getString('whatsapp_id') || contact.getString('phone_number') || ''
      if (!whatsappNumber) {
        const rJid = contact.getString('remote_jid') || ''
        whatsappNumber = rJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/\D/g, '')
      }
    }
    if (!whatsappNumber && patientPhone) {
      whatsappNumber = patientPhone
      if (whatsappNumber.indexOf('55') !== 0 && whatsappNumber.length <= 11) {
        whatsappNumber = '55' + whatsappNumber
      }
    }

    if (!whatsappNumber) {
      return e.badRequestError('WhatsApp do paciente não encontrado')
    }

    // Resolve connected WhatsApp integration
    let integ = null
    try {
      integ = $app.findFirstRecordByFilter(
        'integrations',
        "owner = {:uid} && status = 'CONNECTED'",
        {
          uid: userId,
        },
      )
    } catch (_) {}

    if (!integ) {
      try {
        integ = $app.findFirstRecordByFilter(
          'integrations',
          "status = 'CONNECTED'",
          '-created',
          1,
          0,
        )
      } catch (_) {}
    }

    if (!integ) {
      return e.badRequestError('Nenhuma conexão com WhatsApp ativa')
    }

    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || $os.getenv('EVOLUTION_API_URL') || ''
    if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || $os.getenv('EVOLUTION_API_KEY') || ''

    if (!evoUrl || !evoKey) {
      return e.json(500, { error: 'Evolution API não configurada' })
    }

    const messageText =
      `Olá, ${patientName}! 💚\n\n` +
      `Aqui está o seu link seguro do Mercado Pago para ativar/renovar o *${planName}*${priceFormatted ? ` (${priceFormatted})` : ''}:\n\n` +
      `👉 ${paymentLink}\n\n` +
      `Assim que o pagamento for confirmado, seu plano e limite de mensagens serão atualizados imediatamente pela Yasa. Se tiver alguma dúvida, é só responder por aqui! ✨🥗`

    try {
      const sendRes = $http.send({
        url: evoUrl + '/message/sendText/' + instanceName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: whatsappNumber, text: messageText }),
        timeout: 30,
      })

      if (!sendRes || sendRes.statusCode < 200 || sendRes.statusCode >= 300) {
        return e.json(502, { error: 'Falha ao enviar link pelo WhatsApp' })
      }
    } catch (sendErr) {
      return e.json(502, {
        error: 'Erro de conexão no envio do link: ' + (sendErr.message || String(sendErr)),
      })
    }

    // Save in messages collection
    if (contact) {
      try {
        const msgCol = $app.findCollectionByNameOrId('messages')
        const msg = new Record(msgCol)
        msg.set('contact', contact.id)
        msg.set('content', messageText)
        msg.set('role', 'assistant')
        msg.set('timestamp', new Date().toISOString())
        $app.save(msg)

        contact.set('last_message', messageText)
        contact.set('status', 'responded')
        contact.set('last_message_from_me', true)
        contact.set('last_message_at', new Date().toISOString())
        $app.save(contact)
      } catch (_) {}
    }

    return e.json(200, {
      success: true,
      whatsapp_sent: true,
      payment_link: paymentLink,
      plan_name: planName,
    })
  },
  $apis.requireAuth(),
)
