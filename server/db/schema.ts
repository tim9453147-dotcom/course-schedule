import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

// 課程資料表
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 所屬教室：中壢 / 新竹 / 台北 / 台中
  classroom: text('classroom').notNull().default('中壢'),
  // 分類：activity=活動 / course=課程（純標籤，影響預設顏色與是否顯示課程角色欄）
  kind: text('kind').notNull().default('course'),
  // 課程名稱，例如「微積分」
  title: text('title').notNull(),
  // 課程角色（填人名，僅課程類型會用到）：主持 / 分享 / 總結 / PM
  host: text('host'),
  sharer: text('sharer'),
  summarizer: text('summarizer'),
  pm: text('pm'),
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
  // 分類：activity=活動 / course=課程（純標籤，影響預設顏色與是否顯示課程角色欄）
  kind: text('kind').notNull().default('activity'),
  title: text('title').notNull(),
  // 課程角色（填人名，僅課程類型會用到）：主持 / 分享 / 總結 / PM
  host: text('host'),
  sharer: text('sharer'),
  summarizer: text('summarizer'),
  pm: text('pm'),
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

// 使用者資料表（多帳號＋頁面權限＋申請審核）
// 超級管理員不在此表，靠環境變數帳號登入特判。
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 登入帳號，唯一（建議 email，不強制格式）
  username: text('username').notNull().unique(),
  // 顯示名稱
  displayName: text('display_name').notNull(),
  // 密碼雜湊（nuxt-auth-utils hashPassword，scrypt）
  passwordHash: text('password_hash').notNull(),
  // 狀態：pending=待審 / approved=已啟用 / rejected=已拒絕 / disabled=已停用
  status: text('status').notNull().default('pending'),
  // 已授權頁面，存成 JSON 字串陣列，例如 '["calendar","equipment"]'
  pages: text('pages').notNull().default('[]'),
  // 申請備註
  note: text('note'),
  // 建立時間（Unix 秒）
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  // 審核通過時間（Unix 秒）
  approvedAt: integer('approved_at')
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
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
