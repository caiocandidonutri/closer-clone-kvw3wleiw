routerAdd(
  'POST',
  '/backend/v1/yasa/chat',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')
    const body = e.requestInfo().body || {}
    const message = (body.message || '').trim()
    if (!message) return e.badRequestError('message required')

    try {
      const result = $ai.agent('yasa-triage-agent').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })
      return e.json(200, {
        content: result.content,
        conversation_id: result.conversation_id,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError)
        return e.json(503, { error: 'AI temporarily unavailable' })
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, { error: status >= 500 ? 'agent request failed' : err.message })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: 'AI temporarily unavailable' })
      }
      return e.json(500, { error: 'agent failed' })
    }
  },
  $apis.requireAuth(),
)
