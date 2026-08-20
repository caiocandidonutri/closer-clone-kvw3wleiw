/// <reference path="../pb_data/types.d.ts" />
// Add `image_url` field to `agent_materials` and sync `file` from `recipes` where missing

migrate(
  (app) => {
    // 1. Add image_url to agent_materials
    const matCol = app.findCollectionByNameOrId('agent_materials')
    if (!matCol.fields.getByName('image_url')) {
      matCol.fields.add(
        new TextField({
          name: 'image_url',
        }),
      )
      app.save(matCol)
    }

    // 2. Sync file field from source_collection ('recipes' / 'meal_plan_templates') to agent_materials
    try {
      const materials = app.findRecordsByFilter('agent_materials', '', '', 500, 0)
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i]
        const srcColl = m.getString('source_collection')
        const srcId = m.getString('source_id')
        const currentFile = m.getString('file')

        if (!currentFile && srcColl && srcId) {
          try {
            const srcRecord = app.findRecordById(srcColl, srcId)
            const srcFile = srcRecord.getString('file')
            if (srcFile) {
              m.set('file', srcFile)
              app.save(m)
              console.log(
                '[0035] Synced file for agent_material ' +
                  m.id +
                  ' from ' +
                  srcColl +
                  '/' +
                  srcId +
                  ': ' +
                  srcFile,
              )
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.log('[0035] Error syncing files: ' + (err && err.message ? err.message : String(err)))
    }
  },
  (app) => {
    try {
      const matCol = app.findCollectionByNameOrId('agent_materials')
      const imgField = matCol.fields.getByName('image_url')
      if (imgField) {
        matCol.fields.remove(imgField)
        app.save(matCol)
      }
    } catch (_) {}
  },
)
