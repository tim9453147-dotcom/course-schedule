import type { GatheringInput } from './validation'

// 把家聚活動輸入正規化成寫入 DB 的值：空字串一律轉 null，讓資料庫乾淨。
// （recipeId 已由 schema 轉為 number|null）
export function normalizeGathering(data: GatheringInput) {
  const s = (v: string | null | undefined) => {
    const t = (v ?? '').trim()
    return t === '' ? null : t
  }
  return {
    name: data.name,
    date: data.date,
    startTime: s(data.startTime),
    endTime: s(data.endTime),
    location: s(data.location),
    mapUrl: s(data.mapUrl),
    cook: s(data.cook),
    assistant: s(data.assistant),
    shopper: s(data.shopper),
    process: s(data.process),
    attendees: s(data.attendees),
    recipeId: data.recipeId ?? null,
    note: s(data.note)
  }
}

// 家聚收支計算：收入＝人數×收費、盈餘＝收入−支出（缺值以 0 計）。
export function computeFinance(headcount: number | null, fee: number | null, expense: number | null) {
  const income = (headcount ?? 0) * (fee ?? 0)
  const profit = income - (expense ?? 0)
  return { income, profit }
}
