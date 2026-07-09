import { asc, desc } from 'drizzle-orm'
import { gatherings } from '../../db/schema'

// 取得所有家聚活動（活動紀錄 tab；任何人都能看）。依日期新→舊排序。
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(gatherings)
    .orderBy(desc(gatherings.date), asc(gatherings.startTime))
})
