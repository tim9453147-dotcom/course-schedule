import { eq } from 'drizzle-orm'
import { events } from '../../db/schema'

// 更新單次活動（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const data = await readValidatedBody(event, eventInputSchema.parse)
  const db = useDb(event)

  const [updated] = await db
    .update(events)
    .set({
      ...data,
      startTime: data.startTime || null,
      endTime: data.endTime || null
    })
    .where(eq(events.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }

  await logScheduleChange(db, {
    entityType: 'event',
    entityId: updated.id,
    action: 'updated',
    classroom: updated.classroom,
    summary: buildEventSummary(updated)
  })

  return updated
})
