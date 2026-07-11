import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

// 更新 AI 辨識 prompt（僅超級管理員）。
// 空字串＝刪除該筆（回到程式內建的預設）；否則 upsert。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const { prompt } = await readBody<{ prompt?: string }>(event)
  if (typeof prompt !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '缺少 prompt' })
  }

  const db = useDb(event)
  const value = prompt.trim()

  if (!value) {
    await db.delete(settings).where(eq(settings.key, AI_EXTRACT_PROMPT_KEY))
    return { ok: true }
  }

  await db
    .insert(settings)
    .values({ key: AI_EXTRACT_PROMPT_KEY, value, updatedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: Math.floor(Date.now() / 1000) }
    })

  return { ok: true }
})
