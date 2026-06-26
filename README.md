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

## 匯入課表（批次貼上 JSON）

課表來源常常是一張圖片，可以先用 AI（例如把圖片貼給 Claude / ChatGPT）轉成 JSON，再**依日期**一次匯入整個月的活動，不用一筆筆在月曆上點。

**使用流程**（首頁月曆，登入後）：

1. 點工具列右上的 **「匯入」**。
2. 選 **匯入到教室**（資料不必寫教室，由這裡決定）。
3. 選 **模式**：
   - **附加**：保留該教室原本的活動，匯入的直接新增上去。
   - **覆蓋此區間**：先刪掉該教室在「這次匯入日期範圍（最早～最晚日期）」內的活動，再匯入（適合「重貼某個月的新版課表」，不會動到其他月份）。
4. 把 JSON 貼進文字框（可按 **「複製 AI 指令」** 拿到給 AI 用的提示詞）。
5. 按 **「解析預覽」** 核對表格與錯誤提示，沒問題再按 **「確認匯入」**。

> 匯入一律存成「單次活動（events）」，分類固定為「課程（course）」——來源 JSON 即使寫了其他 `kind` 也會被忽略。每週固定課（courses）請在月曆上單獨新增。

### JSON 格式

最外層是一個**陣列**，每筆活動一個物件：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `title` | ✅ | 名稱 |
| `date` | ✅ | 西元日期 `YYYY-MM-DD`（例 `2026-06-04`） |
| `startTime` | | 開始時間，24 小時制 `HH:MM`（例 `19:30`）。整天留空 `""` 或省略 |
| `endTime` | | 結束時間，格式同上 |
| `host` | | 主持 |
| `sharer` | | 分享 |
| `summarizer` | | 總結 |
| `pm` | | PM |
| `location` | | 地點（純文字，與「教室」分頁無關） |
| `note` | | 備註 |
| `color` | | 顏色名：`sky` / `emerald` / `violet` / `amber` / `rose` / `cyan`。省略時預設 `sky` |

> `kind` 不需要填（填了也會被忽略，一律存成 `course`）；教室由匯入畫面選，不要放在 JSON 裡。

### 範例

以一份完整的六月課表為例。**每筆都用相同欄位**（給 AI 當範本時，請維持一致的格式、不要省略或多加欄位）；沒有的角色就留空字串 `""`：

```json
[
  { "title": "銅章會議", "date": "2026-06-01", "startTime": "19:30", "endTime": "21:00", "host": "", "sharer": "", "summarizer": "", "pm": "", "location": "中壢教室" },
  { "title": "超凡訓練", "date": "2026-06-04", "startTime": "19:30", "endTime": "21:00", "host": "偉霖", "sharer": "", "summarizer": "凱平哥", "pm": "尚融", "location": "中壢教室" },
  { "title": "9%聯合培訓", "date": "2026-06-06", "startTime": "15:00", "endTime": "16:30", "host": "", "sharer": "", "summarizer": "", "pm": "", "location": "中壢教室" },
  { "title": "玩創家", "date": "2026-06-08", "startTime": "19:30", "endTime": "21:00", "host": "運昇", "sharer": "浩廷", "summarizer": "寶哥老師", "pm": "凱平", "location": "中壢教室" },
  { "title": "群星計畫", "date": "2026-06-11", "startTime": "19:30", "endTime": "21:00", "host": "凱平", "sharer": "", "summarizer": "運昇哥", "pm": "吾心", "location": "中壢教室" },
  { "title": "e-Spring", "date": "2026-06-15", "startTime": "19:30", "endTime": "21:00", "host": "威麟", "sharer": "鴻德", "summarizer": "彥彰", "pm": "浩廷", "location": "中壢教室" },
  { "title": "價值願景", "date": "2026-06-18", "startTime": "19:30", "endTime": "21:00", "host": "育銓", "sharer": "可仰", "summarizer": "立烽哥", "pm": "凱平", "location": "中壢教室" },
  { "title": "613.624.513 聯合培訓", "date": "2026-06-20", "startTime": "19:30", "endTime": "21:00", "host": "", "sharer": "", "summarizer": "", "pm": "", "location": "中壢教室" },
  { "title": "健康講座", "date": "2026-06-22", "startTime": "19:30", "endTime": "21:00", "host": "雅萍", "sharer": "子淳", "summarizer": "博明哥", "pm": "家銘", "location": "中壢教室" },
  { "title": "超凡訓練課", "date": "2026-06-25", "startTime": "19:30", "endTime": "21:00", "host": "偉霖", "sharer": "吾心", "summarizer": "運昇哥", "pm": "威麟", "location": "中壢教室" },
  { "title": "健康講座-穩癌2", "date": "2026-06-27", "startTime": "19:30", "endTime": "21:00", "host": "", "sharer": "", "summarizer": "", "pm": "", "location": "中壢教室" },
  { "title": "群星計畫", "date": "2026-06-29", "startTime": "19:30", "endTime": "21:00", "host": "凱平", "sharer": "", "summarizer": "運昇哥", "pm": "建閔", "location": "中壢教室" }
]
```

