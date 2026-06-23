import { eq } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../db/schema'

// 新增一筆跟進紀錄（需登入）：同時把名單的最後／下次跟進日更新
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const data = await readValidatedBody(event, followUpLogSchema.parse)
  const db = useDb(event)

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id))
  if (!contact) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  const [created] = await db
    .insert(followUpLogs)
    .values({ contactId: id, date: data.date, content: data.content ?? null })
    .returning()

  // 以「最新一次跟進日」回填名單的最後跟進日，並重算下次跟進日
  const last
    = !contact.lastFollowUp || data.date > contact.lastFollowUp
      ? data.date
      : contact.lastFollowUp
  await db
    .update(contacts)
    .set({
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, contact.followUpFreq),
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(contacts.id, id))

  setResponseStatus(event, 201)
  return created
})
