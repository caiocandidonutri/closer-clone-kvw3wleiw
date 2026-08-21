/// <reference path="../pb_data/types.d.ts" />
// Adds triage fields to patients collection:
// - weight_kg (number, optional)
// - height_cm (number, optional)
// - intolerances (json, optional)
// - health_conditions (json, optional)
// - dietary_preference (text, optional)
// - triaged (bool, default false)
// - triaged_at (date, optional)

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('patients')

    if (!col.fields.getByName('weight_kg')) {
      col.fields.add(new NumberField({ name: 'weight_kg' }))
    }
    if (!col.fields.getByName('height_cm')) {
      col.fields.add(new NumberField({ name: 'height_cm' }))
    }
    if (!col.fields.getByName('intolerances')) {
      col.fields.add(new JSONField({ name: 'intolerances' }))
    }
    if (!col.fields.getByName('health_conditions')) {
      col.fields.add(new JSONField({ name: 'health_conditions' }))
    }
    if (!col.fields.getByName('dietary_preference')) {
      col.fields.add(new TextField({ name: 'dietary_preference' }))
    }
    if (!col.fields.getByName('triaged')) {
      // BoolField should NOT be required so false is accepted
      col.fields.add(new BoolField({ name: 'triaged' }))
    }
    if (!col.fields.getByName('triaged_at')) {
      col.fields.add(new DateField({ name: 'triaged_at' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('patients')
    const fieldsToRemove = [
      'weight_kg',
      'height_cm',
      'intolerances',
      'health_conditions',
      'dietary_preference',
      'triaged',
      'triaged_at',
    ]
    for (let i = 0; i < fieldsToRemove.length; i++) {
      const f = col.fields.getByName(fieldsToRemove[i])
      if (f) col.fields.remove(f)
    }
    app.save(col)
  },
)
