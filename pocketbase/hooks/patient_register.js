/// <reference path="../pb_data/types.d.ts" />
// Public patient registration endpoint:
// POST /backend/v1/patients/register
// Body: { name, phone, email?, nutritional_goal?, subscription_plan }
//
// Behavior:
// - Resolves the Dr. Caio owner user (from connected WhatsApp integration or admin email).
// - Normalizes the phone number (adds 55 if BR without country code).
// - Validates fields: name, phone, subscription_plan ('free_trial' | 'free' | 'weekly' | 'monthly' | 'quarterly').
// - If free trial (subscription_plan === 'free_trial' || 'free'):
//     subscription_plan = 'free_trial'
//     subscription_start = now
//     subscription_end = now + 3 days
//     message_count_limit = 5
//     message_count_used = 0
//     status = 'trial'
// - If paid plan ('weekly', 'monthly', 'quarterly'):
//     Duration and message limits set according to plan definition
//     status = 'trial' or 'inactive' (or 'active' if starting)
// - Creates or updates patient in the `patients` collection.
// - Finds/creates contact relation if appropriate.
// - Sends the welcome WhatsApp message via Evolution API:
//     "Olá [nome]! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri Responde! Sua assistente Yasa já está pronta para te ajudar. Que tal começar me contando qual é o seu principal objetivo? 💚"

