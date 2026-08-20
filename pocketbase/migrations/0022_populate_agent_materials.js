/// <reference path="../pb_data/types.d.ts" />
// Test migration execution log

migrate(
  (app) => {
    // Generate a test record directly
    const col = app.findCollectionByNameOrId('agent_materials')
    const rec = new Record(col)
    rec.set('owner', '3zyy01r8a6a6kuw')
    rec.set('title', 'Test Material 0022')
    rec.set('description', 'Test Description')
    rec.set('is_active', true)
    app.save(rec)
  },
  (app) => {
    try {
      app.db().newQuery("DELETE FROM agent_materials WHERE title = 'Test Material 0022'").execute()
    } catch (_) {}
  },
)
