// 上傳課表圖片 → 呼叫 Gemini（免費方案 gemini-2.5-flash）辨識成日期制匯入 JSON。
// 只回傳模型產生的 JSON 字串，由前端填進匯入預覽框人工核對；不直接寫資料庫。見 specs/0013。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const config = useRuntimeConfig(event)
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, statusMessage: '尚未設定 Gemini API key' })
  }

  const { imageBase64, mimeType, defaultYear } = await readBody<{
    imageBase64?: string
    mimeType?: string
    defaultYear?: number
  }>(event)

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '缺少圖片資料' })
  }
  if (!mimeType || !mimeType.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: '檔案格式需為圖片' })
  }

  const year = Number(defaultYear) || new Date().getFullYear()

  // 給 Gemini 的指令（對齊 specs/0012 的日期制欄位；辨識規則見 specs/0013）
  const prompt = [
    '你是課表 OCR 助手。把這張課表圖片轉成 JSON 陣列，每一堂課一個物件。',
    '欄位：title（課程名稱）、date（西元日期 YYYY-MM-DD）、startTime / endTime（24 小時制 HH:MM）、host、sharer、summarizer、pm、location、note。',
    '',
    '辨識規則：',
    '1. 只擷取課表中的「課程」內容；佈置說明、頁首頁尾、裝飾等非課程資訊一律忽略。',
    '2.「DST」也是一堂課，必須列出（不要當成非課程資訊忽略）。',
    '3. 角色欄位（重要，務必擷取）：把每堂課的角色填到對應欄位。課表常用縮寫——「H」＝主持→填 host、「C」＝總結→填 summarizer；若圖上另有「分享」欄→填 sharer、「PM」欄→填 pm。沒有該欄、或該課該角色沒寫，才留空字串。',
    '4.「值星小組」是與上述角色不同的另一個區塊／欄位，請整塊忽略、不要放進任何欄位；忽略它不影響主持(H)、總結(C) 等角色的擷取。',
    `5. date（日期）：若圖片只有月/日沒有年份，年份一律用 ${year}。`,
    '6. startTime（開始時間）：',
    '   - 課程本身有寫時間，就用寫的時間。',
    '   - 沒寫時間時：課名是「DST」→ 預設 18:30；其餘「週一到週五」的課 → 預設 19:30。',
    '   - 週六、週日且沒寫時間、或無法判斷的，留空字串。',
    '7. endTime（結束時間）：有寫就用寫的，沒寫就留空字串（不要自行推算）。',
    '8. location（地點）：依課表的標題／表頭判斷；個別課程沒另外標明地點時就留空字串。',
    '9. note（備註）：除非課表明確寫了備註，否則留空字串。',
    '',
    '只輸出 JSON 陣列本身，不要任何其他文字、說明或 markdown 標記。'
  ].join('\n')

  // Gemini responseSchema：強制吐出對齊 eventImportItemSchema 的陣列（全 STRING，title/date 必填）
  const stringProp = { type: 'STRING' }
  const responseSchema = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        title: stringProp,
        date: stringProp,
        startTime: stringProp,
        endTime: stringProp,
        host: stringProp,
        sharer: stringProp,
        summarizer: stringProp,
        pm: stringProp,
        location: stringProp,
        note: stringProp
      },
      required: ['title', 'date']
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.geminiApiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema }
      })
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: '無法連線 AI 服務，請稍後再試' })
  }

  if (res.status === 429) {
    throw createError({ statusCode: 429, statusMessage: 'AI 服務忙碌或已達免費上限，請稍後再試' })
  }
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `AI 辨識失敗（${res.status}）` })
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw createError({ statusCode: 422, statusMessage: 'AI 無法辨識這張圖片，請換一張更清晰的' })
  }

  // 原樣回傳 JSON 字串，交給前端填入匯入預覽框（保留可編輯/可核對）
  return { text }
})
