import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

// 取得目前全站主題風格（所有人皆可讀取，供 SSR / 前端同步）
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SITE_THEME_KEY))

  const theme: SiteTheme = row?.value === 'dark_modern' ? 'dark_modern' : 'seasonal'
  return { theme }
})