routerAdd('POST', '/backend/v1/patients/register', (e) => {
  const raw = e.requestInfo().body
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}

  const name = (body.name || '').toString().trim()
  const phoneRaw = (body.phone || body.phoneNumber || body.whatsapp || '').toString().trim()
  const email = (body.email || '').toString().trim()
  const nutritionalGoal = (body.nutritional_goal || body.nutritionalGoal || body.goal || '')
    .toString()
    .trim()
  let planSlug = (body.subscription_plan || body.subscriptionPlan || body.plan || 'free_trial')
    .toString()
    .trim()
    .toLowerCase()

  if (planSlug === 'free') {
    planSlug = 'free_trial'
  }

  if (!name) {
    return e.json(400, { success: false, error: 'Nome é obrigatório' })
  }
  if (!phoneRaw) {
    return e.json(400, { success: false, error: 'Telefone (WhatsApp) é obrigatório' })
  }

  // Normalize BR phone number
  let phone = phoneRaw.replace(/\D/g, '')
  if (phone.length > 0 && phone.indexOf('55') !== 0 && phone.length <= 11) {
    phone = '55' + phone
  }

  if (phone.length < 10) {
    return e.json(400, { success: false, error: 'Telefone inválido' })
  }

  // ── Resolve Owner User (Dr. Caio) ──
  let ownerId = ''
  try {
    const integ = $app.findFirstRecordByFilter(
      'integrations',
      "status = 'CONNECTED'",
      '-created',
      1,
      0,
    )
    if (integ) ownerId = integ.getString('owner')
  } catch (_) {}

  if (!ownerId) {
    try {
      const adminEmail =
        $os.getenv('NUTRI_OWNER_EMAIL') ||
        $secrets.get('NUTRI_OWNER_EMAIL') ||
        'caiocandidonutri@hotmail.com'
      const admin = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
      if (admin) ownerId = admin.id
    } catch (err) {
      console.log(
        '[patient_register] could not resolve admin owner: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }

  if (!ownerId) {
    console.log('[patient_register] error: no owner user found')
    return e.json(500, { success: false, error: 'Profissional não configurado no sistema' })
  }

  // ── Plan configuration ──
  let durationDays = 3
  let messageLimit = 5
  let limitType = 'total'
  let isFreeTrial = planSlug === 'free_trial'

  if (planSlug === 'weekly') {
    durationDays = 7
    messageLimit = 15
    limitType = 'total'
  } else if (planSlug === 'monthly') {
    durationDays = 30
    messageLimit = 25
    limitType = 'daily'
  } else if (planSlug === 'quarterly') {
    durationDays = 90
    messageLimit = 40
    limitType = 'daily'
  } else {
    planSlug = 'free_trial'
    durationDays = 3
    messageLimit = 5
    limitType = 'total'
  }

  const now = new Date()
  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
  const startIso = now.toISOString()
  const endIso = end.toISOString()

  // ── Find existing patient by phone & owner ──
  let patient = null
  try {
    patient = $app.findFirstRecordByFilter(
      'patients',
      'owner = {:uid} && phone = {:ph}',
      '-created',
      1,
      0,
      { uid: ownerId, ph: phone },
    )
  } catch (_) {}

  let createdNew = false
  if (!patient) {
    const patCol = $app.findCollectionByNameOrId('patients')
    patient = new Record(patCol)
    patient.set('owner', ownerId)
    patient.set('name', name)
    patient.set('phone', phone)
    if (email) patient.set('email', email)
    if (nutritionalGoal) patient.set('nutritional_goal', nutritionalGoal)
    patient.set('registration_date', startIso.slice(0, 10))
    patient.set('invited_by', ownerId)
    createdNew = true
  } else {
    patient.set('name', name)
    if (email) patient.set('email', email)
    if (nutritionalGoal) patient.set('nutritional_goal', nutritionalGoal)
  }

  patient.set('subscription_plan', planSlug)
  patient.set('subscription_start', startIso)
  patient.set('subscription_end', endIso)
  patient.set('message_count_used', 0)
  patient.set('message_count_limit', messageLimit)
  patient.set('status', isFreeTrial ? 'trial' : 'active')
  if (limitType === 'daily') {
    patient.set('message_reset_date', startIso)
  }

  try {
    $app.save(patient)
  } catch (err) {
    console.log(
      '[patient_register] failed to save patient: ' +
        (err && err.message ? err.message : String(err)),
    )
    return e.json(500, { success: false, error: 'Erro ao cadastrar paciente' })
  }

  console.log(
    '[patient_register] patient saved id=' +
      patient.id +
      ' phone=' +
      phone +
      ' plan=' +
      planSlug +
      ' createdNew=' +
      createdNew,
  )

  // ── Send WhatsApp welcome invite message ──
  let integ = null
  try {
    integ = $app.findFirstRecordByFilter('integrations', 'owner = {:uid} && status = {:s}', {
      uid: ownerId,
      s: 'CONNECTED',
    })
  } catch (_) {}

  let messageSent = false
  if (integ) {
    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''

    if (evoUrl && evoKey && instanceName) {
      const welcomeText =
        'Olá ' +
        name +
        '! 🎉 O Dr. Caio Cândido te dá as boas-vindas ao Nutri Responde! ' +
        'Sua assistente Yasa já está pronta para te ajudar. Que tal começar me contando qual é o seu principal objetivo? 💚'

      try {
        const sendRes = $http.send({
          url: evoUrl + '/message/sendText/' + instanceName,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: phone, text: welcomeText }),
          timeout: 25,
        })
        if (sendRes && sendRes.statusCode >= 200 && sendRes.statusCode < 300) {
          messageSent = true
          console.log('[patient_register] welcome WhatsApp sent to ' + phone)
        } else {
          console.log(
            '[patient_register] Evolution sendText returned status ' +
              (sendRes ? sendRes.statusCode : 'null'),
          )
        }
      } catch (sendErr) {
        console.log(
          '[patient_register] WhatsApp send failed: ' +
            (sendErr && sendErr.message ? sendErr.message : String(sendErr)),
        )
      }
    }
  } else {
    console.log('[patient_register] no connected WhatsApp integration for owner=' + ownerId)
  }

  return e.json(200, {
    success: true,
    patient: {
      id: patient.id,
      name: patient.getString('name'),
      phone: patient.getString('phone'),
      subscription_plan: patient.getString('subscription_plan'),
      status: patient.getString('status'),
      subscription_end: patient.getString('subscription_end'),
    },
    message_sent: messageSent,
  })
})
