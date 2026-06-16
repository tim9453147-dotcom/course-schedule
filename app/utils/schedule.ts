// 教室分頁清單
export const CLASSROOMS = ['中壢', '新竹', '台北', '台中']

// 課程資料型別（對應後端 D1 的 courses 表）
export interface Course {
  id: number
  classroom: string
  title: string
  teacher: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  location: string | null
  color: string
  note: string | null
  createdAt: number
}

// 單次活動資料型別（對應後端 events 表）
export interface CalEvent {
  id: number
  classroom: string
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  color: string
  note: string | null
  createdAt: number
}

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
