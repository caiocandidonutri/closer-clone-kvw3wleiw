/// <reference path="../pb_data/types.d.ts" />
// Yasa chat endpoint — OpenAI Chat Completions API (text + vision via gpt-4o),
// DALL-E 3 image generation, and library document delivery.
//
// Respects plan tiers and limits dynamically by inspecting patient subscription_plan & benefits.

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

    // ── Resolve Contact & Patient Plan details ──
    const contactId = body.contact_id || ''
    let patientRecord = null
    let patientPlanSlug = 'free_trial'
    let planBenefits = []
    let planRec = null

    if (contactId) {
      try {
        const contactRec = $app.findRecordById('contacts', contactId)
        const pId = contactRec ? contactRec.getString('patient_id') : ''
        if (pId) {
          patientRecord = $app.findRecordById('patients', pId)
        }
        if (!patientRecord) {
          // Try looking up patient by phone or remote_jid
          const rawPhone = contactRec
            ? contactRec.getString('phone_number') || contactRec.getString('whatsapp_id') || ''
            : ''
          const digitsOnly = rawPhone.replace(/\D/g, '')
          const last9 = digitsOnly.slice(-9)
          if (last9.length >= 9) {
            const allPatients = $app.findRecordsByFilter('patients', '', '-created', 100, 0)
            for (const p of allPatients) {
              const pDigits = (p.getString('phone') || '').replace(/\D/g, '').slice(-9)
              if (pDigits === last9) {
                patientRecord = p
                break
              }
            }
          }
        }
      } catch (_) {}
    }

    if (patientRecord) {
      patientPlanSlug = patientRecord.getString('subscription_plan') || 'free_trial'
    }

    try {
      planRec = $app.findFirstRecordByData('subscription_plans', 'slug', patientPlanSlug)
      if (planRec) {
        const rawB = planRec.get('benefits')
        if (Array.isArray(rawB)) planBenefits = rawB
        else if (typeof rawB === 'string' && rawB) planBenefits = JSON.parse(rawB)
      }
    } catch (_) {}

    // Derive permissions from plan slug & benefits
    const isFreeTrial = patientPlanSlug === 'free_trial'
    const isWeekly = patientPlanSlug === 'weekly'
    const isMonthlyOrAbove = patientPlanSlug === 'monthly' || patientPlanSlug === 'quarterly'
    const isQuarterly = patientPlanSlug === 'quarterly'

    const allowsAnyRecipes = isWeekly || isMonthlyOrAbove
    const allowsOnlySnackRecipes = isWeekly // Semanal allows snack recipes (lanches) only
    const allowsFullRecipesAndMeals = isMonthlyOrAbove // Mensal and Quarterly allow full meal plans, meal prep (marmitas)
    const allowsMealPrep = isMonthlyOrAbove // Marmitas / planos semanais
    const allowsSmartListAndFridge = isMonthlyOrAbove

    // ── Build the full system prompt ──
    const systemPrompt = (() => {
      const base =
        'Você é a Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
        '═══ IDENTIDADE ═══\n' +
        'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
        'Papel: atender dúvidas nutricionais de pacientes, orientar sobre alimentação saudável e bem-estar.\n' +
        'Especialidade: nutrição clínica, dietética, gastronomia, alergias e intolerâncias alimentares, diabetes, colesterol, hipertensão e saúde feminina (endometriose, menopausa, lipedema, questões hormonais).\n' +
        'Tom: profissional, acolhedor, informal leve — próximo e humano.\n\n' +
        '═══ FORMATAÇÃO DA RESPOSTA (MUITO IMPORTANTE) ═══\n' +
        'Sempre responda em português do Brasil, com formatação rica e bonita no WhatsApp:\n' +
        '- Use emojis com moderação e propósito (🥗 🍎 💧 ✅ 💡 🤗), no início das seções.\n' +
        '- Separe em seções claras com uma linha em branco entre elas.\n' +
        '- Estrutura sugerida: saudação curta → resposta principal → dica extra (quando útil) → encerramento acolhedor.\n' +
        '- Use QUEBRAS DE LINHA entre os passos. Em listas, use • ou - no início de cada item.\n' +
        '- Quando enviar RECEITA (apenas se o plano permitir), formate com: 🍽️ Título, 📝 Ingredientes (lista), 👩‍🍳 Modo de preparo (passos), 💡 Dica.\n' +
        '- Frases curtas e diretas. Nunca um bloco gigante de texto corrido.\n' +
        '- Máximo ~250 palavras por resposta, salvo receitas autorizadas.\n\n' +
        '═══ FLUXO DE RESPOSTA ═══\n' +
        '1. Cumprimente o paciente pelo nome quando souber.\n' +
        '2. Apresente-se como assistente nutricional do Dr. Caio (na primeira interação).\n' +
        '3. Se o paciente ainda não enviou o plano alimentar, pergunte se tem foto do plano para anexar.\n' +
        '4. Se o paciente enviar foto (do prato, do plano, de um alimento), leia e entenda: calorias, porções, cuidados, alimentos prescritos, composição do prato. Estime calorias e porções sempre que aplicável (veja a seção ANÁLISE DE IMAGENS).\n' +
        '5. Responda de forma prática, em passos simples.\n' +
        '6. Ao final, pergunte se há mais dúvidas.\n\n' +
        '═══ ÁREAS DE CONHECIMENTO (profundo) ═══\n' +
        '- Nutrição clínica e dietética: cálculos, macros, micros, necessidades, dietas terapêuticas.\n' +
        '- Gastronomia: preparos, substituições culinárias saudáveis, técnicas, temperos.\n' +
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
        '═══ REGRAS DE SEGURANÇA ═══\n' +
        '- NUNCA diagnosticar doenças.\n' +
        '- NUNCA prescrever medicamentos ou suplementos como tratamento.\n' +
        '- NUNCA prometer resultados (emagrecimento, ganho de massa).\n' +
        '- Fora do escopo de nutrição → encaminhe ao Dr. Caio.\n' +
        '- Casos clínicos graves → sinalize que precisa de avaliação humana do Dr. Caio.\n' +
        '- Em caso de dúvida sobre os limites, prefira encaminhar ao Dr. Caio.\n\n'

      // ── PIRÂMIDE DE CONTEÚDO E REGRAS POR PLANO ATIVO ──
      let planRulesSection = '═══ CONTROLE DE ACESSO E REGRAS DO PLANO ATIVO DO PACIENTE ═══\n'
      planRulesSection += `Plano atual do paciente: ${patientPlanSlug.toUpperCase()}\n`
      if (planBenefits.length > 0) {
        planRulesSection +=
          `Benefícios cadastrados no banco:\n` +
          planBenefits.map((b) => `• ${b}`).join('\n') +
          '\n\n'
      }

      if (isFreeTrial) {
        planRulesSection +=
          '⚠️ RESTRIÇÕES DO PLANO FREE TRIAL (3 MENSAGENS):\n' +
          '- O paciente é FREE TRIAL. Ele tem direito APENAS a orientação nutricional básica e esclarecimento de dúvidas gerais de alimentação.\n' +
          '- ❌ NÃO PODE receber receitas de nenhum tipo (nem lanches, nem almoço/jantar).\n' +
          '- ❌ NÃO PODE receber estratégias de marmitas, planejamento semanal de refeições, lista de compras ou modo geladeira.\n' +
          '- SE O PACIENTE PEDIR QUALQUER RECEITA OU ESTRATÉGIA DE MARMITAS/CARDÁPIO COMPLETO, RESPONDA EXATAMENTE COM ESTA MENSAGEM OU MUITO PRÓXIMO: ' +
          '"As receitas completas e estratégias de marmitas estão disponíveis a partir do plano Semanal! 😊 Quer fazer o upgrade?"\n' +
          '- Se pedir lista de compras ou geladeira inteligente, informe educadamente que são recursos disponíveis nos planos pagos.\n' +
          '- Mantenha o atendimento focado em orientação nutricional e conceitos saudáveis sem dar receitas nem marmitas.\n\n'
      } else if (isWeekly) {
        planRulesSection +=
          '⚠️ REGRAS DO PLANO SEMANAL (15 MENSAGENS):\n' +
          '- O paciente tem direito a orientação nutricional e ✅ RECEITAS DE LANCHES (ex.: panqueca fit, cookie de banana, bolo de caneca low carb, vitaminas, snacks saudáveis).\n' +
          '- ❌ NÃO PODE receber estratégias de marmitas (meal prep para a semana), montagem de planos/cardápios semanais completos, lista de compras inteligente nem modo geladeira.\n' +
          '- SE O PACIENTE PEDIR ESTRATÉGIA DE MARMITAS, PLANO SEMANAL DE REFEIÇÕES OU ORGANIZAÇÃO DA SEMANA, RESPONDA: ' +
          '"As estratégias de marmitas e planos semanais estão disponíveis a partir do plano Mensal! 🍱 Quer fazer o upgrade?"\n' +
          '- Se pedir lista de compras ou modo geladeira inteligente: "A lista de compras inteligente e o modo geladeira estão disponíveis no plano Mensal! 🛒 Quer fazer o upgrade?"\n\n'
      } else if (isMonthlyOrAbove) {
        planRulesSection +=
          '✨ REGRAS DO PLANO ' +
          (isQuarterly ? 'TRIMESTRAL (PREMIUM)' : 'MENSAL (COMPLETO)') +
          ':\n' +
          '- ✅ TUDO LIBERADO: orientação nutricional, todas as receitas, estratégia de marmitas, organização de refeições semanais, lista de compras inteligente e modo geladeira inteligente.\n' +
          (isQuarterly ? '- ✅ Atendimento prioritário e acompanhamento premium.\n\n' : '\n')
      }

      let extra = ''
      if (cfg) {
        const tone = cfg.getString('tone') || 'leve'
        const detail = cfg.getString('detail_level') || 'detalhado'
        extra +=
          '\n═══ CONFIGURAÇÃO DO PROFISSIONAL ═══\n' +
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
      }

      // Active recipes — include only if plan allows recipes (Weekly allows snacks, Monthly+ allows all)
      if (allowsAnyRecipes) {
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
          const title = r.getString('title') || ''
          // If weekly, filter to snack/lanche recipes if identifiable, or provide guidance
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
              lower.includes('crepioca') ||
              lower.includes('muffin')
            if (isSnack) {
              activeRecs.push('— Receita de Lanche: ' + title + '\n' + ct)
            }
          } else {
            activeRecs.push('— Receita: ' + title + '\n' + ct)
          }
        }
        if (activeRecs.length > 0) {
          extra +=
            '\n═══ BIBLIOTECA DE RECEITAS DO DR. CAIO (LIBERADA PARA O PLANO) ═══\n' +
            'Quando o paciente pedir receita permitida pelo seu plano, consulte a base abaixo:\n' +
            'Estrutura visual da receita:\n' +
            '1. Título com emoji em negrito (ex: 🥞 *Panqueca de Banana Fit*)\n' +
            '2. Lista de ingredientes com bullets • (ex: 📋 *Ingredientes:*\n• 1 banana madura...)\n' +
            '3. Modo de preparo com tempo estimado (ex: ⏱️ *Preparo:* 5 minutos...)\n' +
            '4. Dica especial do Dr. Caio com emoji (ex: 💡 *Dica do Dr. Caio:...*)\n\n' +
            activeRecs.join('\n\n')
        }
      }

      // Active materials (PDFs)
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
        extra += '\n═══ MATERIAIS (PDFs) DISPONÍVEIS — FONTE SEGURA ═══\n' + activeMats.join('\n\n')
      }

      // Active meal plan templates (only if plan allows meal plans)
      if (allowsFullRecipesAndMeals) {
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
            '\n═══ MODELOS DE PLANOS ALIMENTARES E MARMITAS DO DR. CAIO ═══\n' +
            activeTpls.join('\n\n')
        }
      }

      if (allowsSmartListAndFridge) {
        extra +=
          '\n\n═══ CAPACIDADES ESPECIAIS (PLANO MENSAL / TRIMESTRAL) ═══\n' +
          '——— 1) LISTA DE COMPRAS INTELIGENTE ———\n' +
          'Quando o paciente pedir lista de compras:\n' +
          'Organize por seções: 🥩 Carnes e Proteínas, 🥬 Hortifruti, 🥛 Laticínios, 🌾 Grãos e Cereais, 🧂 Temperos, 🛒 Outros.\n' +
          'Inclua quantidades e "💰 Orçamento estimado: R$ XX,XX a R$ YY,YY".\n\n' +
          '——— 2) MODO "O QUE TENHO NA GELADEIRA?" ———\n' +
          'Sugira preparações com os alimentos identificados.\n'
      }

      return base + planRulesSection + extra
    })()

    // ── Recent conversation history (last 12 messages) ──
    const history = (() => {
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

    // ── Build OpenAI messages array ──
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
      const fallback = 'gpt-4o-mini'
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
      // Check permission: free trial cannot receive recipe documents
      const isRecipeDoc = coll === 'recipes' || coll === 'meal_plan_templates'
      if (!isFreeTrial || !isRecipeDoc) {
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
      }
      content = content
        .replace(/ENVIAR_DOCUMENTO:[^\n]*/g, '')
        .replace(/\s+$/, '')
        .trim()
    }

    // ── Recipe image resolution ──
    let imageUrl = ''
    if (allowsAnyRecipes) {
      try {
        if (docUrl) {
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

        if (!imageUrl) {
          const checkText = (message + ' ' + content).toLowerCase()
          const isRecipe =
            checkText.indexOf('receita') >= 0 ||
            checkText.indexOf('como fazer') >= 0 ||
            checkText.indexOf('lanche') >= 0 ||
            checkText.indexOf('panqueca') >= 0

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
              const keywords = rTitle
                .split(/[\s,_\-—]+/)
                .filter((k) => k.length > 3 && k !== 'receita' && k !== 'dr.' && k !== 'caio')
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
    }

    // ── Persist: store the assistant message + mark needs_human ──
    let savedMessageId = ''
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
      patient_plan: patientPlanSlug,
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
