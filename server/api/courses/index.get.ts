import { asc } from 'drizzle-orm'
import { courses } from '../../db/schema'

// 取得所有課程（任何人都能看）
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(courses)
    .orderBy(asc(courses.dayOfWeek), asc(courses.startTime))
})
