/// <reference path="../pb_data/types.d.ts" />
// Evolution API v2 webhook receiver — multimodal Yasa.
//
// Handles inbound WhatsApp messages of every kind:
//   - text          → normal chat or triage step
//   - audio         → transcribe via OpenAI Whisper, then chat or triage
//   - image         → download, base64, send to GPT-4o vision
//   - document(PDF) → extract text (best-effort) and feed to the chat
//
// Features:
// 1. Mandatory triage workflow for non-triaged patients before GPT invocation
// 2. Individual patient protection (anti-sharing rule)
// 3. Complete personalized system prompt when triaged (IMC, weight, height, goal, intolerances, conditions, diet)
// 4. Plan limits and resets

routerAdd('POST', '/backend/v1/webhook/evolution', (e) => {
  const raw = e.requestInfo().body
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}

  const event = (body.event || '').toString().toUpperCase()
  const instance = (body.instance || '').toString()
  const data = body.data || {}

  console.log(
    '[whatsapp_webhook] received event="' +
      event +
      '" instance="' +
      instance +
      '" dataKeys=' +
      (data ? Object.keys(data).join(',') : '(none)'),
  )

  // ── CONNECTION_UPDATE: sync integration status ──
  if (event === 'CONNECTION.UPDATE' || event === 'connection.update') {
    const state = (data.state || '').toString()
    console.log('[whatsapp_webhook] CONNECTION_UPDATE state=' + state + ' instance=' + instance)
    try {
      const integ = $app.findFirstRecordByData('integrations', 'instance_name', instance)
      if (integ) {
        if (state === 'open') integ.set('status', 'CONNECTED')
        else if (state === 'close' || state === 'closed' || state === 'connecting')
          integ.set('status', state === 'connecting' ? 'WAITING_QR' : 'DISCONNECTED')
        $app.save(integ)
        console.log('[whatsapp_webhook] integration status updated → ' + integ.getString('status'))
      } else {
        console.log('[whatsapp_webhook] no integration found for instance=' + instance)
      }
    } catch (err) {
      console.log(
        '[whatsapp_webhook] CONNECTION_UPDATE error: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
    return e.json(200, { ok: true })
  }

  // ── MESSAGES_UPSERT: incoming/outgoing message ──
  if (event !== 'MESSAGES.UPSERT' && event !== 'messages.upsert') {
    console.log('[whatsapp_webhook] skipping unhandled event=' + event)
    return e.json(200, { ok: true, skipped: 'unhandled_event' })
  }

  const key = data.key || {}
  const remoteJid = (key.remoteJid || '').toString()
  const fromMe = key.fromMe === true
  const msgId = (key.id || '').toString()
  const pushName = (data.pushName || '').toString()
  const message = data.message || {}
  const messageType = (data.messageType || '').toString()

  // Extract the plain text body
  const extractText = (m) => {
    if (!m) return ''
    if (typeof m === 'string') return m
    if (m.conversation) return m.conversation
    if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text
    if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption
    if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption
    if (m.documentMessage && m.documentMessage.caption) return m.documentMessage.caption
    if (m.buttonsResponseMessage && m.buttonsResponseMessage.selectedButtonId)
      return m.buttonsResponseMessage.selectedButtonId
    if (m.templateMessage) return ''
    return ''
  }
  const text = extractText(message).trim()

  // Ignore status broadcasts
  if (!remoteJid) return e.json(200, { ok: true, skipped: 'no_remote_jid' })
  if (remoteJid.indexOf('status@') === 0 || remoteJid.indexOf('broadcast@') === 0)
    return e.json(200, { ok: true, skipped: 'broadcast' })

  // Detect media kinds
  const isAudio =
    messageType === 'audioMessage' ||
    messageType === 'audio' ||
    (message && message.audioMessage ? true : false)
  const isImage =
    messageType === 'imageMessage' ||
    messageType === 'image' ||
    (message && message.imageMessage ? true : false)
  const isDocument =
    messageType === 'documentMessage' ||
    messageType === 'document' ||
    (message && message.documentMessage ? true : false)
  let isPdf = false
  if (isDocument && message.documentMessage) {
    const fn = (message.documentMessage.fileName || '').toString().toLowerCase()
    const mt = (message.documentMessage.mimetype || '').toString().toLowerCase()
    if (fn.endsWith('.pdf') || mt === 'application/pdf') isPdf = true
  }

  if (fromMe) {
    try {
      const c = $app.findFirstRecordByData('contacts', 'remote_jid', remoteJid)
      if (c) {
        c.set('last_message_from_me', true)
        c.set('status', 'responded')
        c.set(
          'last_message',
          text || (isAudio ? '🎤 Áudio' : isImage ? '📷 Foto' : isDocument ? '📄 Documento' : ''),
        )
        c.set('last_message_at', new Date().toISOString())
        $app.save(c)
      }
    } catch (_) {}
    return e.json(200, { ok: true, skipped: 'from_me' })
  }

  if (!text && !isAudio && !isImage && !isDocument)
    return e.json(200, { ok: true, skipped: 'no_text' })

  // ── Resolve integration (owner) ──
  let integ = null
  try {
    integ = $app.findFirstRecordByData('integrations', 'instance_name', instance)
  } catch (_) {}
  if (!integ) {
    let allIntegs = []
    try {
      allIntegs = $app.findRecordsByFilter(
        'integrations',
        "status = 'CONNECTED'",
        '-created',
        20,
        0,
      )
    } catch (_) {}
    if (allIntegs.length > 0) integ = allIntegs[0]
    if (!integ) return e.json(200, { ok: true, skipped: 'no_integration' })
  }
  const owner = integ.getString('owner')
  if (!owner) return e.json(200, { ok: true, skipped: 'no_owner' })

  let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
  const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
  const instanceName = integ.getString('instance_name')

  const phoneNumber = remoteJid.split('@')[0]
  const isLid = remoteJid.indexOf('@lid') >= 0

  // ── Upsert contact ──
  let contact = null
  try {
    contact = $app.findFirstRecordByData('contacts', 'remote_jid', remoteJid)
  } catch (_) {}
  if (!contact && !isLid) {
    try {
      contact = $app.findFirstRecordByData('contacts', 'whatsapp_id', phoneNumber)
    } catch (_) {}
  }

  const contactCol = $app.findCollectionByNameOrId('contacts')
  if (!contact) {
    contact = new Record(contactCol)
    contact.set('owner', owner)
    contact.set('remote_jid', remoteJid)
    contact.set('whatsapp_id', phoneNumber)
    contact.set('phone_number', phoneNumber)
    contact.set('name', pushName || phoneNumber)
    contact.set('push_name', pushName)
    contact.set('status', 'pending')
    contact.set('pipeline_stage', 'Em Conversa')
    contact.set('last_message_from_me', false)
  } else {
    contact.set('remote_jid', remoteJid)
    if (!contact.getString('whatsapp_id')) contact.set('whatsapp_id', phoneNumber)
    if (!contact.getString('phone_number')) contact.set('phone_number', phoneNumber)
    if (pushName && !contact.getString('push_name')) {
      contact.set('push_name', pushName)
      if (!contact.getString('name')) contact.set('name', pushName)
    }
  }
  contact.set('last_message_from_me', false)
  contact.set(
    'last_message',
    text ||
      (isAudio
        ? '🎤 Áudio'
        : isImage
          ? '📷 Foto'
          : isPdf
            ? '📄 PDF'
            : isDocument
              ? '📄 Documento'
              : ''),
  )
  contact.set('last_message_at', new Date().toISOString())
  if (contact.getString('status') !== 'responded') contact.set('status', 'pending')
  $app.save(contact)
  const contactId = contact.id

  // ── Resolve OpenAI key ──
  const apiKey = (() => {
    try {
      const cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', owner)
      const k = cfg.getString('openai_api_key')
      if (k) return k
    } catch (_) {}
    return $os.getenv('OPENAI_API_KEY') || $secrets.get('OPENAI_API_KEY') || ''
  })()
  if (!apiKey) {
    return e.json(200, { ok: true, skipped: 'no_openai_key' })
  }

  let cfg = null
  try {
    cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', owner)
  } catch (_) {}
  const model = (cfg && cfg.getString('gemini_model')) || 'gpt-4o-mini'
  let temperature = cfg && cfg.get('temperature')
  if (temperature === null || temperature === '' || typeof temperature !== 'number')
    temperature = 0.7
  let maxSeconds = cfg && cfg.get('max_response_seconds')
  if (!maxSeconds) maxSeconds = 30

  // ── Download media ──
  const downloadMedia = () => {
    if (!msgId || !evoUrl || !evoKey || !instanceName) return null
    if (!isAudio && !isImage && !isDocument) return null
    try {
      const res = $http.send({
        url: evoUrl + '/chat/getBase64FromMediaMessage/' + instanceName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          message: { key: { id: msgId } },
          convertToMp4: isAudio ? true : false,
        }),
        timeout: 40,
      })
      if (!res || !res.statusCode || res.statusCode >= 400) return null
      const j = res.json || {}
      const base64 = (j.base64 || (j.data && j.data.base64) || '').toString()
      if (!base64) return null
      let mt = (j.mimetype || (j.data && j.data.mimetype) || '').toString()
      let fn = (j.fileName || (j.data && j.data.fileName) || '').toString()
      if (!mt) mt = isAudio ? 'audio/mpeg' : isImage ? 'image/jpeg' : 'application/octet-stream'
      if (!fn) fn = isAudio ? 'audio.mp3' : isImage ? 'image.jpg' : 'document'
      return { base64: base64, mimetype: mt, filename: fn }
    } catch (err) {
      return null
    }
  }

  // ── Transcribe audio ──
  const transcribeAudio = (media) => {
    if (!media || !media.base64) return ''
    try {
      const fname = media.filename || 'audio.mp3'
      const charsB64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const cleanB64 = media.base64.replace(/[^A-Za-z0-9+/=]/g, '')
      const audioBytes = []
      for (let i = 0; i < cleanB64.length; i += 4) {
        const c1 = charsB64.indexOf(cleanB64.charAt(i))
        const c2 = charsB64.indexOf(cleanB64.charAt(i + 1))
        const c3 = charsB64.indexOf(cleanB64.charAt(i + 2))
        const c4 = charsB64.indexOf(cleanB64.charAt(i + 3))
        audioBytes.push((c1 << 2) | (c2 >> 4))
        if (c3 !== 64) audioBytes.push(((c2 & 15) << 4) | (c3 >> 2))
        if (c4 !== 64) audioBytes.push(((c3 & 3) << 6) | c4)
      }
      const formData = new FormData()
      formData.append('model', 'whisper-1')
      formData.append('language', 'pt')
      formData.append('file', $filesystem.fileFromBytes(audioBytes, fname))

      const res = $http.send({
        url: 'https://api.openai.com/v1/audio/transcriptions',
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey },
        body: formData,
        timeout: 60,
      })
      if (!res || !res.statusCode || res.statusCode >= 400) return ''
      const j = res.json || {}
      return (j.text || '').toString().trim()
    } catch (err) {
      return ''
    }
  }

  // ── Process media payload ──
  let userText = text
  let visionB64 = ''
  let visionMime = 'image/jpeg'

  if (isAudio) {
    const media = downloadMedia()
    const transcript = transcribeAudio(media)
    if (transcript) {
      userText = (text ? text + ' ' : '') + '[Áudio transcrito] ' + transcript
    } else {
      userText =
        text || 'Recebi um áudio seu, mas não consegui transcrever agora. Pode repetir por texto?'
    }
  } else if (isImage) {
    const media = downloadMedia()
    if (media && media.base64) {
      visionB64 = media.base64
      visionMime = media.mimetype || 'image/jpeg'
      if (!userText) userText = 'Recebi esta foto. Pode me ajudar?'
    } else {
      userText = text || 'Recebi sua foto, mas não consegui abri-la agora. Pode reenviar?'
    }
  } else if (isPdf) {
    userText = text || 'Recebi seu PDF. Em que posso te ajudar sobre ele?'
  } else if (isDocument) {
    userText = text || 'Recebi seu documento. Pode me dizer o que você precisa sobre ele?'
  }

  if (!userText) userText = 'Olá!'

  // ── Save user message ──
  try {
    const msgCol = $app.findCollectionByNameOrId('messages')
    const userMsg = new Record(msgCol)
    userMsg.set('contact', contactId)
    userMsg.set('content', userText)
    userMsg.set('role', 'user')
    userMsg.set('timestamp', new Date().toISOString())
    $app.save(userMsg)
  } catch (_) {}

  // ── Send WhatsApp Helper ──
  const sendWhatsAppMessage = (inst, rJid, msgTxt, apiKeyVal, apiBaseUrl) => {
    if (!rJid || !apiBaseUrl || !apiKeyVal || !inst) return null
    const cleanNum = rJid.replace('@s.whatsapp.net', '').replace('@lid', '')
    try {
      return $http.send({
        url: apiBaseUrl + '/message/sendText/' + inst,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKeyVal },
        body: JSON.stringify({ number: cleanNum, text: msgTxt }),
        timeout: 30,
      })
    } catch (_) {
      return null
    }
  }

  // ── Find / Match Patient ──
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  const last9 = digitsOnly.slice(-9)
  let patient = null
  try {
    const patients = $app.findRecordsByFilter('patients', '', '', 200, 0)
    for (const p of patients) {
      const pDigits = (p.getString('phone') || '').replace(/\D/g, '').slice(-9)
      if (pDigits === last9 && last9.length >= 9) {
        patient = p
        break
      }
    }
  } catch (_) {}

  if (patient) {
    contact.set('patient_id', patient.id)
    $app.save(contact)
  } else {
    // Auto lead creation with 3 messages limit
    try {
      const lead = new Record($app.findCollectionByNameOrId('patients'))
      if (owner) lead.set('owner', owner)
      lead.set('name', contact.getString('push_name') || 'Novo Lead')
      lead.set('phone', phoneNumber)
      lead.set('subscription_plan', 'free_trial')
      lead.set('status', 'trial')
      lead.set('message_count_used', 0)
      lead.set('message_count_limit', 3)
      lead.set('triaged', false)
      $app.save(lead)
      contact.set('patient_id', lead.id)
      $app.save(contact)
      patient = lead
    } catch (_) {}
  }

  // ── Check Message Limits & Reset Logic ──
  let planSlug = 'free_trial'
  let planBenefits = []
  if (patient) {
    planSlug = patient.getString('subscription_plan') || 'free_trial'
    const status = patient.getString('status') || 'trial'

    // Fetch plan from db for dynamic benefits & limits
    let planRec = null
    try {
      planRec = $app.findFirstRecordByData('subscription_plans', 'slug', planSlug)
      if (planRec) {
        const rawB = planRec.get('benefits')
        if (Array.isArray(rawB)) planBenefits = rawB
        else if (typeof rawB === 'string' && rawB) planBenefits = JSON.parse(rawB)
      }
    } catch (_) {}

    const isDaily = planSlug === 'monthly' || planSlug === 'quarterly'
    const limit =
      (planRec ? planRec.getInt('message_limit') : 0) ||
      (planSlug === 'free_trial'
        ? 3
        : planSlug === 'weekly'
          ? 15
          : planSlug === 'monthly'
            ? 25
            : 40)

    // Check daily reset for monthly/quarterly
    if (isDaily) {
      const resetDateStr = patient.getString('message_reset_date')
      const now = new Date()
      if (resetDateStr) {
        const resetDate = new Date(resetDateStr)
        const diffHours = (now.getTime() - resetDate.getTime()) / (1000 * 60 * 60)
        if (diffHours >= 24) {
          patient.set('message_count_used', 0)
          patient.set('message_reset_date', now.toISOString())
          $app.save(patient)
        }
      } else {
        patient.set('message_reset_date', now.toISOString())
        $app.save(patient)
      }
    }

    const currentUsed =
      typeof patient.get('message_count_used') === 'number' ? patient.get('message_count_used') : 0

    let blocked = false
    let blockMessage = ''

    if (planSlug === 'free_trial' && currentUsed >= limit) {
      blocked = true
      blockMessage =
        'Você usou suas 3 mensagens gratuitas do trial! 🎉 Para continuar recebendo orientações e ter acesso a receitas e marmitas, assine um plano: https://nutriresponde.goskip.app/#planos'
    } else if (planSlug === 'weekly' && currentUsed >= limit) {
      blocked = true
      blockMessage =
        'Você usou suas 15 mensagens do plano Semanal. Para continuar e desbloquear estratégias de marmitas, lista de compras e modo geladeira, faça upgrade para o plano Mensal! 🚀 https://nutriresponde.goskip.app/#planos'
    } else if (planSlug === 'monthly' && currentUsed >= limit) {
      blocked = true
      blockMessage =
        'Você já usou suas 25 mensagens de hoje. Elas renovam automaticamente amanhã! 💚'
    } else if (planSlug === 'quarterly' && currentUsed >= limit) {
      blocked = true
      blockMessage =
        'Você já usou suas 40 mensagens de hoje. Elas renovam automaticamente amanhã! 💚'
    } else if (status === 'expired' || status === 'cancelled') {
      blocked = true
      blockMessage =
        'Seu plano expirou! 😢 Renove agora para continuar seu acompanhamento com a Yasa: https://nutriresponde.goskip.app/#planos'
    }

    if (blocked) {
      try {
        const msgCol = $app.findCollectionByNameOrId('messages')
        const aiMsg = new Record(msgCol)
        aiMsg.set('contact', contactId)
        aiMsg.set('content', blockMessage)
        aiMsg.set('role', 'assistant')
        aiMsg.set('timestamp', new Date().toISOString())
        $app.save(aiMsg)
        contact.set('last_message', blockMessage)
        contact.set('status', 'responded')
        contact.set('last_message_from_me', true)
        contact.set('last_message_at', new Date().toISOString())
        $app.save(contact)
      } catch (_) {}

      sendWhatsAppMessage(instanceName, remoteJid, blockMessage, evoKey, evoUrl)
      return e.json(200, { ok: true, skipped: 'patient_blocked', contact_id: contactId })
    }
  }

  // ── Helper parsing routines for triage ──
  const parseWeight = (raw) => {
    if (!raw) return null
    const cleaned = raw.replace(',', '.').replace(/[^\d.]/g, '')
    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    if (num >= 30 && num <= 300) return num
    return null
  }

  const parseHeight = (raw) => {
    if (!raw) return null
    let str = raw.trim().replace(',', '.')
    let num = parseFloat(str.replace(/[^\d.]/g, ''))
    if (isNaN(num)) return null
    if (num >= 100 && num <= 250) {
      return Math.round(num)
    }
    if (num >= 1.0 && num <= 2.5) {
      return Math.round(num * 100)
    }
    return null
  }

  const parseObjective = (raw) => {
    if (!raw) return ''
    const trimmed = raw.trim()
    const lower = trimmed.toLowerCase()
    if (
      lower === '1' ||
      lower.includes('emagrecimento') ||
      lower.includes('emagrecer') ||
      lower.includes('perder peso')
    ) {
      return 'Emagrecimento'
    }
    if (
      lower === '2' ||
      lower.includes('hipertrofia') ||
      lower.includes('massa muscular') ||
      lower.includes('ganhar massa')
    ) {
      return 'Hipertrofia'
    }
    if (
      lower === '3' ||
      lower.includes('saúde feminina') ||
      lower.includes('saude feminina') ||
      lower.includes('hormonal') ||
      lower.includes('endometriose') ||
      lower.includes('menopausa') ||
      lower.includes('lipedema') ||
      lower.includes('sop')
    ) {
      return 'Saúde feminina'
    }
    if (
      lower === '4' ||
      lower.includes('diabetes') ||
      lower.includes('glicemia') ||
      lower.includes('insulina')
    ) {
      return 'Diabetes'
    }
    if (lower.startsWith('5') || lower === '5') {
      const rest = trimmed.replace(/^[5️⃣5\s:.-]+/i, '').trim()
      return rest || 'Outro objetivo de saúde'
    }
    return trimmed
  }

  const parseListItems = (raw) => {
    if (!raw) return []
    const trimmed = raw.trim()
    const lower = trimmed.toLowerCase()
    if (
      lower === 'nenhuma' ||
      lower === 'nenhum' ||
      lower === 'não' ||
      lower === 'nao' ||
      lower === 'nada' ||
      lower === 'não tenho' ||
      lower === 'nao tenho' ||
      lower === 'sem' ||
      lower === 'n' ||
      lower === '0'
    ) {
      return []
    }
    const split = trimmed
      .split(/[,;\n\/|]|\be\b|\bou\b/i)
      .map((s) =>
        s
          .trim()
          .replace(/^[•\-\*\s]+/, '')
          .trim(),
      )
      .filter((s) => s.length > 1 && !/^(e|ou|nao|não|nenhuma|nenhum|nada)$/i.test(s))
    return split
  }

  // ── FRENTE 2: MANDATORY TRIAGE WORKFLOW ──
  const isPatientTriaged = patient ? patient.getBool('triaged') === true : false

  if (patient && !isPatientTriaged) {
    // Determine current triage step based on stored fields
    const curWeight = patient.get('weight_kg')
    const curHeight = patient.get('height_cm')
    const curGoal = patient.getString('nutritional_goal')
    const curIntol = patient.get('intolerances')
    const curCond = patient.get('health_conditions')

    const hasWeight =
      curWeight !== null && curWeight !== '' && typeof curWeight === 'number' && curWeight >= 30
    const hasHeight =
      curHeight !== null && curHeight !== '' && typeof curHeight === 'number' && curHeight >= 100
    const hasGoal = !!(curGoal && curGoal.trim().length > 0)
    const hasIntol =
      curIntol !== null &&
      curIntol !== undefined &&
      (Array.isArray(curIntol) ||
        curIntol === '[]' ||
        (typeof curIntol === 'string' && curIntol.length > 0))
    const hasCond =
      curCond !== null &&
      curCond !== undefined &&
      (Array.isArray(curCond) ||
        curCond === '[]' ||
        (typeof curCond === 'string' && curCond.length > 0))

    const isFirstContact = !hasWeight && !hasHeight && !hasGoal && !hasIntol && !hasCond

    let triageReply = ''
    let triageCompleted = false
    let currentStep = 'weight' // 'weight' | 'height' | 'goal' | 'intolerances' | 'conditions'

    if (isFirstContact) {
      currentStep = 'weight'
    } else if (!hasWeight) {
      currentStep = 'weight'
    } else if (!hasHeight) {
      currentStep = 'height'
    } else if (!hasGoal) {
      currentStep = 'goal'
    } else if (!hasIntol) {
      currentStep = 'intolerances'
    } else if (!hasCond) {
      currentStep = 'conditions'
    }

    const patientName = patient.getString('name') || contact.getString('push_name') || 'paciente'

    if (currentStep === 'weight') {
      if (isFirstContact) {
        // Welcome message + ask weight
        triageReply =
          `Olá, ${patientName}! 💚 Sou a Yasa, sua assistente nutricional oficial do Dr. Caio Cândido.\n\n` +
          `Para que todas as minhas recomendações sejam 100% personalizadas sob medida para você, vamos fazer uma triagem rápida de 5 perguntinhas!\n\n` +
          `1️⃣ Qual o seu *peso atual*? (ex: 72 kg)`
      } else {
        const val = parseWeight(userText)
        if (val) {
          patient.set('weight_kg', val)
          $app.save(patient)
          triageReply = `Perfeito, ${val} kg anotado! ✍️\n\n2️⃣ E qual a sua *altura*? (ex: 1,65 m ou 165 cm)`
        } else {
          triageReply = `Por favor, informe um peso válido entre 30 e 300 kg (ex: 72 kg ou 68.5) para continuarmos nossa triagem! ⚖️`
        }
      }
    } else if (currentStep === 'height') {
      const val = parseHeight(userText)
      if (val) {
        patient.set('height_cm', val)
        $app.save(patient)
        const heightM = (val / 100).toFixed(2).replace('.', ',')
        triageReply =
          `Ótimo, altura ${heightM} m registrada! 📏\n\n` +
          `3️⃣ Qual é o seu *principal objetivo*?\n` +
          `1️⃣ Emagrecimento\n` +
          `2️⃣ Hipertrofia (ganho de massa muscular)\n` +
          `3️⃣ Saúde feminina (menopausa, SOP, lipedema, etc.)\n` +
          `4️⃣ Diabetes / Controle de glicemia\n` +
          `5️⃣ Outro (pode me contar em detalhes!)`
      } else {
        triageReply = `Por favor, informe uma altura válida entre 1,00 m e 2,50 m (ex: 1,65 m ou 165) para continuarmos! 📏`
      }
    } else if (currentStep === 'goal') {
      const obj = parseObjective(userText)
      if (obj) {
        patient.set('nutritional_goal', obj)
        $app.save(patient)
        triageReply =
          `Excelente foco em *${obj}*! 🎯\n\n` +
          `4️⃣ Você tem alguma *intolerância ou alergia alimentar*?\n` +
          `(Ex: lactose, glúten, ovo, amendoim, frutos do mar... Se não tiver nenhuma, responda apenas *nenhuma*).`
      } else {
        triageReply = `Por favor, escolha uma das opções (1 a 5) ou digite seu objetivo nutricional para continuarmos! 🎯`
      }
    } else if (currentStep === 'intolerances') {
      const list = parseListItems(userText)
      patient.set('intolerances', list)
      $app.save(patient)
      const formatted = list.length > 0 ? list.join(', ') : 'nenhuma'
      triageReply =
        `Anotado (intolerâncias: ${formatted})! 📋\n\n` +
        `5️⃣ Por último: você tem alguma *condição de saúde* que eu deva saber?\n` +
        `(Ex: diabetes, hipertensão, hipotireoidismo, gastrite, colesterol alto, SOP... Se não tiver, responda apenas *nenhuma*).`
    } else if (currentStep === 'conditions') {
      const list = parseListItems(userText)
      patient.set('health_conditions', list)
      patient.set('triaged', true)
      patient.set('triaged_at', new Date().toISOString())
      $app.save(patient)
      triageCompleted = true

      triageReply =
        `Perfeito! 🎉 Triagem concluída com sucesso.\n\n` +
        `Agora cada recomendação, cálculo e orientação será feita sob medida pra você, ${patientName} 💚\n\n` +
        `O que você gostaria de saber ou como posso te ajudar hoje?`
    }

    // Persist assistant triage reply in messages
    try {
      const msgCol = $app.findCollectionByNameOrId('messages')
      const aiMsg = new Record(msgCol)
      aiMsg.set('contact', contactId)
      aiMsg.set('content', triageReply)
      aiMsg.set('role', 'assistant')
      aiMsg.set('timestamp', new Date().toISOString())
      aiMsg.set('needs_human', false)
      aiMsg.set('ai_response_seconds', 0)
      $app.save(aiMsg)

      contact.set('last_message', triageReply)
      contact.set('status', 'responded')
      contact.set('last_message_from_me', true)
      contact.set('last_message_at', new Date().toISOString())
      $app.save(contact)
    } catch (_) {}

    // Increment message count used
    try {
      const cur = patient.get('message_count_used') || 0
      patient.set('message_count_used', cur + 1)
      $app.save(patient)
    } catch (_) {}

    // Send to WhatsApp via Evolution
    if (!isLid && evoUrl && evoKey && instanceName) {
      sendWhatsAppMessage(instanceName, remoteJid, triageReply, evoKey, evoUrl)
    }

    return e.json(200, {
      ok: true,
      triage: true,
      triage_completed: triageCompleted,
      contact_id: contactId,
    })
  }

  // ── Plan Permissions (Post-Triage) ──
  const isFreeTrial = planSlug === 'free_trial'
  const isWeekly = planSlug === 'weekly'
  const isMonthlyOrAbove = planSlug === 'monthly' || planSlug === 'quarterly'
  const isQuarterly = planSlug === 'quarterly'

  const allowsAnyRecipes = isWeekly || isMonthlyOrAbove
  const allowsOnlySnackRecipes = isWeekly
  const allowsFullRecipesAndMeals = isMonthlyOrAbove
  const allowsSmartListAndFridge = isMonthlyOrAbove

  // ── Build system prompt with Patient Profile (Frente 3) and Anti-Sharing Protection (Frente 4) ──
  const systemPrompt = (() => {
    const patientName =
      (patient && patient.getString('name')) || contact.getString('push_name') || 'paciente'

    const base =
      'Você é a Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
      '═══ IDENTIDADE ═══\n' +
      'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
      'Papel: atender dúvidas nutricionais de pacientes, orientar sobre alimentação saudável e tirar dúvidas.\n' +
      'Especialidade: nutrição clínica, dietética, gastronomia saudável, alergias, diabetes, colesterol, hipertensão e saúde feminina (endometriose, menopausa, lipedema, SOP).\n' +
      'Tom: profissional, acolhedor, informal leve — próximo e humano.\n\n' +
      '═══ FORMATAÇÃO DA RESPOSTA (MUITO IMPORTANTE) ═══\n' +
      'Sempre responda em português do Brasil, com formatação rica e bonita no WhatsApp:\n' +
      '- Use emojis com moderação e propósito (🥗 🍎 💧 ✅ 💡 🤗), no início das seções.\n' +
      '- Separe em seções claras com uma linha em branco entre elas.\n' +
      '- Estrutura sugerida: saudação curta → resposta principal → dica extra → encerramento acolhedor.\n' +
      '- Use QUEBRAS DE LINHA entre os passos.\n' +
      '- Frases curtas e diretas. Nunca um bloco gigante de texto corrido.\n' +
      '- Máximo ~250 palavras por resposta.\n\n' +
      '═══ REGRAS DE SEGURANÇA ═══\n' +
      '- NUNCA diagnosticar doenças nem prescrever remédios.\n' +
      '- Fora do escopo de nutrição → encaminhe ao Dr. Caio.\n\n'

    // ── FRENTE 4: PROTEÇÃO ANTI-COMPARTILHAMENTO ──
    const antiSharingSection =
      '🚨 PROTEÇÃO DE ATENDIMENTO INDIVIDUAL:\n' +
      `Este paciente (${patientName}) é o ÚNICO que você atende neste número de WhatsApp.\n` +
      'Se o paciente perguntar algo PARA OUTRA PESSOA (ex: "meu marido quer saber...", "minha filha pode comer...", "meu amigo...", "minha mãe..."), você DEVE:\n' +
      `1. Educar gentilmente: "Entendo, ${patientName}! Mas meu atendimento é 100% personalizado para você. Se seu familiar/amigo quiser acompanhamento, pode criar o plano em https://nutriresponde.goskip.app/#planos."\n` +
      '2. Redirecionar para o próprio plano do paciente: "Vamos focar em você! 💚"\n' +
      '3. JAMAIS responder a pergunta sobre a outra pessoa.\n\n'

    // ── FRENTE 3: PERFIL DO PACIENTE (Se triaged === true) ──
    let patientProfileSection = ''
    if (patient && patient.getBool('triaged') === true) {
      const weight = patient.get('weight_kg') || null
      const height = patient.get('height_cm') || null
      const goal = patient.getString('nutritional_goal') || 'Saúde geral'
      const dietary = patient.getString('dietary_preference') || 'Onívoro'

      let rawIntol = patient.get('intolerances')
      let intolerancesArr = []
      if (Array.isArray(rawIntol)) intolerancesArr = rawIntol
      else if (typeof rawIntol === 'string' && rawIntol) {
        try {
          intolerancesArr = JSON.parse(rawIntol)
        } catch (_) {
          intolerancesArr = [rawIntol]
        }
      }

      let rawCond = patient.get('health_conditions')
      let conditionsArr = []
      if (Array.isArray(rawCond)) conditionsArr = rawCond
      else if (typeof rawCond === 'string' && rawCond) {
        try {
          conditionsArr = JSON.parse(rawCond)
        } catch (_) {
          conditionsArr = [rawCond]
        }
      }

      let imcStr = 'Não calculado'
      if (weight && height && height > 0) {
        const heightM = height / 100
        const imcVal = (weight / (heightM * heightM)).toFixed(1)
        imcStr = `${imcVal}`
      }

      const intolStr = intolerancesArr.length > 0 ? intolerancesArr.join(', ') : 'Nenhuma relatada'
      const condStr = conditionsArr.length > 0 ? conditionsArr.join(', ') : 'Nenhuma relatada'

      patientProfileSection =
        '═══ PERFIL DO PACIENTE (PERSONALIZAÇÃO OBRIGATÓRIA) ═══\n' +
        `- Nome: ${patientName}\n` +
        `- Peso: ${weight ? weight + ' kg' : 'Não informado'}\n` +
        `- Altura: ${height ? height + ' cm' : 'Não informada'}${height && weight ? ' → IMC: ' + imcStr : ''}\n` +
        `- Objetivo: ${goal}\n` +
        `- Intolerâncias / Alergias: ${intolStr}\n` +
        `- Condições de saúde: ${condStr}\n` +
        `- Preferência alimentar: ${dietary}\n\n` +
        '⚠️ REGRAS DE PERSONALIZAÇÃO:\n' +
        '- JAMAIS recomende alimentos que contenham as intolerâncias do paciente.\n' +
        '- Adapte toda receita ou orientação às intolerâncias listadas.\n' +
        '- Considere o objetivo (emagrecimento = foco em déficit calórico e saciedade, hipertrofia = superávit proteico e densidade nutricional).\n' +
        '- Se o paciente tem diabetes ou glicemia alta: evite carboidratos simples, priorize baixo índice glicêmico e fibras.\n' +
        '- Se o paciente tem hipertensão: atenção redobrada ao sódio e alimentos ultraprocessados.\n' +
        '- Se o paciente tem problemas tireoidianos / saúde feminina: priorize micronutrientes anti-inflamatórios e antioxidantes.\n\n'
    }

    let planRules = '═══ CONTROLE DE ACESSO E REGRAS DO PLANO ATIVO DO PACIENTE ═══\n'
    planRules += `Plano atual do paciente: ${planSlug.toUpperCase()}\n`
    if (planBenefits.length > 0) {
      planRules +=
        `Benefícios cadastrados:\n` + planBenefits.map((b) => `• ${b}`).join('\n') + '\n\n'
    }

    if (isFreeTrial) {
      planRules +=
        '⚠️ RESTRIÇÕES DO PLANO FREE TRIAL (3 MENSAGENS):\n' +
        '- O paciente é FREE TRIAL. Ele tem direito APENAS a orientação nutricional básica e dúvidas gerais de alimentação.\n' +
        '- ❌ NÃO PODE receber receitas de nenhum tipo (nem lanches, nem pratos principais).\n' +
        '- ❌ NÃO PODE receber estratégias de marmitas, planejamento semanal de refeições, lista de compras ou modo geladeira.\n' +
        '- SE O PACIENTE PEDIR RECEITA OU ESTRATÉGIA DE MARMITAS/CARDÁPIO COMPLETO, RESPONDA EXATAMENTE OU MUITO PRÓXIMO: ' +
        '"As receitas completas e estratégias de marmitas estão disponíveis a partir do plano Semanal! 😊 Quer fazer o upgrade?"\n' +
        '- Se pedir lista de compras ou geladeira inteligente, informe que são recursos a partir do plano Mensal.\n\n'
    } else if (isWeekly) {
      planRules +=
        '⚠️ REGRAS DO PLANO SEMANAL (15 MENSAGENS):\n' +
        '- O paciente tem direito a orientação nutricional e ✅ RECEITAS DE LANCHES (ex.: panqueca fit, cookie de banana, bolo de caneca low carb, vitaminas, snacks saudáveis).\n' +
        '- ❌ NÃO PODE receber estratégias de marmitas (meal prep para a semana), montagem de planos/cardápios semanais completos, lista de compras inteligente nem modo geladeira.\n' +
        '- SE O PACIENTE PEDIR ESTRATÉGIA DE MARMITAS, PLANO SEMANAL DE REFEIÇÕES OU ORGANIZAÇÃO DA SEMANA, RESPONDA: ' +
        '"As estratégias de marmitas e planos semanais estão disponíveis a partir do plano Mensal! 🍱 Quer fazer o upgrade?"\n' +
        '- Se pedir lista de compras ou modo geladeira: "A lista de compras inteligente e o modo geladeira estão disponíveis no plano Mensal! 🛒 Quer fazer o upgrade?"\n\n'
    } else if (isMonthlyOrAbove) {
      planRules +=
        '✨ REGRAS DO PLANO ' +
        (isQuarterly ? 'TRIMESTRAL (PREMIUM)' : 'MENSAL (COMPLETO)') +
        ':\n' +
        '- ✅ TUDO LIBERADO: orientação nutricional, receitas, estratégia de marmitas, organização de refeições semanais, lista de compras inteligente e modo geladeira inteligente.\n' +
        (isQuarterly ? '- ✅ Atendimento prioritário e acompanhamento premium.\n\n' : '\n')
    }

    let extra = ''
    if (cfg) {
      const guide = cfg.getString('general_guidelines')
      if (guide) extra += 'Orientações fixas do Dr. Caio: ' + guide + '\n'
    }

    // Include recipes if plan permits
    if (allowsAnyRecipes) {
      let recs = []
      try {
        recs = $app.findRecordsByFilter('recipes', 'owner = {:uid}', '-created', 50, 0, {
          uid: owner,
        })
      } catch (_) {}
      const activeRecs = []
      for (const r of recs) {
        if (r.getBool('is_active') === false) continue
        const ct = r.getString('content_text')
        if (!ct) continue
        const title = r.getString('title') || ''
        if (allowsOnlySnackRecipes) {
          const lower = (title + ' ' + ct).toLowerCase()
          const isSnack =
            lower.includes('lanche') ||
            lower.includes('panqueca') ||
            lower.includes('cookie') ||
            lower.includes('bolo') ||
            lower.includes('snack') ||
            lower.includes('shake') ||
            lower.includes('vitamina') ||
            lower.includes('suco') ||
            lower.includes('crepioca')
          if (isSnack) activeRecs.push('— Receita de Lanche: ' + title + '\n' + ct)
        } else {
          activeRecs.push('— Receita: ' + title + '\n' + ct)
        }
      }
      if (activeRecs.length > 0) {
        extra += '\n═══ BIBLIOTECA DE RECEITAS DO DR. CAIO ═══\n' + activeRecs.join('\n\n')
      }
    }

    // Include meal plan templates if Monthly+
    if (allowsFullRecipesAndMeals) {
      let tpls = []
      try {
        tpls = $app.findRecordsByFilter(
          'meal_plan_templates',
          'owner = {:uid}',
          '-created',
          20,
          0,
          { uid: owner },
        )
      } catch (_) {}
      const activeTpls = []
      for (const tp of tpls) {
        if (tp.getBool('is_active') === false) continue
        const ct = tp.getString('content_text')
        if (!ct) continue
        activeTpls.push('— Modelo de plano: ' + tp.getString('title') + '\n' + ct)
      }
      if (activeTpls.length > 0) {
        extra += '\n═══ MODELOS DE PLANOS ALIMENTARES E MARMITAS ═══\n' + activeTpls.join('\n\n')
      }
    }

    if (allowsSmartListAndFridge) {
      extra +=
        '\n\n═══ CAPACIDADES ESPECIAIS (PLANO MENSAL / TRIMESTRAL) ═══\n' +
        '——— 1) LISTA DE COMPRAS INTELIGENTE ———\n' +
        'Organize por seções com emojis: 🥩 Carnes, 🥬 Hortifruti, 🥛 Laticínios, 🌾 Grãos, 🧂 Temperos, 🛒 Outros. Inclua orçamento estimado.\n\n' +
        '——— 2) MODO GELADEIRA INTELIGENTE ———\n' +
        'Sugira preparações práticas com os ingredientes disponíveis.\n'
    }

    return base + antiSharingSection + patientProfileSection + planRules + extra
  })()

  // ── Conversation history ──
  const history = (() => {
    const out = []
    try {
      const msgs = $app.findRecordsByFilter('messages', 'contact = {:cid}', '-created', 12, 0, {
        cid: contactId,
      })
      const ordered = []
      for (let i = msgs.length - 1; i >= 0; i--) ordered.push(msgs[i])
      for (const m of ordered) {
        const role = m.getString('role')
        const content = m.getString('content')
        if (!content) continue
        if (role === 'user') out.push({ role: 'user', content: content })
        else if (role === 'assistant') out.push({ role: 'assistant', content: content })
      }
    } catch (_) {}
    return out
  })()

  const buildMessages = () => {
    const msgs = [{ role: 'system', content: systemPrompt }]
    for (const h of history) msgs.push({ role: h.role, content: h.content })
    if (visionB64) {
      const cleaned =
        visionB64.indexOf(',') >= 0 ? visionB64.split(',').slice(1).join(',') : visionB64
      const dataUrl = 'data:' + visionMime + ';base64,' + cleaned
      msgs.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: userText },
        ],
      })
    } else {
      msgs.push({ role: 'user', content: userText })
    }
    return msgs
  }

  const effectiveModel = visionB64 ? 'gpt-4o' : model

  const callOpenAI = (modelName) => {
    return $http.send({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: modelName,
        messages: buildMessages(),
        temperature: temperature,
        max_tokens: 1024,
      }),
      timeout: maxSeconds,
    })
  }

  const startedAt = Date.now()
  let res = null
  let usedModel = effectiveModel
  try {
    res = callOpenAI(effectiveModel)
  } catch (err) {
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
    } catch (_) {
      return e.json(200, { ok: true, skipped: 'openai_failed' })
    }
  }

  if (!res || !res.statusCode || res.statusCode >= 400) {
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
    } catch (_) {
      return e.json(200, { ok: true, skipped: 'openai_http_error' })
    }
  }

  let content = ''
  let needsHuman = false
  try {
    const json = res.json
    const choices = json && json.choices ? json.choices : []
    if (choices.length > 0) {
      const c = choices[0]
      if (c.message && c.message.content) content = c.message.content
    }
  } catch (_) {}

  if (!content) {
    content =
      'Olá! Tive dificuldade para processar sua mensagem agora. Pode repetir, por favor? Se preferir, o Dr. Caio também pode te ajudar pessoalmente.'
    needsHuman = true
  }

  if (
    content.indexOf('Dr. Caio') >= 0 &&
    (content.indexOf('encaminhar') >= 0 ||
      content.indexOf('encaminh') >= 0 ||
      content.indexOf('avaliação') >= 0 ||
      content.indexOf('pessoalmente') >= 0)
  ) {
    needsHuman = true
  }

  const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000))

  // ── Extract any "send document" instruction ──
  let sendDocCollection = ''
  let sendDocId = ''
  const docMatch = content.match(/ENVIAR_DOCUMENTO:\s*([a-zA-Z_]+)\|([a-zA-Z0-9]+)/)
  if (docMatch) {
    sendDocCollection = docMatch[1]
    sendDocId = docMatch[2]
    content = content
      .replace(/ENVIAR_DOCUMENTO:[^\n]*/g, '')
      .replace(/\s+$/, '')
      .trim()
  }

  // ── Persist assistant reply ──
  try {
    const msgCol = $app.findCollectionByNameOrId('messages')
    const aiMsg = new Record(msgCol)
    aiMsg.set('contact', contactId)
    aiMsg.set('content', content)
    aiMsg.set('role', 'assistant')
    aiMsg.set('timestamp', new Date().toISOString())
    aiMsg.set('needs_human', needsHuman)
    aiMsg.set('ai_response_seconds', elapsed)
    $app.save(aiMsg)

    try {
      contact.set('last_message', content)
      contact.set('status', 'responded')
      contact.set('last_message_from_me', true)
      contact.set('last_message_at', new Date().toISOString())
      $app.save(contact)
    } catch (_) {}
  } catch (_) {}

  // ── Increment message counter ──
  if (patient) {
    try {
      const cur = patient.get('message_count_used') || 0
      patient.set('message_count_used', cur + 1)
      $app.save(patient)
    } catch (_) {}
  }

  // ── Send via Evolution ──
  if (!isLid && evoUrl && evoKey && instanceName) {
    let matchedRecipeImageUrl = ''
    if (allowsAnyRecipes) {
      try {
        const checkText = ((userText || '') + ' ' + (content || '')).toLowerCase()
        const isRecipeQuery =
          checkText.indexOf('receita') >= 0 ||
          checkText.indexOf('como fazer') >= 0 ||
          checkText.indexOf('lanche') >= 0 ||
          checkText.indexOf('panqueca') >= 0

        if (isRecipeQuery) {
          const recipeMats = $app.findRecordsByFilter(
            'agent_materials',
            'type = "recipe" && image_url != ""',
            '-created',
            50,
            0,
          )
          for (const rm of recipeMats) {
            const rTitle = (rm.getString('title') || '').toLowerCase()
            const keywords = rTitle
              .split(/[\s,_\-—]+/)
              .filter((k) => k.length > 3 && k !== 'receita' && k !== 'dr.' && k !== 'caio')
            let matchCount = 0
            for (const kw of keywords) {
              if (checkText.indexOf(kw) >= 0) matchCount++
            }
            if (matchCount >= 1) {
              matchedRecipeImageUrl = rm.getString('image_url')
              break
            }
          }
        }
      } catch (_) {}
    }

    if (matchedRecipeImageUrl) {
      try {
        $http.send({
          url: evoUrl + '/message/sendMedia/' + instanceName,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({
            number: phoneNumber,
            mediatype: 'image',
            mimetype: 'image/jpeg',
            media: matchedRecipeImageUrl,
            caption: '',
          }),
          timeout: 45,
        })
      } catch (_) {}
    }

    try {
      $http.send({
        url: evoUrl + '/message/sendText/' + instanceName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          number: phoneNumber,
          text: content,
        }),
        timeout: 30,
      })
    } catch (_) {}
  }

  return e.json(200, {
    ok: true,
    contact_id: contactId,
    needs_human: needsHuman,
    model: usedModel,
  })
})
