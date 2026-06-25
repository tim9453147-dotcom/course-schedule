// 教室分頁清單 CLASSROOMS 已移到 shared/utils/classrooms.ts（前後端共用，自動匯入）

// 課程資料型別（對應後端 D1 的 courses 表）
export interface Course {
  id: number
  classroom: string
  kind: string
  title: string
  host: string | null
  sharer: string | null
  summarizer: string | null
  pm: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  // 重複範圍（含端點，"YYYY-MM-DD"）；null=不限／永遠
  startDate: string | null
  endDate: string | null
  // 例外日（被「僅這一次」抽掉的日期）
  exDates: string[]
  location: string | null
  color: string
  note: string | null
  createdAt: number
}

// 單次活動資料型別（對應後端 events 表）
export interface CalEvent {
  id: number
  classroom: string
  kind: string
  title: string
  host: string | null
  sharer: string | null
  summarizer: string | null
  pm: string | null
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  color: string
  note: string | null
  createdAt: number
}

// 分類：活動 / 課程（純標籤，影響預設顏色、標題文字、是否顯示老師欄）
export const KIND_OPTIONS = [
  { value: 'activity', label: '活動' },
  { value: 'course', label: '課程' }
]

// 各分類的預設顏色（新增時或切換分類時帶入；使用者仍可自行改）
export const KIND_DEFAULT_COLOR: Record<string, string> = {
  activity: 'rose',
  course: 'sky'
}

// 重複方式：決定要存成「單次活動(events)」還是「每週(courses)」
export const REPEAT_OPTIONS = [
  { value: 'none', label: '不重複' },
  { value: 'weekly', label: '每週重複' }
]

// 時間下拉：小時 00～23（24 小時制）、分鐘只有 00/15/30/45
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const v = String(h).padStart(2, '0')
  return { label: v, value: v }
})

export const MINUTE_OPTIONS = ['00', '15', '30', '45'].map(v => ({ label: v, value: v }))

// 星期 1~7 對應中文
export const DAY_NAMES = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

export function dayName(day: number) {
  return DAY_NAMES[day - 1] ?? `第 ${day} 天`
}

// 可選顏色，class 字串寫死，Tailwind 才掃得到（不能用動態字串拼接）
export const COLOR_OPTIONS = [
  { value: 'sky', label: '天藍', card: 'bg-sky-50 dark:bg-sky-950 border-sky-300 dark:border-sky-800', dot: 'bg-sky-500' },
  { value: 'emerald', label: '翠綠', card: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { value: 'violet', label: '紫羅蘭', card: 'bg-violet-50 dark:bg-violet-950 border-violet-300 dark:border-violet-800', dot: 'bg-violet-500' },
  { value: 'amber', label: '琥珀', card: 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
  { value: 'rose', label: '玫瑰', card: 'bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800', dot: 'bg-rose-500' },
  { value: 'cyan', label: '青色', card: 'bg-cyan-50 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-800', dot: 'bg-cyan-500' }
]

export function colorCard(color: string) {
  return (COLOR_OPTIONS.find(c => c.value === color) ?? COLOR_OPTIONS[0]).card
}

export function colorDot(color: string) {
  return (COLOR_OPTIONS.find(c => c.value === color) ?? COLOR_OPTIONS[0]).dot
}

// FullCalendar 需要實際色碼（不是 Tailwind class）
export const COLOR_HEX: Record<string, string> = {
  sky: '#0ea5e9',
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  cyan: '#06b6d4'
}

export function colorHex(color: string) {
  return COLOR_HEX[color] ?? COLOR_HEX.sky
}
