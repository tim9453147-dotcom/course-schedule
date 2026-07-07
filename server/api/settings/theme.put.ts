import { settings } from '../../db/schema'

// 設定全站色系主題（僅超級管理員）：upsert 'theme' 鍵，所有使用者下次載入即套用。
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const theme = body?.theme
  if (!isThemeId(theme)) {
    throw createError({ statusCode: 400, statusMessage: '不合法的主題' })
  }

  const db = useDb(event)
  const updatedAt = Math.floor(Date.now() / 1000)
  await db
    .insert(settings)
    .values({ key: 'theme', value: theme, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value: theme, updatedAt } })

  return { theme }
})
