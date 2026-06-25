# 0011 — 匯入課表（選教室 + 貼上 JSON + 預覽確認）

## 背景

目前要建立每週課程，只能在月曆上一筆一筆 inline 新增（`app/pages/index.vue`）。實務上課表來源是**圖片**，使用者會先用 AI 把圖片轉成文字，再批次匯入。

決定：來源文字格式用 **JSON**（直接對應 `courses` 欄位、可用現有 `courseInputSchema` 驗證、中文課名含逗號也不破格）。流程：**在匯入畫面選教室 → 貼上 JSON → 解析預覽 → 確認匯入**。本版只處理每週課程（`courses`），單次活動（`events`）與「app 內直接上傳圖片由後端轉 JSON」列為後續。

## JSON 格式（餵給 AI 的目標格式）

頂層為陣列，每堂課一個物件。`classroom` 不放在 JSON 裡（由匯入畫面選的教室統一帶入）；`color` 可省略（依 `kind` 給預設）。

```json
[
  { "title": "微積分", "kind": "course", "dayOfWeek": 1,
    "startTime": "08:10", "endTime": "09:00",
    "host": "小明", "sharer": "小華", "summarizer": "", "pm": "",
    "location": "", "note": "" },
  { "title": "晚會", "kind": "activity", "dayOfWeek": 5, "startTime": "19:30", "endTime": "21:00" }
]
```

- `dayOfWeek`：1=週一…7=週日。為方便 AI，後端**寬鬆解析**：也接受中文（`週一`/`一`…`日`）轉成 1–7。
- `startTime`/`endTime`：24 小時 `HH:MM`；整天課留空字串 `""`（沿用 0010 的「每週可不填時間」）。寬鬆：`H:MM` 自動補零。
- `kind`：`course` 或 `activity`，預設 `course`。
- 缺的欄位可省略；`color` 省略時 course→`sky`、activity→`rose`（對齊 `KIND_DEFAULT_COLOR`）。

## 後端

新增 `server/api/courses/import.post.ts`（沿用既有 route 風格：`requirePage(event,'calendar')` → `readValidatedBody` → `useDb`）：

- 輸入驗證（加在 `server/utils/validation.ts`）：
  ```
  courseImportItemSchema = courseInputSchema.omit({ classroom: true }).extend({
    dayOfWeek: 寬鬆(number 1–7 或 中文星期) ,
    color: z.string().trim().optional()   // 省略時依 kind 補預設
  })
  importCoursesSchema = z.object({
    classroom: z.enum(CLASSROOMS 之一),
    mode: z.enum(['append','replace']).default('append'),
    items: z.array(courseImportItemSchema).min(1).max(CAP)  // CAP 見下方「筆數上限」
  })
  ```
- 處理：把每筆補上 `classroom`（頂層）、缺 `color` 依 `kind` 補預設。
  - `mode='replace'`：先刪掉該教室現有 `courses`，再插入。
  - `mode='append'`：直接插入。
- **以 `db.batch([...])` 包成單一原子操作**（replace 的刪除＋插入全有或全無；超過 D1 單批上限就分塊）。
- 回傳 `{ inserted, deleted }`。

權限：`requirePage(event,'calendar')`（超級管理員全通）——與既有課表寫入一致。免 migration（無 schema 變更）。

## 前端（`app/pages/index.vue`）

