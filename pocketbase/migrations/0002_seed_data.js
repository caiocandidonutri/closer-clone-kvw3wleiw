migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'caiocandidonutri@hotmail.com')
    } catch (_) {
      user = new Record(usersCol)
      user.setEmail('caiocandidonutri@hotmail.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Dr. Caio Cândido')
      app.save(user)
    }

    const contactsCol = app.findCollectionByNameOrId('contacts')
    const messagesCol = app.findCollectionByNameOrId('messages')

    const seed = [
      {
        name: 'Marina Oliveira',
        wid: '5511999990001',
        status: 'pending',
        wait: 5400,
        last: 'Oi Dr. Caio, gostaria de saber sobre a consulta de menopausa',
        msgs: [
          {
            role: 'user',
            content: 'Oi Dr. Caio, gostaria de saber sobre a consulta de menopausa',
            mins: 90,
          },
          {
            role: 'assistant',
            content:
              'Olá Marina! Que bom ter você por aqui. Pode me contar um pouco sobre os sintomas que você está sentindo?',
            mins: 88,
          },
        ],
      },
      {
        name: 'Patrícia Souza',
        wid: '5511988880002',
        status: 'pending',
        wait: 7200,
        last: 'Estou com muita fadiga e ganho de peso',
        msgs: [{ role: 'user', content: 'Estou com muita fadiga e ganho de peso', mins: 120 }],
      },
      {
        name: 'Ricardo Alves',
        wid: '5511977770003',
        status: 'responded',
        wait: 0,
        last: 'Perfeito, obrigado pelo retorno!',
        msgs: [
          { role: 'user', content: 'Quando teria horário para consulta?', mins: 200 },
          {
            role: 'assistant',
            content:
              'Olá Ricardo! Tenho horário na quinta às 14h. Vou te enviar o link de agendamento.',
            mins: 195,
          },
          { role: 'user', content: 'Perfeito, obrigado pelo retorno!', mins: 190 },
        ],
      },
      {
        name: 'Fernanda Lima',
        wid: '5511966660004',
        status: 'pending',
        wait: 3600,
        last: 'Quero fazer a análise de exames',
        msgs: [{ role: 'user', content: 'Quero fazer a análise de exames', mins: 60 }],
      },
      {
        name: 'Juliana Castro',
        wid: '5511955550005',
        status: 'responded',
        wait: 0,
        last: 'Combinado então!',
        msgs: [
          { role: 'user', content: 'Vocês atendem emagrecimento integrativo?', mins: 300 },
          {
            role: 'assistant',
            content:
              'Sim Juliana! Trabalhamos com protocolos integrativos focados em saúde e autoestima. Vamos conversar?',
            mins: 295,
          },
          { role: 'user', content: 'Combinado então!', mins: 290 },
        ],
      },
      {
        name: 'Carlos Mendes',
        wid: '5511944440006',
        status: 'pending',
        wait: 1800,
        last: 'Boa, preciso de orientação sobre exames clínicos',
        msgs: [
          { role: 'user', content: 'Boa, preciso de orientação sobre exames clínicos', mins: 30 },
        ],
      },
    ]

    const now = Date.now()
    for (const s of seed) {
      let contact
      try {
        contact = app.findFirstRecordByData('contacts', 'whatsapp_id', s.wid)
      } catch (_) {
        contact = new Record(contactsCol)
        contact.set('name', s.name)
        contact.set('whatsapp_id', s.wid)
        contact.set('status', s.status)
        contact.set('owner', user.id)
        contact.set('last_message', s.last)
        contact.set('wait_time_seconds', s.wait)
        contact.set('avatar_url', '')
        app.save(contact)
      }

      for (const m of s.msgs) {
        const ts = new Date(now - m.mins * 60 * 1000).toISOString()
        const msg = new Record(messagesCol)
        msg.set('contact', contact.id)
        msg.set('content', m.content)
        msg.set('role', m.role)
        msg.set('timestamp', ts)
        app.save(msg)
      }
    }
  },
  (app) => {
    try {
      const contacts = app.findRecordsByFilter('contacts', '1=1', '', 500, 0)
      for (const c of contacts) app.delete(c)
    } catch (_) {}
    try {
      const msgs = app.findRecordsByFilter('messages', '1=1', '', 500, 0)
      for (const m of msgs) app.delete(m)
    } catch (_) {}
  },
)
