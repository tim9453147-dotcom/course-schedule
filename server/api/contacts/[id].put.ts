import { eq } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 更新名單（整筆，需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const data = await readValidatedBody(event, contactInputSchema.parse)
  const db = useDb(event)

  const last = data.lastFollowUp || null
  const freq = data.followUpFreq || null

  const [updated] = await db
    .update(contacts)
    .set({
      ...data,
      followUpFreq: freq,
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, freq),
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(eq(contacts.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }
  return updated
})
