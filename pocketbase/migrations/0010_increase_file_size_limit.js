/// <reference path="../pb_data/types.d.ts" />
// Aumenta o limite de tamanho de upload do campo `file` nas coleções
// `recipes`, `meal_plan_templates` e `agent_materials` de 10 MB (10485760)
// para 50 MB (52428800), permitindo o upload de PDFs maiores.
//
// Mantém inalterados os demais metadados do campo (maxSelect, mimeTypes, etc.).
// Os mimeTypes são preservados com o mesmo conjunto definido na migration 0009.
migrate(
  (app) => {
    // 50 MB em bytes.
    const NEW_MAX_SIZE = 52428800

    // Mesmos mimeTypes definidos na migration 0009_recipes_and_broader_uploads.
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

    // Coleções cujo campo `file` terá o maxSize aumentado.
    // `agent_materials` só é alterado se existir e tiver o campo `file`.
    const targets = ['recipes', 'meal_plan_templates', 'agent_materials']

    for (const name of targets) {
      let col
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        // Coleção não existe — pula (ex.: agent_materials pode não existir).
        continue
      }

      let fileField
      try {
        fileField = col.fields.getByName('file')
      } catch (_) {
        // Sem campo `file` — pula.
        continue
      }

      // Só recria se for de fato um campo de arquivo e ainda não está no novo limite.
      if (!fileField || fileField.type !== 'file' || fileField.maxSize === NEW_MAX_SIZE) {
        continue
      }

      try {
        col.fields.removeByName('file')
      } catch (_) {}

      col.fields.add(
        new FileField({
          name: 'file',
          required: false,
          maxSelect: 1,
          maxSize: NEW_MAX_SIZE,
          mimeTypes: docMimes,
        }),
      )

      app.save(col)
    }
  },
  (app) => {
    // Reverte o maxSize para o limite anterior (10 MB).
    const PREV_MAX_SIZE = 10485760

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

    const targets = ['recipes', 'meal_plan_templates', 'agent_materials']

    for (const name of targets) {
      let col
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        continue
      }

      let fileField
      try {
        fileField = col.fields.getByName('file')
      } catch (_) {
        continue
      }

      if (!fileField || fileField.type !== 'file') {
        continue
      }

      try {
        col.fields.removeByName('file')
      } catch (_) {}

      col.fields.add(
        new FileField({
          name: 'file',
          required: false,
          maxSelect: 1,
          maxSize: PREV_MAX_SIZE,
          mimeTypes: docMimes,
        }),
      )

      app.save(col)
    }
  },
)
