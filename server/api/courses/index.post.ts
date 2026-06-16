import { courses } from '../../db/schema'

// 新增課程（需管理員登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const data = await readValidatedBody(event, courseInputSchema.parse)
  const db = useDb(event)

  const [created] = await db.insert(courses).values(data).returning()
  setResponseStatus(event, 201)
  return created
})
