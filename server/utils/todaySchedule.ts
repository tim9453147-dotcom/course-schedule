import { and, eq, or, isNull, lte, gte } from 'drizzle-orm'
import { courses, events } from '../db/schema'
import type { useDb } from './db'

// 今日課表（每日通知用，見 specs/0026）：收集今天的課程 + 活動，跨所有教室。

type Db = ReturnType<typeof useDb>

export interface TodayInfo {
  date: string // YYYY-MM-DD（台灣）
  dayOfWeek: number // 1=週一 ... 7=週日（對齊 courses.dayOfWeek）
  month: number
  day: number
  weekdayLabel: string // 一/二/.../日
}

export interface TodayItem {
  classroom: string
  startTime: string | null // 空 → 全天
  title: string
  summarizer: string | null
}

const WEEKDAY_0_6 = ['日', '一', '二', '三', '四', '五', '六'] // JS getDay：0=週日

// 以台灣時區（UTC+8）取「今天」是哪一天、星期幾
export function getTaiwanToday(): TodayInfo {
  const tw = new Date(Date.now() + 8 * 3600 * 1000)
  const y = tw.getUTCFullYear()
  const m = tw.getUTCMonth() + 1
  const d = tw.getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const jsDow = tw.getUTCDay() // 0=Sun..6=Sat
  return {
    date: `${y}-${pad(m)}-${pad(d)}`,
    dayOfWeek: jsDow === 0 ? 7 : jsDow,
    month: m,
    day: d,
    weekdayLabel: WEEKDAY_0_6[jsDow] ?? ''
  }
}

// 收集今日課程（尊重重複範圍與例外日）+ 今日活動，依教室分組、組內按時間排序。
export async function collectTodaySchedule(
  db: Db,
  today: TodayInfo
): Promise<{ classroom: string, items: TodayItem[] }[]> {
  // 課程：星期相符 + 日期落在重複範圍內（null 代表不限）
  const courseRows = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.dayOfWeek, today.dayOfWeek),
        or(isNull(courses.startDate), lte(courses.startDate, today.date)),
        or(isNull(courses.endDate), gte(courses.endDate, today.date))
      )
    )
  const courseItems: TodayItem[] = courseRows
    .filter(c => !(Array.isArray(c.exDates) && c.exDates.includes(today.date))) // 例外日排除
    .map(c => ({ classroom: c.classroom, startTime: c.startTime || null, title: c.title, summarizer: c.summarizer ?? null }))

  // 活動：日期精確相符
  const eventRows = await db.select().from(events).where(eq(events.date, today.date))
  const eventItems: TodayItem[] = eventRows.map(e => ({
    classroom: e.classroom,
    startTime: e.startTime || null,
    title: e.title,
    summarizer: e.summarizer ?? null
  }))

  return groupByClassroom([...courseItems, ...eventItems])
}

// 依教室分組（教室順序照 CLASSROOMS），組內整天排最前、其餘按時間由早到晚
function groupByClassroom(items: TodayItem[]): { classroom: string, items: TodayItem[] }[] {
  const byRoom = new Map<string, TodayItem[]>()
  for (const it of items) {
    const arr = byRoom.get(it.classroom)
    if (arr) arr.push(it)
    else byRoom.set(it.classroom, [it])
  }
  const entries = [...byRoom.entries()].sort((a, b) => CLASSROOMS.indexOf(a[0]) - CLASSROOMS.indexOf(b[0]))
  return entries.map(([classroom, list]) => ({ classroom, items: list.sort(byTime) }))
}

function byTime(a: TodayItem, b: TodayItem): number {
  if (!a.startTime && !b.startTime) return 0
  if (!a.startTime) return -1
  if (!b.startTime) return 1
  return a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0
}

// 組出「今日課表」文字區塊
export function buildTodayScheduleBlock(
  grouped: { classroom: string, items: TodayItem[] }[],
  today: TodayInfo
): string {
  const header = `☀️ 早安！今日課表（${today.month}/${today.day} 週${today.weekdayLabel}）`
  const blocks = grouped.map((g) => {
    const lines = g.items
      .map((it) => {
        const time = it.startTime || '全天'
        const sum = it.summarizer ? `（總結：${it.summarizer}）` : ''
        return `${time} ${it.title}${sum}`
      })
      .join('\n')
    return `【${g.classroom}】\n${lines}`
  }).join('\n\n')
  return `${header}\n\n${blocks}`
}
