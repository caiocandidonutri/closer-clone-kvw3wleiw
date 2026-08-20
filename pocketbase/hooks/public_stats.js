/// <reference path="../pb_data/types.d.ts" />
// Public stats endpoint:
// GET /api/public/stats
//
// Returns real counts for landing page stats:
// - patients_count: count of patients with status in ('active', 'trial')
// - messages_count: total count of messages
// - active_contacts: count of contacts with status = 'responded'

routerAdd(
  'GET',
  '/api/public/stats',
  (e) => {
    let patientsCount = 0
    let messagesCount = 0
    let activeContactsCount = 0

    // 1. Count active/trial patients
    try {
      const patients = $app.findRecordsByFilter(
        'patients',
        "status = 'active' || status = 'trial'",
        '',
        1000,
        0,
      )
      patientsCount = patients ? patients.length : 0
    } catch (err) {
      console.log(
        '[public_stats] error counting patients: ' +
          (err && err.message ? err.message : String(err)),
      )
    }

    // 2. Count total messages
    try {
      const messages = $app.findRecordsByFilter('messages', '', '', 5000, 0)
      messagesCount = messages ? messages.length : 0
    } catch (err) {
      console.log(
        '[public_stats] error counting messages: ' +
          (err && err.message ? err.message : String(err)),
      )
    }

    // 3. Count active contacts (status='responded')
    try {
      const contacts = $app.findRecordsByFilter('contacts', "status = 'responded'", '', 1000, 0)
      activeContactsCount = contacts ? contacts.length : 0
    } catch (err) {
      console.log(
        '[public_stats] error counting contacts: ' +
          (err && err.message ? err.message : String(err)),
      )
    }

    return e.json(200, {
      patients_count: patientsCount,
      messages_count: messagesCount,
      active_contacts: activeContactsCount,
    })
  },
  $apis.request(),
)
