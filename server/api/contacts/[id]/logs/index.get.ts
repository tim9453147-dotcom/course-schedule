import { and, eq, desc } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../../db/schema'

// 取得某名單的跟進紀錄（時間軸，需 crm 權限）：僅限自己的名單
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb(event)

  // 確認名單屬於自己，否則視為找不到
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), ownedBy(contacts.userId, ownerKey(actor))))
  if (!contact) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  return await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, id))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
})
