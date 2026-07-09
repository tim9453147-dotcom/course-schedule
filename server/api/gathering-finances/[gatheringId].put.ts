import { eq } from 'drizzle-orm'
import { gatherings, gatheringFinances } from '../../db/schema'

// upsert 一場活動的收支（需 gathering-finance 權限）。回傳含 income/profit 的合併視圖。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering-finance')

  const gatheringId = Number(getRouterParam(event, 'gatheringId'))
  if (!Number.isInteger(gatheringId)) {
    throw createError({ statusCode: 400, statusMessage: '活動 id 不正確' })
  }

  const data = await readValidatedBody(event, gatheringFinanceSchema.parse)
  const db = useDb(event)

  // 活動必須存在
  const g = await db.select().from(gatherings).where(eq(gatherings.id, gatheringId)).get()
  if (!g) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個活動' })
  }

  const existing = await db
    .select()
    .from(gatheringFinances)
    .where(eq(gatheringFinances.gatheringId, gatheringId))
    .get()

  const values = { headcount: data.headcount, fee: data.fee, expense: data.expense }
  const returned = existing
    ? await db
        .update(gatheringFinances)
        .set(values)
        .where(eq(gatheringFinances.gatheringId, gatheringId))
        .returning()
    : await db
        .insert(gatheringFinances)
        .values({ gatheringId, ...values })
        .returning()

  const row = returned[0]
  if (!row) {
    throw createError({ statusCode: 500, statusMessage: '收支寫入失敗' })
  }

  const { income, profit } = computeFinance(row.headcount, row.fee, row.expense)
  return {
    id: g.id,
    name: g.name,
    date: g.date,
    headcount: row.headcount,
    fee: row.fee,
    expense: row.expense,
    income,
    profit
  }
})
