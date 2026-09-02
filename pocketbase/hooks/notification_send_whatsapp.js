/// <reference path="../pb_data/types.d.ts" />
// Endpoint: POST /backend/v1/notifications/send-whatsapp
// Sends a custom/edited message to the patient via WhatsApp and marks the notification as read.
// Body: { notification_id?: string, patient_id?: string, message: string }

routerAdd(
  'POST',
  '/backend/v1/notifications/send-whatsapp',
  (e) => {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const userId = authRecord.id
    const raw = e.requestInfo().body
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
    const notificationId = (body.notification_id || body.notificationId || '').toString().trim()
    let patientId = (body.patient_id || body.patientId || '').toString().trim()
    const text = (body.message || body.text || '').toString().trim()

    if (!text) {
      return e.badRequestError('O texto da mensagem é obrigatório')
    }

    let notif = null
    if (notificationId) {
      try {
        notif = $app.findRecordById('notifications', notificationId)
        if (notif.getString('owner') !== userId) {
          return e.forbiddenError('Acesso negado a esta notificação')
        }
        if (!patientId) {
          patientId = notif.getString('patient_id')
        }
      } catch (_) {}
    }

    let patient = null
    if (patientId) {
      try {
        patient = $app.findRecordById('patients', patientId)
      } catch (_) {}
    }

    // Determine target contact & phone
    let contact = null
    if (patientId) {
      try {
        contact = $app.findFirstRecordByFilter('contacts', 'patient_id = {:pid}', {
          pid: patientId,
        })
      } catch (_) {}
    }

    if (!contact && patient) {
      const contactRel = patient.getString('contact')
      if (contactRel) {
        try {
          contact = $app.findRecordById('contacts', contactRel)
        } catch (_) {}
      }
    }

    const patientPhone = patient ? (patient.getString('phone') || '').replace(/\D/g, '') : ''

    if (!contact && patientPhone.length >= 8) {
      const last9 = patientPhone.slice(-9)
      try {
        const contacts = $app.findRecordsByFilter('contacts', '', '-created', 200, 0)
        for (const c of contacts) {
          const cJid = (c.getString('remote_jid') || '').replace(/\D/g, '')
          const cPhone = (c.getString('whatsapp_id') || c.getString('phone_number') || '').replace(
            /\D/g,
            '',
          )
          if ((cJid && cJid.slice(-9) === last9) || (cPhone && cPhone.slice(-9) === last9)) {
            contact = c
            if (patientId) {
              try {
                c.set('patient_id', patientId)
                $app.save(c)
              } catch (_) {}
            }
            break
          }
        }
      } catch (_) {}
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
      return e.badRequestError('Nenhum número de WhatsApp encontrado para este paciente')
    }

    // Resolve connected integration
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
      return e.badRequestError('Nenhuma conexão com WhatsApp ativa no momento')
    }

    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || $os.getenv('EVOLUTION_API_URL') || ''
    if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || $os.getenv('EVOLUTION_API_KEY') || ''

    if (!evoUrl || !evoKey) {
      return e.json(500, { error: 'Configuração da Evolution API incompleta' })
    }

    // Send WhatsApp
    try {
      const sendRes = $http.send({
        url: evoUrl + '/message/sendText/' + instanceName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: whatsappNumber, text: text }),
        timeout: 30,
      })

      if (!sendRes || sendRes.statusCode < 200 || sendRes.statusCode >= 300) {
        let errDetails = 'Erro ao enviar mensagem pelo WhatsApp'
        try {
          if (sendRes && sendRes.json) {
            errDetails = sendRes.json.message || sendRes.json.error || errDetails
          }
        } catch (_) {}
        return e.json(502, { error: errDetails })
      }
    } catch (httpErr) {
      console.log('[send-whatsapp] HTTP error: ' + httpErr)
      return e.json(502, {
        error: 'Falha na comunicação com o WhatsApp: ' + (httpErr.message || String(httpErr)),
      })
    }

    // Save message in messages collection
    if (contact) {
      try {
        const msgCol = $app.findCollectionByNameOrId('messages')
        const msg = new Record(msgCol)
        msg.set('contact', contact.id)
        msg.set('content', text)
        msg.set('role', 'assistant')
        msg.set('timestamp', new Date().toISOString())
        msg.set('needs_human', false)
        msg.set('ai_response_seconds', 0)
        $app.save(msg)

        contact.set('last_message', text)
        contact.set('status', 'responded')
        contact.set('last_message_from_me', true)
        contact.set('last_message_at', new Date().toISOString())
        $app.save(contact)
      } catch (_) {}
    }

    // Mark notification as read
    if (notif) {
      try {
        notif.set('read', true)
        notif.set('read_at', new Date().toISOString())
        $app.save(notif)
      } catch (_) {}
    }

    return e.json(200, {
      success: true,
      whatsapp_sent: true,
      notification_read: !!notif,
    })
  },
  $apis.requireAuth(),
)
