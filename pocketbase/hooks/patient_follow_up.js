/// <reference path="../pb_data/types.d.ts" />
// Cron: Runs every 2 hours to send proactive follow-up 2 days after plan purchase
// "Como está sendo sua experiência? Conseguiu montar seu cardápio? 💚"

cronAdd('patient_follow_up_cron', '0 */2 * * *', () => {
  console.log('[patient_follow_up_cron] Checking patients for 2-day post-purchase follow-up...')
  try {
    let integ = null
    try {
      integ = $app.findFirstRecordByFilter('integrations', "status = 'CONNECTED'", '-created', 1, 0)
    } catch (_) {}

    if (!integ) return

    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || $os.getenv('EVOLUTION_API_URL') || ''
    if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || $os.getenv('EVOLUTION_API_KEY') || ''

    if (!evoUrl || !evoKey) return

    const now = Date.now()
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000
    const fourDaysMs = 4 * 24 * 60 * 60 * 1000

    // Look for active patients whose subscription_start was between 2 and 4 days ago and haven't received follow_up
    const activePatients =
      $app.findRecordsByFilter(
        'patients',
        "status = 'active' && subscription_start != '' && (follow_up_status = '' || follow_up_status = null || follow_up_status = 'pending')",
        '-subscription_start',
        100,
        0,
      ) || []

    const msgCol = $app.findCollectionByNameOrId('messages')

    for (let i = 0; i < activePatients.length; i++) {
      const p = activePatients[i]
      const startStr = p.getString('subscription_start')
      if (!startStr) continue

      const startDate = new Date(startStr).getTime()
      const diff = now - startDate

      if (diff >= twoDaysMs && diff <= fourDaysMs) {
        const patientName = p.getString('name') || 'Paciente'
        const phone = (p.getString('phone') || '').replace(/\D/g, '')
        if (!phone) continue

        let targetPhone = phone
        if (targetPhone.indexOf('55') !== 0 && targetPhone.length <= 11) {
          targetPhone = '55' + targetPhone
        }

        const text =
          `Olá, ${patientName}! 💚 Passando para saber como está sendo sua experiência com o seu plano nesses primeiros dias!\n\n` +
          `Você conseguiu montar seu cardápio e testar as dicas da Yasa? Se tiver qualquer dúvida sobre alimentos ou receitas, estou por aqui! ✨🥗`

        try {
          const sendRes = $http.send({
            url: evoUrl + '/message/sendText/' + instanceName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({ number: targetPhone, text: text }),
            timeout: 25,
          })

          if (sendRes && sendRes.statusCode >= 200 && sendRes.statusCode < 300) {
            p.set('follow_up_status', 'sent')
            p.set('follow_up_sent_at', new Date().toISOString())
            $app.save(p)

            // save assistant message if contact exists
            let contact = null
            try {
              contact = $app.findFirstRecordByFilter('contacts', 'patient_id = {:pid}', {
                pid: p.id,
              })
            } catch (_) {}

            if (contact) {
              try {
                const msg = new Record(msgCol)
                msg.set('contact', contact.id)
                msg.set('content', text)
                msg.set('role', 'assistant')
                msg.set('timestamp', new Date().toISOString())
                $app.save(msg)

                contact.set('last_message', text)
                contact.set('status', 'responded')
                contact.set('last_message_from_me', true)
                contact.set('last_message_at', new Date().toISOString())
                $app.save(contact)
              } catch (_) {}
            }
            console.log('[patient_follow_up_cron] Follow-up sent to ' + patientName)
          }
        } catch (sendErr) {
          console.log('[patient_follow_up_cron] send error: ' + sendErr)
        }
      }
    }
  } catch (err) {
    console.log('[patient_follow_up_cron] error: ' + err)
  }
})
