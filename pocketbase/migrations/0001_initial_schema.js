migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    const integrations = new Collection({
      name: 'integrations',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'provider', type: 'text' },
        { name: 'instance_name', type: 'text' },
        { name: 'apikey', type: 'text' },
        { name: 'webhook_url', type: 'text' },
        { name: 'status', type: 'text' },
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_integrations_instance_name ON integrations (instance_name)',
        'CREATE INDEX idx_integrations_owner ON integrations (owner)',
      ],
    })
    app.save(integrations)

    const contacts = new Collection({
      name: 'contacts',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'whatsapp_id', type: 'text' },
        { name: 'status', type: 'select', values: ['pending', 'responded'], maxSelect: 1 },
        { name: 'avatar_url', type: 'text' },
        { name: 'last_message', type: 'text' },
        { name: 'wait_time_seconds', type: 'number' },
        { name: 'metadata', type: 'json' },
        { name: 'identity_vector', type: 'vector', dimensions: 1536, distance: 'cosine' },
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_contacts_whatsapp_id ON contacts (whatsapp_id)',
        'CREATE INDEX idx_contacts_status ON contacts (status)',
        'CREATE INDEX idx_contacts_owner ON contacts (owner)',
      ],
    })
    app.save(contacts)

    const contactsId = app.findCollectionByNameOrId('contacts').id

    const messages = new Collection({
      name: 'messages',
      type: 'base',
      listRule: 'contact.owner = @request.auth.id',
      viewRule: 'contact.owner = @request.auth.id',
      createRule: 'contact.owner = @request.auth.id',
      updateRule: 'contact.owner = @request.auth.id',
      deleteRule: 'contact.owner = @request.auth.id',
      fields: [
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'content', type: 'text' },
        { name: 'role', type: 'select', values: ['user', 'assistant', 'system'], maxSelect: 1 },
        { name: 'timestamp', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_messages_contact ON messages (contact)'],
    })
    app.save(messages)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('messages'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contacts'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('integrations'))
    } catch (_) {}
  },
)
