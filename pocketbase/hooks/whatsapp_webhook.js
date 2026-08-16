/// <reference path="../pb_data/types.d.ts" />
// WhatsApp webhook → OpenAI Yasa reply.
// Receives incoming WhatsApp messages (text or image of meal plan),
// resolves the contact + owner, calls the Yasa chat logic via OpenAI
// gpt-4o, and returns the assistant reply. Stores the inbound user message.

routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  const body = e.requestInfo().body || {}
  const phone = (body.phone || body.From || '').toString().replace(/\D/g, '')
  if (!phone) return e.badRequestError('phone obrigatório')

  // Body may carry the raw text and/or a media URL/base64 for meal-plan photos.
  const text = (body.message || body.Body || '').toString().trim()
  const imageUrl = (body.image_url || body.MediaUrl0 || '').toString()
  const imageBase64 = (body.image_base64 || '').toString()
  const imageMime = (body.image_mime || 'image/jpeg').toString()

  if (!text && !imageUrl && !imageBase64) return e.badRequestError('mensagem ou imagem obrigatória')

  // ── Resolve contact by phone ──
  let contact = null
  try {
    contact = $app.findFirstRecordByData('contacts', 'phone', phone)
  } catch (_) {}
  if (!contact) {
    return e.json(404, { error: 'Contato não encontrado para este número.' })
  }

  const owner = contact.getString('owner')
  if (!owner) return e.json(403, { error: 'Contato sem profissional responsável.' })

  // ── Resolve OpenAI key (per-user config → shared secret) ──
  const apiKey = (() => {
    try {
      const cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', owner)
      const k = cfg.getString('openai_api_key')
      if (k) return k
    } catch (_) {}
    return $os.getenv('OPENAI_API_KEY') || $secrets.get('OPENAI_API_KEY') || ''
  })()
  if (!apiKey) {
    return e.json(503, {
      error:
        'Chave da API da OpenAI não configurada. Adicione OPENAI_API_KEY nos secrets ou nas Configurações do agente Yasa.',
      needs_config: true,
    })
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

  // ── Build system prompt (same as yasa_chat.js) ──
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

    // Active materials
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
        '\n═══ MATERIAIS (PDFs) DISPONÍVEIS ═══\n' +
        'Use o conteúdo abaixo como base quando o assunto da conversa tiver relação.\n' +
        activeMats.join('\n\n')
    }

    // Active meal plan templates
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
        '\n═══ MODELOS DE PLANOS ALIMENTARES DO DR. CAIO ═══\n' +
        'Use os modelos abaixo como referência quando o paciente perguntar sobre o plano alimentar, trocas, porções ou substituições.\n' +
        activeTpls.join('\n\n')
    }
    return base + extra
  })()

  // ── Persist inbound user message ──
  const inboundContent = text || (imageUrl ? '📷 Foto do plano alimentar' : '📷 Foto')
  let contactId = contact.id
  try {
    const msgCol = $app.findCollectionByNameOrId('messages')
    const userMsg = new Record(msgCol)
    userMsg.set('contact', contactId)
    userMsg.set('content', inboundContent)
    userMsg.set('role', 'user')
    userMsg.set('timestamp', new Date().toISOString())
    $app.save(userMsg)
  } catch (_) {}

  // ── Recent conversation history ──
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

  // ── Fetch image as base64 if a URL was given ──
  let finalImageBase64 = imageBase64
  let finalImageMime = imageMime
  if (!finalImageBase64 && imageUrl) {
    try {
      const r = $http.send({ url: imageUrl, method: 'GET', timeout: 20 })
      if (r && r.statusCode === 200 && r.body) {
        finalImageBase64 = $os.base64(r.body) // PocketBase helper, may be undefined
        if (!finalImageBase64 && typeof Buffer !== 'undefined') {
          finalImageBase64 = Buffer.from(r.body, 'binary').toString('base64')
        }
        const ct = r.headers && r.headers['content-type']
        if (ct) finalImageMime = ct.split(';')[0]
      }
    } catch (_) {}
  }

  // ── Build OpenAI messages ──
  const buildMessages = () => {
    const msgs = [{ role: 'system', content: systemPrompt }]
    for (const h of history) msgs.push({ role: h.role, content: h.content })
    if (finalImageBase64) {
      const cleaned =
        finalImageBase64.indexOf(',') >= 0
          ? finalImageBase64.split(',').slice(1).join(',')
          : finalImageBase64
      const dataUrl = 'data:' + finalImageMime + ';base64,' + cleaned
      msgs.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: text || 'Recebi esta foto do meu plano alimentar. Pode analisar?' },
        ],
      })
    } else {
      msgs.push({ role: 'user', content: text })
    }
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
      return e.json(502, { error: 'Não foi possível obter resposta da IA.' })
    }
  }

  if (!res || !res.statusCode || res.statusCode >= 400) {
    try {
      res = callOpenAI('gpt-4o-mini')
      usedModel = 'gpt-4o-mini'
    } catch (_) {
      return e.json(502, { error: 'Não foi possível obter resposta da IA.' })
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
      $app.save(contact)
    } catch (_) {}
  } catch (_) {}

  return e.json(200, {
    content: content,
    needs_human: needsHuman,
    model: usedModel,
  })
})
