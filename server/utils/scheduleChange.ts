import type { Course, Event } from '../db/schema'
import { scheduleChanges } from '../db/schema'
import type { useDb } from './db'

// 課表變更紀錄工具（每日 LINE 通知用，見 specs/0025）。

type Db = ReturnType<typeof useDb>

const WEEKDAY_1_7 = ['', '一', '二', '三', '四', '五', '六', '日'] // 依 dayOfWeek 1..7 取值
const WEEKDAY_0_6 = ['日', '一', '二', '三', '四', '五', '六'] // JS getDay：0=週日

function kindLabel(kind: string): string {
  return kind === 'course' ? '課程' : '活動'
}

// 課程（每週重複）→ 例：課程「產品課」每週三 20:00
export function buildCourseSummary(c: Course): string {
  const time = c.startTime ? ` ${c.startTime}` : ''
  return `${kindLabel(c.kind)}「${c.title}」每週${WEEKDAY_1_7[c.dayOfWeek] ?? c.dayOfWeek}${time}`
}

// 單次活動 → 例：活動「家聚」7/22(二) 19:00
export function buildEventSummary(e: Event): string {
  const [ys, ms, ds] = e.date.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  const valid = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
  const wd = valid ? (WEEKDAY_0_6[new Date(y, m - 1, d).getDay()] ?? '') : ''
  const time = e.startTime ? ` ${e.startTime}` : ''
  return `${kindLabel(e.kind)}「${e.title}」${m}/${d}(${wd})${time}`
}

// 寫一筆變更紀錄。刻意吞掉錯誤：通知記錄失敗不該讓課表編輯本身失敗。
export async function logScheduleChange(
  db: Db,
  change: {
    entityType: 'course' | 'event'
    entityId: number
    action: 'created' | 'updated' | 'deleted'
    classroom: string
    summary: string
  }
): Promise<void> {
  try {
    await db.insert(scheduleChanges).values(change)
  } catch (err) {
    console.error('[scheduleChange] 記錄失敗（不影響課表操作）:', err)
  }
}
