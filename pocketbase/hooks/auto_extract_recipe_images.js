/// <reference path="../pb_data/types.d.ts" />
// Auto-extract recipe images from PDF materials on startup and cron (every 1 hour).
// Zero-cost, zero external image generation AI.

cronAdd('auto_extract_recipe_images', '0 * * * *', () => {
  const pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
  console.log('[auto_extract_recipe_images] Running recipe image extraction check...')

  const indexOfBytes = (bytes, pattern, startOffset) => {
    const pLen = pattern.length
    const bLen = bytes.length
    const start = startOffset || 0
    if (pLen === 0 || bLen === 0 || start + pLen > bLen) return -1
    const p0 = pattern[0]
    for (let i = start; i <= bLen - pLen; i++) {
      if (bytes[i] === p0) {
        let match = true
        for (let j = 1; j < pLen; j++) {
          if (bytes[i + j] !== pattern[j]) {
            match = false
            break
          }
        }
        if (match) return i
      }
    }
    return -1
  }

  const extractJpegFromPdf = (pdfBytes) => {
    const jpegHeader = [0xff, 0xd8, 0xff]
    const jpegFooter = [0xff, 0xd9]
    let offset = 0
    while (offset < pdfBytes.length) {
      const startIdx = indexOfBytes(pdfBytes, jpegHeader, offset)
      if (startIdx === -1) break

      const endIdx = indexOfBytes(pdfBytes, jpegFooter, startIdx + 3)
      if (endIdx === -1) {
        offset = startIdx + 3
        continue
      }

      const imgLen = endIdx + 2 - startIdx
      if (imgLen >= 8192) {
        const imgBytes = []
        for (let i = startIdx; i < endIdx + 2; i++) {
          imgBytes.push(pdfBytes[i])
        }
        return {
          bytes: imgBytes,
          length: imgLen,
          mime: 'image/jpeg',
          ext: 'jpg',
        }
      }
      offset = endIdx + 2
    }
    return null
  }

  const extractPngFromPdf = (pdfBytes) => {
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const pngFooter = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]
    const startIdx = indexOfBytes(pdfBytes, pngHeader, 0)
    if (startIdx !== -1) {
      const endIdx = indexOfBytes(pdfBytes, pngFooter, startIdx + 8)
      if (endIdx !== -1) {
        const imgLen = endIdx + 8 - startIdx
        if (imgLen >= 8192) {
          const imgBytes = []
          for (let i = startIdx; i < endIdx + 8; i++) {
            imgBytes.push(pdfBytes[i])
          }
          return {
            bytes: imgBytes,
            length: imgLen,
            mime: 'image/png',
            ext: 'png',
          }
        }
      }
    }
    return null
  }

  let agentMaterialsList = []
  try {
    agentMaterialsList = $app.findRecordsByFilter(
      'agent_materials',
      'type = "recipe"',
      '-created',
      100,
      0,
    )
  } catch (_) {}

  for (let i = 0; i < agentMaterialsList.length; i++) {
    const mat = agentMaterialsList[i]
    const title = mat.getString('title') || 'Receita ' + mat.id

    if (mat.getString('image_url')) {
      continue // Already has image
    }

    let pdfUrl = ''
    const matFile = mat.getString('file')
    const srcColl = mat.getString('source_collection') || 'recipes'
    const srcId = mat.getString('source_id')

    if (matFile) {
      pdfUrl = pbUrl + '/api/files/agent_materials/' + mat.id + '/' + matFile
    } else if (srcId) {
      try {
        const sourceRecord = $app.findRecordById(srcColl, srcId)
        const sFile = sourceRecord.getString('file')
        if (sFile) {
          pdfUrl = pbUrl + '/api/files/' + srcColl + '/' + srcId + '/' + sFile
        }
      } catch (_) {}
    }

    if (!pdfUrl) {
      console.log('[auto_extract_recipe_images] Processando receita "' + title + '"... sem imagem')
      continue
    }

    try {
      const pdfRes = $http.send({
        url: pdfUrl,
        method: 'GET',
        timeout: 60,
      })
      if (!pdfRes || pdfRes.statusCode !== 200 || !pdfRes.body) continue

      const rawBody = pdfRes.body
      let pdfBytes = []
      if (Array.isArray(rawBody)) {
        pdfBytes = rawBody
      } else if (typeof rawBody === 'string') {
        for (let b = 0; b < rawBody.length; b++) {
          pdfBytes.push(rawBody.charCodeAt(b) & 0xff)
        }
      } else {
        for (let b = 0; b < rawBody.length; b++) {
          pdfBytes.push(rawBody[b])
        }
      }

      let extractedImg = extractJpegFromPdf(pdfBytes)
      if (!extractedImg) {
        extractedImg = extractPngFromPdf(pdfBytes)
      }

      if (!extractedImg) {
        console.log(
          '[auto_extract_recipe_images] Processando receita "' +
            title +
            '"... sem imagem extraível',
        )
        continue
      }

      const imgFileName = 'recipe_' + mat.id + '.' + extractedImg.ext
      let savedUrl = ''
      const superToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''
      const formData = new FormData()
      formData.append('file', $filesystem.fileFromBytes(extractedImg.bytes, imgFileName))

      const uploadRes = $http.send({
        url: pbUrl + '/api/collections/agent_materials/records/' + mat.id,
        method: 'PATCH',
        headers: superToken ? { Authorization: superToken } : {},
        body: formData,
        timeout: 30,
      })

      if (uploadRes && uploadRes.statusCode === 200) {
        const updatedJson = uploadRes.json || {}
        const uploadedFileName = updatedJson.file || imgFileName
        savedUrl = pbUrl + '/api/files/agent_materials/' + mat.id + '/' + uploadedFileName
      } else {
        savedUrl = pbUrl + '/api/files/agent_materials/' + mat.id + '/' + imgFileName
      }

      mat.set('image_url', savedUrl)
      $app.save(mat)
      console.log(
        '[auto_extract_recipe_images] Processando receita "' +
          title +
          '"... imagem extraída com sucesso! URL=' +
          savedUrl,
      )
    } catch (err) {
      console.log(
        '[auto_extract_recipe_images] Erro ao processar "' +
          title +
          '": ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }
})
