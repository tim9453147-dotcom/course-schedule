import { eq } from 'drizzle-orm'
import { rentals } from '../../db/schema'

// 刪除借還紀錄（需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '紀錄 id 不正確' })
  }

  const db = useDb(event)
  const [deleted] = await db
    .delete(rentals)
    .where(eq(rentals.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆紀錄' })
  }
  return { ok: true }
})
