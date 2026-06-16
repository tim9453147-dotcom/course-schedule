# 課表網站 (Course Schedule)

用 **Nuxt 4 + Cloudflare Pages + D1** 打造的課表網站。前端、後端 API 都在同一個 Nuxt 專案裡，部署到 Cloudflare 後，API 會跑在 Cloudflare Workers 上，資料存在 D1（Cloudflare 的 SQLite 資料庫）。

## 技術組成

| 用途 | 工具 |
| --- | --- |
| 套件管理 / 執行 | bun |
| 前端框架 | Nuxt 4 (Vue 3) |
| UI 元件 | Nuxt UI v4（內建 Tailwind CSS） |
| 月曆 | FullCalendar v6（月檢視、月份切換） |
| 後端 API | Nuxt 內建 server (Nitro) → 部署後跑在 Cloudflare Workers |
| 資料庫 | Cloudflare D1 |
| 資料庫存取 | Drizzle ORM + drizzle-kit |
| 登入驗證 | nuxt-auth-utils（加密 cookie session） |
| 本地 D1 模擬 | nitro-cloudflare-dev + wrangler |

## 專案結構

```
app/
  app.vue              # 整體版面（頂部導覽：教室課表 / 器材室管理、登入/登出）
  pages/
    index.vue          # 月曆檢視 + 管理員直接在日曆上編輯（FullCalendar）
    equipment.vue      # 器材室管理：器材清單、數量統計、借還紀錄
    login.vue          # 管理員登入
  utils/
    schedule.ts        # 教室清單、星期、顏色、色碼、課程型別
    equipment.ts       # 器材 / 借還型別
server/
  api/
    courses/           # 每週固定課 CRUD
    events/            # 單次活動 CRUD
    equipment/         # 器材 CRUD
    rentals/           # 借還紀錄 CRUD
    auth/              # 登入 / 登出
  db/
    schema.ts          # Drizzle 資料表（courses / events / equipment / rentals）
    migrations/        # drizzle-kit 產生的 SQL
    seed.sql           # 範例資料
  utils/
    db.ts              # 取得 D1 + drizzle 實例
    validation.ts      # zod 輸入驗證
wrangler.toml          # Cloudflare 設定（D1 綁定）
drizzle.config.ts      # drizzle-kit 設定
```

## 兩種課程資料

- **每週固定課（courses）**：用「星期幾 + 時間」表示，會重複。月曆上交給 FullCalendar 的 `daysOfWeek` 自動鋪滿每個月的對應星期。
- **單次活動（events）**：綁一個實際日期（例如 `2026-06-18` 期中考），時間留空則視為整天事件。

兩者在首頁月曆會一起顯示，用上方的教室分頁切換。

## 怎麼編輯（管理員登入後）

所有編輯都直接在首頁月曆上操作（沒有獨立管理頁）：

- **點空白日期** → 新增（預設單次活動，可切換成每週課程）
- **點現有課程／活動** → 編輯或刪除
- **直接拖曳** → 改日期（單次活動）或改星期（每週課程）

未登入的訪客只能瀏覽，點/拖都不會有反應。

## 器材室管理

頂部導覽列「器材室管理」（`/equipment`）：

- 依教室分頁（目前器材主要放「中壢」；其他教室已預留，不用改資料庫就能直接加）。
- 上方數量統計卡：器材種類、總數量、借出中、可用。
- **器材清單**：每筆器材的總數 / 借出中 / 可用，可新增、編輯、刪除。
- **借還紀錄**：借用人、數量、借出日、應還日、狀態（借出中 / 已歸還），可借出、歸還、編輯、刪除。
- 借出時若數量超過可用量會被擋下。
- 一般訪客可瀏覽，登入後才能新增 / 借出 / 歸還 / 編輯 / 刪除。

## ⚠️ 關於 Node 版本

這台機器的預設 `node` 是很舊的 v11，Nuxt 需要新版。每次開新終端機，先切換到新版 node（擇一）：

```bash
fnm use 22          # 或
mise use node@24
```

## 本地開發

```bash
# 1. 安裝套件
bun install

# 2. 設定環境變數：複製範本後填入帳密
cp .env.example .env
#   .env 內容：
#   NUXT_ADMIN_USERNAME=admin
#   NUXT_ADMIN_PASSWORD=你的密碼
#   NUXT_SESSION_PASSWORD=至少32字元隨機字串（openssl rand -base64 32）

# 3. 建立本地 D1 資料表（套用 migration）
bun run db:migrate:local

# 4.（選用）灌入範例課程
bun run db:seed:local

# 5. 啟動開發伺服器 http://localhost:3000
bun dev
```

預設管理員帳密在 `.env`（範例為 `admin` / `admin1234`）。到 <http://localhost:3000/login> 登入後即可管理課程。

## 改了資料表怎麼辦？

1. 編輯 `server/db/schema.ts`
2. 產生新的 migration：`bun run db:generate`
3. 套用到本地：`bun run db:migrate:local`
4. 之後部署前再套用到線上：`bun run db:migrate:remote`

## 部署到 Cloudflare Pages

> 先確認用的是新版 node：`fnm use 22`（或 `mise use node@24`），並在專案資料夾內執行。

```bash
# 1. 登入 Cloudflare（會開瀏覽器，只有這步需要手動授權）
bunx wrangler login

# 2. 建立線上 D1 資料庫
bunx wrangler d1 create course-schedule-db
#    → 把回傳的 database_id 貼到 wrangler.toml 的 database_id 欄位

# 3. 把資料表建到線上 D1
bun run db:migrate:remote

# 4. 建立 Pages 專案（名稱要全帳號唯一；網址會是 <名稱>.pages.dev）
bunx wrangler pages project create course-schedule --production-branch main

# 5. 設定線上密鑰（名稱要跟 .env 一樣）
#    NUXT_SESSION_PASSWORD 用隨機 32 字元；管理員帳密請自己決定（別用測試的 admin1234）
echo -n "$(openssl rand -base64 32)" | bunx wrangler pages secret put NUXT_SESSION_PASSWORD --project-name course-schedule
echo -n "admin"            | bunx wrangler pages secret put NUXT_ADMIN_USERNAME --project-name course-schedule
echo -n "你的強密碼"        | bunx wrangler pages secret put NUXT_ADMIN_PASSWORD --project-name course-schedule

# 6. build 並部署
bun run build
bunx wrangler pages deploy dist --project-name course-schedule --branch main
```

完成後會給你一個 `https://course-schedule.pages.dev` 網址。
之後每次要更新線上版，重跑第 6 步即可；改了資料表則先 `bun run db:migrate:remote`。

> 也可以改用 Cloudflare 後台網頁設定密鑰：Pages 專案 → Settings → Variables and Secrets。

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `bun dev` | 本地開發伺服器 |
| `bun run build` | 正式 build（輸出到 `dist/`） |
| `bun run db:generate` | 由 schema 產生 migration |
| `bun run db:migrate:local` | 套用 migration 到本地 D1 |
| `bun run db:migrate:remote` | 套用 migration 到線上 D1 |
| `bun run db:seed:local` | 灌範例資料到本地 D1 |
| `bun run deploy` | build 並部署到 Cloudflare Pages |
