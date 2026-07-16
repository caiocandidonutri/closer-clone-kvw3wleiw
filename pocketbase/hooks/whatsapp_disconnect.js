routerAdd(
  'POST',
  '/backend/v1/whatsapp/disconnect',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const integrationId = body.integrationId
    if (!integrationId) return e.badRequestError('integrationId is required')

    let integ
    try {
      integ = $app.findFirstRecordByFilter('integrations', 'id = {:id} && owner = {:uid}', {
        id: integrationId,
        uid: userId,
      })
    } catch (_) {
      return e.notFoundError('Integration not found')
    }

    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evoUrl.length > 0 && evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || ''

    if (instanceName && evoUrl && evoKey) {
      $http.send({
        url: evoUrl + '/instance/logout/' + instanceName,
        method: 'DELETE',
        headers: { apikey: evoKey },
        timeout: 20,
      })
    }

    integ.set('status', 'DISCONNECTED')
    $app.save(integ)
    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
