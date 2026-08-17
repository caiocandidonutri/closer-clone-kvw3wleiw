/// <reference path="../pb_data/types.d.ts" />
// Evolution API v2 webhook receiver — multimodal Yasa.
//
// Handles inbound WhatsApp messages of every kind:
//   - text          → normal chat
//   - audio         → transcribe via OpenAI Whisper, then chat on the transcript
//   - image         → download, base64, send to GPT-4o vision
//   - document(PDF) → extract text (best-effort) and feed to the chat
// Before answering, Yasa consults the local knowledge base
// (recipes / meal_plan_templates / agent_materials) and may send back
// images or PDFs from that library through Evolution sendMedia.

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

  // Extract the plain text body from any of the shapes Evolution/whatsapp-web.js uses.
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

  // Ignore status broadcasts and our own outgoing echoes.
  if (!remoteJid) return e.json(200, { ok: true, skipped: 'no_remote_jid' })
  if (remoteJid.indexOf('status@') === 0 || remoteJid.indexOf('broadcast@') === 0)
    return e.json(200, { ok: true, skipped: 'broadcast' })

  // Detect media kinds.
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
    // Outgoing message sent from the phone itself — mark contact as responded.
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

  // Only proceed when there is text or a media payload we can handle.
  if (!text && !isAudio && !isImage && !isDocument)
    return e.json(200, { ok: true, skipped: 'no_text' })

  // ── Resolve the integration (owner) for this instance ──
  let integ = null
  try {
    integ = $app.findFirstRecordByData('integrations', 'instance_name', instance)
  } catch (_) {}
  if (!integ) {
    console.log(
      '[whatsapp_webhook] MESSAGES_UPSERT skipped: no integration for instance=' + instance,
    )
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
    if (allIntegs.length > 0) {
      integ = allIntegs[0]
      console.log(
        '[whatsapp_webhook] fallback: using integration id=' +
          integ.id +
          ' instance=' +
          integ.getString('instance_name'),
      )
    }
    if (!integ) return e.json(200, { ok: true, skipped: 'no_integration' })
  }
  const owner = integ.getString('owner')
  if (!owner) {
    console.log('[whatsapp_webhook] MESSAGES_UPSERT skipped: no owner on integration')
    return e.json(200, { ok: true, skipped: 'no_owner' })
  }
  console.log(
    '[whatsapp_webhook] MESSAGES_UPSERT from=' +
      remoteJid +
      ' type=' +
      messageType +
      ' text="' +
      (text || '').slice(0, 60) +
      '" owner=' +
      owner,
  )

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
  if (!contact) {
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
          const r = picRes.body.toString().replace(/"/g, '')
          if (r.indexOf('http') === 0) picUrl = r
        }
        if (picUrl) {
          contact.set('profile_picture_url', picUrl)
          if (!contact.getString('avatar_url')) contact.set('avatar_url', picUrl)
          $app.save(contact)
        }
      }
    } catch (_) {}
  }

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

  // ── Download media (audio/image/document) as base64 from Evolution ──
  // Returns { base64, mimetype, filename } or null on failure.
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
      if (!res || !res.statusCode || res.statusCode >= 400) {
        console.log(
          '[whatsapp_webhook] getBase64 media http=' +
            (res && res.statusCode) +
            ' body=' +
            (res && res.body ? res.body.toString().slice(0, 200) : ''),
        )
        return null
      }
      const j = res.json || {}
      const base64 = (j.base64 || (j.data && j.data.base64) || '').toString()
      if (!base64) return null
      let mt = ''
      let fn = ''
      try {
        mt = (j.mimetype || (j.data && j.data.mimetype) || '').toString()
      } catch (_) {}
      try {
        fn = (j.fileName || (j.data && j.data.fileName) || '').toString()
      } catch (_) {}
      if (!mt && message) {
        if (isAudio && message.audioMessage) mt = message.audioMessage.mimetype || ''
        if (isImage && message.imageMessage) mt = message.imageMessage.mimetype || ''
        if (isDocument && message.documentMessage) mt = message.documentMessage.mimetype || ''
      }
      if (!mt) mt = isAudio ? 'audio/mpeg' : isImage ? 'image/jpeg' : 'application/octet-stream'
      if (!fn) fn = isAudio ? 'audio.mp3' : isImage ? 'image.jpg' : 'document'
      console.log(
        '[whatsapp_webhook] media downloaded mime=' +
          mt +
          ' filename=' +
          fn +
          ' bytes~' +
          base64.length,
      )
      return { base64: base64, mimetype: mt, filename: fn }
    } catch (err) {
      console.log(
        '[whatsapp_webhook] getBase64 media error: ' +
          (err && err.message ? err.message : String(err)),
      )
      return null
    }
  }

  // ── Transcribe audio via OpenAI Whisper ──
  const transcribeAudio = (media) => {
    if (!media || !media.base64) return ''
    try {
      const fname = media.filename || 'audio.mp3'
      // Decode the base64 audio into a raw byte array (the JSVM has no atob).
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
      // Build the multipart body via FormData + $filesystem.fileFromBytes so
      // that $http.send emits a correct multipart/form-data payload. Passing a
      // plain JS byte array as `body` makes the JSVM JSON-serialize it, which
      // corrupts the multipart and makes Whisper return HTTP 400. FormData is
      // handled natively and produces the right Content-Type/boundary. Do NOT
      // set Content-Type manually — PocketBase fills it in from the FormData.
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
      if (!res || !res.statusCode || res.statusCode >= 400) {
        console.log(
          '[whatsapp_webhook] whisper http=' +
            (res && res.statusCode) +
            ' body=' +
            (res && res.body ? res.body.toString().slice(0, 300) : ''),
        )
        return ''
      }
      const j = res.json || {}
      const t = (j.text || '').toString().trim()
      console.log('[whatsapp_webhook] whisper transcript="' + t.slice(0, 120) + '"')
      return t
    } catch (err) {
      console.log(
        '[whatsapp_webhook] whisper error: ' + (err && err.message ? err.message : String(err)),
      )
      return ''
    }
  }

  // ── Process the inbound media (if any) into text or vision input ──
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
    const media = downloadMedia()
    if (media && media.base64) {
      // Best-effort: send the PDF to GPT-4o vision as an image_url? GPT-4o
      // supports PDF via file inputs only through the Files API, which we
      // can't easily reach here. Instead, we attempt to extract readable
      // text from the raw bytes using a minimal heuristic scan for text
      // streams (BT...ET). This is imperfect but works for many simple
      // PDFs; otherwise the library content_text is already in the prompt.
      const decodeB64Str = (b64) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '')
        let out = ''
        for (let i = 0; i < clean.length; i += 4) {
          const c1 = chars.indexOf(clean.charAt(i))
          const c2 = chars.indexOf(clean.charAt(i + 1))
          const c3 = chars.indexOf(clean.charAt(i + 2))
          const c4 = chars.indexOf(clean.charAt(i + 3))
          out += String.fromCharCode((c1 << 2) | (c2 >> 4))
          if (c3 !== 64) out += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2))
          if (c4 !== 64) out += String.fromCharCode(((c3 & 3) << 6) | c4)
        }
        return out
      }
      try {
        const raw = decodeB64Str(media.base64)
        const extracted = []
        const re = /\(((?:[^()\\]|\\.)*?)\)\s*Tj/g
        let m
        let guard = 0
        while ((m = re.exec(raw)) && guard < 2000) {
          const s = m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')')
          if (s.trim()) extracted.push(s)
          guard++
        }
        const pdfText = extracted.join(' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
        if (pdfText) {
          userText =
            (text ? text + '\n\n' : '') +
            '[Conteúdo extraído do PDF enviado pelo paciente]\n' +
            pdfText
        } else {
          userText =
            text ||
            'Recebi seu PDF, mas não consegui extrair o texto dele agora. Pode me dizer o que ele contém?'
        }
      } catch (_) {
        userText = text || 'Recebi seu PDF, mas não consegui processá-lo agora.'
      }
    } else {
      userText = text || 'Recebi seu PDF, mas não consegui abri-lo agora. Pode reenviar?'
    }
  } else if (isDocument) {
    userText = text || 'Recebi seu documento. Pode me dizer o que você precisa sobre ele?'
  }

  if (!userText) userText = 'Olá!'

  // ── Persist the inbound user message ──
  const inboundContent =
    userText ||
    (isAudio
      ? '🎤 Áudio'
      : isImage
        ? '📷 Foto'
        : isPdf
          ? '📄 PDF'
          : isDocument
            ? '📄 Documento'
            : '')
  try {
    const msgCol = $app.findCollectionByNameOrId('messages')
    const userMsg = new Record(msgCol)
    userMsg.set('contact', contactId)
    userMsg.set('content', inboundContent)
    userMsg.set('role', 'user')
    userMsg.set('timestamp', new Date().toISOString())
    $app.save(userMsg)
    console.log('[whatsapp_webhook] inbound message saved contactId=' + contactId)
  } catch (err) {
    console.log(
      '[whatsapp_webhook] failed to save inbound message: ' +
        (err && err.message ? err.message : String(err)),
    )
  }

  // ── Build the nutrition system prompt (kept in sync with yasa_chat.js) ──
  const systemPrompt = (() => {
    const base =
      'Você é a Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
      '═══ IDENTIDADE ═══\n' +
      'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
      'Papel: atender dúvidas nutricionais de pacientes, orientar sobre alimentação, refeições, lanches, receitas e trocas no plano alimentar.\n' +
      'Especialidade: nutrição clínica, dietética, gastronomia, alergias e intolerâncias alimentares, diabetes, colesterol, hipertensão e saúde feminina (endometriose, menopausa, lipedema, questões hormonais).\n' +
      'Tom: profissional, acolhedor, informal leve — próximo e humano.\n\n' +
      '═══ FORMATAÇÃO DA RESPOSTA (MUITO IMPORTANTE) ═══\n' +
      'Sempre responda em português do Brasil, com formatação rica e bonita no WhatsApp:\n' +
      '- Use emojis com moderação e propósito (🥗 🍎 💧 ✅ 💡 🤗), no início das seções.\n' +
      '- Separe em seções claras com uma linha em branco entre elas.\n' +
      '- Estrutura sugerida: saudação curta → resposta principal → dica extra (quando útil) → encerramento acolhedor.\n' +
      '- Use QUEBRAS DE LINHA entre os passos. Em listas, use • ou - no início de cada item.\n' +
      '- Quando enviar RECEITA, formate com: 🍽️ Título, 📝 Ingredientes (lista), 👩‍🍳 Modo de preparo (passos), 💡 Dica.\n' +
      '- Frases curtas e diretas. Nunca um bloco gigante de texto corrido.\n' +
      '- Máximo ~250 palavras por resposta, salvo receitas completas.\n\n' +
      '═══ FLUXO DE RESPOSTA ═══\n' +
      '1. Cumprimente o paciente pelo nome quando souber.\n' +
      '2. Apresente-se como assistente nutricional do Dr. Caio (na primeira interação).\n' +
      '3. Se o paciente ainda não enviou o plano alimentar, pergunte se tem foto do plano para anexar.\n' +
      '4. Se o paciente enviar foto (do prato, do plano, de um alimento), leia e entenda: calorias, porções, cuidados, alimentos prescritos, composição do prato.\n' +
      '5. Responda de forma prática, em passos simples.\n' +
      '6. Ao final, pergunte se há mais dúvidas.\n\n' +
      '═══ ÁREAS DE CONHECIMENTO (profundo) ═══\n' +
      '- Nutrição clínica e dietética: cálculos, macros, micros, necessidades, dietas terapêuticas.\n' +
      '- Gastronomia: receitas, preparos, substituições culinárias, técnicas, temperos.\n' +
      '- Alergias e intolerâncias alimentares (gluten, lactose, frutos do mar, etc.).\n' +
      '- Diabetes (tipos 1 e 2), insulina, contagem de carboidratos, índice glicêmico.\n' +
      '- Colesterol e dislipidemias, hipertensão, síndrome metabólica.\n' +
      '- Saúde feminina: endometriose, menopausa, lipedema, SOP, questões hormonais.\n' +
      '- Nutrição infantil, esportiva, gestacional e vegetariana quando pertinente.\n\n' +
      '═══ CONSULTA À BASE DE CONHECIMENTO LOCAL (OBRIGATÓRIO) ═══\n' +
      'SEMPRE consulte PRIMEIRO a base de conhecimento local abaixo (receitas, modelos de plano alimentar e materiais do Dr. Caio) antes de usar conhecimento geral. ' +
      'A base local é a fonte segura e prioritária. Só use conhecimento geral para complementar quando a base não cobrir o tema.\n\n' +
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

    extra +=
      '\n═══ ENVIO DE DOCUMENTOS ═══\n' +
      'Quando você julgar que enviar um PDF da biblioteca (receita, modelo de plano ou material) ajudaria o paciente, responda com uma linha no formato exato:\n' +
      'ENVIAR_DOCUMENTO: <collection>|<recordId>\n' +
      'Onde <collection> é "recipes", "meal_plan_templates" ou "agent_materials". Coloque essa linha no final da resposta. O sistema anexará o arquivo automaticamente.'
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

  // For vision, force a vision-capable model.
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
    console.log(
      '[whatsapp_webhook] OpenAI primary model=' +
        effectiveModel +
        ' status=' +
        (res && res.statusCode),
    )
  } catch (err) {
    console.log(
      '[whatsapp_webhook] OpenAI primary failed: ' +
        (err && err.message ? err.message : String(err)),
    )
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
      console.log(
        '[whatsapp_webhook] OpenAI fallback model=gpt-4o-mini status=' + (res && res.statusCode),
      )
    } catch (err2) {
      console.log(
        '[whatsapp_webhook] OpenAI fallback also failed: ' +
          (err2 && err2.message ? err2.message : String(err2)),
      )
      return e.json(200, { ok: true, skipped: 'openai_failed' })
    }
  }

  if (!res || !res.statusCode || res.statusCode >= 400) {
    console.log(
      '[whatsapp_webhook] OpenAI http error status=' +
        (res && res.statusCode) +
        ' body=' +
        (res && res.body ? res.body.toString().slice(0, 300) : ''),
    )
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
      console.log('[whatsapp_webhook] OpenAI retry fallback status=' + (res && res.statusCode))
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

  // ── Extract any "send document" instruction from the model reply ──
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

    // Optionally send a document/PDF/image from the library.
    if (sendDocCollection && sendDocId) {
      try {
        const rec = $app.findRecordById(sendDocCollection, sendDocId)
        if (rec) {
          const fileField = rec.getString('file') || ''
          const pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
          const token = $secrets.get('PB_SUPERUSER_TOKEN') || ''
          if (fileField && pbUrl) {
            const fileUrl =
              pbUrl + '/api/files/' + sendDocCollection + '/' + sendDocId + '/' + fileField
            const lower = fileField.toLowerCase()
            const mediatype = lower.endsWith('.pdf')
              ? 'document'
              : lower.endsWith('.jpg') ||
                  lower.endsWith('.jpeg') ||
                  lower.endsWith('.png') ||
                  lower.endsWith('.webp')
                ? 'image'
                : 'document'
            const mimeForMedia =
              mediatype === 'image'
                ? lower.endsWith('.png')
                  ? 'image/png'
                  : 'image/jpeg'
                : 'application/pdf'
            // Prefer sending by URL (works for large files, no base64 bloat).
            $http.send({
              url: evoUrl + '/message/sendMedia/' + instanceName,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: evoKey },
              body: JSON.stringify({
                number: phoneNumber,
                mediatype: mediatype,
                mimetype: mimeForMedia,
                media: fileUrl,
                fileName: fileField,
                caption: '📎 ' + (rec.getString('title') || 'Documento'),
              }),
              timeout: 60,
            })
            console.log(
              '[whatsapp_webhook] sent library doc ' + sendDocCollection + '/' + sendDocId,
            )
          }
        }
      } catch (err) {
        console.log(
          '[whatsapp_webhook] send library doc failed: ' +
            (err && err.message ? err.message : String(err)),
        )
      }
    }
  }

  return e.json(200, {
    ok: true,
    contact_id: contactId,
    needs_human: needsHuman,
    model: usedModel,
  })
})
