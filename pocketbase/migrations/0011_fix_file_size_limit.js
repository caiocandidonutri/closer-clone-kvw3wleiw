/// <reference path="../pb_data/types.d.ts" />
// Corrige o erro `validation_file_size_limit` (HTTP 400) ao fazer upload de PDFs
// maiores que 10 MB nas coleções `recipes`, `meal_plan_templates` e `agent_materials`.
//
// A migration anterior (0010) usava `col.fields.getByName('file')` seguido de
// `removeByName`/`add`, porém os `try/catch` silenciosos mascaravam a falha e o
// campo nunca era realmente recriado com o novo `maxSize` — o limite continuava em
// 10 MB (10485760 bytes).
//
// Esta migration usa uma abordagem DIFERENTE: itera sobre o array `col.fields`,
// localiza o campo `file` e modifica DIRETAMENTE a propriedade `maxSize` do campo
// encontrado (em PocketBase as propriedades do FileField são flat — maxSize,
// mimeTypes, maxSelect, etc. estão no próprio campo, não dentro de `options`).
// Não remove nem recria o campo, preservando todos os demais metadados.
migrate(
  (app) => {
    // 50 MB em bytes.
    const NEW_MAX_SIZE = 52428800

    // Coleções cujo campo `file` terá o maxSize aumentado.
    const targets = ['recipes', 'meal_plan_templates', 'agent_materials']

    for (const name of targets) {
      let col
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        // Coleção não existe — pula defensivamente.
        continue
      }

      // Itera sobre o array de campos para encontrar o `file`.
      // Não usa `col.fields.getByName('file')`.
      let fileField = null
      for (const field of col.fields) {
        if (field.name === 'file' && field.type === 'file') {
          fileField = field
          break
        }
      }

      // Campo `file` inexistente ou não é do tipo file — pula.
      if (!fileField) {
        continue
      }

      // Já está no limite desejado — nada a fazer.
      if (fileField.maxSize === NEW_MAX_SIZE) {
        continue
      }

      // Modifica diretamente a propriedade flat `maxSize` do campo FileField.
      fileField.maxSize = NEW_MAX_SIZE

      app.save(col)
    }
  },
  (app) => {
    // Reverte o maxSize para o limite anterior (10 MB).
    const PREV_MAX_SIZE = 10485760

    const targets = ['recipes', 'meal_plan_templates', 'agent_materials']

    for (const name of targets) {
      let col
      try {
        col = app.findCollectionByNameOrId(name)
      } catch (_) {
        continue
      }

      let fileField = null
      for (const field of col.fields) {
        if (field.name === 'file' && field.type === 'file') {
          fileField = field
          break
        }
      }

      if (!fileField) {
        continue
      }

      fileField.maxSize = PREV_MAX_SIZE

      app.save(col)
    }
  },
)
