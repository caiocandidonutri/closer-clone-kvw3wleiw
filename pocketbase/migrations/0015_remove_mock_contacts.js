// Remove os contatos "mock" (sem remote_jid) e suas mensagens associadas.
//
// Critério de mock: contatos onde `remote_jid` está vazio/ausente — ou seja,
// nunca foram importados de uma instância real do WhatsApp via Evolution API.
// Contatos reais (com remote_jid preenchido) são preservados.
//
// A exclusão é segura e idempotente: rodar novamente não faz nada se não houver mocks.
migrate(
  (app) => {
    // 1. Localiza todos os contatos sem remote_jid (mocks).
    const mockContacts = app.findRecordsByFilter(
      'contacts',
      "remote_jid = '' || remote_jid = null",
      'created',
      0,
      0,
    )

    let deletedContacts = 0
    let deletedMessages = 0

    for (let i = 0; i < mockContacts.length; i++) {
      const c = mockContacts[i]
      const cid = c.id

      // 2. Exclui as mensagens vinculadas a este contato.
      try {
        const msgs = app.findRecordsByFilter('messages', 'contact = {:cid}', 'created', 0, 0, {
          cid: cid,
        })
        for (let k = 0; k < msgs.length; k++) {
          try {
            app.delete(msgs[k])
            deletedMessages++
          } catch (_) {}
        }
      } catch (_) {}

      // 3. Exclui o próprio contato mock.
      try {
        app.delete(c)
        deletedContacts++
      } catch (_) {}
    }

    console.log(
      '[0015] Mocks removidos: ' +
        deletedContacts +
        ' contatos, ' +
        deletedMessages +
        ' mensagens.',
    )
  },
  (app) => {
    // Reversão não aplicável: dados mock excluídos não podem ser recriados
    // automaticamente. Não-op intencional.
  },
)
