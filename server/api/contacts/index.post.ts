import { contacts } from '../../db/schema'

// 新增名單（需 crm 權限）：歸屬於登入者自己
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const data = await readValidatedBody(event, contactInputSchema.parse)
  const db = useDb(event)

  const last = data.lastFollowUp || null
  const freq = data.followUpFreq || null

  const [created] = await db
    .insert(contacts)
    .values({
      ...data,
      userId: ownerKey(actor),
      followUpFreq: freq,
      lastFollowUp: last,
      nextFollowUp: computeNextFollowUp(last, freq)
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
