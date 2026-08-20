/// <reference path="../pb_data/types.d.ts" />
// Notifications logic:
// 1. Cron every 1 hour (cronAdd) checking active/trial patients:
//    - 80% message limit reached
//    - Subscription expiring in <= 3 days
//    - Inactivity for 48h (last message was > 48h ago)
//    - Deduplication: avoids duplicate unread notifications
// 2. GET /backend/v1/notifications — returns notifications for the logged in user
// 3. POST /backend/v1/notifications/:id/read — marks notification as read

cronAdd('check_notifications_cron', '0 * * * *', () => {
  console.log('[check_notifications] Running hourly proactive notifications check...')
  try {
    const patients =
      $app.findRecordsByFilter('patients', "status = 'active' || status = 'trial'", '', 1000, 0) ||
      []
    const now = new Date()
    const nowMs = now.getTime()
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    const fortyEightHoursMs = 48 * 60 * 60 * 1000

    const notifCol = $app.findCollectionByNameOrId('notifications')

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i]
      const ownerId = p.getString('owner')
      const patientId = p.id
      const name = p.getString('name') || 'Paciente'
      const plan = p.getString('subscription_plan') || 'free_trial'
      const used = p.getInt('message_count_used') || 0
      const limit = p.getInt('message_count_limit') || 0
      const endStr = p.getString('subscription_end')
      const contactId = p.getString('contact')

      if (!ownerId) continue

      // Rule 1: 80% message limit
      if (limit > 0 && used > 0) {
        const ratio = used / limit
        if (ratio >= 0.8) {
          // Check if unread notification already exists
          let exists = false
          try {
            const existing = $app.findFirstRecordByFilter(
              'notifications',
              "owner = {:owner} && patient_id = {:pid} && type = 'limit_80' && read = false",
              '-created',
              1,
              0,
              { owner: ownerId, pid: patientId },
            )
            if (existing) exists = true
          } catch (_) {}

          if (!exists) {
            const notif = new Record(notifCol)
            notif.set('owner', ownerId)
            notif.set('patient_id', patientId)
            notif.set('type', 'limit_80')
            notif.set('title', 'Limite de mensagens próximo')
            notif.set(
              'message',
              'Paciente ' +
                name +
                ' atingiu 80% do limite de mensagens (' +
                used +
                '/' +
                limit +
                ')',
            )
            notif.set('read', false)
            notif.set('metadata', {
              patient_name: name,
              plan: plan,
              message_count_used: used,
              message_count_limit: limit,
            })
            try {
              $app.save(notif)
              console.log('[check_notifications] created limit_80 for ' + name)
            } catch (err) {
              console.log(
                '[check_notifications] error saving limit_80: ' +
                  (err && err.message ? err.message : String(err)),
              )
            }
          }
        }
      }

      // Rule 2: Expiration in <= 3 days
      if (endStr) {
        const endDate = new Date(endStr)
        const diffMs = endDate.getTime() - nowMs
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

        if (diffMs > 0 && diffMs <= threeDaysMs) {
          let exists = false
          try {
            const existing = $app.findFirstRecordByFilter(
              'notifications',
              "owner = {:owner} && patient_id = {:pid} && type = 'expiring_soon' && read = false",
              '-created',
              1,
              0,
              { owner: ownerId, pid: patientId },
            )
            if (existing) exists = true
          } catch (_) {}

          if (!exists) {
            const daysLabel = diffDays <= 1 ? '1 dia' : diffDays + ' dias'
            const notif = new Record(notifCol)
            notif.set('owner', ownerId)
            notif.set('patient_id', patientId)
            notif.set('type', 'expiring_soon')
            notif.set('title', 'Plano expirando')
            notif.set('message', 'Plano de ' + name + ' expira em ' + daysLabel + ' (' + plan + ')')
            notif.set('read', false)
            notif.set('metadata', {
              patient_name: name,
              plan: plan,
              subscription_end: endStr,
              days_left: diffDays,
            })
            try {
              $app.save(notif)
              console.log('[check_notifications] created expiring_soon for ' + name)
            } catch (err) {
              console.log(
                '[check_notifications] error saving expiring_soon: ' +
                  (err && err.message ? err.message : String(err)),
              )
            }
          }
        }
      }

      // Rule 3: Inactivity 48h
      let lastMsgDate = null
      if (contactId) {
        try {
          const lastMsg = $app.findFirstRecordByFilter(
            'messages',
            'contact = {:cid}',
            '-created',
            1,
            0,
            { cid: contactId },
          )
          if (lastMsg) {
            const tsStr = lastMsg.getString('created') || lastMsg.getString('timestamp')
            if (tsStr) lastMsgDate = new Date(tsStr)
          }
        } catch (_) {}
      }

      if (!lastMsgDate) {
        // Check contact's last_message_at or created
        try {
          const contact = contactId ? $app.findRecordById('contacts', contactId) : null
          if (contact) {
            const lma = contact.getString('last_message_at') || contact.getString('created')
            if (lma) lastMsgDate = new Date(lma)
          }
        } catch (_) {}
      }

      // If we have a last message date or patient registration date
      if (!lastMsgDate) {
        const regStr = p.getString('created') || p.getString('registration_date')
        if (regStr) lastMsgDate = new Date(regStr)
      }

      if (lastMsgDate) {
        const diffMs = nowMs - lastMsgDate.getTime()
        if (diffMs >= fortyEightHoursMs) {
          let exists = false
          try {
            const existing = $app.findFirstRecordByFilter(
              'notifications',
              "owner = {:owner} && patient_id = {:pid} && type = 'inactivity_48h' && read = false",
              '-created',
              1,
              0,
              { owner: ownerId, pid: patientId },
            )
            if (existing) exists = true
          } catch (_) {}

          if (!exists) {
            const notif = new Record(notifCol)
            notif.set('owner', ownerId)
            notif.set('patient_id', patientId)
            notif.set('type', 'inactivity_48h')
            notif.set('title', 'Paciente inativo')
            notif.set('message', name + ' não interage há mais de 48h')
            notif.set('read', false)
            notif.set('metadata', {
              patient_name: name,
              plan: plan,
              last_message_at: lastMsgDate.toISOString(),
            })
            try {
              $app.save(notif)
              console.log('[check_notifications] created inactivity_48h for ' + name)
            } catch (err) {
              console.log(
                '[check_notifications] error saving inactivity_48h: ' +
                  (err && err.message ? err.message : String(err)),
              )
            }
          }
        }
      }
    }
  } catch (globalErr) {
    console.log(
      '[check_notifications] global error in cron: ' +
        (globalErr && globalErr.message ? globalErr.message : String(globalErr)),
    )
  }
})

