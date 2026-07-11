import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

// 取得 AI 辨識 prompt（僅超級管理員）：DB 有存回存的、否則回預設。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const db = useDb(event)
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, AI_EXTRACT_PROMPT_KEY))

  return { prompt: row?.value ?? DEFAULT_AI_EXTRACT_PROMPT }
})
