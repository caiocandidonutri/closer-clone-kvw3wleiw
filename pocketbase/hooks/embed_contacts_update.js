onRecordAfterUpdateSuccess((e) => {
  const nameChanged = e.record.getString('name') !== e.record.original().getString('name')
  if (!nameChanged) return e.next()
  const name = e.record.getString('name')
  if (!name) return e.next()
  try {
    const res = $ai.embed({ input: name })
    const vec = res.data[0].embedding
    if (Array.isArray(vec) && vec.length === 1536) {
      const record = $app.findRecordById('contacts', e.record.id)
      record.set('identity_vector', vec)
      $app.save(record)
    }
  } catch (err) {
    console.log('embed update failed for contact ' + e.record.id, err.message || String(err))
  }
  return e.next()
}, 'contacts')
