/// <reference path="../pb_data/types.d.ts" />
// Endpoint: POST /backend/v1/notifications/delete-read
// Deletes all read notifications belonging to the logged-in user.
// Returns: { success: true, deleted_count: number }

routerAdd(
  'POST',
  '/backend/v1/notifications/delete-read',
  (e) => {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const userId = authRecord.id
    try {
      const readList =
        $app.findRecordsByFilter(
          'notifications',
          'owner = {:uid} && read = true',
          '-created',
          1000,
          0,
          { uid: userId },
        ) || []

      let count = 0
      for (let i = 0; i < readList.length; i++) {
        try {
          $app.delete(readList[i])
          count++
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        deleted_count: count,
      })
    } catch (err) {
      console.log('[delete-read] error: ' + err)
      return e.json(500, { error: 'Erro ao excluir notificações lidas' })
    }
  },
  $apis.requireAuth(),
)
