import { and, eq, desc } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../db/schema'

// 取消「今天已跟進」（需 crm 權限）：刪除該名單指定日期（前端送出的當地今天）的所有跟進紀錄，
// 再以剩餘紀錄回算名單的最後／下次跟進日。對應 Done 勾選的反向操作。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const { date } = await readValidatedBody(event, doneDateSchema.parse)
  const db = useDb(event)

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), ownedBy(contacts.userId, ownerKey(actor))))
  if (!contact) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  await db
    .delete(followUpLogs)
    .where(and(eq(followUpLogs.contactId, id), eq(followUpLogs.date, date)))

  // 以剩餘紀錄中最新的日期回填最後跟進日
  const [latest] = await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, id))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
    .limit(1)
  const last = latest?.date ?? null

  const [updated] = await db
    .update(contacts)
    .set({
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, contact.followUpFreq),
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(contacts.id, id))
    .returning()

  return updated
})
