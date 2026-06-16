import { rentals } from '../../db/schema'

// 新增借出紀錄（需登入）。借出數量不可超過可用數量。
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const data = await readValidatedBody(event, rentalInputSchema.parse)
  const db = useDb(event)

  const stock = await getStock(db, data.equipmentId)
  if (!stock) {
    throw createError({ statusCode: 400, statusMessage: '找不到對應的器材' })
  }
  // 只有「尚未歸還」的借出才占用庫存
  const isOpen = !data.returnDate
  if (isOpen && data.qty > stock.available) {
    throw createError({
      statusCode: 400,
      statusMessage: `可用數量不足（可用 ${stock.available}，欲借 ${data.qty}）`
    })
  }

  const [created] = await db
    .insert(rentals)
    .values({
      ...data,
      dueDate: data.dueDate || null,
      returnDate: data.returnDate || null
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
