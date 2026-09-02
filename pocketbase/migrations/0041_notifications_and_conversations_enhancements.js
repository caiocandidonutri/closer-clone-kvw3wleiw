/// <reference path="../pb_data/types.d.ts" />
// Migration 0041: Add follow_up fields to patients, flagged field to messages, read_at to notifications

migrate(
  (app) => {
    // 1. Extend notifications with read_at
    try {
      const notifCol = app.findCollectionByNameOrId('notifications')
      if (!notifCol.fields.getByName('read_at')) {
        notifCol.fields.add(new DateField({ name: 'read_at', required: false }))
      }
      app.save(notifCol)
    } catch (e) {
      console.log('Error adding read_at to notifications: ' + e)
    }

    // 2. Extend messages with flagged (para acompanhar)
    try {
      const msgCol = app.findCollectionByNameOrId('messages')
      if (!msgCol.fields.getByName('flagged')) {
        msgCol.fields.add(new BoolField({ name: 'flagged', required: false }))
      }
      app.save(msgCol)
      msgCol.addIndex('idx_messages_flagged', false, 'flagged', '')
      app.save(msgCol)
    } catch (e) {
      console.log('Error adding flagged to messages: ' + e)
    }

    // 3. Extend patients with follow_up_sent_at and weekly_summary_last_sent
    try {
      const patCol = app.findCollectionByNameOrId('patients')
      if (!patCol.fields.getByName('follow_up_sent_at')) {
        patCol.fields.add(new DateField({ name: 'follow_up_sent_at', required: false }))
      }
      if (!patCol.fields.getByName('follow_up_status')) {
        patCol.fields.add(
          new SelectField({
            name: 'follow_up_status',
            values: ['pending', 'sent', 'skipped'],
            maxSelect: 1,
            required: false,
          }),
        )
      }
      app.save(patCol)
    } catch (e) {
      console.log('Error adding follow_up fields to patients: ' + e)
    }
  },
  (app) => {
    try {
      const notifCol = app.findCollectionByNameOrId('notifications')
      notifCol.fields.removeByName('read_at')
      app.save(notifCol)
    } catch (_) {}

    try {
      const msgCol = app.findCollectionByNameOrId('messages')
      msgCol.removeIndex('idx_messages_flagged')
      msgCol.fields.removeByName('flagged')
      app.save(msgCol)
    } catch (_) {}

    try {
      const patCol = app.findCollectionByNameOrId('patients')
      patCol.fields.removeByName('follow_up_sent_at')
      patCol.fields.removeByName('follow_up_status')
      app.save(patCol)
    } catch (_) {}
  },
)
