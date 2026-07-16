routerAdd(
  'POST',
  '/backend/v1/whatsapp/connect',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const integrationId = body.integrationId
    if (!integrationId) return e.badRequestError('integrationId is required')

    let integ
    try {
      integ = $app.findFirstRecordByFilter('integrations', 'id = {:id} && owner = {:uid}', {
        id: integrationId,
        uid: userId,
      })
    } catch (_) {
      return e.notFoundError('Integration not found')
    }

    const instanceName = integ.getString('instance_name')
    if (!instanceName) return e.badRequestError('Instance name not configured')

    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
    if (!evoUrl || !evoKey) {
      return e.json(500, { error: 'Evolution API not configured. Contact support.' })
    }

    var pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
    var webhookUrl = pbUrl + '/backend/v1/webhook/evolution'

    // 1. Check current connection state
    const stateRes = $http.send({
      url: evoUrl + '/instance/connectionState/' + instanceName,
      method: 'GET',
      headers: { apikey: evoKey },
      timeout: 15,
    })

    if (stateRes.statusCode === 200) {
      let stateData = {}
      try {
        stateData = stateRes.json || {}
      } catch (_) {}
      var st =
        stateData.instance && stateData.instance.state ? stateData.instance.state : stateData.state
      if (st === 'open') {
        integ.set('status', 'CONNECTED')
        $app.save(integ)
        return e.json(200, { status: 'CONNECTED', base64: null })
      }
    }

    // 2. Create instance (409 = already exists, which is fine)
    const createRes = $http.send({
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

    if (createRes.statusCode === 401 || createRes.statusCode === 403) {
      return e.json(500, { error: 'Evolution API authentication failed. Check API key.' })
    }

    if (createRes.statusCode >= 400 && createRes.statusCode !== 409) {
      let createErr = 'Failed to create WhatsApp instance'
      try {
        var errJson = createRes.json
        if (errJson && (errJson.message || errJson.error)) {
          createErr = errJson.message || errJson.error
        }
      } catch (_) {}
      return e.json(200, { status: 'ERROR', base64: null, error: createErr })
    }

    // 3. If create returned QR directly, set webhook and return QR
    if (createRes.statusCode === 200 || createRes.statusCode === 201) {
      let createData = {}
      try {
        createData = createRes.json || {}
      } catch (_) {}
      if (createData.qrcode && createData.qrcode.base64) {
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
        integ.set('status', 'WAITING_QR')
        $app.save(integ)
        return e.json(200, { status: 'WAITING_QR', base64: createData.qrcode.base64 })
      }
    }

    // 4. Set webhook for existing instance
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

    // 5. Get QR via connect endpoint
    const connectRes = $http.send({
      url: evoUrl + '/instance/connect/' + instanceName,
      method: 'GET',
      headers: { apikey: evoKey },
      timeout: 30,
    })

    if (connectRes.statusCode >= 400) {
      let connectErr = 'QR code not ready. Please try again.'
      try {
        var connErrJson = connectRes.json
        if (connErrJson && (connErrJson.message || connErrJson.error)) {
          connectErr = connErrJson.message || connErrJson.error
        }
      } catch (_) {}
      integ.set('status', 'WAITING_QR')
      $app.save(integ)
      return e.json(200, { status: 'WAITING_QR', base64: null, error: connectErr })
    }

    let connectData = {}
    try {
      connectData = connectRes.json || {}
    } catch (_) {}

    var connState =
      connectData.instance && connectData.instance.state
        ? connectData.instance.state
        : connectData.state
    if (connState === 'open') {
      integ.set('status', 'CONNECTED')
      $app.save(integ)
      return e.json(200, { status: 'CONNECTED', base64: null })
    }

    var base64 = connectData.base64 || (connectData.qrcode && connectData.qrcode.base64) || null
    integ.set('status', 'WAITING_QR')
    $app.save(integ)

    if (!base64) {
      return e.json(200, {
        status: 'WAITING_QR',
        base64: null,
        error: 'QR code not ready. Please try again.',
      })
    }

    return e.json(200, { status: 'WAITING_QR', base64: base64 })
  },
  $apis.requireAuth(),
)
