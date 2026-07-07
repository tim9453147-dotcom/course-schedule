import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

// 讀取全站色系主題（公開；所有使用者、含未登入者都套用同一主題）。
// 未設定或值不合法時回預設主題。
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const row = await db.select().from(settings).where(eq(settings.key, 'theme')).get()
  return { theme: isThemeId(row?.value) ? row!.value : DEFAULT_THEME }
})
