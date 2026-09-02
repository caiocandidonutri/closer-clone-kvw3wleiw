/// <reference path="../pb_data/types.d.ts" />
// Endpoint: POST /backend/v1/notifications/ai-draft
// Generates a personalized message from Dr. Caio / Yasa to the patient based on notification type and context.
// Returns: { success: true, draft: string, patient: { id, name, phone }, contact_found: boolean }

routerAdd(
  'POST',
  '/backend/v1/notifications/ai-draft',
  (e) => {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Não autorizado' })
    }

    const raw = e.requestInfo().body
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
    const notificationId = body.notification_id || body.notificationId
    let patientId = body.patient_id || body.patientId
    const customPrompt = body.custom_prompt || ''

    let notif = null
    if (notificationId) {
      try {
        notif = $app.findRecordById('notifications', notificationId)
        if (!patientId) {
          patientId = notif.getString('patient_id')
        }
      } catch (_) {}
    }

    let patient = null
    if (patientId) {
      try {
        patient = $app.findRecordById('patients', patientId)
      } catch (_) {}
    }

    const patientName = patient
      ? patient.getString('name')
      : (notif && notif.get('metadata') && notif.get('metadata').patient_name) || 'Paciente'
    const notifType = notif ? notif.getString('type') : body.type || 'general'
    const notifTitle = notif ? notif.getString('title') : ''
    const notifMsg = notif ? notif.getString('message') : ''
    const meta = (notif ? notif.get('metadata') : body.metadata) || {}

    const plan = (patient ? patient.getString('subscription_plan') : meta.plan) || 'free_trial'
    const used = patient ? patient.getInt('message_count_used') : meta.message_count_used || 0
    const limit = patient ? patient.getInt('message_count_limit') : meta.message_count_limit || 0
    const daysLeft = meta.days_left || 0

    let contextInfo = `Nome do paciente: ${patientName}\nTipo de notificação: ${notifType} (${notifTitle})\nDetalhes: ${notifMsg}\nPlano: ${plan}\nMensagens usadas: ${used}/${limit}`
    if (daysLeft) contextInfo += `\nDias restantes do plano: ${daysLeft}`

    let systemPrompt =
      'Você é o assistente inteligente do Dr. Caio Cândido (Nutri Responde). ' +
      'Sua tarefa é redigir uma mensagem acolhedora, humana e motivadora para o Dr. Caio (ou a assistente Yasa) enviar via WhatsApp para o paciente.\n\n' +
      'Regras:\n' +
      '1. Tom: profissional, acolhedor, empático e incentivador (português do Brasil).\n' +
      '2. Usar formatação de WhatsApp com quebras de linha e emojis com moderação (💚, 🥗, 🎯, ✨).\n' +
      '3. Conforme o tipo:\n' +
      '   - "limit_80": avisar com carinho que o limite de mensagens do plano está quase no fim, reforçar o progresso dele e convidar a fazer upgrade ou perguntar se precisa de ajuda.\n' +
      '   - "expiring_soon": lembrar gentilmente que o ciclo do plano está terminando em poucos dias e reforçar a importância da constância nos resultados.\n' +
      '   - "inactivity_48h": perguntar como foi o dia/refeições, se teve dificuldade com o cardápio ou se precisa de alguma orientação rápida.\n' +
      '   - Outros: mensagem simpática de acompanhamento.\n' +
      '4. Nunca seja robótico. Assine ou mencione "Dr. Caio e equipe Yasa" ou similar de forma natural.\n' +
      '5. Retorne APENAS o texto da mensagem pronta para envio, sem introduções ou explicações adicionais.'

    let draft = ''
    try {
      // Use $ai.chat (fast model)
      const aiRes = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Gere a mensagem para o seguinte contexto:\n${contextInfo}${customPrompt ? `\nInstrução extra do nutricionista: ${customPrompt}` : ''}`,
          },
        ],
      })
      if (aiRes && aiRes.choices && aiRes.choices[0] && aiRes.choices[0].message) {
        draft = aiRes.choices[0].message.content.trim()
      }
    } catch (aiErr) {
      console.log('[ai-draft] $ai.chat fallback error: ' + aiErr)
      // Fallback deterministic template
      if (notifType === 'limit_80') {
        draft = `Olá, ${patientName}! 💚 Passando para te parabenizar pela dedicação com suas dúvidas e rotina alimentar! Vi que você já usou ${used} de ${limit} mensagens do seu plano. Se quiser continuar tirando dúvidas sem interrupção, posso te ajudar a renovar ou liberar mais mensagens. Como estão indo suas refeições hoje? 🥗✨`
      } else if (notifType === 'expiring_soon') {
        draft = `Olá, ${patientName}! 💚 Como você está? Lembrei de você hoje: seu plano de acompanhamento expira em ${daysLeft > 0 ? daysLeft + ' dias' : 'breve'}. A constância é o maior segredo para consolidar seus resultados! Vamos continuar juntos nessa jornada? Se precisar do link de renovação, só me avisar por aqui. 🎯`
      } else if (notifType === 'inactivity_48h') {
        draft = `Oi, ${patientName}! 💚 Notei que você não mandou mensagens nos últimos dias. Como está sendo sua rotina com a alimentação? Conseguiu seguir o plano ou surgiu alguma dúvida? Estou por aqui para te apoiar no que precisar! 🤗🥗`
      } else {
        draft = `Olá, ${patientName}! 💚 Dr. Caio passando para saber como estão as coisas com a sua alimentação e seu plano nutricional. Como posso te ajudar hoje? ✨`
      }
    }

    return e.json(200, {
      success: true,
      draft: draft,
      patient_id: patientId || '',
      patient_name: patientName,
      patient_phone: patient ? patient.getString('phone') : '',
    })
  },
  $apis.requireAuth(),
)
