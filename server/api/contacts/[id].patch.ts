import { eq } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 部分更新名單（inline 即時切換階段／頻率，需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const data = await readValidatedBody(event, contactPatchSchema.parse)
  const db = useDb(event)

  const [current] = await db.select().from(contacts).where(eq(contacts.id, id))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  const patch: Record<string, unknown> = {
    ...data,
    updatedAt: Math.floor(Date.now() / 1000)
  }
  if ('followUpFreq' in data) patch.followUpFreq = data.followUpFreq || null
  if ('lastFollowUp' in data) patch.lastFollowUp = data.lastFollowUp || null

  // 頻率或最後跟進日有變動 → 重算下次跟進日
  if ('followUpFreq' in data || 'lastFollowUp' in data) {
    const last = 'lastFollowUp' in data ? data.lastFollowUp || null : current.lastFollowUp
    const freq = 'followUpFreq' in data ? data.followUpFreq || null : current.followUpFreq
    patch.nextFollowUp = computeNextFollowUp(last, freq)
  }

  const [updated] = await db
    .update(contacts)
    .set(patch)
    .where(eq(contacts.id, id))
    .returning()

  return updated
})
