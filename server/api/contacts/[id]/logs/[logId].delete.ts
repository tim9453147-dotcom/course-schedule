import { and, eq, desc } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../../db/schema'

// 刪除某名單的一筆跟進紀錄（需 crm 權限）：僅限自己的名單，刪除後以剩餘紀錄回算名單的最後／下次跟進日
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const contactId = Number(getRouterParam(event, 'id'))
  const logId = Number(getRouterParam(event, 'logId'))
  if (!Number.isInteger(contactId) || !Number.isInteger(logId)) {
    throw createError({ statusCode: 400, statusMessage: 'id 不正確' })
  }

  const db = useDb(event)

  // 確認名單屬於自己
  const [owned] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), ownedBy(contacts.userId, ownerKey(actor))))
  if (!owned) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  const [log] = await db.select().from(followUpLogs).where(eq(followUpLogs.id, logId))
  // 找不到、或這筆紀錄不屬於該名單 → 視為找不到
  if (!log || log.contactId !== contactId) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆紀錄' })
  }

  await db.delete(followUpLogs).where(eq(followUpLogs.id, logId))

  // 取剩餘紀錄中最新的日期，回填名單的最後跟進日
  const [latest] = await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, contactId))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
    .limit(1)
  const last = latest?.date ?? null
  await db
    .update(contacts)
    .set({
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, owned.followUpFreq),
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(contacts.id, contactId))

  return { ok: true }
})
