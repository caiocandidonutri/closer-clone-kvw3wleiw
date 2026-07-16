routerAdd('POST', '/backend/v1/webhook/evolution', (e) => {
  const payload = e.requestInfo().body || {}
  const instanceName = payload.instance
  const event = payload.event ? payload.event.toLowerCase() : ''

  if (!instanceName) return e.json(200, { success: true })

  let integ
  try {
    integ = $app.findFirstRecordByData('integrations', 'instance_name', instanceName)
  } catch (_) {
    return e.json(200, { success: true })
  }
  const ownerId = integ.getString('owner')

  if (event === 'connection.update') {
    const state = payload.data && payload.data.state
    if (state === 'open') integ.set('status', 'CONNECTED')
    else if (state === 'close') integ.set('status', 'DISCONNECTED')
    $app.save(integ)
    return e.json(200, { success: true })
  }

  if (event === 'messages.upsert') {
    let msgObj = payload.data
    if (Array.isArray(msgObj)) msgObj = msgObj[0]
    else if (msgObj && Array.isArray(msgObj.messages)) msgObj = msgObj.messages[0]
    if (!msgObj) return e.json(200, { success: true })

    const key = msgObj.key || {}
    const remoteJid = key.remoteJid || msgObj.remoteJid || ''
    const fromMe = key.fromMe !== undefined ? key.fromMe : msgObj.fromMe || false

    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.indexOf('@g.us') >= 0) {
      return e.json(200, { success: true })
    }

    const pushName = msgObj.pushName || msgObj.verifiedName || 'Unknown'
    let text = ''
    const content = msgObj.message
    if (typeof content === 'string') {
      text = content
    } else if (content && typeof content === 'object') {
      text =
        content.conversation ||
        (content.extendedTextMessage && content.extendedTextMessage.text) ||
        (content.imageMessage && content.imageMessage.caption) ||
        (content.videoMessage && content.videoMessage.caption) ||
        ''
    } else if (msgObj.text) {
      text = msgObj.text
    }
    if (!text) text = '[Mídia]'

    const ts = msgObj.messageTimestamp || msgObj.timestamp
    let timestamp = new Date().toISOString()
    if (ts) {
      const numTs = typeof ts === 'string' ? parseInt(ts, 10) : ts
      if (numTs > 0) timestamp = new Date(numTs < 100000000000 ? numTs * 1000 : numTs).toISOString()
    }

    let contact
    try {
      contact = $app.findFirstRecordByData('contacts', 'whatsapp_id', remoteJid)
    } catch (_) {
      const col = $app.findCollectionByNameOrId('contacts')
      contact = new Record(col)
      contact.set('name', pushName)
      contact.set('whatsapp_id', remoteJid)
      contact.set('status', 'pending')
      contact.set('owner', ownerId)
      contact.set('last_message', text)
      contact.set('wait_time_seconds', 0)
      $app.save(contact)
    }

    const msgCol = $app.findCollectionByNameOrId('messages')
    const incoming = new Record(msgCol)
    incoming.set('contact', contact.id)
    incoming.set('content', text)
    incoming.set('role', 'user')
    incoming.set('timestamp', timestamp)
    $app.save(incoming)

    if (!fromMe) {
      const wait = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000))
      contact.set('status', 'pending')
      contact.set('last_message', text)
      contact.set('wait_time_seconds', wait)
      $app.save(contact)

      try {
        const result = $ai.agent('yasa-triage-agent').chat({
          user_id: ownerId,
          message: text,
        })
        const reply = result.content || ''
        if (reply) {
          const aiMsg = new Record(msgCol)
          aiMsg.set('contact', contact.id)
          aiMsg.set('content', reply)
          aiMsg.set('role', 'assistant')
          aiMsg.set('timestamp', new Date().toISOString())
          $app.save(aiMsg)

          let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
          if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
          const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
          const instName = integ.getString('instance_name')
          $http.send({
            url: evoUrl + '/message/sendText/' + instName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({ number: remoteJid, text: reply }),
            timeout: 30,
          })
        }
      } catch (err) {
        $app.logger().error('yasa agent failed', 'err', err.message || String(err))
      }
    }
  }

  return e.json(200, { success: true })
})
