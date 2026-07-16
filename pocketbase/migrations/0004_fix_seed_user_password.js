migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const email = 'caiocandidonutri@hotmail.com'
    const password = 'Skip@Pass'

    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', email)
      user.setPassword(password)
      user.setVerified(true)
      user.set('name', 'Dr. Caio Cândido')
      app.save(user)
    } catch (_) {
      const user = new Record(usersCol)
      user.setEmail(email)
      user.setPassword(password)
      user.setVerified(true)
      user.set('name', 'Dr. Caio Cândido')
      app.save(user)
    }
  },
  (app) => {},
)
