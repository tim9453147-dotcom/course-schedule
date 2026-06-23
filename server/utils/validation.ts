import { z } from 'zod'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式需為 HH:MM')

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
  startTime: time,
  endTime: time,
  location: z.string().trim().nullish(),
  color: z.string().trim().default('sky'),
  note: z.string().trim().nullish()
})

export type CourseInput = z.infer<typeof courseInputSchema>

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
  stepBreak: z.boolean().default(false),
  step2: z.boolean().default(false),
  step336: z.boolean().default(false),
  stepJoined: z.boolean().default(false),
  step28: z.boolean().default(false),
  contact: z.string().trim().nullish(),
  followUpFreq: followUpFreq.or(z.literal('')).nullish(),
  lastFollowUp: date.or(z.literal('')).nullish(),
  note: z.string().trim().nullish()
})

export type ContactInput = z.infer<typeof contactInputSchema>

// 名單：inline 即時切換（只送變動欄位）
// 注意：階段布林在 contactInputSchema 帶有 .default(false)，但 zod 的 .partial()
// 不會移除 default —— 未送出的階段欄位會被重新填成 false，導致「切換某一階段時
// 把其他階段一併清空」。故在此把 5 個階段覆寫成「不帶 default 的 optional」，
// 沒送的欄位就維持原值不動。
export const contactPatchSchema = contactInputSchema.partial().extend({
  stepBreak: z.boolean().optional(),
  step2: z.boolean().optional(),
  step336: z.boolean().optional(),
  stepJoined: z.boolean().optional(),
  step28: z.boolean().optional()
})

export type ContactPatch = z.infer<typeof contactPatchSchema>

// 跟進紀錄輸入驗證
export const followUpLogSchema = z.object({
  date,
  content: z.string().trim().nullish()
})

export type FollowUpLogInput = z.infer<typeof followUpLogSchema>
