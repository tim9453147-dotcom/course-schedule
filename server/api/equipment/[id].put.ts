import { eq } from 'drizzle-orm'
import { equipment } from '../../db/schema'

// 更新器材（需登入）
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '器材 id 不正確' })
  }

  const data = await readValidatedBody(event, equipmentInputSchema.parse)
  const db = useDb(event)

  const [updated] = await db
    .update(equipment)
    .set(data)
    .where(eq(equipment.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個器材' })
  }
  return updated
})
