import { z } from 'zod'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式需為 HH:MM')
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD')

// 新增 / 編輯課程時的輸入驗證
export const courseInputSchema = z.object({
  classroom: z.string().trim().min(1).default('中壢'),
  kind: z.enum(['activity', 'course']).default('course'),
  title: z.string().trim().min(1, '請輸入名稱'),
  host: z.string().trim().nullish(),
  sharer: z.string().trim().nullish(),
  summarizer: z.string().trim().nullish(),
  pm: z.string().trim().nullish(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  // 時間可留空（整天的每週重複）；空字串視為未指定
  startTime: time.or(z.literal('')).default(''),
  endTime: time.or(z.literal('')).default(''),
  // 重複範圍與例外日（皆可選）：供「此活動及後續 / 僅這一次」拆段、排除使用
  startDate: dateStr.or(z.literal('')).nullish(),
  endDate: dateStr.or(z.literal('')).nullish(),
  exDates: z.array(dateStr).default([]),
  location: z.string().trim().nullish(),
  color: z.string().trim().default('sky'),
  note: z.string().trim().nullish()
})

export type CourseInput = z.infer<typeof courseInputSchema>

// ── 匯入活動（批次依日期寫入 events）──────────────────────────────
// 單筆匯入活動：依「日期」(date) 匯入；classroom 由外層帶入、kind 一律 course（後端硬寫，忽略來源 JSON）、
// color 可省略（補預設 sky）。見 specs/0012。
export const eventImportItemSchema = z.object({
  title: z.string().trim().min(1, '請輸入名稱'),
  host: z.string().trim().nullish(),
  sharer: z.string().trim().nullish(),
  summarizer: z.string().trim().nullish(),
  pm: z.string().trim().nullish(),
  date: dateStr,
  startTime: time.or(z.literal('')).default(''),
  endTime: time.or(z.literal('')).default(''),
  location: z.string().trim().nullish(),
  color: z.string().trim().optional(),
  note: z.string().trim().nullish()
})

export type EventImportItem = z.infer<typeof eventImportItemSchema>

// 整批匯入：選教室 + 模式 + 活動陣列。單次請求上限 45（D1 免費方案 50 query/次，前端會切塊；見 specs/0012）
// 覆蓋模式只清除 [replaceFrom, replaceTo] 日期區間內、此教室的活動（前端帶入整批的 min/max 日期）。
export const importEventsSchema = z.object({
  classroom: z.string().trim().min(1),
  mode: z.enum(['append', 'replace']).default('append'),
  replaceFrom: dateStr.optional(),
  replaceTo: dateStr.optional(),
  items: z.array(eventImportItemSchema).min(1, '沒有可匯入的資料').max(45, '單次請求最多 45 筆')
})

export type ImportEventsInput = z.infer<typeof importEventsSchema>

// 新增 / 編輯單次活動時的輸入驗證
export const eventInputSchema = z.object({
  classroom: z.string().trim().min(1).default('中壢'),
  kind: z.enum(['activity', 'course']).default('activity'),
  title: z.string().trim().min(1, '請輸入名稱'),
  host: z.string().trim().nullish(),
  sharer: z.string().trim().nullish(),
  summarizer: z.string().trim().nullish(),
  pm: z.string().trim().nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD'),
  // 時間可留空（整天事件）；用 .or(literal('')) 把空字串視為未填
  startTime: time.or(z.literal('')).nullish(),
  endTime: time.or(z.literal('')).nullish(),
  location: z.string().trim().nullish(),
  color: z.string().trim().default('rose'),
  note: z.string().trim().nullish()
})

export type EventInput = z.infer<typeof eventInputSchema>

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD')

// 器材輸入驗證
export const equipmentInputSchema = z.object({
  classroom: z.string().trim().min(1).default('中壢'),
  name: z.string().trim().min(1, '請輸入器材名稱'),
  category: z.string().trim().nullish(),
  totalQty: z.coerce.number().int().min(0, '數量不可為負'),
  note: z.string().trim().nullish()
})

export type EquipmentInput = z.infer<typeof equipmentInputSchema>

// 借還紀錄輸入驗證
export const rentalInputSchema = z.object({
  equipmentId: z.coerce.number().int(),
  borrower: z.string().trim().min(1, '請輸入借用人'),
  qty: z.coerce.number().int().min(1, '數量至少 1'),
  borrowDate: date,
  dueDate: date.or(z.literal('')).nullish(),
  returnDate: date.or(z.literal('')).nullish(),
  note: z.string().trim().nullish()
})

export type RentalInput = z.infer<typeof rentalInputSchema>

// CRM 跟進頻率允許值
const followUpFreq = z.enum([
  '一週一次',
  '兩週一次',
  '一個月一次',
  '一季一次',
  '半年一次',
  '暫停'
])

// 名單：新增 / 編輯（整筆）。nextFollowUp 由後端計算，不接受前端輸入。
export const contactInputSchema = z.object({
  name: z.string().trim().min(1, '請輸入姓名'),
  location: z.string().trim().nullish(),
  // 是否已破題（false=未破題 / true=破題）
  broached: z.boolean().default(false),
  // 已完成的進度階段 id 陣列
  completedStages: z.array(z.number().int()).default([]),
  contact: z.string().trim().nullish(),
  followUpFreq: followUpFreq.or(z.literal('')).nullish(),
  lastFollowUp: date.or(z.literal('')).nullish(),
  note: z.string().trim().nullish()
})

export type ContactInput = z.infer<typeof contactInputSchema>

// 名單：inline 即時切換（只送變動欄位）
// 注意：broached / completedStages 在 contactInputSchema 帶有 .default()，但 zod 的
// .partial() 不會移除 default —— 未送出的欄位會被重新填成預設值，導致誤清。
// 故在此把它們覆寫成「不帶 default 的 optional」，沒送的欄位就維持原值不動。
export const contactPatchSchema = contactInputSchema.partial().extend({
  broached: z.boolean().optional(),
  completedStages: z.array(z.number().int()).optional()
})

export type ContactPatch = z.infer<typeof contactPatchSchema>

// 進度階段：新增 / 編輯
export const contactStageInputSchema = z.object({
  label: z.string().trim().min(1, '請輸入階段名稱')
})

export type ContactStageInput = z.infer<typeof contactStageInputSchema>

export const contactStagePatchSchema = z.object({
  label: z.string().trim().min(1, '請輸入階段名稱').optional(),
  sortOrder: z.coerce.number().int().optional()
})

export type ContactStagePatch = z.infer<typeof contactStagePatchSchema>

// 跟進紀錄輸入驗證
export const followUpLogSchema = z.object({
  date,
  content: z.string().trim().nullish()
})

export type FollowUpLogInput = z.infer<typeof followUpLogSchema>

// 取消「今天已跟進」：帶入要清除的日期（由前端以當地今天送出）
export const doneDateSchema = z.object({ date })

export type DoneDateInput = z.infer<typeof doneDateSchema>
