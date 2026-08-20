/// <reference path="../pb_data/types.d.ts" />
// Link orphan contacts to patients (finding existing patient by phone or creating a new lead patient)

migrate(
  (app) => {
    const patCol = app.findCollectionByNameOrId('patients')
    const contacts = app.findRecordsByFilter(
      'contacts',
      "patient_id = '' || patient_id = null",
      '',
      500,
      0,
    )
    const allPatients = app.findRecordsByFilter('patients', '', '', 500, 0)

    const now = new Date()
    const nowIso = now.toISOString()
    const end3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const todayDate = nowIso.slice(0, 10)

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      const remoteJid = (contact.getString('remote_jid') || '').replace('@s.whatsapp.net', '')
      const phoneNumber = contact.getString('phone_number') || remoteJid
      const rawDigits = (phoneNumber || remoteJid).replace(/\D/g, '')

      if (!rawDigits) continue

      const last9 = rawDigits.slice(-9)
      let matchedPatient = null

      // Try matching by last 9 digits of phone
      if (last9.length >= 8) {
        for (let j = 0; j < allPatients.length; j++) {
          const p = allPatients[j]
          const pDigits = (p.getString('phone') || '').replace(/\D/g, '')
          if (pDigits && pDigits.slice(-9) === last9) {
            matchedPatient = p
            break
          }
        }
      }

      if (matchedPatient) {
        contact.set('patient_id', matchedPatient.id)
        app.save(contact)
      } else {
        // Create new patient record
        const pushName = contact.getString('push_name')
        const cName = contact.getString('name')
        const patientName = pushName || cName || 'Paciente WhatsApp'
        const ownerId = contact.getString('owner')

        const newPatient = new Record(patCol)
        newPatient.set('owner', ownerId)
        newPatient.set('name', patientName)
        newPatient.set(
          'phone',
          rawDigits.length <= 11 && rawDigits.indexOf('55') !== 0 ? '55' + rawDigits : rawDigits,
        )
        newPatient.set('status', 'trial')
        newPatient.set('subscription_plan', 'free_trial')
        newPatient.set('subscription_start', nowIso)
        newPatient.set('subscription_end', end3Days)
        newPatient.set('message_count_used', 0)
        newPatient.set('message_count_limit', 5)
        newPatient.set('registration_date', todayDate)
        if (ownerId) {
          newPatient.set('invited_by', ownerId)
        }

        app.save(newPatient)
        allPatients.push(newPatient)

        contact.set('patient_id', newPatient.id)
        app.save(contact)
      }
    }
  },
  (app) => {
    // No-op rollback
  },
)
