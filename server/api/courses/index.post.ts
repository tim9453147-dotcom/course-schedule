import { courses } from '../../db/schema'

// 新增課程（需管理員登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const data = await readValidatedBody(event, courseInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(courses)
    .values({
      ...data,
      // 空字串的範圍日期視為「不限」存成 null
      startDate: data.startDate || null,
      endDate: data.endDate || null
    })
    .returning()
  setResponseStatus(event, 201)
  return created
})
