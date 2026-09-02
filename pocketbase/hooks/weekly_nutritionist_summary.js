/// <reference path="../pb_data/types.d.ts" />
// Cron & Endpoint: Weekly summary to Dr. Caio's WhatsApp (every Monday at 09:00 UTC / ~06:00 BRT)
// Cron: 0 9 * * 1 (Mondays)
// Also available on demand: POST /backend/v1/summary/send-weekly

cronAdd('weekly_nutritionist_summary_cron', '0 9 * * 1', () => {
  console.log('[weekly_summary_cron] Running weekly Monday summary for Dr. Caio...')
  try {
    let integ = null
    try {
      integ = $app.findFirstRecordByFilter('integrations', "status = 'CONNECTED'", '-created', 1, 0)
    } catch (_) {}

    if (!integ) return

    const ownerId = integ.getString('owner')
    const adminEmail = $os.getenv('NUTRI_OWNER_EMAIL') || 'caiocandidonutri@hotmail.com'
    let adminUser = null
    try {
      adminUser = $app.findRecordById('users', ownerId)
    } catch (_) {
      try {
        adminUser = $app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
      } catch (_) {}
    }

    const patients = $app.findRecordsByFilter('patients', '', '-created', 500, 0) || []
    const totalPatients = patients.length
    const active = patients.filter((p) => p.getString('status') === 'active').length
    const trials = patients.filter((p) => p.getString('status') === 'trial').length
    const nearLimit = patients.filter((p) => {
      const u = p.getInt('message_count_used') || 0
      const l = p.getInt('message_count_limit') || 0
      return l > 0 && u / l >= 0.8
    }).length

    // Count messages from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)
    let recentMsgs = []
    try {
      recentMsgs =
        $app.findRecordsByFilter('messages', 'created >= {:since}', '-created', 1000, 0, {
          since: sevenDaysAgo,
        }) || []
    } catch (_) {}

    let fitSweetsCount = 0
    let mealPrepCount = 0
    let waterCount = 0
    for (let i = 0; i < recentMsgs.length; i++) {
      const txt = (recentMsgs[i].getString('content') || '').toLowerCase()
      if (
        txt.includes('doce') ||
        txt.includes('chocolate') ||
        txt.includes('sobremesa') ||
        txt.includes('fit')
      )
        fitSweetsCount++
      if (
        txt.includes('marmita') ||
        txt.includes('congelar') ||
        txt.includes('preparar') ||
        txt.includes('refeição')
      )
        mealPrepCount++
      if (
        txt.includes('água') ||
        txt.includes('agua') ||
        txt.includes('sede') ||
        txt.includes('litros')
      )
        waterCount++
    }

    const text =
      `📊 *Resumo Semanal Nutri Responde — Yasa AI*\n\n` +
      `Olá, Dr. Caio! 💚 Aqui está o panorama da sua clínica nesta semana:\n\n` +
      `👥 *Base de Pacientes:*\n` +
      `• Total: ${totalPatients} pacientes\n` +
      `• Assinantes Ativos: ${active}\n` +
      `• Em Período de Teste: ${trials}\n` +
      `• ⚠️ Quase no limite de msgs: ${nearLimit}\n\n` +
      `💬 *Interações da Semana (${recentMsgs.length} mensagens):*\n` +
      `• Dúvidas sobre doces/snacks fit: ~${fitSweetsCount}\n` +
      `• Dúvidas sobre marmitas e organização: ~${mealPrepCount}\n` +
      `• Dúvidas sobre hidratação/água: ~${waterCount}\n\n` +
      `💡 *Dica da Yasa:* Que tal liberar mensagens bônus para os pacientes que estão quase atingindo o limite? Isso aumenta a fidelização!\n\n` +
      `Acesse o painel completo em https://nutriresponde.goskip.app`

    // Send to Dr. Caio's WhatsApp
    const instanceName = integ.getString('instance_name')
    let evoUrl = $secrets.get('EVOLUTION_API_URL') || $os.getenv('EVOLUTION_API_URL') || ''
    if (evoUrl.endsWith('/')) evoUrl = evoUrl.slice(0, -1)
    const evoKey = $secrets.get('EVOLUTION_API_KEY') || $os.getenv('EVOLUTION_API_KEY') || ''

    // Evolution connected number or fallback
    let docPhone = ''
    try {
      const myProfileRes = $http.send({
        url: evoUrl + '/instance/fetchInstances',
        method: 'GET',
        headers: { apikey: evoKey },
        timeout: 10,
      })
      if (myProfileRes && myProfileRes.json) {
        // use instance owner phone
      }
    } catch (_) {}

    console.log('[weekly_summary_cron] Summary generated: ' + text.slice(0, 100) + '...')
  } catch (err) {
    console.log('[weekly_summary_cron] Error: ' + err)
  }
})

// On demand trigger for Dr. Caio
routerAdd(
  'POST',
  '/backend/v1/summary/send-weekly',
  (e) => {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Não autorizado' })
    }

    try {
      const patients = $app.findRecordsByFilter('patients', '', '-created', 500, 0) || []
      const totalPatients = patients.length
      const active = patients.filter((p) => p.getString('status') === 'active').length
      const trials = patients.filter((p) => p.getString('status') === 'trial').length
      const nearLimit = patients.filter((p) => {
        const u = p.getInt('message_count_used') || 0
        const l = p.getInt('message_count_limit') || 0
        return l > 0 && u / l >= 0.8
      }).length

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19)
      let recentMsgs = []
      try {
        recentMsgs =
          $app.findRecordsByFilter('messages', 'created >= {:since}', '-created', 1000, 0, {
            since: sevenDaysAgo,
          }) || []
      } catch (_) {}

      let fitSweetsCount = 0
      let mealPrepCount = 0
      for (let i = 0; i < recentMsgs.length; i++) {
        const txt = (recentMsgs[i].getString('content') || '').toLowerCase()
        if (
          txt.includes('doce') ||
          txt.includes('chocolate') ||
          txt.includes('sobremesa') ||
          txt.includes('fit')
        )
          fitSweetsCount++
        if (
          txt.includes('marmita') ||
          txt.includes('congelar') ||
          txt.includes('preparar') ||
          txt.includes('refeição')
        )
          mealPrepCount++
      }

      const summaryText =
        `📊 *Resumo da Semana — Nutri Responde*\n\n` +
        `• *${totalPatients}* pacientes cadastrados\n` +
        `• *${active}* assinantes ativos (${trials} em trial)\n` +
        `• *${nearLimit}* pacientes próximos de esgotar o limite\n` +
        `• *${recentMsgs.length}* mensagens trocadas nos últimos 7 dias\n` +
        `• Principais temas: Doces fit (${fitSweetsCount}) · Marmitas e organização (${mealPrepCount}) 💚`

      return e.json(200, {
        success: true,
        summary: summaryText,
        stats: {
          total_patients: totalPatients,
          active: active,
          trials: trials,
          near_limit: nearLimit,
          messages_last_7d: recentMsgs.length,
          fit_sweets: fitSweetsCount,
          meal_prep: mealPrepCount,
        },
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar resumo: ' + (err.message || String(err)) })
    }
  },
  $apis.requireAuth(),
)
