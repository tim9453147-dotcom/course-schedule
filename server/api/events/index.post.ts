import { events } from '../../db/schema'

// 新增單次活動（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const data = await readValidatedBody(event, eventInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(events)
    .values({
      ...data,
      // 空字串時間視為整天事件
      startTime: data.startTime || null,
      endTime: data.endTime || null
    })
    .returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: '活動建立失敗' })
  }

  await logScheduleChange(db, {
    entityType: 'event',
    entityId: created.id,
    action: 'created',
    classroom: created.classroom,
    summary: buildEventSummary(created)
  })

  setResponseStatus(event, 201)
  return created
})
