import { eq } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../db/schema'

// 刪除名單（需登入）：連同其跟進紀錄一起刪
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb(event)
  await db.delete(followUpLogs).where(eq(followUpLogs.contactId, id))
  const [deleted] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }
  return { ok: true }
})
