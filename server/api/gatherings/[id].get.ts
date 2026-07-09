import { eq } from 'drizzle-orm'
import { gatherings } from '../../db/schema'

// 取得單筆家聚活動（任何人都能看）。
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const db = useDb(event)
  const row = await db.select().from(gatherings).where(eq(gatherings.id, id)).get()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }
  return row
})
