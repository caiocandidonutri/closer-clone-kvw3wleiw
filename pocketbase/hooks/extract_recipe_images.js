/// <reference path="../pb_data/types.d.ts" />
// Extract high-quality recipe images from PDF materials (zero-cost, no DALL-E / external AI image gen).
//
// Extracts the first high-quality embedded JPEG/PNG image from each PDF in `recipes` / `agent_materials`,
// uploads it to PocketBase storage / creates a record or sets image_url, and populates `image_url` on `agent_materials`.
//
// Endpoints:
// - POST /backend/v1/recipes/extract-images  (Trigger batch extraction on all recipe PDFs)
// - GET  /backend/v1/recipes/extract-images  (Status of recipe images)

routerAdd('POST', '/backend/v1/recipes/extract-images', (e) => {
  const pbUrl = ($secrets.get('PB_INSTANCE_URL') || '').replace(/\/$/, '')
  console.log('[extract_recipe_images] Starting batch recipe image extraction... pbUrl=' + pbUrl)

  // Helper: Find binary sub-sequence
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

  // Helper: Extract embedded JPEG images from PDF byte array
  // Looks for SOI marker 0xFF 0xD8 0xFF and EOI marker 0xFF 0xD9
  const extractJpegFromPdf = (pdfBytes) => {
    const jpegHeader = [0xff, 0xd8, 0xff]
    const jpegFooter = [0xff, 0xd9]
    let offset = 0
    let bestImage = null

    while (offset < pdfBytes.length) {
      const startIdx = indexOfBytes(pdfBytes, jpegHeader, offset)
      if (startIdx === -1) break

      const endIdx = indexOfBytes(pdfBytes, jpegFooter, startIdx + 3)
      if (endIdx === -1) {
        offset = startIdx + 3
        continue
      }

      const imgLen = endIdx + 2 - startIdx
      // Filter out tiny icons, logos, thumbnails (< 4KB) and check sensible size (> 8KB)
      if (imgLen >= 8192) {
        const imgBytes = []
        for (let i = startIdx; i < endIdx + 2; i++) {
          imgBytes.push(pdfBytes[i])
        }
        bestImage = {
          bytes: imgBytes,
          length: imgLen,
          mime: 'image/jpeg',
          ext: 'jpg',
        }
        console.log(
          '[extract_recipe_images] Found embedded JPEG: offset=' +
            startIdx +
            ' size=' +
            imgLen +
            ' bytes',
        )
        break // Take the first high quality image
      }

      offset = endIdx + 2
    }
    return bestImage
  }

  // Helper: Extract embedded PNG images from PDF byte array (89 50 4E 47 0D 0A 1A 0A ... 49 45 4E 44 AE 42 60 82)
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
          console.log(
            '[extract_recipe_images] Found embedded PNG: offset=' +
              startIdx +
              ' size=' +
              imgLen +
              ' bytes',
          )
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

  let recipesList = []
  try {
    recipesList = $app.findRecordsByFilter('recipes', 'file != ""', '-created', 100, 0)
  } catch (err) {
    console.log(
      '[extract_recipe_images] Error querying recipes: ' +
        (err && err.message ? err.message : String(err)),
    )
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
  } catch (err) {
    console.log(
      '[extract_recipe_images] Error querying agent_materials: ' +
        (err && err.message ? err.message : String(err)),
    )
  }

  console.log(
    '[extract_recipe_images] Found ' +
      recipesList.length +
      ' recipes and ' +
      agentMaterialsList.length +
      ' recipe agent_materials',
  )

  const results = []

  // Process agent_materials
  for (let i = 0; i < agentMaterialsList.length; i++) {
    const mat = agentMaterialsList[i]
    const title = mat.getString('title') || 'Receita ' + mat.id
    console.log(
      '[extract_recipe_images] Processando receita ' +
        (i + 1) +
        '/' +
        agentMaterialsList.length +
        ': "' +
        title +
        '" (ID: ' +
        mat.id +
        ')...',
    )

    // Check if image_url is already set
    const currentImgUrl = mat.getString('image_url')
    if (currentImgUrl) {
      console.log(
        '[extract_recipe_images] Receita "' + title + '" já possui image_url: ' + currentImgUrl,
      )
      results.push({
        id: mat.id,
        title: title,
        status: 'already_has_image',
        image_url: currentImgUrl,
      })
      continue
    }

    // Determine PDF source file URL
    let pdfUrl = ''
    let sourceRecord = null
    const matFile = mat.getString('file')
    const srcColl = mat.getString('source_collection') || 'recipes'
    const srcId = mat.getString('source_id')

    if (matFile) {
      pdfUrl = pbUrl + '/api/files/agent_materials/' + mat.id + '/' + matFile
    } else if (srcId) {
      try {
        sourceRecord = $app.findRecordById(srcColl, srcId)
        const sFile = sourceRecord.getString('file')
        if (sFile) {
          pdfUrl = pbUrl + '/api/files/' + srcColl + '/' + srcId + '/' + sFile
        }
      } catch (_) {}
    }

    if (!pdfUrl) {
      console.log(
        '[extract_recipe_images] Receita "' + title + '" sem arquivo PDF associado. sem imagem',
      )
      results.push({ id: mat.id, title: title, status: 'no_pdf_file' })
      continue
    }

    console.log('[extract_recipe_images] Baixando PDF de ' + pdfUrl + '...')
    let pdfRes = null
    try {
      pdfRes = $http.send({
        url: pdfUrl,
        method: 'GET',
        timeout: 60,
      })
    } catch (err) {
      console.log(
        '[extract_recipe_images] Erro ao baixar PDF para "' +
          title +
          '": ' +
          (err && err.message ? err.message : String(err)),
      )
      results.push({ id: mat.id, title: title, status: 'download_failed', error: String(err) })
      continue
    }

    if (!pdfRes || pdfRes.statusCode !== 200 || !pdfRes.body) {
      console.log(
        '[extract_recipe_images] Resposta HTTP inválida ao baixar PDF: ' +
          (pdfRes && pdfRes.statusCode),
      )
      results.push({
        id: mat.id,
        title: title,
        status: 'download_failed',
        statusCode: pdfRes && pdfRes.statusCode,
      })
      continue
    }

    // Convert response body to byte array
    const rawBody = pdfRes.body
    let pdfBytes = []
    if (Array.isArray(rawBody)) {
      pdfBytes = rawBody
    } else if (typeof rawBody === 'string') {
      pdfBytes = []
      for (let b = 0; b < rawBody.length; b++) {
        pdfBytes.push(rawBody.charCodeAt(b) & 0xff)
      }
    } else {
      // Buffer / object with indexing
      try {
        pdfBytes = []
        for (let b = 0; b < rawBody.length; b++) {
          pdfBytes.push(rawBody[b])
        }
      } catch (_) {}
    }

    console.log(
      '[extract_recipe_images] PDF baixado: ' +
        pdfBytes.length +
        ' bytes. Procurando imagens embutidas...',
    )
    let extractedImg = extractJpegFromPdf(pdfBytes)
    if (!extractedImg) {
      extractedImg = extractPngFromPdf(pdfBytes)
    }

    if (!extractedImg) {
      console.log(
        '[extract_recipe_images] Processando receita "' +
          title +
          '"... sem imagem extraível no PDF',
      )
      results.push({ id: mat.id, title: title, status: 'no_image_in_pdf' })
      continue
    }

    console.log(
      '[extract_recipe_images] Imagem extraída com sucesso (' +
        extractedImg.length +
        ' bytes). Salvando...',
    )

    // Save image to agent_materials file or update image_url
    // We can upload the extracted image file to agent_materials record or save to storage
    const imgFileName = 'recipe_' + mat.id + '.' + extractedImg.ext
    let savedUrl = ''

    try {
      // Create FormData with extracted image and upload via PocketBase API
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
        console.log('[extract_recipe_images] Imagem salva no registro agent_materials: ' + savedUrl)
      }
    } catch (upErr) {
      console.log(
        '[extract_recipe_images] Upload via API falhou: ' +
          (upErr && upErr.message ? upErr.message : String(upErr)),
      )
    }

    // If upload API did not return file URL, construct fallback or store directly
    if (!savedUrl) {
      savedUrl = pbUrl + '/api/files/agent_materials/' + mat.id + '/' + imgFileName
    }

    // Set image_url on agent_materials
    mat.set('image_url', savedUrl)
    $app.save(mat)

    console.log(
      '[extract_recipe_images] Processando receita "' +
        title +
        '"... imagem extraída com sucesso! URL=' +
        savedUrl,
    )
    results.push({
      id: mat.id,
      title: title,
      status: 'extracted',
      image_url: savedUrl,
      size: extractedImg.length,
    })
  }

  return e.json(200, {
    ok: true,
    total_processed: agentMaterialsList.length,
    results: results,
  })
})

// GET status endpoint
routerAdd('GET', '/backend/v1/recipes/extract-images', (e) => {
  let materials = []
  try {
    materials = $app.findRecordsByFilter('agent_materials', 'type = "recipe"', '-created', 100, 0)
  } catch (_) {}

  const summary = materials.map((m) => ({
    id: m.id,
    title: m.getString('title'),
    has_image: !!m.getString('image_url'),
    image_url: m.getString('image_url') || null,
    file: m.getString('file') || null,
    source_collection: m.getString('source_collection') || null,
    source_id: m.getString('source_id') || null,
  }))

  return e.json(200, {
    total: materials.length,
    with_image: summary.filter((s) => s.has_image).length,
    without_image: summary.filter((s) => !s.has_image).length,
    recipes: summary,
  })
})
