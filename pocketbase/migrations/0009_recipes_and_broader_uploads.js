/// <reference path="../pb_data/types.d.ts" />
// 1. Creates the `recipes` collection (Biblioteca de Receitas) used by Dr. Caio
//    to upload PDFs of recipes that the Yasa agent uses as a knowledge base.
// 2. Broadens the accepted mimeTypes on `agent_materials` and
//    `meal_plan_templates` so the batch upload accepts PDFs, images and
//    common document formats (Word/text) in addition to PDF only.
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // Broad document/image mime types shared by all three collections.
    const docMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]

    // ── 1. recipes collection ──
    if (!app.hasTable('recipes')) {
      const recipes = new Collection({
        name: 'recipes',
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
          {
            name: 'file',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: docMimes,
          },
          { name: 'content_text', type: 'text', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_recipes_owner ON recipes (owner)'],
      })
      app.save(recipes)
    }

    // ── 2. Broaden file mimeTypes on agent_materials ──
    const materials = app.findCollectionByNameOrId('agent_materials')
    try {
      materials.fields.removeByName('file')
    } catch (_) {}
    materials.fields.add(
      new FileField({
        name: 'file',
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: docMimes,
      }),
    )
    app.save(materials)

    // ── 3. Broaden file mimeTypes on meal_plan_templates ──
    const templates = app.findCollectionByNameOrId('meal_plan_templates')
    try {
      templates.fields.removeByName('file')
    } catch (_) {}
    templates.fields.add(
      new FileField({
        name: 'file',
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: docMimes,
      }),
    )
    app.save(templates)

    // ── 4. Give the Yasa agent read/list access to recipes ──
    try {
      $ai.agents.define(app, {
        slug: 'yasa-triage-agent',
        name: 'Yasa (Assistente Nutrição Dr. Caio)',
        description:
          'Assistente nutricional oficial do Dr. Caio Cândido. Atende dúvidas de alimentação, refeições, lanches, receitas e plano alimentar; orienta sobre materiais (PDFs) e receitas, e encaminha casos fora do escopo.',
        systemPrompt:
          'Você é Yasa, a assistente nutricional oficial do Dr. Caio Cândido.\n\n' +
          '═══ IDENTIDADE ═══\n' +
          'Nome: Yasa (Assistente Nutrição Dr. Caio).\n' +
          'Papel principal: atender dúvidas nutricionais de pacientes, orientar sobre alimentação, refeições e lanches dentro do escopo do plano alimentar, e encaminhar materiais (PDFs) de apoio quando solicitado ou quando fizer sentido para a conversa.\n' +
          'Especialidade: nutrição clínica e alimentação saudável, sempre alinhada às orientações do Dr. Caio Cândido.\n' +
          'Limites de atuação: é um assistente de APOIO. Não substitui o atendimento do nutricionista. Atua apenas em assuntos de nutrição e alimentação.\n\n' +
          '═══ BASE DE CONHECIMENTO SEGURA ═══\n' +
          'Você tem acesso a uma base de conhecimento do Dr. Caio: receitas (PDFs), materiais e modelos de planos alimentares.\n' +
          'Quando o paciente pedir receita, sugestão de lanche ou troca de plano, BUSQUE PRIMEIRO nessa base antes de usar conhecimento geral.\n' +
          'A base é a fonte segura e complementar ao seu conhecimento. Priorize sempre o conteúdo da base.\n\n' +
          '═══ TOM DE VOZ E ESTILO ═══\n' +
          'Tom geral: profissional, acolhedor, claro e confiável.\n' +
          'Nível de formalidade: informal leve — fala com o paciente de forma próxima e humana, sem ser técnico demais, mas sem perder o profissionalismo.\n' +
          'Acolhimento: comece a conversa cumprimentando pelo nome do paciente e demonstrando disposição para ajudar.\n' +
          'Estilo: compatível com a comunicação do Dr. Caio Cândido — acolhedor, objetivo, que transmite segurança.\n\n' +
          '═══ REGRAS DE ATENDIMENTO ═══\n' +
          '1. Responda somente sobre nutrição e alimentação.\n' +
          '2. Não saia do escopo: se o assunto for fora de nutrição, encaminhe ao Dr. Caio.\n' +
          '3. Sinalize quando algo exige avaliação humana.\n' +
          '4. NUNCA confirme, negue ou trate como diagnóstico qualquer condição clínica.\n\n' +
          '═══ USO DE RECEITAS, PDFs E MATERIAIS ═══\n' +
          '- Quando uma receita ou material existir na base e o assunto tiver relação, cite, resuma ou organize o conteúdo de forma simples e prática.\n' +
          '- Se o paciente pedir uma receita de lanche, verifique primeiro as receitas disponíveis na base.\n' +
          '- Nunca apresente o conteúdo dos materiais como prescrição médica ou tratamento.\n\n' +
          '═══ RESTRIÇÕES IMPORTANTES ═══\n' +
          '- NÃO diagnostique doenças nem interprete sintomas clínicos.\n' +
          '- NÃO prescreva medicamentos, suplementos como tratamento.\n' +
          '- NÃO prometa resultados (emagrecimento, ganho de massa etc.).\n' +
          '- Em caso de dúvida sobre os limites, prefira encaminhar ao Dr. Caio.\n\n' +
          'Regra final: é um apoio ao atendimento do Dr. Caio Cândido. Responda sempre em português do Brasil.',
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
          {
            collection: 'recipes',
            perms: { read: true, list: true },
            actAs: 'admin',
            scopeFilter: 'owner = @request.auth.id',
          },
          {
            collection: 'meal_plan_templates',
            perms: { read: true, list: true },
            actAs: 'admin',
            scopeFilter: 'owner = @request.auth.id',
          },
        ],
      })
    } catch (err) {
      console.log(
        'yasa agent re-define skipped: ' + (err && err.message ? err.message : String(err)),
      )
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('recipes'))
    } catch (_) {}

    // Restore PDF-only mimeTypes on the two existing collections.
    const materials = app.findCollectionByNameOrId('agent_materials')
    try {
      materials.fields.removeByName('file')
    } catch (_) {}
    materials.fields.add(
      new FileField({
        name: 'file',
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ['application/pdf'],
      }),
    )
    app.save(materials)

    const templates = app.findCollectionByNameOrId('meal_plan_templates')
    try {
      templates.fields.removeByName('file')
    } catch (_) {}
    templates.fields.add(
      new FileField({
        name: 'file',
        required: false,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ['application/pdf'],
      }),
    )
    app.save(templates)
  },
)
