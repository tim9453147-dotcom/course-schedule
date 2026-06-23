import { equipment } from '../../db/schema'

// 新增器材（需登入）
export default defineEventHandler(async (event) => {
  await requirePage(event, 'equipment')

  const data = await readValidatedBody(event, equipmentInputSchema.parse)
  const db = useDb(event)

  const [created] = await db.insert(equipment).values(data).returning()
  setResponseStatus(event, 201)
  return created
})
