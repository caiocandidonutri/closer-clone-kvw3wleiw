/// <reference path="../pb_data/types.d.ts" />
// Yasa chat endpoint — OpenAI Chat Completions API (text + vision via gpt-4o).
// Builds the full nutrition system prompt, pulls per-user config + materials +
// meal plan templates + recent conversation history, then calls OpenAI with
// a configurable timeout (~30s default). Falls back to gpt-4o-mini on error.

routerAdd(
  'POST',
  '/backend/v1/yasa/chat',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('autenticação obrigatória')
    const body = e.requestInfo().body || {}
    const message = (body.message || '').trim()
    if (!message) return e.badRequestError('mensagem obrigatória')

    // OpenAI API key: per-user config value wins, else the shared secret.
    const apiKey = (() => {
      try {
        const cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', userId)
        const k = cfg.getString('openai_api_key')
        if (k) return k
      } catch (_) {}
      return $os.getenv('OPENAI_API_KEY') || $secrets.get('OPENAI_API_KEY') || ''
    })()

    if (!apiKey) {
      return e.json(503, {
        error:
          'Chave da API da OpenAI não configurada. Adicione OPENAI_API_KEY nos secrets ou na tela de Configurações do agente Yasa.',
        needs_config: true,
      })
    }

    // ── Resolve runtime config ──
    let cfg = null
    try {
      cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', userId)
    } catch (_) {}
    const model = (cfg && cfg.getString('gemini_model')) || 'gpt-4o-mini'
    let temperature = cfg && cfg.get('temperature')
    if (temperature === null || temperature === '' || typeof temperature !== 'number')
      temperature = 0.7
    let maxSeconds = cfg && cfg.get('max_response_seconds')
    if (!maxSeconds) maxSeconds = 30

    // ── Build the full system prompt ──
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
        let topics = ''
        try {
          const arr = cfg.get('preferred_topics')
          if (Array.isArray(arr) && arr.length > 0) topics = arr.join(', ')
        } catch (_) {}
        if (topics) extra += 'Temas preferenciais de atuação: ' + topics + '\n'
        const guide = cfg.getString('general_guidelines')
        if (guide) extra += 'Orientações gerais fixas do nutricionista: ' + guide + '\n'
        const welcome = cfg.getString('welcome_message')
        if (welcome)
          extra += 'Mensagem de boas-vindas (use ao iniciar uma conversa): ' + welcome + '\n'
      }

      // Active recipes — PRIORITIZED as the safe knowledge base.
      let recs = []
      try {
        recs = $app.findRecordsByFilter('recipes', 'owner = {:uid}', '-created', 50, 0, {
          uid: userId,
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

      // Active materials
      let mats = []
      try {
        mats = $app.findRecordsByFilter('agent_materials', 'owner = {:uid}', '-created', 50, 0, {
          uid: userId,
        })
      } catch (_) {}
      const activeMats = []
      for (const m of mats) {
        if (m.getBool('is_active') === false) continue
        const ct = m.getString('content_text')
        if (!ct) continue
        activeMats.push(
          '— Material: ' +
            m.getString('title') +
            (m.getString('topic') ? ' (tema: ' + m.getString('topic') + ')' : '') +
            '\n' +
            ct,
        )
      }
      if (activeMats.length > 0) {
        extra +=
          '\n═══ MATERIAIS (PDFs) DISPONÍVEIS — FONTE SEGURA ═══\n' +
          'Use o conteúdo abaixo como base quando o assunto da conversa tiver relação. Cite, resuma ou organize. Nunca apresente como prescrição médica.\n' +
          activeMats.join('\n\n')
      }

      // Active meal plan templates
      let tpls = []
      try {
        tpls = $app.findRecordsByFilter(
          'meal_plan_templates',
          'owner = {:uid}',
          '-created',
          20,
          0,
          { uid: userId },
        )
      } catch (_) {}
      const activeTpls = []
      for (const tp of tpls) {
        if (tp.getBool('is_active') === false) continue
        const ct = tp.getString('content_text')
        if (!ct) continue
        activeTpls.push(
          '— Modelo de plano: ' +
            tp.getString('title') +
            (tp.getString('topic') ? ' (tema: ' + tp.getString('topic') + ')' : '') +
            '\n' +
            ct,
        )
      }
      if (activeTpls.length > 0) {
        extra +=
          '\n═══ MODELOS DE PLANOS ALIMENTARES DO DR. CAIO — FONTE SEGURA ═══\n' +
          'Quando o paciente perguntar sobre o plano alimentar, trocas, porções ou substituições, BUSQUE PRIMEIRO nestes modelos antes de usar conhecimento geral. Eles são a referência oficial do Dr. Caio.\n' +
          activeTpls.join('\n\n')
      }
      return base + extra
    })()

    // ── Recent conversation history (last 12 messages) ──
    const history = (() => {
      const contactId = body.contact_id || ''
      const out = []
      if (contactId) {
        try {
          const msgs = $app.findRecordsByFilter('messages', 'contact = {:cid}', '-created', 12, 0, {
            cid: contactId,
          })
          // chronological (oldest first)
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
      }
      return out
    })()

    // ── Build OpenAI messages array (system + history + user, with optional image) ──
    const buildMessages = () => {
      const msgs = [{ role: 'system', content: systemPrompt }]
      for (const h of history) msgs.push({ role: h.role, content: h.content })

      const imgB64 = body.image_base64 || ''
      const imgMime = body.image_mime || 'image/jpeg'
      if (imgB64) {
        const cleaned = imgB64.indexOf(',') >= 0 ? imgB64.split(',').slice(1).join(',') : imgB64
        const dataUrl = 'data:' + imgMime + ';base64,' + cleaned
        // gpt-4o vision: user message with content array (image_url + text)
        msgs.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: message },
          ],
        })
      } else {
        msgs.push({ role: 'user', content: message })
      }
      return msgs
    }

    const callOpenAI = (modelName) => {
      const url = 'https://api.openai.com/v1/chat/completions'
      const payload = {
        model: modelName,
        messages: buildMessages(),
        temperature: temperature,
        max_tokens: 1024,
      }
      return $http.send({
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify(payload),
        timeout: maxSeconds,
      })
    }

    const startedAt = Date.now()
    let res = null
    let usedModel = model
    try {
      res = callOpenAI(model)
    } catch (err) {
      // network/timeout — try fallback model once
      $app.logger().warn('yasa openai primary failed', 'err', err.message || String(err))
      const fallback = model === 'gpt-4o' ? 'gpt-4o-mini' : 'gpt-4o-mini'
      try {
        res = callOpenAI(fallback)
        usedModel = fallback
      } catch (err2) {
        $app.logger().error('yasa openai fallback failed', 'err', err2.message || String(err2))
        return e.json(502, {
          error: 'Não foi possível obter resposta da IA. Tente novamente em instantes.',
        })
      }
    }

    if (!res || !res.statusCode || res.statusCode >= 400) {
      const code = res ? res.statusCode : 0
      let detail = 'Erro na API da OpenAI'
      try {
        const j = res.json
        if (j && j.error && j.error.message) detail = j.error.message
      } catch (_) {}
      $app.logger().error('yasa openai http error', 'code', code, 'detail', detail)
      // retry once on 5xx with fallback model
      if (code >= 500 && usedModel !== 'gpt-4o-mini') {
        try {
          res = callOpenAI('gpt-4o-mini')
          usedModel = 'gpt-4o-mini'
        } catch (_) {}
      }
    }

    // Parse response
    let content = ''
    let needsHuman = false
    try {
      const json = res.json
      const choices = json && json.choices ? json.choices : []
      if (choices.length > 0) {
        const c = choices[0]
        if (c.message && c.message.content) content = c.message.content
      }
    } catch (err) {
      $app.logger().error('yasa openai parse failed', 'err', err.message || String(err))
    }

    if (!content) {
      content =
        'Olá! Tive dificuldade para processar sua mensagem agora. Pode repetir, por favor? Se preferir, o Dr. Caio também pode te ajudar pessoalmente.'
      needsHuman = true
    }

    // Heuristic: out-of-scope → needs human
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

    // ── Persist: store the assistant message + mark needs_human ──
    let savedMessageId = ''
    const contactId = body.contact_id || ''
    if (contactId) {
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
        savedMessageId = aiMsg.id

        // update contact last_message
        try {
          const contact = $app.findRecordById('contacts', contactId)
          contact.set('last_message', content)
          contact.set('status', 'responded')
          $app.save(contact)
        } catch (_) {}
      } catch (err) {
        $app.logger().warn('yasa persist message failed', 'err', err.message || String(err))
      }
    }

    return e.json(200, {
      content: content,
      message_id: savedMessageId,
      needs_human: needsHuman,
      model: usedModel,
    })
  },
  $apis.requireAuth(),
)
