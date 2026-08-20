/// <reference path="../pb_data/types.d.ts" />
// Populate agent_materials with recipes & meal_plans (tags, type, source_collection, source_id)
// and add patient_id relation to contacts + auto-link existing contacts with patients.

migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const patientsColId = app.findCollectionByNameOrId('patients').id

    // ── 1. Update agent_materials schema ──
    const matCol = app.findCollectionByNameOrId('agent_materials')
    if (!matCol.fields.getByName('type')) {
      matCol.fields.add(
        new SelectField({
          name: 'type',
          values: ['recipe', 'meal_plan', 'material'],
          maxSelect: 1,
        }),
      )
    }
    if (!matCol.fields.getByName('tags')) {
      matCol.fields.add(new JSONField({ name: 'tags' }))
    }
    if (!matCol.fields.getByName('source_collection')) {
      matCol.fields.add(new TextField({ name: 'source_collection' }))
    }
    if (!matCol.fields.getByName('source_id')) {
      matCol.fields.add(new TextField({ name: 'source_id' }))
    }
    app.save(matCol)

    // ── 2. Update contacts schema (add patient_id relation) ──
    const contCol = app.findCollectionByNameOrId('contacts')
    if (!contCol.fields.getByName('patient_id')) {
      contCol.fields.add(
        new RelationField({
          name: 'patient_id',
          collectionId: patientsColId,
          maxSelect: 1,
        }),
      )
    }
    app.save(contCol)

    // ── 3. Helper to generate tags from title & description ──
    const extractTags = (title, desc, defaultType) => {
      const text = ((title || '') + ' ' + (desc || '')).toLowerCase()
      const tags = new Set()

      if (defaultType === 'recipe') {
        tags.add('receita')
      } else if (defaultType === 'meal_plan') {
        tags.add('plano_alimentar')
      }

      const keywords = [
        ['shot', 'shots', 'imunidade'],
        ['ovo', 'ovos', 'proteina', 'cafe_da_manha'],
        ['tempero', 'temperos', 'temperos_caseiros', 'culinaria'],
        ['detox', 'suco_detox', 'desinflamacao', 'sucos'],
        ['whey', 'whey_protein', 'proteina', 'hipertrofia', 'suplemento'],
        ['geladeira', 'organizacao', 'conservacao'],
        ['carne', 'carnes', 'peixe', 'peixes', 'proteina', 'almoco_jantar'],
        ['lanche', 'lanches', 'praticidade', 'lanches_saudaveis'],
        ['massa_muscular', 'hipertrofia', 'ganho_de_massa', 'treino'],
        ['emagrecimento', 'perda_de_peso', 'deficit_calorico'],
        ['desinflamacao', 'antiinflamatorio', 'desinflamar'],
        ['aceleracao', 'metabolismo'],
        ['diverticulite', 'saude_intestinal', 'fibras'],
        ['pos_cirurgico', 'recuperacao', 'cirurgia'],
        ['pratico', 'simples', 'praticidade', 'rotina'],
        ['lowcarb', 'baixo_carboidrato'],
        ['sem_gluten', 'gluten_free'],
        ['sem_lactose', 'lacfree'],
        ['personalizado', 'individualizado'],
      ]

      for (let i = 0; i < keywords.length; i++) {
        const list = keywords[i]
        const main = list[0]
        if (text.indexOf(main) >= 0) {
          for (let j = 0; j < list.length; j++) {
            tags.add(list[j])
          }
        }
      }

      const result = []
      tags.forEach((t) => result.push(t))
      return result
    }

    // ── 4. Populate agent_materials with recipes ──
    try {
      const recipes = app.findRecordsByFilter('recipes', 'id != ""', '-created', 500, 0)
      for (let i = 0; i < recipes.length; i++) {
        const rec = recipes[i]
        const recId = rec.id
        const title = rec.getString('title')
        const owner = rec.getString('owner')
        const file = rec.getString('file')
        const desc = rec.getString('description') || ''
        const contentText = rec.getString('content_text') || ''

        // Check if already populated from this recipe
        let exists = false
        try {
          app.findFirstRecordByFilter(
            'agent_materials',
            'source_collection = "recipes" && source_id = {:sid}',
            '-created',
            1,
            0,
            { sid: recId },
          )
          exists = true
        } catch (_) {}

        if (!exists) {
          const mRec = new Record(matCol)
          mRec.set('owner', owner)
          mRec.set('title', title)
          mRec.set('description', desc || 'Receita: ' + title)
          mRec.set('topic', 'Receitas')
          mRec.set('content_text', contentText)
          mRec.set('type', 'recipe')
          mRec.set('source_collection', 'recipes')
          mRec.set('source_id', recId)
          mRec.set('file', file)
          mRec.set('tags', extractTags(title, desc + ' ' + contentText, 'recipe'))
          mRec.set('is_active', rec.getBool('is_active'))
          app.save(mRec)
          console.log('[0026] Populated agent_materials from recipe: ' + title)
        }
      }
    } catch (err) {
      console.log(
        '[0026] Error populating recipes: ' + (err && err.message ? err.message : String(err)),
      )
    }

    // ── 5. Populate agent_materials with meal_plan_templates ──
    try {
      const plans = app.findRecordsByFilter('meal_plan_templates', 'id != ""', '-created', 500, 0)
      for (let i = 0; i < plans.length; i++) {
        const pl = plans[i]
        const plId = pl.id
        const title = pl.getString('title')
        const owner = pl.getString('owner')
        const file = pl.getString('file')
        const desc = pl.getString('description') || ''
        const topic = pl.getString('topic') || 'Planos Alimentares'
        const contentText = pl.getString('content_text') || ''

        let exists = false
        try {
          app.findFirstRecordByFilter(
            'agent_materials',
            'source_collection = "meal_plan_templates" && source_id = {:sid}',
            '-created',
            1,
            0,
            { sid: plId },
          )
          exists = true
        } catch (_) {}

        if (!exists) {
          const mRec = new Record(matCol)
          mRec.set('owner', owner)
          mRec.set('title', title)
          mRec.set('description', desc || 'Modelo de plano alimentar: ' + title)
          mRec.set('topic', topic)
          mRec.set('content_text', contentText)
          mRec.set('type', 'meal_plan')
          mRec.set('source_collection', 'meal_plan_templates')
          mRec.set('source_id', plId)
          mRec.set('file', file)
          mRec.set('tags', extractTags(title, desc + ' ' + contentText + ' ' + topic, 'meal_plan'))
          mRec.set('is_active', pl.getBool('is_active'))
          app.save(mRec)
          console.log('[0026] Populated agent_materials from meal_plan: ' + title)
        }
      }
    } catch (err) {
      console.log(
        '[0026] Error populating meal_plan_templates: ' +
          (err && err.message ? err.message : String(err)),
      )
    }

    // ── 6. Auto-link existing contacts with patients by phone/whatsapp ──
    try {
      const contacts = app.findRecordsByFilter('contacts', 'id != ""', '-created', 500, 0)
      const patients = app.findRecordsByFilter('patients', 'id != ""', '-created', 500, 0)

      const normalizePhone = (num) => {
        if (!num) return ''
        let clean = String(num).replace(/\D/g, '')
        if (clean.length > 0 && clean.indexOf('55') !== 0 && clean.length <= 11) {
          clean = '55' + clean
        }
        return clean
      }

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const cPhone = normalizePhone(
          contact.getString('phone_number') || contact.getString('whatsapp_id'),
        )
        if (!cPhone) continue

        for (let j = 0; j < patients.length; j++) {
          const patient = patients[j]
          const pPhone = normalizePhone(patient.getString('phone'))
          if (
            pPhone &&
            (pPhone === cPhone || cPhone.indexOf(pPhone) >= 0 || pPhone.indexOf(cPhone) >= 0)
          ) {
            // Link contact -> patient
            contact.set('patient_id', patient.id)
            app.save(contact)
            // Link patient -> contact if not set
            if (!patient.getString('contact')) {
              patient.set('contact', contact.id)
              app.save(patient)
            }
            console.log(
              '[0026] Linked contact ' +
                contact.id +
                ' with patient ' +
                patient.id +
                ' (' +
                cPhone +
                ')',
            )
            break
          }
        }
      }
    } catch (err) {
      console.log(
        '[0026] Error auto-linking contacts & patients: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  },
  (app) => {
    // Revert logic
    try {
      const matCol = app.findCollectionByNameOrId('agent_materials')
      const typeF = matCol.fields.getByName('type')
      if (typeF) matCol.fields.remove(typeF)
      const tagsF = matCol.fields.getByName('tags')
      if (tagsF) matCol.fields.remove(tagsF)
      const scF = matCol.fields.getByName('source_collection')
      if (scF) matCol.fields.remove(scF)
      const siF = matCol.fields.getByName('source_id')
      if (siF) matCol.fields.remove(siF)
      app.save(matCol)
    } catch (_) {}

    try {
      const contCol = app.findCollectionByNameOrId('contacts')
      const pF = contCol.fields.getByName('patient_id')
      if (pF) contCol.fields.remove(pF)
      app.save(contCol)
    } catch (_) {}
  },
)
