/// <reference path="../pb_data/types.d.ts" />
// Yasa chat endpoint — OpenAI Chat Completions API (text + vision via gpt-4o),
// DALL-E 3 image generation, and library document delivery.
//
// Builds the full nutrition system prompt (shared with whatsapp_webhook.js),
// pulls per-user config + materials + meal plan templates + recent history,
// then calls OpenAI with a configurable timeout (~30s default). Falls back to
// gpt-4o-mini on error. Supports optional image_base64 (vision) and an
// optional generate_image flag that calls DALL-E 3 and returns the image URL.
// When the model emits ENVIAR_DOCUMENTO: <collection>|<id>, the endpoint
// returns a doc_url + doc_caption the frontend can surface.

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

    // ── Build the full system prompt (shared with whatsapp_webhook.js) ──
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
        '4. Se o paciente enviar foto (do prato, do plano, de um alimento), leia e entenda: calorias, porções, cuidados, alimentos prescritos, composição do prato. Estime calorias e porções sempre que aplicável (veja a seção ANÁLISE DE IMAGENS).\n' +
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
        '═══ ANÁLISE DE IMAGENS ═══\n' +
        'Quando o paciente enviar foto de um prato ou alimento:\n' +
        '1. Identifique os alimentos visíveis na imagem\n' +
        '2. Estime visualmente as porções/quantidades (colher de sopa, unidade, fatia, gramas aproximadas)\n' +
        '3. Calcule calorias e macronutrientes aproximados com base em tabelas nutricionais oficiais (TACO/USDA)\n' +
        '4. Apresente a estimativa de forma clara: alimento → porção estimada → calorias → proteínas → carboidratos → gorduras\n' +
        '5. SEMPRE avise: "⚠️ Esta é uma estimativa visual. As quantidades reais podem variar."\n\n' +
        '═══ BUSCA NA INTERNET ═══\n' +
        'Quando a base de conhecimento local não for suficiente para responder com precisão, você pode complementar com seu conhecimento de bases nutricionais confiáveis como TACO (Tabela Brasileira de Composição de Alimentos), TBCA (Tabela Brasileira de Composição de Alimentos da USP), USDA FoodData Central, e diretrizes da Sociedade Brasileira de Alimentação e Nutrição (SBAN).\n' +
        'Para estimativas de calorias e macronutrientes de alimentos visíveis em fotos, utilize seu conhecimento sobre porções padrão e tabelas nutricionais oficiais. SEMPRE informe o paciente que se trata de uma estimativa e que o Dr. Caio pode ajustar.\n\n' +
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
          '═══ FORMATAÇÃO VISUAL ESTILO GAMMA.APP PARA RECEITAS (OBRIGATÓRIO) ═══\n' +
          'Quando você responder com uma receita, SEMPRE estruture a mensagem neste estilo visual lindo e limpo:\n' +
          '1. Título com emoji em negrito (ex: 🥞 *Panqueca de Banana Fit*)\n' +
          '2. Lista de ingredientes com bullets • (ex: 📋 *Ingredientes:*\n• 1 banana madura\n• 2 ovos...)\n' +
          '3. Modo de preparo com tempo estimado (ex: ⏱️ *Preparo:* 5 minutos\nAmasse a banana...)\n' +
          '4. Dica especial do Dr. Caio com emoji (ex: 💡 *Dica do Dr. Caio:* Sirva com pasta de amendoim...)\n' +
          '5. Chamada para o e-book se relevante (ex: 🔗 Quer o e-book completo? Peça aqui!)\n\n' +
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

      extra +=
        '\n═══ ENVIO DE DOCUMENTOS ═══\n' +
        'Quando você julgar que enviar um PDF da biblioteca (receita, modelo de plano ou material) ajudaria o paciente, responda com uma linha no formato exato:\n' +
        'ENVIAR_DOCUMENTO: <collection>|<recordId>\n' +
        'Onde <collection> é "recipes", "meal_plan_templates" ou "agent_materials". Coloque essa linha no final da resposta. O sistema anexará o arquivo automaticamente.'
      extra +=
        '\n\n═══ CAPACIDADES ESPECIAIS (RECURSOS PREMIUM) ═══\n' +
        'Você tem duas capacidades especiais além do atendimento nutricional normal. Identifique a intenção do paciente e ative quando ele pedir.\n\n' +
        '⚠️ IMPORTANTE — CONTROLE DE ACESSO POR PLANO:\n' +
        'A LISTA DE COMPRAS INTELIGENTE e o MODO "O QUE TENHO NA GELADEIRA?" são recursos EXCLUSIVOS dos planos Mensal e Trimestral. ' +
        'Pacientes dos planos Free Trial e Semanal NÃO têm acesso a esses recursos. ' +
        'Se um paciente do plano Free Trial ou Semanal pedir lista de compras, lista do mercado ou o modo geladeira, responda de forma educada e acolhedora que esse recurso está disponível a partir do plano Mensal (R$79,90/mês), que já inclui todos os recursos da Yasa. Não execute o recurso. Os demais assuntos nutricionais (dúvidas, receitas, trocas, plano alimentar) continuam disponíveis para todos os planos.\n\n' +
        '——— 1) LISTA DE COMPRAS INTELIGENTE (Mensal e Trimestral) ———\n' +
        'Quando o paciente pedir "lista de compras", "montar lista do mercado", "o que comprar essa semana", "lista de supermercado", ou similar:\n' +
        '1. Consulte o plano alimentar ativo do paciente (nos MODELOS DE PLANOS ALIMENTARES abaixo ou no contexto da conversa).\n' +
        '2. Monte uma lista organizada por corredor de supermercado brasileiro, usando exatamente estas seções com seus emojis:\n' +
        '   🥩 Carnes e Proteínas\n   🥬 Hortifruti\n   🥛 Laticínios\n   🌾 Grãos e Cereais\n   🧂 Temperos e Condimentos\n   🛒 Outros\n' +
        '3. Para cada item, inclua uma quantidade estimada para a semana (ex.: "2 kg de peito de frango", "1 maço de couve").\n' +
        '4. Ao final, sempre inclua: "💰 Orçamento estimado: R$ XX,XX a R$ YY,YY" — use preços realistas do mercado brasileiro atual.\n' +
        '5. Formate de forma bonita com emojis e seções claras, pronta para o WhatsApp.\n\n' +
        '——— 2) MODO "O QUE TENHO NA GELADEIRA?" (Mensal e Trimestral) ———\n' +
        'Quando o paciente enviar uma FOTO da geladeira, despensa ou de ingredientes (ou pedir "o que faço com o que tenho na geladeira?", "tenho esses alimentos, o que preparo?"):\n' +
        '1. Use sua capacidade de visão (GPT-4o) para identificar TODOS os alimentos visíveis na foto.\n' +
        '2. Consulte PRIMEIRO a BIBLIOTECA DE RECEITAS do Dr. Caio abaixo e cruze: quais receitas do banco usam os ingredientes que o paciente tem?\n' +
        '3. Se 2 ou mais ingredientes de uma receita do banco batem com os identificados, sugira essa receita.\n' +
        '4. Se nenhuma receita do banco servir, use seu conhecimento geral para sugerir 3 preparações possíveis com os ingredientes identificados.\n' +
        '5. Responda SEMPRE neste formato exato:\n\n' +
        '🍳 Com o que você tem na geladeira, eu sugero:\n\n' +
        '1️⃣ [Nome da Receita]\n   ⏱️ Tempo: XX min\n   📋 Ingredientes que você já tem: [lista]\n   🛒 Precisa comprar: [lista curta, ou "nada!" se já tem tudo]\n   📝 Modo de preparo resumido (3-5 passos)\n\n' +
        '2️⃣ ... (mesmo formato)\n\n' +
        '3️⃣ ... (mesmo formato)\n\n' +
        '💡 Dica do Dr. Caio: [dica nutricional personalizada baseada nos alimentos identificados]\n\n' +
        'Sempre inclua a "💡 Dica do Dr. Caio" ao final, com uma orientação nutricional útil relacionada aos ingredientes.'
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
    const imgB64 = body.image_base64 || ''
    const imgMime = body.image_mime || 'image/jpeg'
    const buildMessages = () => {
      const msgs = [{ role: 'system', content: systemPrompt }]
      for (const h of history) msgs.push({ role: h.role, content: h.content })

      if (imgB64) {
        const cleaned = imgB64.indexOf(',') >= 0 ? imgB64.split(',').slice(1).join(',') : imgB64
        const dataUrl = 'data:' + imgMime + ';base64,' + cleaned
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

    // For vision, force a vision-capable model.
    const effectiveModel = imgB64 ? 'gpt-4o' : model

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
    let usedModel = effectiveModel
    try {
      res = callOpenAI(effectiveModel)
    } catch (err) {
      $app.logger().warn('yasa openai primary failed', 'err', err.message || String(err))
      const fallback = effectiveModel === 'gpt-4o' ? 'gpt-4o-mini' : 'gpt-4o-mini'
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
    let docUrl = ''
    let docCaption = ''
    const docMatch = content.match(/ENVIAR_DOCUMENTO:\s*([a-zA-Z_]+)\|([a-zA-Z0-9]+)/)
    if (docMatch) {
      const coll = docMatch[1]
      const rid = docMatch[2]
      try {
        const rec = $app.findRecordById(coll, rid)
        if (rec) {
          const fileField = rec.getString('file') || ''
          const pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
          if (fileField && pbUrl) {
            docUrl = pbUrl + '/api/files/' + coll + '/' + rid + '/' + fileField
            docCaption = rec.getString('title') || 'Documento'
          }
        }
      } catch (_) {}
      content = content
        .replace(/ENVIAR_DOCUMENTO:[^\n]*/g, '')
        .replace(/\s+$/, '')
        .trim()
    }

    // ── Recipe image resolution (zero-cost from PDF extraction / agent_materials) ──
    let imageUrl = ''
    try {
      if (docUrl) {
        // Check if material has an extracted image
        const matMatch = docUrl.match(/\/api\/files\/([^\/]+)\/([^\/]+)/)
        if (matMatch) {
          const cName = matMatch[1]
          const rId = matMatch[2]
          try {
            const rRec = $app.findRecordById(cName, rId)
            if (rRec && rRec.getString('image_url')) {
              imageUrl = rRec.getString('image_url')
            }
          } catch (_) {}
        }
      }

      // If no image yet, search in agent_materials recipes for matches
      if (!imageUrl) {
        const checkText = (message + ' ' + content).toLowerCase()
        const isRecipe =
          checkText.indexOf('receita') >= 0 ||
          checkText.indexOf('como fazer') >= 0 ||
          checkText.indexOf('ingrediente') >= 0 ||
          checkText.indexOf('preparo') >= 0 ||
          checkText.indexOf('lanche') >= 0 ||
          checkText.indexOf('panqueca') >= 0 ||
          checkText.indexOf('shot') >= 0 ||
          checkText.indexOf('suco detox') >= 0 ||
          checkText.indexOf('tempero') >= 0 ||
          checkText.indexOf('whey') >= 0 ||
          checkText.indexOf('ovo') >= 0 ||
          checkText.indexOf('frango') >= 0 ||
          checkText.indexOf('peixe') >= 0

        if (isRecipe) {
          const recipeMats = $app.findRecordsByFilter(
            'agent_materials',
            'type = "recipe" && image_url != ""',
            '-created',
            30,
            0,
          )
          for (const rm of recipeMats) {
            const rTitle = (rm.getString('title') || '').toLowerCase()
            const rDesc = (rm.getString('description') || '').toLowerCase()
            const keywords = (rTitle + ' ' + rDesc)
              .split(/[\s,_\-—]+/)
              .filter(
                (k) =>
                  k.length > 3 &&
                  k !== 'receita' &&
                  k !== 'dr.' &&
                  k !== 'caio' &&
                  k !== 'candido' &&
                  k !== 'nutricionista',
              )

            let matchCount = 0
            for (const kw of keywords) {
              if (checkText.indexOf(kw) >= 0) matchCount++
            }
            if (matchCount >= 1) {
              imageUrl = rm.getString('image_url')
              break
            }
          }
        }
      }
    } catch (_) {}

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

    const resp = {
      content: content,
      message_id: savedMessageId,
      needs_human: needsHuman,
      model: usedModel,
    }
    if (docUrl) {
      resp.doc_url = docUrl
      resp.doc_caption = docCaption
    }
    if (imageUrl) resp.image_url = imageUrl
    return e.json(200, resp)
  },
  $apis.requireAuth(),
)
