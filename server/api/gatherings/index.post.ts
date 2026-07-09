import { gatherings } from '../../db/schema'

// 新增家聚活動（需 gathering 權限）。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')

  const data = await readValidatedBody(event, gatheringInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(gatherings)
    .values(normalizeGathering(data))
    .returning()

  setResponseStatus(event, 201)
  return created
})
