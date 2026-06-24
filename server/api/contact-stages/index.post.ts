import { desc } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 新增進度階段（需 crm 權限）：歸屬於登入者自己，排在最後
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const data = await readValidatedBody(event, contactStageInputSchema.parse)
  const db = useDb(event)
  const owner = ownerKey(actor)

  // 取目前最大 sortOrder，新階段排在最後
  const [last] = await db
    .select()
    .from(contactStages)
    .where(ownedBy(contactStages.userId, owner))
    .orderBy(desc(contactStages.sortOrder))
    .limit(1)
  const sortOrder = (last?.sortOrder ?? -1) + 1

  const [created] = await db
    .insert(contactStages)
    .values({ userId: owner, label: data.label, sortOrder })
    .returning()

  setResponseStatus(event, 201)
  return created
})
