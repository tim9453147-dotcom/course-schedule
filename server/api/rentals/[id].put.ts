import { eq } from 'drizzle-orm'
import { rentals } from '../../db/schema'

// 更新借還紀錄（需登入）。可用來編輯，或設定 returnDate 表示歸還。
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '紀錄 id 不正確' })
  }

  const data = await readValidatedBody(event, rentalInputSchema.parse)
  const db = useDb(event)

  // 若這筆仍是借出中，檢查可用數量（排除自己）
  const isOpen = !data.returnDate
  if (isOpen) {
    const stock = await getStock(db, data.equipmentId, id)
    if (!stock) {
      throw createError({ statusCode: 400, statusMessage: '找不到對應的器材' })
    }
    if (data.qty > stock.available) {
      throw createError({
        statusCode: 400,
        statusMessage: `可用數量不足（可用 ${stock.available}，欲借 ${data.qty}）`
      })
    }
  }

  const [updated] = await db
    .update(rentals)
    .set({
      ...data,
      dueDate: data.dueDate || null,
      returnDate: data.returnDate || null
    })
    .where(eq(rentals.id, id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆紀錄' })
  }
  return updated
})
