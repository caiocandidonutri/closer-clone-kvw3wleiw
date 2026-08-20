/// <reference path="../pb_data/types.d.ts" />
// After a patient record is created, send a WhatsApp invite message via the
// owner's connected Evolution API instance. The invite link points to the app
// so the patient can start chatting with Yasa. Non-blocking: invite failures
// are logged but never prevent the patient record from being saved.

onRecordAfterCreateSuccess((e) => {
  const p = e.record
  if (!p) return

  const owner = p.getString('owner')
  const name = p.getString('name') || ''
  const phoneRaw = p.getString('phone') || ''
  if (!owner || !phoneRaw) return

  // Normalize the phone number (keep only digits, ensure it starts with 55 for BR).
  let phone = phoneRaw.replace(/\D/g, '')
  if (phone.length > 0 && phone.indexOf('55') !== 0 && phone.length <= 11) {
    phone = '55' + phone
  }
  if (!phone) return

  // Resolve a connected integration owned by this user.
  let integ = null
  try {
    integ = $app.findFirstRecordByFilter('integrations', 'owner = {:uid} && status = {:s}', {
      uid: owner,
      s: 'CONNECTED',
    })
  } catch (_) {}
  if (!integ) {
    console.log('[patient_invite] no connected integration for owner=' + owner)
    return
  }

  const instanceName = integ.getString('instance_name')
  let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
  const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
  if (!evoUrl || !evoKey || !instanceName) {
    console.log('[patient_invite] missing Evolution config')
    return
  }

  const text =
    'Olá ' +
    name +
    '! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri Responde! ' +
    'Sua assistente Yasa já está pronta para te ajudar. Que tal começar me contando qual é o seu principal objetivo? 💚'

  try {
    $http.send({
      url: evoUrl + '/message/sendText/' + instanceName,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({ number: phone, text: text }),
      timeout: 30,
    })
    console.log('[patient_invite] invite sent to ' + phone + ' for patient ' + p.id)
  } catch (err) {
    console.log('[patient_invite] failed: ' + (err && err.message ? err.message : String(err)))
  }
}, 'patients')
