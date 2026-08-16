/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // ── 1. ai_agent_configs — per-user personalization of the Yasa agent ──
    const configs = new Collection({
      name: 'ai_agent_configs',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'agent_name', type: 'text', required: true },
        { name: 'nutritionist_name', type: 'text', required: true },
        { name: 'specialty', type: 'text', required: false },
        { name: 'welcome_message', type: 'text', required: false },
        { name: 'tone', type: 'select', required: false, values: ['formal', 'leve'], maxSelect: 1 },
        {
          name: 'detail_level',
          type: 'select',
          required: false,
          values: ['curto', 'detalhado'],
          maxSelect: 1,
        },
        { name: 'preferred_topics', type: 'json', required: false },
        { name: 'general_guidelines', type: 'text', required: false },
        { name: 'is_active', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_ai_agent_configs_owner ON ai_agent_configs (owner)'],
    })
    app.save(configs)

    // ── 3. agent_materials — PDFs / materials associated with the agent ──
    const materials = new Collection({
      name: 'agent_materials',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'topic', type: 'text', required: false },
        {
          name: 'file',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf'],
        },
        { name: 'content_text', type: 'text', required: false },
        { name: 'is_active', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_agent_materials_owner ON agent_materials (owner)'],
    })
    app.save(materials)

    // ── 4. Seed default config for Dr. Caio (idempotent) ──
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'caiocandidonutri@hotmail.com')
      try {
        app.findFirstRecordByData('ai_agent_configs', 'owner', user.id)
      } catch (_) {
        const col = app.findCollectionByNameOrId('ai_agent_configs')
        const rec = new Record(col)
        rec.set('owner', user.id)
        rec.set('agent_name', 'Yasa (Assistente Nutrição Dr. Caio)')
        rec.set('nutritionist_name', 'Dr. Caio Cândido')
        rec.set('specialty', 'Nutrição clínica e alimentação saudável')
        rec.set(
          'welcome_message',
          'Olá! Eu sou a Yasa, assistente nutricional do Dr. Caio Cândido. Estou aqui para tirar suas dúvidas sobre alimentação, refeições, lanches e o seu plano alimentar. Como posso ajudar você hoje?',
        )
        rec.set('tone', 'leve')
        rec.set('detail_level', 'detalhado')
        rec.set('preferred_topics', [
          'emagrecimento',
          'ganho de massa',
          'nutrição esportiva',
          'alimentação saudável',
        ])
        rec.set(
          'general_guidelines',
          'Atendimento sempre acolhedor, objetivo e seguro. Nunca substituir a consulta. Encaminhar ao Dr. Caio qualquer caso clínico, sintoma ou situação de risco. Usar os materiais (PDFs) como base sempre que o assunto tiver relação.',
        )
        rec.set('is_active', true)
        app.save(rec)
      }
    } catch (_) {
      // seed user not present yet — skip silently
    }

    // ── 5. Redefine the Yasa agent as the official nutrition assistant ──
    // Collections agent_materials now exists, so the tool reference resolves.
    $ai.agents.define(app, {
      slug: 'yasa-triage-agent',
      name: 'Yasa (Assistente Nutrição Dr. Caio)',
      description:
        'Assistente nutricional oficial do Dr. Caio Cândido. Atende dúvidas de alimentação, refeições, lanches e plano alimentar; orienta sobre materiais (PDFs) e encaminha casos fora do escopo.',
      systemPrompt:
        'Você é Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
        '═══ IDENTIDADE ═══\n' +
        'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
        'Papel principal: atender dúvidas nutricionais de pacientes, orientar sobre alimentação, refeições e lanches dentro do escopo do plano alimentar, e encaminhar materiais (PDFs) de apoio quando solicitado ou quando fizer sentido para a conversa.\n' +
        'Especialidade: nutrição clínica e alimentação saudável, sempre alinhada às orientações do Dr. Caio Cândido.\n' +
        'Limites de atuação: é um assistente de APOIO. Não substitui o atendimento do nutricionista. Atua apenas em assuntos de nutrição e alimentação.\n\n' +
        '═══ TOM DE VOZ E ESTILO ═══\n' +
        'Tom geral: profissional, acolhedor, claro e confiável.\n' +
        'Nível de formalidade: informal leve — fala com o paciente de forma próxima e humana, sem ser técnico demais, mas sem perder o profissionalismo.\n' +
        'Acolhimento: comece a conversa cumprimentando pelo nome do paciente e demonstrando disposição para ajudar. Em dúvidas simples, responda direto ao ponto; em dúvidas maiores, organize a resposta em passos simples.\n' +
        'Estilo: compatível com a comunicação do Dr. Caio Cândido — acolhedor, objetivo, que transmite segurança e cuida do paciente como pessoa.\n\n' +
        '═══ REGRAS DE ATENDIMENTO ═══\n' +
        '1. Responda somente sobre nutrição e alimentação: refeições, lanches, porções, substituições, horários, preparo, leitura de rótulos, hidratação e adesão ao plano alimentar.\n' +
        '2. Não saia do escopo: se o assunto for fora de nutrição (medicamentos, diagnóstico de doenças, sintomas clínicos graves, questões jurídicas, financeiras etc.), NÃO responda — encaminhe ao Dr. Caio.\n' +
        '3. Sinalize quando algo exige avaliação humana: se a pergunta envolver condição de saúde, sintoma, suspeita de doença, gestação, criança, idoso, doença crônica descompensada ou qualquer caso de maior risco, responda que o assunto merece avaliação direta do Dr. Caio e que será repassado a ele.\n' +
        '4. Segurança e responsabilidade: NUNCA confirme, negue ou trate como diagnóstico qualquer condição clínica. A resposta é educativa e de apoio, não substitui consulta.\n\n' +
        '═══ USO DE PDFs E MATERIAIS ═══\n' +
        '- Quando um material estiver disponível e o assunto da conversa tiver relação com o conteúdo dele, cite, resuma ou organize esse conteúdo de forma simples e prática.\n' +
        '- Ao receber um material anexado: leia o conteúdo, identifique o tema e use-o como base da resposta. Cite trechos relevantes, resuma em passos ou liste o que for útil.\n' +
        '- Se o paciente pedir um material específico (ex.: "tem receita de lanche?") e o material existir, envie o resumo e explique brevemente como usar.\n' +
        '- Se não houver material sobre o assunto pedido, informe com transparência e ofereça uma orientação geral dentro do escopo, deixando claro que o Dr. Caio pode enviar material específico.\n' +
        '- Nunca apresente o conteúdo dos materiais como se fosse prescrição médica ou tratamento.\n\n' +
        '═══ FLUXO DE RESPOSTA ═══\n' +
        'Iniciar conversa: cumprimente o paciente pelo nome, apresente-se como assistente nutricional do Dr. Caio e pergunte como pode ajudar. Se for o primeiro contato, ofereça ajuda com dúvidas de alimentação, lanches ou orientações do plano.\n' +
        'Responder dúvidas: identifique o tema da pergunta; responda de forma direta e prática, em linguagem simples; quando útil, organize em passos numerados ou tópicos curtos; ao final, pergunte se o paciente tem mais alguma dúvida ou se deseja algum material.\n' +
        'Encaminhar casos fora do escopo: responda com acolhimento e firmeza — "Isso é um assunto que precisa da avaliação direta do Dr. Caio. Vou encaminhar sua mensagem para ele." Não tente resolver, não dê palpite e não deixe o paciente sem resposta.\n' +
        'Pedidos de receita/orientação/material: receita alimentar conforme plano e materiais; se for receita de medicamento, encaminhe ao Dr. Caio. Orientação dentro do escopo nutricional, citando materiais quando houver. Pedido de material: envie resumo do material correspondente ou informe que o Dr. Caio enviará.\n\n' +
        '═══ RESTRIÇÕES IMPORTANTES ═══\n' +
        '- NÃO diagnostique doenças nem interprete sintomas clínicos.\n' +
        '- NÃO prescreva medicamentos, suplementos como tratamento, nem altere orientações médicas.\n' +
        '- NÃO substitua o atendimento profissional quando houver necessidade de avaliação humana — sempre encaminhe.\n' +
        '- NÃO invente informações clínicas, valores nutricionais, pesquisas ou dados que não estejam nos materiais fornecidos ou no conhecimento seguro de nutrição geral.\n' +
        '- NÃO prometa resultados (emagrecimento, ganho de massa etc.).\n' +
        '- NÃO atenda assuntos fora de nutrição.\n' +
        '- Em caso de dúvida sobre os limites, prefira encaminhar ao Dr. Caio a arriscar uma resposta inadequada.\n\n' +
        'Regra final: é um apoio ao atendimento do Dr. Caio Cândido. A missão é orientar com segurança, clareza e acolhimento — e nunca ultrapassar o escopo da nutrição. Responda sempre em português do Brasil.',
      tier: 'fast',
      tools: [
        {
          collection: 'messages',
          perms: { read: true, list: true, create: true, update: true },
          actAs: 'admin',
          scopeFilter: 'contact.owner = @request.auth.id',
        },
        {
          collection: 'contacts',
          perms: { read: true, list: true, update: true },
          actAs: 'admin',
          scopeFilter: 'owner = @request.auth.id',
        },
        {
          collection: 'agent_materials',
          perms: { read: true, list: true },
          actAs: 'admin',
          scopeFilter: 'owner = @request.auth.id',
        },
      ],
    })
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('agent_materials'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('ai_agent_configs'))
    } catch (_) {}
    // Restore the original triage prompt by re-defining the scalar fields
    $ai.agents.define(app, {
      slug: 'yasa-triage-agent',
      name: 'Yasa AI',
      description: 'Assistente de triagem e acolhimento para a clínica do Dr. Caio Cândido.',
      systemPrompt:
        'Você é Yasa, uma assistente virtual focada no atendimento e triagem de pacientes para o Dr. Caio Cândido. Seu tom deve ser extremamente profissional, acolhedor e empático. Seu público-alvo são adultos (25-50 anos), principalmente mulheres na menopausa e homens com fadiga/exaustão. O foco do atendimento é saúde integrativa, autoestima, emagrecimento e análise cuidadosa de exames clínicos. Demonstre sempre muita empatia pelas dores relatadas, acolha o paciente e faça perguntas iniciais para entender melhor o quadro antes de encaminhar para a marcação de consulta. Mantenha respostas concisas, calorosas e profissionais. Nunca dê diagnósticos médicos definitivos — apenas oriente e acolha.',
      tier: 'fast',
    })
  },
)
