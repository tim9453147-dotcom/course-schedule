import { and, eq, isNull } from 'drizzle-orm'
import { equipment, rentals } from '../db/schema'

// 算某器材的數量狀況：總數、借出中、可用
// excludeRentalId：編輯某筆借出時，計算可用量要把它自己排除
export async function getStock(
  db: ReturnType<typeof useDb>,
  equipmentId: number,
  excludeRentalId?: number
) {
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, equipmentId))

  if (!item) return null

  const open = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.equipmentId, equipmentId), isNull(rentals.returnDate)))

  const borrowed = open
    .filter(r => r.id !== excludeRentalId)
    .reduce((sum, r) => sum + r.qty, 0)

  return { total: item.totalQty, borrowed, available: item.totalQty - borrowed }
}
