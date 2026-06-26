import { and, eq, gte, lte } from 'drizzle-orm'
import { events } from '../../db/schema'

// 批次匯入單次活動（依日期，需 calendar 權限）。
// 單次請求上限由 importEventsSchema 控制（45 筆），大量資料由前端切塊多次呼叫；見 specs/0012。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const { classroom, mode, replaceFrom, replaceTo, items } = await readValidatedBody(event, importEventsSchema.parse)

  // 教室必須是合法清單之一
  if (!CLASSROOMS.includes(classroom)) {
    throw createError({ statusCode: 400, statusMessage: '教室不正確' })
  }

  const db = useDb(event)

  // 組出要插入的列：classroom 由外層帶入、kind 一律 course（忽略來源 JSON）、缺 color 補預設 sky、
  // 空字串時間視為整天事件（存 null，與 events POST 一致）。
  const rows = items.map(it => ({
    classroom,
    kind: 'course',
    title: it.title,
    host: it.host ?? null,
    sharer: it.sharer ?? null,
    summarizer: it.summarizer ?? null,
    pm: it.pm ?? null,
    date: it.date,
    startTime: it.startTime || null,
    endTime: it.endTime || null,
    location: it.location ?? null,
    color: it.color || 'sky',
    note: it.note ?? null
  }))

  // 用 db.batch 包成單一原子操作：覆蓋模式先刪此教室在匯入日期區間內的活動，再插入。
  const stmts: unknown[] = []
  if (mode === 'replace' && replaceFrom && replaceTo) {
    stmts.push(
      db
        .delete(events)
        .where(and(eq(events.classroom, classroom), gte(events.date, replaceFrom), lte(events.date, replaceTo)))
        .returning({ id: events.id })
    )
  }
  for (const r of rows) stmts.push(db.insert(events).values(r))

  // drizzle 對「動態長度」的 batch 型別較嚴，這裡以 never 規避（執行期正確）
  const results = (await db.batch(stmts as never)) as unknown[]
  const first = results[0]
  const deleted = mode === 'replace' && replaceFrom && replaceTo && Array.isArray(first) ? first.length : 0

  setResponseStatus(event, 201)
  return { inserted: rows.length, deleted }
})
