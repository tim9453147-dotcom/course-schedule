import { eq } from 'drizzle-orm'
import { gatherings, gatheringFinances } from '../../db/schema'

// 刪除家聚活動（需 gathering 權限）。一併刪除其收支列（FK）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const db = useDb(event)
  // 先刪收支（外鍵指向 gathering），再刪活動本身
  await db.delete(gatheringFinances).where(eq(gatheringFinances.gatheringId, id))
  const [deleted] = await db.delete(gatherings).where(eq(gatherings.id, id)).returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }
  return { ok: true }
})
