/// <reference path="../pb_data/types.d.ts" />
// Endpoint: POST /backend/v1/patients/release-messages
//
// Behavior:
// - Receives patient_id and bonus_amount (default 5).
// - Authenticates the request (nutritionist/owner).
// - Finds the patient record.
// - Updates: message_count_used = 0 and message_count_limit += bonus_amount
// - Finds the contact linked to the patient via patient_id in the contacts table (or patient's contact relation / phone matching).
// - If contact with remote_jid / WhatsApp number is found:
//   Sends message via Evolution API:
//   "🎉 Boa notícia, [Nome do paciente]! O Dr. Caio liberou +[bonus_amount] mensagens para você! Continue sua jornada — é só mandar sua dúvida aqui. 💚"
// - Returns: { success: true, whatsapp_sent: boolean, patient_id, bonus_amount, patient }

routerAdd(
  'POST',
  '/backend/v1/patients/release-messages',
  (e) => {
    const raw = e.requestInfo().body
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}

    const patientId = (body.patient_id || body.patientId || body.id || '').toString().trim()
    let bonusAmount = parseInt(body.bonus_amount || body.bonusAmount, 10)
    if (isNaN(bonusAmount) || bonusAmount <= 0) {
      bonusAmount = 5
    }

    if (!patientId) {
      return e.badRequestError('patient_id is required')
    }

    let patient = null
    try {
      patient = $app.findRecordById('patients', patientId)
    } catch (_) {
      return e.notFoundError('Patient not found')
    }

    const ownerId = patient.getString('owner') || (e.auth && e.auth.id) || ''
    const patientName = patient.getString('name') || 'paciente'
    const currentLimit = patient.getInt('message_count_limit') || 0
    const newLimit = currentLimit + bonusAmount

    patient.set('message_count_used', 0)
    patient.set('message_count_limit', newLimit)

    try {
      $app.save(patient)
    } catch (err) {
      console.log(
        '[patient_release_messages] failed to update patient: ' +
          (err && err.message ? err.message : String(err)),
      )
      return e.json(500, { success: false, error: 'Erro ao atualizar dados do paciente' })
    }

    // ── Find contact for WhatsApp notification ──
    let contact = null
    // 1. Try finding by patient_id relation in contacts
    try {
      contact = $app.findFirstRecordByFilter('contacts', 'patient_id = {:pid}', {
        pid: patientId,
      })
    } catch (_) {}

    // 2. Try contact field on patient if available
    if (!contact) {
      const contactRelId = patient.getString('contact')
      if (contactRelId) {
        try {
          contact = $app.findRecordById('contacts', contactRelId)
        } catch (_) {}
      }
    }

    // 3. Try matching by phone number
    const patientPhone = (patient.getString('phone') || '').replace(/\D/g, '')
    if (!contact && patientPhone.length >= 8) {
      const last9 = patientPhone.slice(-9)
      try {
        const contacts = $app.findRecordsByFilter('contacts', '', '-created', 200, 0)
        for (const c of contacts) {
          const cJid = (c.getString('remote_jid') || '')
            .replace('@s.whatsapp.net', '')
            .replace(/\D/g, '')
          const cPhone = (c.getString('whatsapp_id') || c.getString('phone_number') || '').replace(
            /\D/g,
            '',
          )
          if ((cJid && cJid.slice(-9) === last9) || (cPhone && cPhone.slice(-9) === last9)) {
            contact = c
            // Link contact to patient for future lookups
            try {
              c.set('patient_id', patientId)
              $app.save(c)
            } catch (_) {}
            break
          }
        }
      } catch (_) {}
    }

    // ── Determine WhatsApp destination ──
    let remoteJid = ''
    let whatsappNumber = ''
    if (contact) {
      remoteJid = contact.getString('remote_jid') || ''
      whatsappNumber = contact.getString('whatsapp_id') || contact.getString('phone_number') || ''
    }

    if (!whatsappNumber && remoteJid) {
      whatsappNumber = remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/\D/g, '')
    }
    if (!whatsappNumber && patientPhone) {
      whatsappNumber = patientPhone
      if (whatsappNumber.indexOf('55') !== 0 && whatsappNumber.length <= 11) {
        whatsappNumber = '55' + whatsappNumber
      }
    }

    const messageText =
      '🎉 Boa notícia, ' +
      patientName +
      '! O Dr. Caio liberou +' +
      bonusAmount +
      ' mensagens para você! Continue sua jornada — é só mandar sua dúvida aqui. 💚'

    let whatsappSent = false

    // ── Send message via Evolution API ──
    let integ = null
    if (ownerId) {
      try {
        integ = $app.findFirstRecordByFilter(
          'integrations',
          "owner = {:uid} && status = 'CONNECTED'",
          { uid: ownerId },
        )
      } catch (_) {}
    }
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

    if (integ && whatsappNumber) {
      const instanceName = integ.getString('instance_name')
      let evoUrl = $secrets.get('EVOLUTION_API_URL') || $os.getenv('EVOLUTION_API_URL') || ''
      if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
      const evoKey = $secrets.get('EVOLUTION_API_KEY') || $os.getenv('EVOLUTION_API_KEY') || ''

      if (evoUrl && evoKey && instanceName) {
        try {
          const sendRes = $http.send({
            url: evoUrl + '/message/sendText/' + instanceName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({ number: whatsappNumber, text: messageText }),
            timeout: 30,
          })
          if (sendRes && sendRes.statusCode >= 200 && sendRes.statusCode < 300) {
            whatsappSent = true
            console.log(
              '[patient_release_messages] WhatsApp notification sent to ' +
                whatsappNumber +
                ' for patient ' +
                patientId,
            )
          } else {
            console.log(
              '[patient_release_messages] Evolution sendText status ' +
                (sendRes ? sendRes.statusCode : 'null'),
            )
          }
        } catch (sendErr) {
          console.log(
            '[patient_release_messages] WhatsApp send failed: ' +
              (sendErr && sendErr.message ? sendErr.message : String(sendErr)),
          )
        }
      } else {
        console.log('[patient_release_messages] missing Evolution credentials or instance name')
      }
    } else {
      console.log(
        '[patient_release_messages] no connected integration or no WhatsApp number found (whatsappNumber=' +
          whatsappNumber +
          ')',
      )
    }

    // Persist outgoing assistant message in messages collection if contact exists
    if (contact) {
      try {
        const msgCol = $app.findCollectionByNameOrId('messages')
        const msg = new Record(msgCol)
        msg.set('contact', contact.id)
        msg.set('content', messageText)
        msg.set('role', 'assistant')
        msg.set('timestamp', new Date().toISOString())
        msg.set('needs_human', false)
        msg.set('ai_response_seconds', 0)
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
      whatsapp_sent: whatsappSent,
      patient_id: patient.id,
      bonus_amount: bonusAmount,
      patient: {
        id: patient.id,
        name: patient.getString('name'),
        phone: patient.getString('phone'),
        subscription_plan: patient.getString('subscription_plan'),
        status: patient.getString('status'),
        message_count_used: patient.getInt('message_count_used'),
        message_count_limit: patient.getInt('message_count_limit'),
        triaged: patient.getBool('triaged'),
        subscription_end: patient.getString('subscription_end'),
      },
    })
  },
  $apis.requireAuth(),
)
