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
