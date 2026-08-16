/// <reference path="../pb_data/types.d.ts" />
// Switch the Yasa AI provider from Google Gemini to OpenAI (gpt-4o).
// - Adds `openai_api_key` (per-user config; falls back to OPENAI_API_KEY secret).
// - Replaces the `gemini_model` select values with OpenAI models
//   (gpt-4o-mini, gpt-4o). Existing per-row temperature/max_response_seconds
//   columns are reused unchanged.
migrate(
  (app) => {
    const configs = app.findCollectionByNameOrId('ai_agent_configs')

    // Per-user OpenAI API key (secret-style, stored as text).
    if (!configs.fields.getByName('openai_api_key')) {
      configs.fields.add(new TextField({ name: 'openai_api_key', required: false }))
    }

    // Replace the model select with OpenAI models. We cannot change a
    // select's values in place reliably across versions, so drop + re-add
    // the field under the same name the rest of the app already reads
    // (`gemini_model`) to avoid touching every consumer.
    try {
      configs.fields.removeByName('gemini_model')
    } catch (_) {}
    configs.fields.add(
      new SelectField({
        name: 'gemini_model',
        required: false,
        values: ['gpt-4o-mini', 'gpt-4o'],
        maxSelect: 1,
      }),
    )

    // Relax temperature bounds to OpenAI's 0..2 range (already 0..2 from
    // migration 0006, but ensure max_response_seconds stays sane).
    app.save(configs)

    // Backfill the seed user's model to an OpenAI model if it still holds
    // a Gemini value, so the agent works immediately after this migration.
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'caiocandidonutri@hotmail.com')
      try {
        const cfg = app.findFirstRecordByData('ai_agent_configs', 'owner', user.id)
        const cur = cfg.getString('gemini_model')
        if (cur.indexOf('gpt-') !== 0) cfg.set('gemini_model', 'gpt-4o-mini')
        app.save(cfg)
      } catch (_) {}
    } catch (_) {}
  },
  (app) => {
    const configs = app.findCollectionByNameOrId('ai_agent_configs')
    try {
      configs.fields.removeByName('openai_api_key')
    } catch (_) {}
    try {
      configs.fields.removeByName('gemini_model')
    } catch (_) {}
    configs.fields.add(
      new SelectField({
        name: 'gemini_model',
        required: false,
        values: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
        maxSelect: 1,
      }),
    )
    app.save(configs)
  },
)