- 工具列「新增」旁加「匯入」按鈕（`v-if="canEdit"`）。
- 新 `UModal`「匯入課表」：
  - **教室** `USelect`：預設帶目前分頁 `classroom`；選項為 `visibleClassrooms`（超管為全部 `CLASSROOMS`）。
  - **模式** radio（沿用 0010 的 `URadioGroup`，label 可點）：`附加（預設）` / `覆蓋此教室`。覆蓋選項顯示警告字樣。
  - **JSON** `UTextarea`：貼上文字；附一行格式提示與「複製 AI 指令」小按鈕（把上面那段 prompt 複製到剪貼簿）。
  - **解析預覽** 按鈕：前端 `JSON.parse` + 基本形狀檢查，渲染預覽表格（課程名稱／類型／`dayName(星期)`／時間／角色），顯示「共 N 筆」與逐列錯誤（紅字標出第幾筆缺名稱、星期超範圍等）。解析失敗顯示明確錯誤。
  - **確認匯入** 按鈕：解析無誤才可按 → `POST /api/courses/import` → `refreshCourses()` → toast「已匯入 N 筆」→ 關閉。
- 重用 `DAY_NAMES`/`dayName`、`KIND_OPTIONS`、`KIND_DEFAULT_COLOR`（`app/utils/schedule.ts`）。

## 影響檔案

- 新增 `server/api/courses/import.post.ts`
- `server/utils/validation.ts`（`courseImportItemSchema`、`importCoursesSchema`、中文星期寬鬆解析）
- `app/pages/index.vue`（匯入按鈕＋匯入視窗＋預覽）
- 可能把 `KIND_DEFAULT_COLOR` 的 kind→color 預設邏輯抽一個共用 helper（前後端都用）

## 一次可匯入的筆數上限

正常一份每週課表約幾十筆，實務上不會碰到限制。相關 D1 硬限制（2026-06 查證）：

- 每條查詢最多 **100 個 bound parameter** → 一筆課程 ~16 欄，故**不可**用多筆合併 INSERT（~6 筆就爆）；改用 `db.batch()` 一列一條 INSERT（每條 16 參數）。
- 每次請求（Worker invocation）查詢數上限 **1000（付費）／50（免費）** → 一列一條的情況下，單次請求約 **≤990 筆（付費）／≤45 筆（免費，覆蓋模式再扣 1 條刪除）**。
- 每條 SQL ≤100 KB、單一字串/列 ≤2 MB、查詢需 30 秒內完成（皆非瓶頸）。

決策（**本專案為 D1 免費方案** → 採自動切塊，等於無總筆數上限）：
- 前端把 items **切成每塊 40 筆**，逐塊 `POST /api/courses/import`。
  - 預算計算：免費上限 50 條/次。一次請求含 `getActor` 查使用者（一般 calendar 權限者 +1 條；超管 0 條）＋覆蓋模式的刪除（+1 條）＋ N 條 INSERT。取 N=40 → 最多 42 條，安全留邊。
- 後端 `importCoursesSchema.items` 設 `.max(45)` 作為硬防呆（單次請求永不超過查詢預算）。
- 覆蓋模式：**第一塊**帶 `mode:'replace'`（在同一 `db.batch` 內「刪除該教室＋插入」，原子）；其餘塊帶 `mode:'append'`。
- 前端逐塊送出時顯示進度（「已匯入 40 / 120…」），中途某塊失敗則停止並回報「已成功寫入 X 筆、第 Y 塊失敗」，避免使用者誤以為全失敗。

## 不在本版範圍（後續）

- 單次活動（`events`）的匯入。
- App 內直接**上傳圖片**、由後端呼叫視覺模型（Workers AI / Claude API）轉 JSON——較大版本，先用「外部 AI 轉 JSON → 貼上匯入」。
- CSV／Excel 來源。

## 驗證

1. `typecheck` / `lint` 不新增錯誤。
2. API：登入後 `POST /api/courses/import`
   - `append`：插入 N 筆，回 `{inserted:N,deleted:0}`，月曆出現。
   - `replace`：該教室舊課清空後插入，`{inserted:N,deleted:M}`。
   - 壞資料（星期 8、缺 title）→ 400 並指出哪一筆。
   - 中文星期（`週一`）正確轉 1。
3. 瀏覽器：選教室、貼 JSON、解析預覽顯示正確、確認後月曆呈現；覆蓋模式確認舊課被換掉。
4. 部署無需 migration。
