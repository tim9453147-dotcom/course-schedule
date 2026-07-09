# 0021 — 家聚點頁面（收支 / 活動紀錄 / 食譜）

## 目標

新增一個共用頁面「家聚點」，路由 `/gathering`，含三個分頁：

1. **收支紀錄**：一場家聚活動的完整財務（人數、收費、支出；收入與盈餘自動算）。
2. **活動紀錄**：同一場活動的流程／角色／名單／地點等紀錄；可引用一道食譜。
3. **食譜列表**：獨立食譜清單（名稱、食材、作法、備註）。

「收支紀錄」與「活動紀錄」是**同一場活動的兩種視角**（一場活動一筆），兩個分頁都列出全部活動、只是顯示不同欄位。食譜為獨立清單，活動可選填引用一道。

## 權限模型（一頁三 tab、各自授權）

沿用 `shared/utils/pages.ts` 的 `PAGES` 登記表，但為了「一頁三 tab、每 tab 分開授權」，做兩件事：

1. `PageDef` 新增可選欄位 `nav?: boolean`（預設 `true`）：控制是否在導覽列出現。
2. 新增三個 key，皆指向同一路由 `/gathering`：

| key | 標籤（導覽/授權格） | access | nav | 意義 |
|---|---|---|---|---|
| `gathering` | 家聚點 | `public` | `true` | 活動紀錄 tab；人人可看，有此權才能編輯 |
| `gathering-finance` | 家聚點·收支 | `private` | `false` | 收支 tab；有此權才能看見/編輯 |
| `gathering-recipe` | 家聚點·食譜 | `private` | `false` | 食譜 tab；有此權才能看見/編輯 |

行為：

- **導覽列**只出現一個「家聚點」（另兩筆 `nav:false` 被過濾掉）。`app.vue` 的 `visiblePages` 加上 `p.nav !== false` 過濾。
- **路由守門**：`pageByPath('/gathering')` 依陣列順序回傳第一筆（即 `gathering`，`public`），故 `/gathering` 人人可進；分頁內容才依權限顯示。`gathering` 需排在三筆之首。
- **分頁顯示**：活動紀錄 tab 永遠顯示；收支、食譜 tab 只有 `useCanEdit('gathering-finance')` / `useCanEdit('gathering-recipe')` 為真才顯示。
- **管理者授權格**（`/admin`）iterate `PAGES` 時自動出現三個勾選項，可獨立授權（`gathering-finance`、`gathering-recipe` 因 `nav:false` 不影響此處，仍會列出）。
- **後端**每支 API 各自 `requirePage(event, '<key>')` 把關（前端隱藏只是外觀，後端才是權威）。

> 兩個私有 key 的 `access:'private'` 在路由/導覽上其實不會被用到（`nav:false` 且 path 解析到公開的 `gathering`），保留 `private` 僅表達語義。

## 資料模型（`server/db/schema.ts` 新增三張表）

三張表皆為**共用**（無 `userId`）、**不分教室**（無 `classroom`）。

### `gatherings`（活動核心＋紀錄）
```
id            integer pk autoincrement
name          text notNull            -- 活動名稱，例「海南雞飯」
date          text notNull            -- "YYYY-MM-DD"
startTime     text                    -- "HH:MM"，可空
endTime       text                    -- "HH:MM"，可空
location      text                    -- 地點，例「吾心家」
mapUrl        text                    -- 地圖連結
cook          text                    -- 操鍋（人名）
assistant     text                    -- 助手（人名）
shopper       text                    -- 採買（人名）
process       text                    -- 流程（多行純文字）
attendees     text                    -- 參加名單（多行純文字）
recipeId      integer -> recipes.id   -- 可空，引用一道食譜
note          text
createdAt     integer notNull
```

### `gathering_finances`（收支，與 gathering 一對一）
```
id            integer pk autoincrement
gatheringId   integer notNull unique -> gatherings.id
headcount     integer                 -- 人數，可空
fee           integer                 -- 收費（每人），可空
expense       integer                 -- 支出，可空
createdAt     integer notNull
```
收入＝`headcount × fee`、盈餘＝`收入 − expense`，**不存**，前端/讀取時計算（缺值以 0 計）。

> 收支獨立成表的理由：收支是 private。獨立表 = API 直接用 `requirePage('gathering-finance')` 擋掉整支路由，不必在公開的活動 API 裡逐欄遮蔽財務數字（避免外洩、符合本專案「私有頁＝擋 API」既有慣例）。與活動為一對一，仍是「一場活動一筆」的心智模型。

