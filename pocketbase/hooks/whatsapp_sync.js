/// <reference path="../pb_data/types.d.ts" />
// Import existing WhatsApp conversations/contacts from a connected Evolution instance.
//
// POST /backend/v1/whatsapp/sync  { integrationId?: string }
//   → for the caller's CONNECTED integration, pulls the list of chats from
//     Evolution, upserts a `contacts` row per chat (remoteJid, pushName,
//     profile pic, last message preview) and stores the last ~20 messages
//     per chat in the `messages` collection. Realtime fires on every save
//     so the Contacts/Chat screens update live.
//
// Evolution API (v2) endpoints used:
//   GET  /chat/findChats/{instance}?type=whatsapp  → all conversations
//   POST /chat/fetchProfilePictureUrl/{instance}   → profile pic (optional)

routerAdd(
  'POST',
  '/backend/v1/whatsapp/sync',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const integrationId = body.integrationId || ''

    let integ
    if (integrationId) {
      try {
        integ = $app.findFirstRecordByFilter('integrations', 'id = {:id} && owner = {:uid}', {
          id: integrationId,
          uid: userId,
        })
      } catch (_) {
        return e.notFoundError('Integration not found')
      }
    } else {
      try {
        integ = $app.findFirstRecordByFilter(
          'integrations',
          "owner = {:uid} && status = 'CONNECTED'",
          { uid: userId },
        )
      } catch (_) {
        return e.badRequestError('Nenhuma integração WhatsApp conectada.')
      }
    }

    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
    if (!evoUrl || !evoKey) {
      return e.json(500, { error: 'Evolution API não configurada.' })
    }
    const instanceName = integ.getString('instance_name')

    const owner = userId
    const contactCol = $app.findCollectionByNameOrId('contacts')
    const msgCol = $app.findCollectionByNameOrId('messages')

    const upsertContact = (jid, pushName, lastText, fromMe, lastTs, phone, picUrl) => {
      if (!jid) return null
      let contact = null
      try {
        contact = $app.findFirstRecordByData('contacts', 'remote_jid', jid)
      } catch (_) {}
      if (!contact && phone) {
        try {
          contact = $app.findFirstRecordByData('contacts', 'whatsapp_id', phone)
        } catch (_) {}
      }
      if (!contact) {
        contact = new Record(contactCol)
        contact.set('owner', owner)
        contact.set('remote_jid', jid)
        contact.set('whatsapp_id', phone || jid.split('@')[0])
        contact.set('phone_number', phone || jid.split('@')[0])
        contact.set('name', pushName || phone || jid.split('@')[0])
        contact.set('push_name', pushName)
        contact.set('status', 'pending')
        contact.set('pipeline_stage', 'Em Conversa')
        contact.set('last_message_from_me', !!fromMe)
      } else {
        contact.set('remote_jid', jid)
        if (!contact.getString('whatsapp_id') && phone) contact.set('whatsapp_id', phone)
        if (!contact.getString('phone_number') && phone) contact.set('phone_number', phone)
        if (pushName && !contact.getString('push_name')) {
          contact.set('push_name', pushName)
          if (!contact.getString('name')) contact.set('name', pushName)
        }
        contact.set('last_message_from_me', !!fromMe)
      }
      if (picUrl) {
        contact.set('profile_picture_url', picUrl)
        if (!contact.getString('avatar_url')) contact.set('avatar_url', picUrl)
      }
      if (lastText) contact.set('last_message', lastText)
      if (lastTs) contact.set('last_message_at', lastTs)
      $app.save(contact)
      return contact
    }

    // Fetch every conversation (whatsapp chats list).
    const chatsRes = $http.send({
      url: evoUrl + '/chat/findChats/' + instanceName,
      method: 'GET',
      headers: { apikey: evoKey },
      timeout: 30,
    })

    let imported = 0
    let messagesImported = 0

    if (chatsRes.statusCode === 200) {
      let chats = []
      try {
        const j = chatsRes.json
        // Evolution may return { chats: [...] } or an array directly.
        if (Array.isArray(j)) chats = j
        else if (j && Array.isArray(j.chats)) chats = j.chats
        else if (j && j.data && Array.isArray(j.data)) chats = j.data
      } catch (_) {}

      for (let i = 0; i < chats.length; i++) {
        const ch = chats[i] || {}
        const remoteJid = (ch.remoteJid || ch.jid || '').toString()
        if (!remoteJid) continue
        if (remoteJid.indexOf('status@') === 0 || remoteJid.indexOf('broadcast@') === 0) continue
        const isLid = remoteJid.indexOf('@lid') >= 0
        const phone = remoteJid.split('@')[0]
        const pushName = (ch.pushName || ch.name || '').toString()
        const lastText =
          (ch.lastMessage && (ch.lastMessage.message || ch.lastMessage.text)) ||
          ch.lastMessagePreview ||
          ''
        const lastFromMe = ch.lastMessage && ch.lastMessage.key && ch.lastMessage.key.fromMe
        let lastTs = null
        if (ch.lastMessage && ch.lastMessage.messageTimestamp) {
          const ts = parseInt(ch.lastMessage.messageTimestamp, 10)
          if (!isNaN(ts)) lastTs = new Date(ts * 1000).toISOString()
        } else if (ch.timestamp) {
          const ts = parseInt(ch.timestamp, 10)
          if (!isNaN(ts)) lastTs = new Date(ts * 1000).toISOString()
        }

        // Optional profile picture (best-effort, skip for lid jids).
        let picUrl = ''
        if (!isLid) {
          try {
            const picRes = $http.send({
              url: evoUrl + '/chat/fetchProfilePictureUrl/' + instanceName,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: evoKey },
              body: JSON.stringify({ number: phone }),
              timeout: 8,
            })
            if (picRes.statusCode === 200 && picRes.body) {
              try {
                const pj = picRes.json
                picUrl = (pj && (pj.profilePictureUrl || pj.url || (pj.data && pj.data.url))) || ''
              } catch (_) {
                const raw = picRes.body.toString().replace(/"/g, '')
                if (raw.indexOf('http') === 0) picUrl = raw
              }
            }
          } catch (_) {}
        }

        const contact = upsertContact(
          remoteJid,
          pushName,
          lastText,
          lastFromMe,
          lastTs,
          phone,
          picUrl,
        )
        if (!contact) continue
        imported++

        // Persist the last messages for this chat (best-effort).
        try {
          const msgsRes = $http.send({
            url: evoUrl + '/chat/findMessages/' + instanceName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({
              where: { key: { remoteJid: remoteJid } },
              limit: 20,
            }),
            timeout: 20,
          })
          if (msgsRes.statusCode === 200) {
            let msgs = []
            try {
              const mj = msgsRes.json
              if (Array.isArray(mj)) msgs = mj
              else if (mj && Array.isArray(mj.messages)) msgs = mj.messages
              else if (mj && mj.data && Array.isArray(mj.data)) msgs = mj.data
            } catch (_) {}
            // oldest → newest
            for (let k = msgs.length - 1; k >= 0; k--) {
              const m = msgs[k] || {}
              const key = m.key || {}
              const fromMe = key.fromMe === true
              const message = m.message || {}
              const text =
                message.conversation ||
                '' ||
                (message.extendedTextMessage && message.extendedTextMessage.text) ||
                (message.imageMessage && message.imageMessage.caption) ||
                (message.videoMessage && message.videoMessage.caption) ||
                ''
              if (!text) continue
              const role = fromMe ? 'assistant' : 'user'
              let ts = null
              if (m.messageTimestamp) {
                const tsv = parseInt(m.messageTimestamp, 10)
                if (!isNaN(tsv)) ts = new Date(tsv * 1000).toISOString()
              }
              try {
                const r = new Record(msgCol)
                r.set('contact', contact.id)
                r.set('content', text)
                r.set('role', role)
                if (ts) r.set('timestamp', ts)
                $app.save(r)
                messagesImported++
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    return e.json(200, {
      success: true,
      imported_contacts: imported,
      imported_messages: messagesImported,
    })
  },
  $apis.requireAuth(),
)
