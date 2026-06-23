import { eq, desc } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../db/schema'

// 刪除一筆跟進紀錄（需登入）：刪除後以剩餘紀錄回算名單的最後／下次跟進日
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '紀錄 id 不正確' })
  }

  const db = useDb(event)
  const [log] = await db.select().from(followUpLogs).where(eq(followUpLogs.id, id))
  if (!log) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆紀錄' })
  }

  await db.delete(followUpLogs).where(eq(followUpLogs.id, id))

  // 取剩餘紀錄中最新的日期，回填名單的最後跟進日
  const [latest] = await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, log.contactId))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
    .limit(1)
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, log.contactId))
  if (contact) {
    const last = latest?.date ?? null
    await db
      .update(contacts)
      .set({
        lastFollowUp: last,
        nextFollowUp: computeNextFollowUp(last, contact.followUpFreq),
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(eq(contacts.id, log.contactId))
  }

  return { ok: true }
})