// Endpoint GET /backend/v1/notifications
routerAdd(
  'GET',
  '/backend/v1/notifications',
  (e) => {
    let ownerId = ''
    const authRecord = e.auth
    if (authRecord && authRecord.id) {
      ownerId = authRecord.id
    }

    if (!ownerId) {
      try {
        const integ = $app.findFirstRecordByFilter(
          'integrations',
          "status = 'CONNECTED'",
          '-created',
          1,
          0,
        )
        if (integ) ownerId = integ.getString('owner')
      } catch (_) {}
    }

    if (!ownerId) {
      try {
        const adminEmail =
          $os.getenv('NUTRI_OWNER_EMAIL') ||
          $secrets.get('NUTRI_OWNER_EMAIL') ||
          'caiocandidonutri@hotmail.com'
        const admin = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
        if (admin) ownerId = admin.id
      } catch (_) {}
    }

    let filter = ''
    if (ownerId) {
      filter = "owner = '" + ownerId + "'"
    }

    try {
      const records = $app.findRecordsByFilter('notifications', filter, '-created', 100, 0) || []
      const list = []
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        list.push({
          id: r.id,
          owner: r.getString('owner'),
          patient_id: r.getString('patient_id'),
          type: r.getString('type') || 'general',
          title: r.getString('title') || '',
          message: r.getString('message') || '',
          read: r.getBool('read'),
          metadata: r.get('metadata') || null,
          created: r.getString('created'),
          updated: r.getString('updated'),
        })
      }
      return e.json(200, {
        items: list,
        total: list.length,
        unread_count: list.filter(function (item) {
          return !item.read
        }).length,
      })
    } catch (err) {
      console.log(
        '[notifications] error listing: ' + (err && err.message ? err.message : String(err)),
      )
      return e.json(500, {
        error: 'Erro ao listar notificações',
      })
    }
  },
  $apis.request(),
)

