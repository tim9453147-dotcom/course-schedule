import { eq } from 'drizzle-orm'
import { events } from '../../db/schema'

// 刪除單次活動（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const db = useDb(event)
  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }

  await logScheduleChange(db, {
    entityType: 'event',
    entityId: deleted.id,
    action: 'deleted',
    classroom: deleted.classroom,
    summary: buildEventSummary(deleted)
  })

  return { ok: true }
})
