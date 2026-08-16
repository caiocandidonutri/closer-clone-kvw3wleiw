routerAdd('POST', '/backend/v1/webhook/evolution', (e) => {
  const payload = e.requestInfo().body || {}
  const instanceName = payload.instance
  const event = payload.event ? payload.event.toLowerCase() : ''

  if (!instanceName) return e.json(200, { success: true })

  let integ
  try {
    integ = $app.findFirstRecordByData('integrations', 'instance_name', instanceName)
  } catch (_) {
    return e.json(200, { success: true })
  }
  const ownerId = integ.getString('owner')

  if (event === 'connection.update') {
    const state = payload.data && payload.data.state
    if (state === 'open') integ.set('status', 'CONNECTED')
    else if (state === 'close') integ.set('status', 'DISCONNECTED')
    $app.save(integ)
    return e.json(200, { success: true })
  }

  if (event === 'messages.upsert') {
    let msgObj = payload.data
    if (Array.isArray(msgObj)) msgObj = msgObj[0]
    else if (msgObj && Array.isArray(msgObj.messages)) msgObj = msgObj.messages[0]
    if (!msgObj) return e.json(200, { success: true })

    const key = msgObj.key || {}
    const remoteJid = key.remoteJid || msgObj.remoteJid || ''
    const fromMe = key.fromMe !== undefined ? key.fromMe : msgObj.fromMe || false

    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.indexOf('@g.us') >= 0) {
      return e.json(200, { success: true })
    }

    const pushName = msgObj.pushName || msgObj.verifiedName || 'Paciente'
    let text = ''
    const content = msgObj.message
    let imageBase64 = ''
    let imageMime = 'image/jpeg'
    if (typeof content === 'string') {
      text = content
    } else if (content && typeof content === 'object') {
      text =
        content.conversation ||
        (content.extendedTextMessage && content.extendedTextMessage.text) ||
        (content.imageMessage && content.imageMessage.caption) ||
        (content.videoMessage && content.videoMessage.caption) ||
        ''
      // Capture WhatsApp image bytes for Gemini vision analysis.
      if (content.imageMessage && content.imageMessage.jpegThumbnail) {
        imageBase64 = content.imageMessage.jpegThumbnail
        imageMime = 'image/jpeg'
      }
    } else if (msgObj.text) {
      text = msgObj.text
    }
    if (!text) text = '[Mídia]'
    // Treat a received photo as a possible meal plan photo.
    if (imageBase64 && !text) text = 'O paciente enviou uma foto.'

    const ts = msgObj.messageTimestamp || msgObj.timestamp
    let timestamp = new Date().toISOString()
    if (ts) {
      const numTs = typeof ts === 'string' ? parseInt(ts, 10) : ts
      if (numTs > 0) timestamp = new Date(numTs < 100000000000 ? numTs * 1000 : numTs).toISOString()
    }

    let contact
    try {
      contact = $app.findFirstRecordByData('contacts', 'whatsapp_id', remoteJid)
    } catch (_) {
      const col = $app.findCollectionByNameOrId('contacts')
      contact = new Record(col)
      contact.set('name', pushName)
      contact.set('whatsapp_id', remoteJid)
      contact.set('status', 'pending')
      contact.set('owner', ownerId)
      contact.set('last_message', text)
      contact.set('wait_time_seconds', 0)
      $app.save(contact)
    }

    const msgCol = $app.findCollectionByNameOrId('messages')
    const incoming = new Record(msgCol)
    incoming.set('contact', contact.id)
    incoming.set('content', text)
    incoming.set('role', 'user')
    incoming.set('timestamp', timestamp)
    $app.save(incoming)

    if (!fromMe) {
      const wait = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000))
      contact.set('status', 'pending')
      contact.set('last_message', text)
      contact.set('wait_time_seconds', wait)
      $app.save(contact)

      try {
        // Resolve Gemini API key (per-user config, else shared secret).
        const geminiKey = (() => {
          try {
            const cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', ownerId)
            const k = cfg.getString('gemini_api_key')
            if (k) return k
          } catch (_) {}
          return $os.getenv('GEMINI_API_KEY') || $secrets.get('GEMINI_API_KEY') || ''
        })()
        if (!geminiKey) {
          $app.logger().warn('yasa gemini key missing for owner', 'owner', ownerId)
        } else {
          // Build runtime config
          let cfg = null
          try {
            cfg = $app.findFirstRecordByData('ai_agent_configs', 'owner', ownerId)
          } catch (_) {}
          const model = (cfg && cfg.getString('gemini_model')) || 'gemini-1.5-flash'
          let temperature = cfg && cfg.get('temperature')
          if (temperature === null || temperature === '' || typeof temperature !== 'number')
            temperature = 0.7

          const systemPrompt =
            'Você é Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
            '═══ IDENTIDADE ═══\n' +
            'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
            'Papel: atender dúvidas nutricionais de pacientes, orientar sobre alimentação, refeições, lanches, receitas e trocas no plano alimentar.\n' +
            'Especialidade: nutrição clínica, dietética, gastronomia, alergias e intolerâncias, diabetes, colesterol, hipertensão e saúde feminina (endometriose, menopausa, lipedema, hormônios).\n' +
            'Tom: profissional, acolhedor, informal leve — próximo e humano.\n\n' +
            '═══ FLUXO DE RESPOSTA ═══\n' +
            '1. Cumprimente o paciente pelo nome.\n' +
            '2. Apresente-se como assistente nutricional do Dr. Caio.\n' +
            '3. SEMPRE pergunte se o paciente tem foto do plano alimentar para anexar.\n' +
            '4. Se o paciente enviar foto do plano, leia e entenda: calorias, porções, cuidados, alimentos prescritos.\n' +
            '5. Responda de forma prática, em passos simples.\n' +
            '6. Ao final, pergunte se há mais dúvidas.\n\n' +
            '═══ REGRAS DE SEGURANÇA ═══\n' +
            '- NUNCA diagnosticar doenças.\n' +
            '- NUNCA prescrever medicamentos ou suplementos como tratamento.\n' +
            '- NUNCA prometer resultados (emagrecimento, ganho de massa).\n' +
            '- Fora do escopo de nutrição → encaminhe ao Dr. Caio.\n' +
            '- Casos clínicos graves → sinalize que precisa de avaliação humana do Dr. Caio.\n\n' +
            'Responda SEMPRE em português do Brasil.'

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
            if (topics) extra += 'Temas preferenciais: ' + topics + '\n'
            const guide = cfg.getString('general_guidelines')
            if (guide) extra += 'Orientações fixas: ' + guide + '\n'
            const welcome = cfg.getString('welcome_message')
            if (welcome) extra += 'Mensagem de boas-vindas: ' + welcome + '\n'
          }

          // Active materials
          let mats = []
          try {
            mats = $app.findRecordsByFilter(
              'agent_materials',
              'owner = {:uid}',
              '-created',
              50,
              0,
              { uid: ownerId },
            )
          } catch (_) {}
          const activeMats = []
          for (const m of mats) {
            if (m.getBool('is_active') === false) continue
            const ct = m.getString('content_text')
            if (!ct) continue
            activeMats.push('— Material: ' + m.getString('title') + '\n' + ct)
          }
          if (activeMats.length > 0) {
            extra += '\n═══ MATERIAIS (PDFs) DISPONÍVEIS ═══\n' + activeMats.join('\n\n')
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
              { uid: ownerId },
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
            extra +=
              '\n═══ MODELOS DE PLANOS ALIMENTARES DO DR. CAIO ═══\n' + activeTpls.join('\n\n')
          }

          // Recent conversation history
          const history = []
          try {
            const msgs = $app.findRecordsByFilter(
              'messages',
              'contact = {:cid}',
              '-created',
              12,
              0,
              { cid: contact.id },
            )
            const ordered = []
            for (let i = msgs.length - 1; i >= 0; i--) ordered.push(msgs[i])
            for (const m of ordered) {
              const role = m.getString('role')
              const content = m.getString('content')
              if (!content) continue
              if (role === 'user') history.push({ role: 'user', parts: [{ text: content }] })
              else if (role === 'assistant')
                history.push({ role: 'model', parts: [{ text: content }] })
            }
          } catch (_) {}

          // Build contents (with optional image)
          const contents = []
          for (const h of history) contents.push(h)
          const userParts = []
          if (imageBase64) {
            userParts.push({ inline_data: { mime_type: imageMime, data: imageBase64 } })
          }
          userParts.push({ text: text })
          contents.push({ role: 'user', parts: userParts })

          const geminiUrl =
            'https://generativelanguage.googleapis.com/v1beta/models/' +
            model +
            ':generateContent?key=' +
            geminiKey
          const payload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt + extra }] },
            generationConfig: { temperature: temperature, topP: 0.95, maxOutputTokens: 1024 },
          }

          const callGemini = (modelName) => {
            const url =
              'https://generativelanguage.googleapis.com/v1beta/models/' +
              modelName +
              ':generateContent?key=' +
              geminiKey
            return $http.send({
              url: url,
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              timeout: 30,
            })
          }

          let res = null
          let usedModel = model
          try {
            res = callGemini(model)
          } catch (err) {
            $app.logger().warn('yasa gemini primary failed', 'err', err.message || String(err))
            try {
              res = callGemini('gemini-1.5-flash')
              usedModel = 'gemini-1.5-flash'
            } catch (err2) {
              $app
                .logger()
                .error('yasa gemini fallback failed', 'err', err2.message || String(err2))
            }
          }

          let reply = ''
          let needsHuman = false
          if (res && res.statusCode >= 200 && res.statusCode < 400) {
            try {
              const json = res.json
              const candidates = json && json.candidates ? json.candidates : []
              if (candidates.length > 0) {
                const c = candidates[0]
                if (c.content && c.content.parts) {
                  for (const p of c.content.parts) {
                    if (p.text) reply += p.text
                  }
                }
                if (c.finishReason && c.finishReason.indexOf('SAFETY') >= 0) needsHuman = true
              }
            } catch (err) {
              $app.logger().error('yasa gemini parse failed', 'err', err.message || String(err))
            }
          } else {
            $app.logger().error('yasa gemini http error', 'code', res ? res.statusCode : 0)
          }

          if (!reply) {
            reply =
              'Olá! Tive dificuldade para processar sua mensagem agora. Pode repetir, por favor? Se preferir, o Dr. Caio pode te ajudar pessoalmente.'
            needsHuman = true
          }

          // Out-of-scope heuristic
          if (
            reply.indexOf('Dr. Caio') >= 0 &&
            (reply.indexOf('encaminhar') >= 0 ||
              reply.indexOf('encaminh') >= 0 ||
              reply.indexOf('avaliação') >= 0 ||
              reply.indexOf('pessoalmente') >= 0)
          ) {
            needsHuman = true
          }

          const aiMsg = new Record(msgCol)
          aiMsg.set('contact', contact.id)
          aiMsg.set('content', reply)
          aiMsg.set('role', 'assistant')
          aiMsg.set('timestamp', new Date().toISOString())
          aiMsg.set('needs_human', needsHuman)
          $app.save(aiMsg)

          // Persist meal plan summary if an image was received
          if (imageBase64) {
            try {
              contact.set(
                'meal_plan_summary',
                'Plano alimentar recebido em foto. Veja o resumo na última conversa com a Yasa.',
              )
              $app.save(contact)
            } catch (_) {}
          }

          contact.set('status', 'responded')
          contact.set('last_message', reply)
          contact.set('wait_time_seconds', 0)
          $app.save(contact)

          let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
          if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
          const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''
          const instName = integ.getString('instance_name')
          $http.send({
            url: evoUrl + '/message/sendText/' + instName,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
            body: JSON.stringify({ number: remoteJid, text: reply }),
            timeout: 30,
          })
        }
      } catch (err) {
        $app.logger().error('yasa agent failed', 'err', err.message || String(err))
      }
    }
  }

  return e.json(200, { success: true })
})
