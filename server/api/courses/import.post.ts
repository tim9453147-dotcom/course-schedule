import { eq } from 'drizzle-orm'
import { courses } from '../../db/schema'

// 批次匯入每週課程（需 calendar 權限）。
// 單次請求上限由 importCoursesSchema 控制（45 筆），大量資料由前端切塊多次呼叫；見 specs/0011。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'calendar')

  const { classroom, mode, items } = await readValidatedBody(event, importCoursesSchema.parse)

  // 教室必須是合法清單之一
  if (!CLASSROOMS.includes(classroom)) {
    throw createError({ statusCode: 400, statusMessage: '教室不正確' })
  }

  const db = useDb(event)

  // 組出要插入的列：classroom 由外層帶入、缺 color 依 kind 補預設（對齊前端 KIND_DEFAULT_COLOR）
  const rows = items.map(it => ({
    classroom,
    kind: it.kind,
    title: it.title,
    host: it.host ?? null,
    sharer: it.sharer ?? null,
    summarizer: it.summarizer ?? null,
    pm: it.pm ?? null,
    dayOfWeek: it.dayOfWeek,
    startTime: it.startTime,
    endTime: it.endTime,
    location: it.location ?? null,
    color: it.color || (it.kind === 'activity' ? 'rose' : 'sky'),
    note: it.note ?? null
  }))

  // 用 db.batch 包成單一原子操作：覆蓋模式先刪該教室現有課程，再插入。
  const stmts: unknown[] = []
  if (mode === 'replace') {
    stmts.push(db.delete(courses).where(eq(courses.classroom, classroom)).returning({ id: courses.id }))
  }
  for (const r of rows) stmts.push(db.insert(courses).values(r))

  // drizzle 對「動態長度」的 batch 型別較嚴，這裡以 never 規避（執行期正確）
  const results = (await db.batch(stmts as never)) as unknown[]
  const first = results[0]
  const deleted = mode === 'replace' && Array.isArray(first) ? first.length : 0

  setResponseStatus(event, 201)
  return { inserted: rows.length, deleted }
})
