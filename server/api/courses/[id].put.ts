import { eq } from 'drizzle-orm'
import { courses } from '../../db/schema'

// 更新課程（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '課程 id 不正確' })
  }

  const data = await readValidatedBody(event, courseInputSchema.parse)
  const db = useDb(event)

  const [updated] = await db
    .update(courses)
    .set(data)
    .where(eq(courses.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這門課程' })
  }
  return updated
})
