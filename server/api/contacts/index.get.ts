import { desc } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 取得所有名單（需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const db = useDb(event)
  return await db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
})
