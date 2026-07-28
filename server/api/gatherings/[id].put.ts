import { eq } from 'drizzle-orm'
import { gatherings, events } from '../../db/schema'

// 更新家聚活動（需 gathering 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const data = await readValidatedBody(event, gatheringInputSchema.parse)
  const db = useDb(event)

  const [updated] = await db
    .update(gatherings)
    .set(normalizeGathering(data))
    .where(eq(gatherings.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }

  if (data.syncToCalendar) {
    const classroom = data.classroom || '中壢'
    const [createdEvent] = await db
      .insert(events)
      .values({
        classroom,
        kind: 'activity',
        title: updated.name,
        date: updated.date,
        startTime: updated.startTime || null,
        endTime: updated.endTime || null,
        location: updated.location || null,
        color: 'rose',
        note: updated.note || null
      })
      .returning()

    if (createdEvent) {
      await logScheduleChange(db, {
        entityType: 'event',
        entityId: createdEvent.id,
        action: 'created',
        classroom: createdEvent.classroom,
        summary: buildEventSummary(createdEvent)
      })
    }
  }

  return updated
})
