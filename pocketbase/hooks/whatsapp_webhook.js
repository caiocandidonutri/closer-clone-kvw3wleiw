/// <reference path="../pb_data/types.d.ts" />
// Evolution API v2 webhook receiver.
//
// Evolution posts two kinds of events here (configured in whatsapp_connect.js):
//   - MESSAGES_UPSERT   → a message was received or sent
//   - CONNECTION_UPDATE → instance connected/disconnected
//
// For every inbound (fromMe=false) text message we:
//   1. upsert the contact (remoteJid + pushName + profile pic)
//   2. persist the inbound user message
//   3. call Yasa (OpenAI gpt-4o) with the full nutrition prompt + history
//   4. persist the assistant reply
//   5. send the reply back to the contact through Evolution sendText
// All realtime happens for free: PocketBase fires record events on save and
// the frontend useRealtime('contacts' | 'messages') picks them up.

routerAdd('POST', '/backend/v1/webhook/evolution', (e) => {
  const raw = e.requestInfo().body
  const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}

  const event = (body.event || '').toString().toUpperCase()
  const instance = (body.instance || '').toString()
  const data = body.data || {}

  // ── CONNECTION_UPDATE: sync integration status ──
  if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
    const state = (data.state || '').toString()
    try {
      const integ = $app.findFirstRecordByData('integrations', 'instance_name', instance)
      if (integ) {
        if (state === 'open') integ.set('status', 'CONNECTED')
        else if (state === 'close' || state === 'closed' || state === 'connecting')
          integ.set('status', state === 'connecting' ? 'WAITING_QR' : 'DISCONNECTED')
        $app.save(integ)
      }
    } catch (_) {}
    return e.json(200, { ok: true })
  }

  // ── MESSAGES_UPSERT: incoming/outgoing message ──
  if (event !== 'MESSAGES_UPSERT' && event !== 'messages.upsert') {
    return e.json(200, { ok: true, skipped: 'unhandled_event' })
  }

  const key = data.key || {}
  const remoteJid = (key.remoteJid || '').toString()
  const fromMe = key.fromMe === true
  const msgId = (key.id || '').toString()
  const pushName = (data.pushName || '').toString()
  const message = data.message || {}
  const messageType = (data.messageType || '').toString()

  // Extract the plain text body from any of the shapes Evolution/whatsapp-web.js uses.
  const extractText = (m) => {
    if (!m) return ''
    if (typeof m === 'string') return m
    if (m.conversation) return m.conversation
    if (m.extendedTextMessage && m.extendedTextMessage.text) return m.extendedTextMessage.text
    if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption
    if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption
    if (m.buttonsResponseMessage && m.buttonsResponseMessage.selectedButtonId)
      return m.buttonsResponseMessage.selectedButtonId
    if (m.templateMessage) return ''
    return ''
  }
  const text = extractText(message).trim()

  // Ignore status broadcasts, empty messages, and our own outgoing echoes.
  if (!remoteJid) return e.json(200, { ok: true, skipped: 'no_remote_jid' })
  if (remoteJid.indexOf('status@') === 0 || remoteJid.indexOf('broadcast@') === 0)
    return e.json(200, { ok: true, skipped: 'broadcast' })
  if (fromMe) {
    // Outgoing message sent from the phone itself — mark contact as responded.
    try {
      const c = $app.findFirstRecordByData('contacts', 'remote_jid', remoteJid)
      if (c) {
        c.set('last_message_from_me', true)
        c.set('status', 'responded')
        c.set('last_message', text || '📷 Mídia')
        c.set('last_message_at', new Date().toISOString())
        $app.save(c)
      }
    } catch (_) {}
    return e.json(200, { ok: true, skipped: 'from_me' })
  }
  // For now only handle text/conversation/extendedText. Media (photos) is logged.
  const isImage =
    messageType === 'imageMessage' ||
    (message && message.imageMessage && message.imageMessage.url) ||
    (message && message.imageMessage && message.imageMessage.jpegThumbnail)
  if (!text && !isImage) return e.json(200, { ok: true, skipped: 'no_text' })

  // ── Resolve the integration (owner) for this instance ──
  let integ = null
  try {
    integ = $app.findFirstRecordByData('integrations', 'instance_name', instance)
  } catch (_) {}
  if (!integ) {
    return e.json(200, { ok: true, skipped: 'no_integration' })
  }
  const owner = integ.getString('owner')
  if (!owner) return e.json(200, { ok: true, skipped: 'no_owner' })

  let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
  const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
  const instanceName = integ.getString('instance_name')

  // Extract phone number from remoteJid (strip @s.whatsapp.net / @lid).
  const phoneNumber = remoteJid.split('@')[0]
  // For lid-style jids we cannot reach the user back; keep the jid as the id.
  const isLid = remoteJid.indexOf('@lid') >= 0

  // ── Upsert contact ──
  let contact = null
  try {
    contact = $app.findFirstRecordByData('contacts', 'remote_jid', remoteJid)
  } catch (_) {}
  if (!contact) {
    // also try matching by whatsapp_id (phone) in case synced before remote_jid existed
    if (!isLid) {
      try {
        contact = $app.findFirstRecordByData('contacts', 'whatsapp_id', phoneNumber)
      } catch (_) {}
    }
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
  contact.set('last_message', text || (isImage ? '📷 Foto do plano alimentar' : ''))
  contact.set('last_message_at', new Date().toISOString())
  if (contact.getString('status') !== 'responded') contact.set('status', 'pending')
  $app.save(contact)
  const contactId = contact.id

  // Try to fetch profile picture (best-effort, non-blocking).
  if (!contact.getString('profile_picture_url') && !isLid && evoUrl && evoKey) {
    try {
      const picRes = $http.send({
        url: evoUrl + '/chat/fetchProfilePictureUrl/' + instanceName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ number: phoneNumber }),
        timeout: 10,
      })
      if (picRes.statusCode === 200 && picRes.body) {
        let picUrl = ''
        try {
          const j = picRes.json
          picUrl = (j && (j.profilePictureUrl || j.url || (j.data && j.data.url))) || ''
        } catch (_) {
          const raw = picRes.body.toString().replace(/"/g, '')
          if (raw.indexOf('http') === 0) picUrl = raw
        }
        if (picUrl) {
          contact.set('profile_picture_url', picUrl)
          if (!contact.getString('avatar_url')) contact.set('avatar_url', picUrl)
          $app.save(contact)
        }
      }
    } catch (_) {}
  }

  // ── Persist the inbound user message ──
  const inboundContent = text || (isImage ? '📷 Foto do plano alimentar' : '')
  try {
    const msgCol = $app.findCollectionByNameOrId('messages')
    const userMsg = new Record(msgCol)
    userMsg.set('contact', contactId)
    userMsg.set('content', inboundContent)
    userMsg.set('role', 'user')
    userMsg.set('timestamp', new Date().toISOString())
    $app.save(userMsg)
  } catch (_) {}

  // ── Resolve OpenAI key (per-user → shared secret) ──
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

  // ── Resolve runtime config ──
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

  // ── Build the nutrition system prompt (kept in sync with yasa_chat.js) ──
  const systemPrompt = (() => {
    const base =
      'Você é Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
      '═══ IDENTIDADE ═══\n' +
      'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
      'Papel: atender dúvidas nutricionais de pacientes, orientar sobre alimentação, refeições, lanches, receitas e trocas no plano alimentar.\n' +
      'Especialidade: nutrição clínica, dietética, gastronomia, alergias e intolerâncias alimentares, diabetes, colesterol, hipertensão e saúde feminina (endometriose, menopausa, lipedema, questões hormonais).\n' +
      'Tom: profissional, acolhedor, informal leve — próximo e humano.\n\n' +
      '═══ FLUXO DE RESPOSTA ═══\n' +
      '1. Cumprimente o paciente pelo nome.\n' +
      '2. Apresente-se como assistente nutricional do Dr. Caio.\n' +
      '3. SEMPRE pergunte se o paciente tem foto do plano alimentar para anexar.\n' +
      '4. Se o paciente enviar foto do plano, leia e entenda: calorias, porções, cuidados, alimentos prescritos.\n' +
      '5. Responda de forma prática, em passos simples.\n' +
      '6. Ao final, pergunte se há mais dúvidas.\n\n' +
      '═══ ÁREAS DE CONHECIMENTO ═══\n' +
      '- Nutrição clínica e dietética\n' +
      '- Gastronomia (receitas, preparos, substituições culinárias)\n' +
      '- Alergias e intolerâncias alimentares\n' +
      '- Diabetes, colesterol, hipertensão\n' +
      '- Saúde feminina: endometriose, menopausa, lipedema, questões hormonais\n\n' +
      '═══ REGRAS DE SEGURANÇA ═══\n' +
      '- NUNCA diagnosticar doenças.\n' +
      '- NUNCA prescrever medicamentos ou suplementos como tratamento.\n' +
      '- NUNCA prometer resultados (emagrecimento, ganho de massa).\n' +
      '- Fora do escopo de nutrição → encaminhe ao Dr. Caio.\n' +
      '- Casos clínicos graves → sinalize que precisa de avaliação humana do Dr. Caio.\n' +
      '- Em caso de dúvida sobre os limites, prefira encaminhar ao Dr. Caio.\n\n' +
      'Regra final: é um apoio ao atendimento do Dr. Caio Cândido. Responda SEMPRE em português do Brasil.'

    let extra = ''
    if (cfg) {
      const tone = cfg.getString('tone') || 'leve'
      const detail = cfg.getString('detail_level') || 'detalhado'
      extra +=
        '\n\n═══ CONFIGURAÇÃO DO PROFISSIONAL ═══\n' +
        'Nome do agente: ' +
        (cfg.getString('agent_name') || 'Yasa') +
        '\n' +
        'Nutricionista responsável: ' +
        (cfg.getString('nutritionist_name') || 'Dr. Caio Cândido') +
        '\n' +
        'Especialidade: ' +
        (cfg.getString('specialty') || 'Nutrição clínica e alimentação saudável') +
        '\n' +
        'Tom: ' +
        (tone === 'formal' ? 'mais formal' : 'leve/informal leve') +
        '\n' +
        'Nível de detalhe: ' +
        (detail === 'curto'
          ? 'respostas curtas e diretas'
          : 'respostas detalhadas, organizadas em passos quando útil') +
        '\n'
      const guide = cfg.getString('general_guidelines')
      if (guide) extra += 'Orientações gerais fixas do nutricionista: ' + guide + '\n'
      const welcome = cfg.getString('welcome_message')
      if (welcome)
        extra += 'Mensagem de boas-vindas (use ao iniciar uma conversa): ' + welcome + '\n'
    }

    // Active recipes — prioritized safe knowledge base.
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
      activeRecs.push('— Receita: ' + r.getString('title') + '\n' + ct)
    }
    if (activeRecs.length > 0) {
      extra +=
        '\n═══ BIBLIOTECA DE RECEITAS DO DR. CAIO — FONTE SEGURA ═══\n' +
        'Quando o paciente pedir receita, sugestão de lanche, jantar, almoço ou troca alimentar, BUSQUE PRIMEIRO nesta base antes de usar conhecimento geral. ' +
        'A base abaixo é a fonte segura e complementar ao seu conhecimento. Priorize sempre o conteúdo da base.\n\n' +
        activeRecs.join('\n\n')
    }

    // Active materials (PDFs).
    let mats = []
    try {
      mats = $app.findRecordsByFilter('agent_materials', 'owner = {:uid}', '-created', 50, 0, {
        uid: owner,
      })
    } catch (_) {}
    const activeMats = []
    for (const m of mats) {
      if (m.getBool('is_active') === false) continue
      const ct = m.getString('content_text')
      if (!ct) continue
      activeMats.push('— Material: ' + m.getString('title') + '\n' + ct)
    }
    if (activeMats.length > 0) {
      extra +=
        '\n═══ MATERIAIS (PDFs) DISPONÍVEIS — FONTE SEGURA ═══\n' +
        'Use o conteúdo abaixo como base quando o assunto da conversa tiver relação.\n' +
        activeMats.join('\n\n')
    }

    // Active meal plan templates.
    let tpls = []
    try {
      tpls = $app.findRecordsByFilter('meal_plan_templates', 'owner = {:uid}', '-created', 20, 0, {
        uid: owner,
      })
    } catch (_) {}
    const activeTpls = []
    for (const tp of tpls) {
      if (tp.getBool('is_active') === false) continue
      const ct = tp.getString('content_text')
      if (!ct) continue
      activeTpls.push('— Modelo de plano: ' + tp.getString('title') + '\n' + ct)
    }
    if (activeTpls.length > 0) {
      extra +=
        '\n═══ MODELOS DE PLANOS ALIMENTARES DO DR. CAIO — FONTE SEGURA ═══\n' +
        'Quando o paciente perguntar sobre o plano alimentar, trocas, porções ou substituições, BUSQUE PRIMEIRO nestes modelos antes de usar conhecimento geral. Eles são a referência oficial do Dr. Caio.\n' +
        activeTpls.join('\n\n')
    }
    return base + extra
  })()

  // ── Recent conversation history (last 12, chronological) ──
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
    msgs.push({
      role: 'user',
      content: text || 'Recebi esta foto do meu plano alimentar. Pode analisar?',
    })
    return msgs
  }

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
  let usedModel = model
  try {
    res = callOpenAI(model)
  } catch (err) {
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
    } catch (err2) {
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

  // ── Send the reply back to the contact via Evolution ──
  if (!isLid && evoUrl && evoKey && instanceName) {
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
