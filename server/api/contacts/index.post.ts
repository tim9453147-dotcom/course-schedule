import { contacts } from '../../db/schema'

// 新增名單（需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const data = await readValidatedBody(event, contactInputSchema.parse)
  const db = useDb(event)

  const last = data.lastFollowUp || null
  const freq = data.followUpFreq || null

  const [created] = await db
    .insert(contacts)
    .values({
      ...data,
      followUpFreq: freq,
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, freq)
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
