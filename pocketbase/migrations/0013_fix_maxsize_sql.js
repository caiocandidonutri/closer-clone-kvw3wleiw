/// <reference path="../pb_data/types.d.ts" />
// Corrige o erro `validation_file_size_limit` (HTTP 400) ao fazer upload de PDFs
// maiores que 10 MB nas coleções `recipes`, `meal_plan_templates` e `agent_materials`.
//
// As migrations anteriores (0010, 0011, 0012) tentaram `col.fields.getByName` +
// `removeByName`/`add` e `fileField.maxSize = ...`, porém os `try/catch`
// silenciosos mascaravam falhas e o limite persistia em 10 MB (10485760 bytes).
//
// Esta migration recria o campo `file` de cada coleção do zero via
// `removeByName` + `add(new FileField(...))` SEM try/catch — qualquer erro
// propaga e aborta a migration, em vez de ser silenciado.
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

    const targets = ['recipes', 'meal_plan_templates', 'agent_materials']

    for (const name of targets) {
      // Carrega a coleção; propaga se não existir.
      const col = app.findCollectionByNameOrId(name)

      // Remove o campo `file` existente; propaga se houver erro.
      col.fields.removeByName('file')

      // Recria com o novo maxSize.
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
      const col = app.findCollectionByNameOrId(name)
      col.fields.removeByName('file')
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
