/// <reference path="../pb_data/types.d.ts" />
// Populate agent_materials with recipes & meal_plans

migrate(
  (app) => {
    const matCol = app.findCollectionByNameOrId('agent_materials')

    // Helper to generate tags from text
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

    // Populate recipes using findAllRecords
    try {
      const recCol = app.findCollectionByNameOrId('recipes')
      const recipes = app.findAllRecords(recCol)
      console.log('[0027] findAllRecords recipes count: ' + (recipes ? recipes.length : 0))

      if (recipes && recipes.length > 0) {
        for (let i = 0; i < recipes.length; i++) {
          const rec = recipes[i]
          const recId = rec.id
          const title = rec.getString('title')
          const owner = rec.getString('owner')
          const file = rec.getString('file')
          const desc = rec.getString('description') || ''
          const contentText = rec.getString('content_text') || ''

          let exists = false
          try {
            app.findFirstRecordByData('agent_materials', 'source_id', recId)
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
            console.log('[0027] Populated agent_materials from recipe: ' + title)
          }
        }
      }
    } catch (err) {
      console.log(
        '[0027] Error populating recipes: ' + (err && err.message ? err.message : String(err)),
      )
    }

    // Populate meal_plan_templates using findAllRecords
    try {
      const planCol = app.findCollectionByNameOrId('meal_plan_templates')
      const plans = app.findAllRecords(planCol)
      console.log('[0027] findAllRecords meal_plan_templates count: ' + (plans ? plans.length : 0))

      if (plans && plans.length > 0) {
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
            app.findFirstRecordByData('agent_materials', 'source_id', plId)
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
            mRec.set(
              'tags',
              extractTags(title, desc + ' ' + contentText + ' ' + topic, 'meal_plan'),
            )
            mRec.set('is_active', pl.getBool('is_active'))
            app.save(mRec)
            console.log('[0027] Populated agent_materials from meal_plan: ' + title)
          }
        }
      }
    } catch (err) {
      console.log(
        '[0027] Error populating meal_plan_templates: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM agent_materials WHERE source_collection IN ('recipes', 'meal_plan_templates')",
        )
        .execute()
    } catch (_) {}
  },
)