### 注意事項

- 一般一份月課表（幾十筆）不會碰到任何上限。資料較多時前端會自動分批送出，因此沒有總筆數限制。
- 解析預覽會逐列標出錯誤（缺名稱、日期格式錯誤、時間格式錯誤等），有錯時「確認匯入」會被擋下。
- 需要 `calendar` 頁權限（管理員）才能匯入。

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
#   NUXT_GEMINI_API_KEY=（選用，給「上傳圖片自動辨識」用；留空則該功能停用）

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
bunx wrangler pages project create course-schedule-2689336 --production-branch main

# 5. 設定線上密鑰（名稱要跟 .env 一樣）
#    NUXT_SESSION_PASSWORD 用隨機 32 字元；管理員帳密請自己決定（別用測試的 admin1234）
echo -n "$(openssl rand -base64 32)" | bunx wrangler pages secret put NUXT_SESSION_PASSWORD --project-name course-schedule-2689336
echo -n "admin"            | bunx wrangler pages secret put NUXT_ADMIN_USERNAME --project-name course-schedule-2689336
echo -n "你的強密碼"        | bunx wrangler pages secret put NUXT_ADMIN_PASSWORD --project-name course-schedule-2689336

# 5b.（選用）圖片辨識匯入：設定 Gemini API key（到 https://aistudio.google.com 免費申請）
#     不設也沒關係，只是「上傳課表圖片，自動辨識」會停用；手動貼 JSON 匯入照常可用
echo -n "你的 Gemini API key" | bunx wrangler pages secret put NUXT_GEMINI_API_KEY --project-name course-schedule-2689336

# 6. build 並部署
bun run build
bunx wrangler pages deploy dist --project-name course-schedule-2689336 --branch main
```

完成後會給你一個 `https://course-schedule-2689336.pages.dev` 網址。
之後每次要更新線上版，重跑第 6 步即可；改了資料表則先 `bun run db:migrate:remote`。

> 也可以改用 Cloudflare 後台網頁設定密鑰：Pages 專案 → Settings → Variables and Secrets。
>
> ⚠️ **密鑰改了要重新部署才生效**：`wrangler pages secret put` 之後，新值會等到下一次 `pages deploy`（第 6 步）才套用到線上。新增或更換 `NUXT_GEMINI_API_KEY` 後記得重跑第 6 步。

### 更新線上祕鑰（事後修改）

之後要改某把線上祕鑰（例如換 `NUXT_GEMINI_API_KEY`、改管理員密碼）時，**重點：改完一定要重新部署才會生效**——祕鑰是在 build／deploy 當下被打包進去的。任一把祕鑰都適用，只是換個名字。

**方式 A：用指令（wrangler）**

```bash
# 0. 先把新版 node 放到 PATH（這專案的老問題，wrangler 沒它會壞）
export PATH=/home/tim/.local/share/mise/installs/node/24.11.1/bin:$PATH

# 1. 首次或登入過期才要做（會開瀏覽器）
bunx wrangler login

# 2. 設定／更新祕鑰 → 會提示你貼上值
bunx wrangler pages secret put NUXT_GEMINI_API_KEY --project-name course-schedule-2689336

# 3. 重新部署，祕鑰才生效
bun run deploy
```

**方式 B：用 Cloudflare 後台網頁**

1. 登入 Cloudflare → **Workers & Pages** → 點 **course-schedule-2689336**。
2. **Settings → Variables and Secrets**。
3. 找到要改的祕鑰（沒有就新增），Type 選 **Secret**，填入新值 → **Save**。
4. **重新部署**：到 **Deployments** 頁對最新一筆按 **⋯ → Retry deployment**，或在本機跑 `bun run deploy`。

> 兩種方式做完都要記得最後的**重新部署**，否則線上仍是舊值。

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
