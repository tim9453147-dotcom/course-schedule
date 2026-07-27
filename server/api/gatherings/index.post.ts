import { gatherings, events } from '../../db/schema'

// 新增家聚活動（需 gathering 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')

  const data = await readValidatedBody(event, gatheringInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(gatherings)
    .values(normalizeGathering(data))
    .returning()

  if (created && data.syncToCalendar) {
    const classroom = data.classroom || '中壢'
    const [createdEvent] = await db
      .insert(events)
      .values({
        classroom,
        kind: 'activity',
        title: created.name,
        date: created.date,
        startTime: created.startTime || null,
        endTime: created.endTime || null,
        location: created.location || null,
        color: 'rose',
        note: created.note || null
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

  setResponseStatus(event, 201)
  return created
})
