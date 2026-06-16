import { asc } from 'drizzle-orm'
import { equipment } from '../../db/schema'

// 取得所有器材（任何人都能看）
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(equipment)
    .orderBy(asc(equipment.classroom), asc(equipment.name))
})
