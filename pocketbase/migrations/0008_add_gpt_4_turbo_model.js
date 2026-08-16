/// <reference path="../pb_data/types.d.ts" />
// Adds `gpt-4-turbo` as a selectable model in the Yasa agent config.
// The `gemini_model` select (repurposed for OpenAI models in 0007) only
// allowed gpt-4o-mini and gpt-4o — this expands it to include gpt-4-turbo.
migrate(
  (app) => {
    const configs = app.findCollectionByNameOrId('ai_agent_configs')
    try {
      configs.fields.removeByName('gemini_model')
    } catch (_) {}
    configs.fields.add(
      new SelectField({
        name: 'gemini_model',
        required: false,
        values: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        maxSelect: 1,
      }),
    )
    app.save(configs)
  },
  (app) => {
    const configs = app.findCollectionByNameOrId('ai_agent_configs')
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
    app.save(configs)
  },
)
