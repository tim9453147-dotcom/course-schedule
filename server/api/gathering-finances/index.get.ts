import { asc, desc, eq } from 'drizzle-orm'
import { gatherings, gatheringFinances } from '../../db/schema'

// 收支列表（需 gathering 權限）。左連接活動，全部活動都列出；
// 未填收支者財務欄位為 null。順帶算出 income / profit 供列表顯示 +/−。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')

  const db = useDb(event)
  const rows = await db
    .select({
      id: gatherings.id,
      name: gatherings.name,
      date: gatherings.date,
      headcount: gatheringFinances.headcount,
      fee: gatheringFinances.fee,
      expense: gatheringFinances.expense
    })
    .from(gatherings)
    .leftJoin(gatheringFinances, eq(gatheringFinances.gatheringId, gatherings.id))
    .orderBy(desc(gatherings.date), asc(gatherings.startTime))

  return rows.map((r) => {
    const { income, profit } = computeFinance(r.headcount, r.fee, r.expense)
    return { ...r, income, profit }
  })
})
