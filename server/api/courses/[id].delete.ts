import { eq } from 'drizzle-orm'
import { courses } from '../../db/schema'

// 刪除課程（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '課程 id 不正確' })
  }

  const db = useDb(event)
  const [deleted] = await db
    .delete(courses)
    .where(eq(courses.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這門課程' })
  }

  await logScheduleChange(db, {
    entityType: 'course',
    entityId: deleted.id,
    action: 'deleted',
    classroom: deleted.classroom,
    summary: buildCourseSummary(deleted)
  })

  return { ok: true }
})
