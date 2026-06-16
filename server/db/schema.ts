import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

// 課程資料表
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 所屬教室：中壢 / 新竹 / 台北 / 台中
  classroom: text('classroom').notNull().default('中壢'),
  // 課程名稱，例如「微積分」
  title: text('title').notNull(),
  // 授課老師
  teacher: text('teacher'),
  // 星期：1=週一 ... 7=週日
  dayOfWeek: integer('day_of_week').notNull(),
  // 開始 / 結束時間，存成 "HH:MM" 字串，例如 "08:10"
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  // 教室 / 地點
  location: text('location'),
  // 顯示用的顏色（Tailwind 色名，例如 "sky"、"rose"）
  color: text('color').notNull().default('sky'),
  // 備註
  note: text('note'),
  // 建立時間（Unix 秒）
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 單次活動／事件（綁定一個實際日期，例如考試、活動）
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 所屬教室：中壢 / 新竹 / 台北 / 台中
  classroom: text('classroom').notNull().default('中壢'),
  title: text('title').notNull(),
  // 實際日期，存成 "YYYY-MM-DD"，例如 "2026-06-18"
  date: text('date').notNull(),
  // 時間可留空 → 視為整天事件
  startTime: text('start_time'),
  endTime: text('end_time'),
  location: text('location'),
  color: text('color').notNull().default('rose'),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 器材（依教室分類，記錄總數量）
export const equipment = sqliteTable('equipment', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classroom: text('classroom').notNull().default('中壢'),
  name: text('name').notNull(),
  // 分類，例如 球類 / 3C / 文具
  category: text('category'),
  // 總數量
  totalQty: integer('total_qty').notNull().default(1),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 借還紀錄
export const rentals = sqliteTable('rentals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  equipmentId: integer('equipment_id')
    .notNull()
    .references(() => equipment.id),
  // 借用人
  borrower: text('borrower').notNull(),
  // 借出數量
  qty: integer('qty').notNull().default(1),
  // 借出日 / 預計歸還日 / 實際歸還日（皆為 "YYYY-MM-DD"）
  borrowDate: text('borrow_date').notNull(),
  dueDate: text('due_date'),
  // returnDate 為 null 代表「借出中」尚未歸還
  returnDate: text('return_date'),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 方便其他檔案引用的型別
export type Course = typeof courses.$inferSelect
export type NewCourse = typeof courses.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Equipment = typeof equipment.$inferSelect
export type NewEquipment = typeof equipment.$inferInsert
export type Rental = typeof rentals.$inferSelect
export type NewRental = typeof rentals.$inferInsert
