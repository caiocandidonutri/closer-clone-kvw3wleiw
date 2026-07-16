routerAdd(
  'POST',
  '/backend/v1/whatsapp/send',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')
    const body = e.requestInfo().body || {}
    const contactId = body.contactId
    const text = body.text
    if (!contactId || !text) return e.badRequestError('contactId and text required')

    let contact
    try {
      contact = $app.findRecordById('contacts', contactId)
    } catch (_) {
      return e.notFoundError('contact not found')
    }
    if (contact.getString('owner') !== userId) return e.forbiddenError('not allowed')

    let integ
    try {
      integ = $app.findFirstRecordByFilter(
        'integrations',
        "owner = {:uid} && status = 'CONNECTED'",
        { uid: userId },
      )
    } catch (_) {
      return e.badRequestError('no connected WhatsApp integration')
    }

    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
    const instanceName = integ.getString('instance_name')

    const sendRes = $http.send({
      url: evoUrl + '/message/sendText/' + instanceName,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({ number: contact.getString('whatsapp_id'), text: text }),
      timeout: 30,
    })
    if (!sendRes.statusCode || sendRes.statusCode >= 400) {
      return e.json(502, { error: 'Evolution send failed' })
    }

    const msgCol = $app.findCollectionByNameOrId('messages')
    const msg = new Record(msgCol)
    msg.set('contact', contactId)
    msg.set('content', text)
    msg.set('role', 'assistant')
    msg.set('timestamp', new Date().toISOString())
    $app.save(msg)

    contact.set('status', 'responded')
    contact.set('last_message', text)
    contact.set('wait_time_seconds', 0)
    $app.save(contact)

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
