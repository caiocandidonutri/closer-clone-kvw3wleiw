/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // ── 1. Extend ai_agent_configs with Gemini runtime settings ──
    const configs = app.findCollectionByNameOrId('ai_agent_configs')
    if (!configs.fields.getByName('gemini_api_key')) {
      configs.fields.add(new TextField({ name: 'gemini_api_key', required: false }))
    }
    if (!configs.fields.getByName('gemini_model')) {
      configs.fields.add(
        new SelectField({
          name: 'gemini_model',
          required: false,
          values: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
          maxSelect: 1,
        }),
      )
    }
    if (!configs.fields.getByName('temperature')) {
      configs.fields.add(new NumberField({ name: 'temperature', required: false, min: 0, max: 2 }))
    }
    if (!configs.fields.getByName('max_response_seconds')) {
      configs.fields.add(
        new NumberField({
          name: 'max_response_seconds',
          required: false,
          min: 5,
          max: 120,
          onlyInt: true,
        }),
      )
    }
    app.save(configs)

    // ── 2. Extend messages with feedback + needs_human flag ──
    const messages = app.findCollectionByNameOrId('messages')
    if (!messages.fields.getByName('feedback')) {
      messages.fields.add(
        new SelectField({
          name: 'feedback',
          required: false,
          values: ['useful', 'not_useful'],
          maxSelect: 1,
        }),
      )
    }
    if (!messages.fields.getByName('needs_human')) {
      messages.fields.add(new BoolField({ name: 'needs_human', required: false }))
    }
    if (!messages.fields.getByName('ai_response_seconds')) {
      messages.fields.add(
        new NumberField({
          name: 'ai_response_seconds',
          required: false,
          min: 0,
          onlyInt: true,
        }),
      )
    }
    app.save(messages)
    try {
      messages.addIndex('idx_messages_needs_human', false, 'needs_human', '')
      app.save(messages)
    } catch (_) {}

    // ── 3. Extend contacts with meal plan photo reference + summary ──
    const contacts = app.findCollectionByNameOrId('contacts')
    if (!contacts.fields.getByName('meal_plan_photo')) {
      contacts.fields.add(
        new FileField({
          name: 'meal_plan_photo',
          required: false,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        }),
      )
    }
    if (!contacts.fields.getByName('meal_plan_summary')) {
      contacts.fields.add(new TextField({ name: 'meal_plan_summary', required: false }))
    }
    app.save(contacts)

    // ── 4. meal_plan_templates — Dr. Caio's most-prescribed plan templates ──
    const templates = new Collection({
      name: 'meal_plan_templates',
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
      indexes: ['CREATE INDEX idx_meal_plan_templates_owner ON meal_plan_templates (owner)'],
    })
    app.save(templates)

    // ── 5. yasa_feedback — feedback log per assistant message ──
    const feedback = new Collection({
      name: 'yasa_feedback',
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
        {
          name: 'message',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('messages').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'contact',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('contacts').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'rating',
          type: 'select',
          required: true,
          values: ['useful', 'not_useful'],
          maxSelect: 1,
        },
        { name: 'comment', type: 'text', required: false },
        { name: 'question_text', type: 'text', required: false },
        { name: 'answer_text', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_yasa_feedback_owner ON yasa_feedback (owner)',
        'CREATE INDEX idx_yasa_feedback_contact ON yasa_feedback (contact)',
      ],
    })
    app.save(feedback)

    // ── 6. Backfill default Gemini config for existing seed user (idempotent) ──
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'caiocandidonutri@hotmail.com')
      try {
        const cfg = app.findFirstRecordByData('ai_agent_configs', 'owner', user.id)
        if (!cfg.getString('gemini_model')) cfg.set('gemini_model', 'gemini-1.5-flash')
        if (cfg.get('temperature') === null || cfg.get('temperature') === '')
          cfg.set('temperature', 0.7)
        if (!cfg.get('max_response_seconds')) cfg.set('max_response_seconds', 30)
        app.save(cfg)
      } catch (_) {}
    } catch (_) {}
  },
  (app) => {
    // Best-effort rollback
    try {
      app.delete(app.findCollectionByNameOrId('yasa_feedback'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('meal_plan_templates'))
    } catch (_) {}

    const messages = app.findCollectionByNameOrId('messages')
    for (const f of ['feedback', 'needs_human', 'ai_response_seconds']) {
      try {
        messages.fields.removeByName(f)
      } catch (_) {}
    }
    try {
      messages.removeIndex('idx_messages_needs_human')
    } catch (_) {}
    app.save(messages)

    const contacts = app.findCollectionByNameOrId('contacts')
    for (const f of ['meal_plan_photo', 'meal_plan_summary']) {
      try {
        contacts.fields.removeByName(f)
      } catch (_) {}
    }
    app.save(contacts)

    const configs = app.findCollectionByNameOrId('ai_agent_configs')
    for (const f of ['gemini_api_key', 'gemini_model', 'temperature', 'max_response_seconds']) {
      try {
        configs.fields.removeByName(f)
      } catch (_) {}
    }
    app.save(configs)
  },
)
