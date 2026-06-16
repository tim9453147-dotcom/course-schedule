import { desc, eq } from 'drizzle-orm'
import { rentals, equipment } from '../../db/schema'

// 取得所有借還紀錄（含器材名稱與教室，任何人都能看）
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select({
      id: rentals.id,
      equipmentId: rentals.equipmentId,
      equipmentName: equipment.name,
      classroom: equipment.classroom,
      borrower: rentals.borrower,
      qty: rentals.qty,
      borrowDate: rentals.borrowDate,
      dueDate: rentals.dueDate,
      returnDate: rentals.returnDate,
      note: rentals.note
    })
    .from(rentals)
    .leftJoin(equipment, eq(rentals.equipmentId, equipment.id))
    .orderBy(desc(rentals.borrowDate), desc(rentals.id))
})
