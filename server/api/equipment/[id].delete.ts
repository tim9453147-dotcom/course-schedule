import { eq } from 'drizzle-orm'
import { equipment, rentals } from '../../db/schema'

// 刪除器材（需登入）：連同其借還紀錄一起刪
export default defineEventHandler(async (event) => {
  await requirePage(event, 'equipment')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '器材 id 不正確' })
  }

  const db = useDb(event)
  // 先刪該器材的借還紀錄，再刪器材本身
  await db.delete(rentals).where(eq(rentals.equipmentId, id))
  const [deleted] = await db
    .delete(equipment)
    .where(eq(equipment.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個器材' })
  }
  return { ok: true }
})
