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
  // 開始 / 結束時間，存成 "HH:MM" 字串，例如 "08:10"；空字串代表整天（不指定時間）
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  // 重複範圍（含端點，"YYYY-MM-DD"）：startDate=起始下界、endDate=結束上界；
  // 皆為 null 代表不限／永遠。供「此活動及後續」拆段使用（像 Google 日曆）。
  startDate: text('start_date'),
  endDate: text('end_date'),
  // 例外日（JSON 字串陣列，"YYYY-MM-DD"）：被「僅這一次」抽掉、改成單次活動覆寫的日期。
  exDates: text('ex_dates', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default([]),
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
  // 可看到的課表教室，存成 JSON 字串陣列；預設只看得到中壢
  classrooms: text('classrooms').notNull().default('["中壢"]'),
  // 申請備註
  note: text('note'),
  // 建立時間（Unix 秒）
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  // 審核通過時間（Unix 秒）
  approvedAt: integer('approved_at')
})

// CRM 名單（追蹤漏斗階段與跟進排程）
export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 擁有者：一般使用者為其 users.id；超級管理員為 NULL。每位使用者各自獨立的名單。
  userId: integer('user_id').references(() => users.id),
  // 姓名
  name: text('name').notNull(),
  // 位置
  location: text('location'),
  // 是否已破題（false=未破題 / true=破題）。固定的二元狀態，與下方可自訂階段分開。
  broached: integer('broached', { mode: 'boolean' }).notNull().default(false),
  // 已完成的「進度階段」id 陣列（對應 contact_stages.id），以 JSON 存放
  completedStages: text('completed_stages', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default([]),
  // 聯絡方式
  contact: text('contact'),
  // 以下為「每日任務／個人名單表」用的延伸欄位；總名單表格預設不顯示，靠明細 modal 編輯。
  // 誰的朋友（開發名單）
  friendOf: text('friend_of'),
  // 一起開發的夥伴姓名（開發名單）
  devPartner: text('dev_partner'),
  // 新人資訊，自由文字備註（開發名單）
  info: text('info'),
  // 等級：SSR / SR / R（開發名單）
  level: text('level'),
  // 狀態（織網表）
  status: text('status'),
  // 跟進頻率：一週一次 / 兩週一次 / 一個月一次 / 一季一次 / 半年一次 / 暫停
  followUpFreq: text('follow_up_freq'),
  // 最後 / 下次跟進日（"YYYY-MM-DD"）；nextFollowUp 由 lastFollowUp + 頻率自動算出
  lastFollowUp: text('last_follow_up'),
  nextFollowUp: text('next_follow_up'),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 進度階段定義（每位使用者各自一份，可自行新增／改名／排序／刪除）
// 擁有者規則同 contacts：一般使用者為 users.id，超級管理員為 NULL。
export const contactStages = sqliteTable('contact_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  // 階段名稱，例如「2」「336」「加入」「28」
  label: text('label').notNull(),
  // 排序（越小越前）
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 跟進紀錄（時間軸，一筆名單對多筆紀錄）
export const followUpLogs = sqliteTable('follow_up_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id),
  // 跟進日期（"YYYY-MM-DD"）
  date: text('date').notNull(),
  // 跟進內容
  content: text('content'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 每日任務（個人名單表）：四個區塊共用一張表，以 section 區分
//   develop=開發名單 / reserve=預備名單 / five=五人名單 / network=織網表
// 擁有者規則同 contacts：一般使用者為 users.id，超級管理員為 NULL，各自獨立。
// 採「先建立空白列，再 inline 逐欄填寫」的表單式操作，故除 section 外欄位皆可留空。
// 每日任務：把「總名單的某個人」放進某個區塊的關聯列。
//   姓名與延伸欄位（誰的朋友、等級、狀態…）都來自所引用的 contact，這裡只存「這一列自己的」資料。
//   同一個人在同一區塊不重複，但可同時出現在不同區塊。contact 被刪除時，其 prospects 一併刪除。
export const prospects = sqliteTable('prospects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 擁有者（同 contacts）：一般使用者為 users.id，超級管理員為 NULL。
  userId: integer('user_id').references(() => users.id),
  // 引用的總名單對象
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id),
  // 所屬區塊：develop / reserve / five / network
  section: text('section').notNull(),
  // 日期（"YYYY-MM-DD"）：加入此區塊的日期，屬於這一列自己
  date: text('date'),
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
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
export type ContactStage = typeof contactStages.$inferSelect
export type NewContactStage = typeof contactStages.$inferInsert
export type FollowUpLog = typeof followUpLogs.$inferSelect
export type NewFollowUpLog = typeof followUpLogs.$inferInsert
export type Prospect = typeof prospects.$inferSelect
export type NewProspect = typeof prospects.$inferInsert
