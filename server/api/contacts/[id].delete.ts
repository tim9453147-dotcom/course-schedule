import { and, eq } from 'drizzle-orm'
import { contacts, followUpLogs, prospects } from '../../db/schema'

// 刪除名單（需 crm 權限）：僅限自己的名單，連同其跟進紀錄一起刪
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb(event)

  // 先確認這筆名單屬於自己
  const owner = ownedBy(contacts.userId, ownerKey(actor))
  const [current] = await db.select().from(contacts).where(and(eq(contacts.id, id), owner))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  await db.delete(followUpLogs).where(eq(followUpLogs.contactId, id))
  // 一併移除此人在每日任務各區塊的關聯列
  await db.delete(prospects).where(eq(prospects.contactId, id))
  await db.delete(contacts).where(eq(contacts.id, id))

  return { ok: true }
})
