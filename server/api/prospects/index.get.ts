import { asc, eq } from 'drizzle-orm'
import { contacts, prospects } from '../../db/schema'

// 取得每日任務名單（需 crm 權限）：只回傳登入者自己的關聯列，並帶出所引用的 contact 明細。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const db = useDb(event)
  return await db
    .select({
      id: prospects.id,
      section: prospects.section,
      date: prospects.date,
      contactId: prospects.contactId,
      createdAt: prospects.createdAt,
      contact: contacts
    })
    .from(prospects)
    .innerJoin(contacts, eq(prospects.contactId, contacts.id))
    .where(ownedBy(prospects.userId, ownerKey(actor)))
    .orderBy(asc(prospects.id))
})
