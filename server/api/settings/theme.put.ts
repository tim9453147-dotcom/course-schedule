import { settings } from '../../db/schema'

// 更新全站主題風格（僅限超級管理員）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const { theme } = await readBody<{ theme?: string }>(event)
  if (!isSiteTheme(theme)) {
    throw createError({ statusCode: 400, statusMessage: '不正確的主題模式' })
  }

  const db = useDb(event)
  await db
    .insert(settings)
    .values({
      key: SITE_THEME_KEY,
      value: theme,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: theme,
        updatedAt: Math.floor(Date.now() / 1000)
      }
    })

  return { ok: true, theme }
})
