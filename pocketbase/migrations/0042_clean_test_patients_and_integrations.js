/// <reference path="../pb_data/types.d.ts" />
// Migration 0042: Pré-lançamento Nutri Responde
// 1) Limpeza de 9 pacientes de teste criados em agosto/2026 e seus dados órfãos (mensagens, notificações, contatos vinculados)
// 2) Normalização do plano 'free_trial' para message_limit = 3 e 3 dias de duração
// 3) Remoção de instâncias antigas da Evolution API (mantendo apenas 'k1qd8pnhtun4z0s' / 'ins_nsguwfha')
//    e preenchimento preventivo do webhook_url na instância mantida.

migrate(
  (app) => {
    // ── 1. Limpeza de pacientes de teste e registros associados ──
    const testPatientIds = [
      'kp4drho7zyr0dmg', // Hercules
      'yejzvzwgs9srrlo', // Elisa Geraldo
      '8ui0bouvhplr9mg', // Fabiana Assistente
      'csak1omp99ck5w6', // Michelle Assistente
      '5mtpvusdtmxec2r', // Michelle Ferreira
      'ej1bmj5olyplgqm', // Bárbara Baldini 🦷
      'nw353054huwsujo', // Dr. Caio Candido
      '49nzqw6w62c13je', // Bárbara Gonçalves Baldini
      '2j6ufv6chfem0y4', // Caio Candido
    ]

    const quotedPatientIds = testPatientIds.map((id) => "'" + id + "'").join(',')

    // A. Apagar mensagens relacionadas aos contatos vinculados a esses pacientes
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM messages 
        WHERE contact IN (
          SELECT id FROM contacts 
          WHERE patient_id IN (${quotedPatientIds})
        )
      `)
        .execute()
    } catch (err) {
      console.log('[0042_cleanup] Error deleting messages for test patients:', err)
    }

    // B. Apagar notificações relacionadas a esses pacientes
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM notifications 
        WHERE patient_id IN (${quotedPatientIds})
      `)
        .execute()
    } catch (err) {
      console.log('[0042_cleanup] Error deleting notifications for test patients:', err)
    }

    // C. Apagar contatos vinculados a esses pacientes ou com os telefones de teste
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM contacts 
        WHERE patient_id IN (${quotedPatientIds})
      `)
        .execute()
    } catch (err) {
      console.log('[0042_cleanup] Error deleting contacts for test patients:', err)
    }

    // D. Apagar os próprios pacientes de teste
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM patients 
        WHERE id IN (${quotedPatientIds})
           OR (owner = '3zyy01r8a6a6kuw' AND created < '2026-09-01')
      `)
        .execute()
    } catch (err) {
      console.log('[0042_cleanup] Error deleting patients:', err)
    }

    // ── 2. Normalização do plano free_trial ──
    try {
      const freePlan = app.findFirstRecordByData('subscription_plans', 'slug', 'free_trial')
      freePlan.set('message_limit', 3)
      freePlan.set('duration_days', 3)
      freePlan.set('limit_type', 'total')
      freePlan.set('has_all_features', false)
      freePlan.set('price_brl', 0)
      app.save(freePlan)
      console.log('[0042_cleanup] free_trial subscription_plan normalized to 3 messages')
    } catch (err) {
      console.log('[0042_cleanup] subscription_plans free_trial record not found or error:', err)
    }

    // ── 3. Limpeza de integrações Evolution API antigas ──
    const oldIntegrationIds = [
      '6vnlsptfpxum3qo', // ins_qozj0g9s
      '4zocrormns8p78y', // ins_3gn6ctze
      'b1smemmgdd3nhpp', // ins_rmp1ubju
    ]
    const quotedOldIntegIds = oldIntegrationIds.map((id) => "'" + id + "'").join(',')

    try {
      app
        .db()
        .newQuery(`
        DELETE FROM integrations 
        WHERE id IN (${quotedOldIntegIds})
      `)
        .execute()
      console.log('[0042_cleanup] Old integrations deleted')
    } catch (err) {
      console.log('[0042_cleanup] Error deleting old integrations:', err)
    }

    // Preencher preventivamente o webhook_url na instância mantida (k1qd8pnhtun4z0s / ins_nsguwfha)
    try {
      const kept = app.findFirstRecordByData('integrations', 'instance_name', 'ins_nsguwfha')
      const pbUrl = (
        $secrets.get('PB_INSTANCE_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        'https://warm-market-crm-clone-7c1f6.shrd02.internal.goskip.dev'
      ).replace(/\/$/, '')
      const webhookUrl = pbUrl + '/backend/v1/webhook/evolution'

      kept.set('webhook_url', webhookUrl)
      app.save(kept)
      console.log(
        '[0042_cleanup] Kept integration ins_nsguwfha updated with webhook_url=' + webhookUrl,
      )
    } catch (err) {
      console.log('[0042_cleanup] Could not update kept integration ins_nsguwfha webhook_url:', err)
    }
  },
  (app) => {
    // Reversão no-op: registros de teste e integrações obsoletas não devem ser recriados.
  },
)
