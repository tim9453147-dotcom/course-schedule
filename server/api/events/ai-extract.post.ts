import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

// 上傳課表圖片 → 呼叫 Gemini（免費方案 gemini-2.5-flash）辨識成日期制匯入 JSON。
// 只回傳模型產生的 JSON 字串，由前端填進匯入預覽框人工核對；不直接寫資料庫。見 specs/0013。
// prompt 可由超級管理員在 /admin 線上調整（見 specs/0023），未設定時用內建預設。
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

  // 有效 prompt：超管在 /admin 存過就用 DB 的，否則用內建預設（見 specs/0023）。
  // 送出前把 {{year}} 佔位符代入當年年份。
  const db = useDb(event)
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, AI_EXTRACT_PROMPT_KEY))
  const prompt = (row?.value || DEFAULT_AI_EXTRACT_PROMPT).replaceAll('{{year}}', String(year))

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
