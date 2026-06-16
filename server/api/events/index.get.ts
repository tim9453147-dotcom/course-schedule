import { asc } from 'drizzle-orm'
import { events } from '../../db/schema'

// 取得所有單次活動（任何人都能看）
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(events)
    .orderBy(asc(events.date), asc(events.startTime))
})