// Endpoint POST /backend/v1/notifications/{id}/read
routerAdd(
  'POST',
  '/backend/v1/notifications/{id}/read',
  (e) => {
    const id = e.requestInfo().pathParams.id
    if (!id) {
      return e.json(400, { error: 'ID da notificação é obrigatório' })
    }

    try {
      const notif = $app.findRecordById('notifications', id)
      notif.set('read', true)
      $app.save(notif)
      return e.json(200, {
        success: true,
        id: notif.id,
        read: true,
      })
    } catch (err) {
      console.log(
        '[notifications] error marking read: ' + (err && err.message ? err.message : String(err)),
      )
      return e.json(404, {
        error: 'Notificação não encontrada',
      })
    }
  },
  $apis.request(),
)

// Endpoint POST /backend/v1/notifications/read-all (convenience)
routerAdd(
  'POST',
  '/backend/v1/notifications/read-all',
  (e) => {
    let ownerId = ''
    const authRecord = e.auth
    if (authRecord && authRecord.id) {
      ownerId = authRecord.id
    }

    if (!ownerId) {
      try {
        const adminEmail =
          $os.getenv('NUTRI_OWNER_EMAIL') ||
          $secrets.get('NUTRI_OWNER_EMAIL') ||
          'caiocandidonutri@hotmail.com'
        const admin = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
        if (admin) ownerId = admin.id
      } catch (_) {}
    }

    let filter = 'read = false'
    if (ownerId) {
      filter = "owner = '" + ownerId + "' && read = false"
    }

    try {
      const unreadList = $app.findRecordsByFilter('notifications', filter, '-created', 500, 0) || []
      for (let i = 0; i < unreadList.length; i++) {
        const n = unreadList[i]
        n.set('read', true)
        $app.save(n)
      }
      return e.json(200, {
        success: true,
        marked_count: unreadList.length,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao marcar todas como lidas' })
    }
  },
  $apis.request(),
)

// Endpoint POST /backend/v1/notifications/trigger-check (convenience to trigger check on demand)
routerAdd(
  'POST',
  '/backend/v1/notifications/trigger-check',
  (e) => {
    try {
      const patients =
        $app.findRecordsByFilter(
          'patients',
          "status = 'active' || status = 'trial'",
          '',
          1000,
          0,
        ) || []
      const now = new Date()
      const nowMs = now.getTime()
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000
      const fortyEightHoursMs = 48 * 60 * 60 * 1000

      const notifCol = $app.findCollectionByNameOrId('notifications')
      let createdCount = 0

      for (let i = 0; i < patients.length; i++) {
        const p = patients[i]
        const ownerId = p.getString('owner')
        const patientId = p.id
        const name = p.getString('name') || 'Paciente'
        const plan = p.getString('subscription_plan') || 'free_trial'
        const used = p.getInt('message_count_used') || 0
        const limit = p.getInt('message_count_limit') || 0
        const endStr = p.getString('subscription_end')
        const contactId = p.getString('contact')

        if (!ownerId) continue

        // Rule 1: 80% message limit
        if (limit > 0 && used > 0) {
          const ratio = used / limit
          if (ratio >= 0.8) {
            let exists = false
            try {
              const existing = $app.findFirstRecordByFilter(
                'notifications',
                "owner = {:owner} && patient_id = {:pid} && type = 'limit_80' && read = false",
                '-created',
                1,
                0,
                { owner: ownerId, pid: patientId },
              )
              if (existing) exists = true
            } catch (_) {}

            if (!exists) {
              const notif = new Record(notifCol)
              notif.set('owner', ownerId)
              notif.set('patient_id', patientId)
              notif.set('type', 'limit_80')
              notif.set('title', 'Limite de mensagens próximo')
              notif.set(
                'message',
                'Paciente ' +
                  name +
                  ' atingiu 80% do limite de mensagens (' +
                  used +
                  '/' +
                  limit +
                  ')',
              )
              notif.set('read', false)
              notif.set('metadata', {
                patient_name: name,
                plan: plan,
                message_count_used: used,
                message_count_limit: limit,
              })
              $app.save(notif)
              createdCount++
            }
          }
        }

        // Rule 2: Expiration in <= 3 days
        if (endStr) {
          const endDate = new Date(endStr)
          const diffMs = endDate.getTime() - nowMs
          const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

          if (diffMs > 0 && diffMs <= threeDaysMs) {
            let exists = false
            try {
              const existing = $app.findFirstRecordByFilter(
                'notifications',
                "owner = {:owner} && patient_id = {:pid} && type = 'expiring_soon' && read = false",
                '-created',
                1,
                0,
                { owner: ownerId, pid: patientId },
              )
              if (existing) exists = true
            } catch (_) {}

            if (!exists) {
              const daysLabel = diffDays <= 1 ? '1 dia' : diffDays + ' dias'
              const notif = new Record(notifCol)
              notif.set('owner', ownerId)
              notif.set('patient_id', patientId)
              notif.set('type', 'expiring_soon')
              notif.set('title', 'Plano expirando')
              notif.set(
                'message',
                'Plano de ' + name + ' expira em ' + daysLabel + ' (' + plan + ')',
              )
              notif.set('read', false)
              notif.set('metadata', {
                patient_name: name,
                plan: plan,
                subscription_end: endStr,
                days_left: diffDays,
              })
              $app.save(notif)
              createdCount++
            }
          }
        }

        // Rule 3: Inactivity 48h
        let lastMsgDate = null
        if (contactId) {
          try {
            const lastMsg = $app.findFirstRecordByFilter(
              'messages',
              'contact = {:cid}',
              '-created',
              1,
              0,
              { cid: contactId },
            )
            if (lastMsg) {
              const tsStr = lastMsg.getString('created') || lastMsg.getString('timestamp')
              if (tsStr) lastMsgDate = new Date(tsStr)
            }
          } catch (_) {}
        }

        if (!lastMsgDate) {
          try {
            const contact = contactId ? $app.findRecordById('contacts', contactId) : null
            if (contact) {
              const lma = contact.getString('last_message_at') || contact.getString('created')
              if (lma) lastMsgDate = new Date(lma)
            }
          } catch (_) {}
        }

        if (!lastMsgDate) {
          const regStr = p.getString('created') || p.getString('registration_date')
          if (regStr) lastMsgDate = new Date(regStr)
        }

        if (lastMsgDate) {
          const diffMs = nowMs - lastMsgDate.getTime()
          if (diffMs >= fortyEightHoursMs) {
            let exists = false
            try {
              const existing = $app.findFirstRecordByFilter(
                'notifications',
                "owner = {:owner} && patient_id = {:pid} && type = 'inactivity_48h' && read = false",
                '-created',
                1,
                0,
                { owner: ownerId, pid: patientId },
              )
              if (existing) exists = true
            } catch (_) {}

            if (!exists) {
              const notif = new Record(notifCol)
              notif.set('owner', ownerId)
              notif.set('patient_id', patientId)
              notif.set('type', 'inactivity_48h')
              notif.set('title', 'Paciente inativo')
              notif.set('message', name + ' não interage há mais de 48h')
              notif.set('read', false)
              notif.set('metadata', {
                patient_name: name,
                plan: plan,
                last_message_at: lastMsgDate.toISOString(),
              })
              $app.save(notif)
              createdCount++
            }
          }
        }
      }

      return e.json(200, {
        success: true,
        created_count: createdCount,
      })
    } catch (err) {
      return e.json(500, {
        error:
          'Erro ao verificar notificações: ' + (err && err.message ? err.message : String(err)),
      })
    }
  },
  $apis.request(),
)
