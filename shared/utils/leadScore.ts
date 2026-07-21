// 名單「今日跟進」熱度公式（先找誰）。純函式、無副作用、前後端共用（shared/ 自動匯入）。
// 比照 followup.ts：「今天」由呼叫端傳入（YYYY-MM-DD），不在此呼叫 Date.now()，方便測試與 SSR。

// 計算所需的最小名單欄位；app/utils 的 Contact 結構上相容。
export interface LeadScoreInput {
  broached: boolean
  completedStages: number[] | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
}

// 跟進頻率 → 權重（越高頻越該顧）。「暫停」與未設為 0。
export const FOLLOW_UP_FREQ_WEIGHT: Record<string, number> = {
  一週一次: 20,
  兩週一次: 14,
  一個月一次: 8,
  一季一次: 4,
  半年一次: 2,
  暫停: 0
}

const MS_PER_DAY = 86_400_000

// 兩個 YYYY-MM-DD 相差天數（a - b），無法解析回 0。
function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(da) || Number.isNaN(db)) return 0
  return Math.round((da - db) / MS_PER_DAY)
}

// 有設頻率（非暫停）但從沒跟進過 → 待啟動。
function isPending(c: LeadScoreInput): boolean {
  return !!c.followUpFreq && c.followUpFreq !== '暫停' && !c.lastFollowUp
}

// 是否列入「今日跟進」：逾期 ∪ 今天到期 ∪ 待啟動。
export function isTodayFollowUp(c: LeadScoreInput, today: string): boolean {
  if (isPending(c)) return true
  if (!c.nextFollowUp) return false
  return c.nextFollowUp <= today
}

// 熱度分數（越高越前）。
export function leadScore(c: LeadScoreInput, today: string): number {
  let score = 0
  if (c.nextFollowUp) {
    const overdue = dayDiff(today, c.nextFollowUp) // >0 逾期、=0 今天、<0 未到
    if (overdue > 0) score += Math.min(overdue, 30) * 3
    else if (overdue === 0) score += 40
  }
  if (isPending(c)) score += 35
  score += FOLLOW_UP_FREQ_WEIGHT[c.followUpFreq ?? ''] ?? 0
  score += (c.completedStages?.length ?? 0) * 5
  if (c.broached) score += 10
  return score
}

export type LeadReason
  = | { kind: 'overdue', label: string, days: number }
    | { kind: 'due', label: string }
    | { kind: 'pending', label: string }
    | null

// 主要理由（畫面主 chip 用）。優先序：逾期 → 今天到期 → 待啟動。
export function topReason(c: LeadScoreInput, today: string): LeadReason {
  if (c.nextFollowUp) {
    const overdue = dayDiff(today, c.nextFollowUp)
    if (overdue > 0) return { kind: 'overdue', label: `逾期 ${overdue} 天`, days: overdue }
    if (overdue === 0) return { kind: 'due', label: '今天到期' }
  }
  if (isPending(c)) return { kind: 'pending', label: '待啟動' }
  return null
}
