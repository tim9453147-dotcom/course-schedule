// 名單型別（對應後端 contacts 表）
export interface Contact {
  id: number
  name: string
  location: string | null
  stepBreak: boolean
  step2: boolean
  step336: boolean
  stepJoined: boolean
  step28: boolean
  contact: string | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
  note: string | null
  createdAt: number
  updatedAt: number
}

// 跟進紀錄型別（對應後端 follow_up_logs 表）
export interface FollowUpLog {
  id: number
  contactId: number
  date: string
  content: string | null
  createdAt: number
}

// 漏斗 5 階段（依序）；key 對應 Contact 上的布林欄位
export const FUNNEL_STEPS = [
  { key: 'stepBreak', label: '破題' },
  { key: 'step2', label: '2' },
  { key: 'step336', label: '336' },
  { key: 'stepJoined', label: '加入' },
  { key: 'step28', label: '28' }
] as const

export type StepKey = (typeof FUNNEL_STEPS)[number]['key']

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

// 名單已完成到第幾階段（連續完成的階段數，用於漏斗進度）
export function funnelProgress(c: Contact) {
  let n = 0
  for (const step of FUNNEL_STEPS) {
    if (c[step.key]) n++
    else break
  }
  return n
}
