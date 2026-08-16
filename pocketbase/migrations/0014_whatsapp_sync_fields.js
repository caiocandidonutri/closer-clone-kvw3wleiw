// Adds the WhatsApp-sync fields consumed by the Evolution API webhook + sync
// import: remoteJid metadata, phone number, profile picture, pipeline stage,
// last-message tracking, etc. These are referenced by the frontend Contacts,
// Pipeline and Dashboard screens but did not exist on the live DB yet.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contacts')

    const add = (field) => {
      if (!col.fields.getByName(field.name)) col.fields.add(field)
    }

    add(new TextField({ name: 'remote_jid' }))
    add(new TextField({ name: 'phone_number' }))
    add(new TextField({ name: 'push_name' }))
    add(new TextField({ name: 'profile_picture_url' }))
    add(new TextField({ name: 'classification' }))
    add(new NumberField({ name: 'score' }))
    add(new BoolField({ name: 'last_message_from_me' }))
    add(new TextField({ name: 'pipeline_stage' }))
    add(new DateField({ name: 'last_message_at' }))

    // Index the WhatsApp identifiers used for lookups and sorting.
    col.addIndex('idx_contacts_remote_jid', false, 'remote_jid', '')
    col.addIndex('idx_contacts_last_message_at', false, 'last_message_at', '')

    app.save(col)

    // Backfill pipeline_stage for pre-existing contacts so the Kanban works.
    app
      .db()
      .newQuery(
        "UPDATE contacts SET pipeline_stage = 'Em Espera' WHERE pipeline_stage IS NULL OR pipeline_stage = ''",
      )
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contacts')
    try {
      col.removeIndex('idx_contacts_remote_jid')
    } catch (_) {}
    try {
      col.removeIndex('idx_contacts_last_message_at')
    } catch (_) {}
    ;[
      'remote_jid',
      'phone_number',
      'push_name',
      'profile_picture_url',
      'classification',
      'score',
      'last_message_from_me',
      'pipeline_stage',
      'last_message_at',
    ].forEach((name) => {
      try {
        const f = col.fields.getByName(name)
        if (f) col.fields.remove(f)
      } catch (_) {}
    })
    app.save(col)
  },
)