### `recipes`（食譜）
```
id            integer pk autoincrement
name          text notNull            -- 料理名稱
ingredients   text                    -- 食材
steps         text                    -- 作法
note          text                    -- 備註
createdAt     integer notNull
```

型別 export：`Gathering`/`NewGathering`、`GatheringFinance`/`NewGatheringFinance`、`Recipe`/`NewRecipe`。

遷移：改 `schema.ts` → `just db-generate` → `just db-migrate-local`（部署前後再 `just db-migrate-remote`）。

## 後端 API

驗證 schema 放 `server/utils/validation.ts`：`gatheringInputSchema`、`gatheringFinanceSchema`、`recipeInputSchema`。

### 活動（活動紀錄 tab；讀公開、寫需 `gathering`）
- `GET  /api/gatherings`          — 公開，列全部活動（依 date 排序）。
- `GET  /api/gatherings/[id]`     — 公開，單筆。
- `POST /api/gatherings`          — `requirePage('gathering')`。
- `PUT  /api/gatherings/[id]`     — `requirePage('gathering')`。
- `DELETE /api/gatherings/[id]`   — `requirePage('gathering')`；一併刪除其 `gathering_finances` 列。

### 收支（收支 tab；讀寫皆需 `gathering-finance`）
- `GET /api/gathering-finances`               — `requirePage('gathering-finance')`；join 活動，回傳 `{ ...gathering, finance: {...}|null }[]` 或攤平欄位，供收支列表顯示 `日期｜名稱｜盈餘`。
- `PUT /api/gathering-finances/[gatheringId]` — `requirePage('gathering-finance')`；upsert（存在則更新、否則插入）該活動的財務。

### 食譜（食譜 tab；讀寫皆需 `gathering-recipe`）
- `GET    /api/recipes`        — `requirePage('gathering-recipe')`。
- `POST   /api/recipes`        — `requirePage('gathering-recipe')`。
- `PUT    /api/recipes/[id]`   — `requirePage('gathering-recipe')`。
- `DELETE /api/recipes/[id]`   — `requirePage('gathering-recipe')`；被引用時把引用它的 `gatherings.recipeId` 設回 null（或允許刪除，前端顯示以名稱查不到即忽略）。採「刪除時將引用者 recipeId 設 null」。

## 前端

- `app/pages/gathering.vue`：`definePageMeta({ middleware:'auth' })` 不需要（因 public 可進），改為在頁面內以 `useCanEdit` 決定分頁。用 `<UTabs>`，`items` 依權限動態組出（活動紀錄恆有；收支/食譜視權限加入）。沿用 `crm.vue` 的 tab 寫法。
- 元件（`app/components/`，Nuxt 自動匯入）：
  - `GatheringRecords.vue` — 活動紀錄：list（`日期｜名稱｜地點`）＋明細 modal（完整欄位、可編輯，需 `gathering` 權）。**操鍋/助手/採買為下拉選單**：來源為 `GET /api/contacts`（登入者自己的名單）best-effort 抓取，抓不到（無 crm 權）就退回可自由輸入的文字框；選定後**存人名文字**（不存 contactId）。明細中**點食譜名稱 → 展開/開該食譜的食材與作法**。
  - `GatheringFinance.vue` — 收支：list（`日期｜名稱｜盈餘`，+綠 −紅）＋明細 modal（日期、人數、收費、收入(自動)、支出、盈餘(自動)）。財務資料經 `PUT /api/gathering-finances/[gatheringId]` upsert。
  - `RecipeList.vue` — 食譜：list（名稱）＋明細 modal（名稱、食材、作法、備註）。
- 沿用現有 `useNotify`／`useConfirm`／`useFetch(deep:true)` 樂觀更新慣例。

## YAGNI（本次不做）

食譜照片、活動照片、結構化名單/流程（先純文字）、財務匯出/統計圖表、跨教室分頁、活動與食譜的多對多。

## 驗證

`just typecheck`、`just lint`；並以瀏覽器對 `just dev` 實際操作：
- 超級管理員：三個 tab 皆見，可新增/編輯活動、填收支（驗證收入=人數×收費、盈餘正確）、新增食譜、活動引用食譜並展開。
- 一般使用者只授 `gathering`：只見活動紀錄 tab，收支/食譜 tab 不顯示；打 `/api/recipes`、`/api/gathering-finances` 應 403。
