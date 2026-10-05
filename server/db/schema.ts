import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

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
}, table => ({
  equipmentIdIdx: index('rentals_equipment_id_idx').on(table.equipmentId)
}))

// 使用者資料表（Cloudflare Access 身分＋頁面權限＋審核）
// 超級管理員 email 由環境變數 allowlist 判斷，不需建立於此表。
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 舊登入帳號；遷移期保留，既有關聯仍以 user id 運作。
  username: text('username').notNull().unique(),
  // 經 Cloudflare Access 驗證並標準化為小寫的 email；一般使用者身分唯一鍵。
  accessEmail: text('access_email').unique(),
  // 顯示名稱
  displayName: text('display_name').notNull(),
  // 舊帳密相容欄位；Access 模式不使用，待未來重建 SQLite 表時移除。
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

// 家聚點 — 活動核心＋紀錄（spec 0021）。共用（無 userId）、不分教室。
// 一場家聚一筆；收支與活動紀錄兩個分頁都指向同一筆，只是顯示不同欄位。
export const gatherings = sqliteTable('gatherings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 活動名稱，例「海南雞飯」
  name: text('name').notNull(),
  // 日期 "YYYY-MM-DD"
  date: text('date').notNull(),
  // 開始 / 結束時間 "HH:MM"，可空
  startTime: text('start_time'),
  endTime: text('end_time'),
  // 地點，例「吾心家」
  location: text('location'),
  // 地圖連結
  mapUrl: text('map_url'),
  // 角色（存人名）：操鍋 / 助手 / 採買
  cook: text('cook'),
  assistant: text('assistant'),
  shopper: text('shopper'),
  // 流程（多行純文字）
  process: text('process'),
  // 參加名單（多行純文字）
  attendees: text('attendees'),
  // 引用的食譜（可空）
  recipeId: integer('recipe_id').references(() => recipes.id),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 家聚點 — 收支（與 gathering 一對一；獨立成表以乾淨隔離 private 權限）。
// 收入＝人數×收費、盈餘＝收入−支出，皆不存，讀取時計算。
export const gatheringFinances = sqliteTable('gathering_finances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gatheringId: integer('gathering_id')
    .notNull()
    .unique()
    .references(() => gatherings.id),
  // 人數 / 收費（每人）/ 支出，皆可空
  headcount: integer('headcount'),
  fee: integer('fee'),
  expense: integer('expense'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 家聚點 — 食譜（獨立清單）。活動可選填引用一道。
export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 料理名稱
  name: text('name').notNull(),
  // 食材
  ingredients: text('ingredients'),
  // 作法
  steps: text('steps'),
  // 備註
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 全站設定（通用鍵值表，單列一鍵）。用於存 LINE 群組 ID（key=line_group_id，見 specs/0025）。
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})

// 課表變更紀錄（每日 LINE 通知用，見 specs/0025）。
// 每次 courses/events 的新增/修改/刪除各記一筆；notifiedAt 為 null 代表「待通知」。
// entityId=0 代表彙整型異動（例如批次匯入），發送時不與其他列合併。
export const scheduleChanges = sqliteTable('schedule_changes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').notNull(), // course / event
  entityId: integer('entity_id').notNull().default(0),
  action: text('action').notNull(), // created / updated / deleted
  classroom: text('classroom').notNull(),
  summary: text('summary').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  notifiedAt: integer('notified_at')
}, table => ({
  notifiedAtIdx: index('schedule_changes_notified_at_idx').on(table.notifiedAt)
}))

// 通知發送紀錄（見 specs/0025）。每次嘗試 push 記一筆，供除錯。
export const notificationLogs = sqliteTable('notification_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  channel: text('channel').notNull(), // line（未來 discord/…）
  target: text('target'), // 群組 ID
  status: text('status').notNull(), // success / failed
  errorMessage: text('error_message'),
  sentAt: integer('sent_at')
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
export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
export type ScheduleChange = typeof scheduleChanges.$inferSelect
export type NewScheduleChange = typeof scheduleChanges.$inferInsert
export type NotificationLog = typeof notificationLogs.$inferSelect
export type NewNotificationLog = typeof notificationLogs.$inferInsert
export type Gathering = typeof gatherings.$inferSelect
export type NewGathering = typeof gatherings.$inferInsert
export type GatheringFinance = typeof gatheringFinances.$inferSelect
export type NewGatheringFinance = typeof gatheringFinances.$inferInsert
export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert
