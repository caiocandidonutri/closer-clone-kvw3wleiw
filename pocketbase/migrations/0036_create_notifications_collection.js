/// <reference path="../pb_data/types.d.ts" />
// Create notifications collection for proactive dietitian alerts:
// - 80% message limit reached
// - Subscription expiring in <= 3 days
// - Inactivity for 48 hours

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const patientsId = app.findCollectionByNameOrId('patients').id

    const notificationsCol = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule: 'owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: usersId, maxSelect: 1 },
        { name: 'patient_id', type: 'relation', collectionId: patientsId, maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          values: ['limit_80', 'expiring_soon', 'inactivity_48h', 'general'],
          maxSelect: 1,
        },
        { name: 'title', type: 'text' },
        { name: 'message', type: 'text', required: true },
        { name: 'read', type: 'bool' },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_owner ON notifications (owner)',
        'CREATE INDEX idx_notifications_patient ON notifications (patient_id)',
        'CREATE INDEX idx_notifications_read ON notifications (read)',
        'CREATE INDEX idx_notifications_created ON notifications (created DESC)',
      ],
    })

    app.save(notificationsCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('notifications'))
    } catch (_) {}
  },
)
