routerAdd(
  'POST',
  '/backend/v1/whatsapp/connect',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
    if (!evoUrl || !evoKey) return e.json(500, { error: 'Evolution API not configured' })

    let integ
    try {
      integ = $app.findFirstRecordByFilter('integrations', 'owner = {:uid}', { uid: userId })
    } catch (_) {
      const col = $app.findCollectionByNameOrId('integrations')
      const instanceName = 'ins_' + $security.randomString(8).toLowerCase()
      integ = new Record(col)
      integ.set('name', 'WhatsApp')
      integ.set('provider', 'evolution_api')
      integ.set('instance_name', instanceName)
      integ.set('apikey', evoKey)
      integ.set('status', 'DISCONNECTED')
      integ.set('owner', userId)
      $app.save(integ)
    }

    const instanceName = integ.getString('instance_name')

    $http.send({
      url: evoUrl + '/instance/create',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({
        instanceName: instanceName,
        token: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
      timeout: 30,
    })

    const pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    const webhookUrl = pbUrl + '/backend/v1/webhook/evolution'
    $http.send({
      url: evoUrl + '/webhook/set/' + instanceName,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
      timeout: 20,
    })
    integ.set('webhook_url', webhookUrl)

    const connectRes = $http.send({
      url: evoUrl + '/instance/connect/' + instanceName,
      method: 'GET',
      headers: { apikey: evoKey },
      timeout: 30,
    })

    if (!connectRes.statusCode || connectRes.statusCode >= 400) {
      integ.set('status', 'WAITING_QR')
      $app.save(integ)
      return e.json(200, { status: 'WAITING_QR', base64: null })
    }

    let data = {}
    try {
      data = connectRes.json || {}
    } catch (_) {}

    const state = data.instance && data.instance.state ? data.instance.state : data.state
    if (state === 'open') {
      integ.set('status', 'CONNECTED')
      $app.save(integ)
      return e.json(200, { status: 'CONNECTED', base64: null })
    }

    const base64 = data.base64 || (data.qrcode && data.qrcode.base64) || null
    integ.set('status', 'WAITING_QR')
    $app.save(integ)
    return e.json(200, { status: 'WAITING_QR', base64: base64 })
  },
  $apis.requireAuth(),
)
