import { and, eq } from 'drizzle-orm'
import { contactLocations } from '../../db/schema'

// 新增地點選項（需 crm 權限）：歸屬本人；同名（去空白）已存在則回傳既有那筆，不重複建立。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const data = await readValidatedBody(event, contactLocationInputSchema.parse)
  const db = useDb(event)
  const owner = ownerKey(actor)

  const [existing] = await db
    .select()
    .from(contactLocations)
    .where(and(ownedBy(contactLocations.userId, owner), eq(contactLocations.label, data.label)))
    .limit(1)
  if (existing) return existing

  const [created] = await db
    .insert(contactLocations)
    .values({ userId: owner, label: data.label })
    .returning()
  setResponseStatus(event, 201)
  return created
})
