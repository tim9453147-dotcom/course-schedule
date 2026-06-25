# 0010 — 每週重複可不填時間 + Google 日曆式「修改範圍」

## 背景

課表頁 (`app/pages/index.vue`) 把「每週重複」存成 `courses` 一列（`dayOfWeek` + 必填時間），一列即代表「無限期、每週同一天」的整個系列。需求：

1. 新增每週重複時，開始/結束時間不該強制必填（可做整天的每週重複）。
2. 編輯每週重複項目按「儲存」時，先問修改範圍（像 Google 日曆）：**僅這一次 / 這次及之後 / 全部**。

需求 2 需要「某一次」與「某段範圍」的概念，故擴充 `courses` 資料模型。

## 變更

### 需求 1（免 migration）
- `courseInputSchema`（`server/utils/validation.ts`）：`startTime`/`endTime` 改成 `time.or(z.literal('')).default('')`。欄位仍 `NOT NULL TEXT`，存空字串。
- `save()`：移除「每週重複需填開始與結束時間」的擋下檢查。
- 展開後空字串時間 → `allDay` 的每週重複實例。

### 需求 2 — 資料模型（migration `0013_flashy_iron_patriot.sql`）
`courses` 新增三欄（沿用 `contacts.completedStages` 的 `mode:'json'`）：
- `startDate TEXT`（含端點下界，null=不限）
- `endDate TEXT`（含端點上界，null=永遠）
- `exDates TEXT NOT NULL DEFAULT '[]'`（被「僅這一次」抽掉的日期 JSON 陣列）

`courseInputSchema` 增加 `startDate`/`endDate`（`dateStr.or(literal('')).nullish()`）、`exDates`（`array(dateStr).default([])`）；`courses` POST/PUT 寫入前把空字串日期正規化為 `null`。`Course` 介面（`app/utils/schedule.ts`）同步加欄位。

### 需求 2 — 渲染（手動展開）
FullCalendar 的 `daysOfWeek` 不支援排除單一天，而「僅這一次」必須把該日抽掉，故改為自行展開：
- `viewRange` ref + `onDatesSet`：追蹤目前可見日期範圍（初始今天 ±60 天）。
- `expandCourse(c)`：在 `[max(startDate,viewStart), min(endDate,viewEnd)]` 內、星期符合、未在 `exDates` 的日期逐一產生實例，`extendedProps.occDate` 記住是哪一次。
- 單次活動 (`events`) 維持原樣。拖曳行為不變（整個系列平移星期）。

### 需求 2 — 編輯流程
- `onEventClick`（course）：以 `occDate` 設 `editingOccurrenceDate` 與 `form.date`（修正原本固定取本週的問題）。
- `save()`：若 `mode=edit && source=course && repeat=weekly` → 開「修改範圍」`URadioGroup` 視窗，不直接存。
- `applyCourseEdit(scope)`：
  - **all**：`PUT` 原課，只改內容、範圍/例外日不動。
  - **following**：`PUT` 原課 `endDate=occ 前一天`、`exDates` 留 `<occ`；`POST` 新課 `startDate=occ`、沿用原 `endDate` 與 `>=occ` 的例外日，套用新內容。
  - **this**：`PUT` 原課 `exDates += occ`；`POST /api/events` 在 occ 建立單次活動覆寫。

## 影響檔案
`server/db/schema.ts`、`server/db/migrations/0013_flashy_iron_patriot.sql`、`server/utils/validation.ts`、`server/api/courses/index.post.ts`、`server/api/courses/[id].put.ts`、`app/utils/schedule.ts`、`app/pages/index.vue`。

## 部署
`bun run db:generate` 已產生 0013；本地已 `db:migrate:local`。部署前/後須 `bun run db:migrate:remote`。

## 驗證
- 新增每週重複、時間選「不指定」→ 整天每週重複正常顯示。
- 點某次每週課編輯 → 三選一：
  - 僅這一次：`courses.ex_dates` 多一日、`events` 多一列覆寫，其餘照舊。
  - 這次及之後：原課 `end_date` 設為前一天、新增一列 `start_date=該日`。
  - 全部：整系列內容變更。
- 既有舊課（`start_date/end_date` 為 null）維持無限顯示。
- `typecheck`/`lint` 未新增錯誤（既有錯誤與本變更無關）。
