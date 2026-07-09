// 家聚點型別（對應後端 gatherings / gathering_finances / recipes 表；spec 0021）

// 活動核心＋紀錄
export interface Gathering {
  id: number
  name: string
  date: string
  startTime: string | null
  endTime: string | null
  location: string | null
  mapUrl: string | null
  cook: string | null
  assistant: string | null
  shopper: string | null
  process: string | null
  attendees: string | null
  recipeId: number | null
  note: string | null
  createdAt: number
}

// 收支列表列（活動 join 財務，附算好的 income/profit）
export interface GatheringFinanceRow {
  id: number // = gathering id
  name: string
  date: string
  headcount: number | null
  fee: number | null
  expense: number | null
  income: number
  profit: number
}

// 食譜
export interface Recipe {
  id: number
  name: string
  ingredients: string | null
  steps: string | null
  note: string | null
  createdAt: number
}

// 收入＝人數×收費、盈餘＝收入−支出（缺值以 0 計）
export function computeFinance(
  headcount: number | null,
  fee: number | null,
  expense: number | null
) {
  const income = (headcount ?? 0) * (fee ?? 0)
  const profit = income - (expense ?? 0)
  return { income, profit }
}
