import { desc } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 取得名單（需 crm 權限）：只回傳登入者自己的名單
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const db = useDb(event)
  return await db
    .select()
    .from(contacts)
    .where(ownedBy(contacts.userId, ownerKey(actor)))
    .orderBy(desc(contacts.createdAt))
})
