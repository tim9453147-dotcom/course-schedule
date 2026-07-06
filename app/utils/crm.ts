// 名單型別（對應後端 contacts 表）
export interface Contact {
  id: number
  name: string
  location: string | null
  // 是否已破題（false=未破題 / true=破題）
  broached: boolean
  // 已完成的進度階段 id 陣列（對應 ContactStage.id）
  completedStages: number[]
  // 聯絡方式（開發名單）
  contact: string | null
  // 個人名單表延伸欄位（總名單明細 modal 編輯，表格預設不顯示）
  friendOf: string | null
  devPartner: string | null
  info: string | null
  // 等級：SSR / SR / R
  level: string | null
  // 狀態（織網表）
  status: string | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
  note: string | null
  createdAt: number
  updatedAt: number
}

// 進度階段型別（對應後端 contact_stages 表）
export interface ContactStage {
  id: number
  userId: number | null
  label: string
  sortOrder: number
  createdAt: number
}

// 跟進紀錄型別（對應後端 follow_up_logs 表）
export interface FollowUpLog {
  id: number
  contactId: number
  date: string
  content: string | null
  createdAt: number
}

// 破題與否的二選一切換選項
export const BROACHED_OPTIONS = [
  { label: '未破題', value: false },
  { label: '破題', value: true }
] as const

// 跟進頻率選項
export const FOLLOW_UP_FREQ_OPTIONS = [
  '一週一次',
  '兩週一次',
  '一個月一次',
  '一季一次',
  '半年一次',
  '暫停'
]

// 是否逾期（已設下次跟進日，且早於今天）
export function isOverdue(nextFollowUp: string | null | undefined) {
  return !!nextFollowUp && nextFollowUp < todayStr()
}

// 把日期（YYYY-MM-DD）轉成相對今天的中文描述：今天／昨天／N天前／一週前／N個月前…
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const today = todayStr()
  if (dateStr === today) return '今天'
  // 以 UTC 解析避免時區誤差，計算整數天差
  const a = Date.parse(`${dateStr}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return dateStr
  const days = Math.round((b - a) / 86400000)
  if (days < 0) return dateStr // 未來日期，原樣顯示
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return w === 1 ? '一週前' : `${w}週前`
  }
  if (days < 365) {
    const m = Math.floor(days / 30)
    return m === 1 ? '一個月前' : `${m}個月前`
  }
  const y = Math.floor(days / 365)
  return y === 1 ? '一年前' : `${y}年前`
}
