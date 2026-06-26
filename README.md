# 課表管理系統（course-schedule）

以 **Nuxt 4 + Cloudflare Pages + D1** 打造的全端課表 / 設備 / CRM 管理系統。前端與 API 在同一個專案裡，Nitro 以 `cloudflare-pages` preset 建置，`server/api/**` 會跑成 Cloudflare Worker。

---

## 一、快速啟動開發

本專案的指令都透過 [`just`](https://github.com/casey/just) 執行，每條 recipe 已自動套用正確的 node 版本，**不必手動切 node**。打 `just`（不帶參數）會列出所有指令。

### 1. 安裝套件

```bash
just install       # = bun install；postinstall 會跑 nuxt prepare
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

然後編輯 `.env`，至少要填：

| 變數 | 用途 | 備註 |
| --- | --- | --- |
| `NUXT_ADMIN_USERNAME` | 超級管理員帳號 | 不在資料庫裡，純環境變數帳號 |
| `NUXT_ADMIN_PASSWORD` | 超級管理員密碼 | 請改掉預設值 |
| `NUXT_SESSION_PASSWORD` | session cookie 加密金鑰 | 至少 32 字元隨機字串，`openssl rand -base64 32` 產生 |
| `NUXT_GEMINI_API_KEY` | 圖片辨識匯入（選填） | 留空只是「上傳圖片辨識」不能用，手動貼 JSON 匯入仍可用 |
| `NUXT_GEMINI_MODEL` | Gemini 模型（選填） | 預設 `gemini-2.5-flash` |

> 本機開發 D1 用 `--local`，不需要 `wrangler.toml` 裡的 `database_id`。

### 3. 建立本機資料庫

```bash
just db-migrate-local      # 套用 migration 到本機 D1（.wrangler/state）
just db-seed-local         # （選填）載入 server/db/seed.sql 範例資料
```

### 4. 啟動 dev server

```bash
just dev                   # = bun dev；http://localhost:3000，D1 透過 wrangler 綁定
```

用 `.env` 裡的超級管理員帳密登入即可有全部權限。

### 常用指令

```bash
just typecheck             # vue-tsc 型別檢查
just lint                  # eslint
just db-generate           # 改完 server/db/schema.ts 後產生 SQL migration
just                       # 列出所有 just 指令
```

> 不想用 just 也行，對應的原始指令都在 `package.json` 的 `scripts`（`bun run typecheck`、`bun run db:generate`…）。但此時要自己顧好 node 版本：系統預設的 `/usr/bin/node` 是 v18.19.1，低於 Nuxt 4 需要的 Node 20+，請先 `fnm use 22` 再執行，否則 `nuxt` / `wrangler` / `drizzle-kit` 可能在 `import` 處噴 `SyntaxError`。

> 修改資料表流程：編輯 `server/db/schema.ts` → `db:generate` → `db:migrate:local`（線上記得另外 `db:migrate:remote`）。

---

## 二、發布上線

線上專案：**course-schedule-2689336** → https://course-schedule-2689336.pages.dev

### 發布前一定要先設定

1. **建立遠端 D1 並填入 `database_id`**（只需做一次）

   ```bash
   wrangler d1 create course-schedule-db
   ```

   把回傳的 `database_id` 貼進 `wrangler.toml` 的 `[[d1_databases]]` 區塊。

2. **套用遠端資料庫 migration**

   ```bash
   just db-migrate-remote     # = bun run db:migrate:remote
   ```

   每次有新的 schema 變更、部署前後都要再跑一次。

3. **在 Cloudflare Pages 設定 Secrets**（對應 `.env` 的同名變數）

   `.env` 只在本機有效；線上要在 Pages 專案設定環境變數 / Secrets：

   - `NUXT_ADMIN_USERNAME` — 超級管理員帳號
   - `NUXT_ADMIN_PASSWORD` — 超級管理員密碼
   - `NUXT_SESSION_PASSWORD` — cookie 加密金鑰（至少 32 字元）
   - `NUXT_GEMINI_API_KEY` — 圖片辨識（選填）
   - `NUXT_GEMINI_MODEL` — 模型（選填）

   可用 dashboard 設定，或：

   ```bash
   wrangler pages secret put NUXT_ADMIN_PASSWORD --project-name course-schedule-2689336
   wrangler pages secret put NUXT_SESSION_PASSWORD --project-name course-schedule-2689336
   # 其餘變數同理
   ```

   > ⚠️ **Secret 變更只會在下一次部署後生效**，改完記得重新部署。

### 部署

```bash
just deploy                # = bun run deploy：nuxt build + wrangler pages deploy dist
```

---

## 三、帳號與權限概念

- **超級管理員**：純環境變數帳號（`NUXT_ADMIN_USERNAME` / `NUXT_ADMIN_PASSWORD`），不在資料庫裡，擁有全部頁面與教室權限。
- **一般使用者**：在登入頁自行申請（狀態 `pending`），由超級管理員到 `/admin` 核准並指派可用頁面 / 教室。

---

## 四、技術重點

- 全端 Nuxt 4，API 在 `server/api/**`，部署為 Cloudflare Worker。
- 資料庫只透過 `useDb(event)`（Drizzle 包 D1）存取。
- migration 由 drizzle-kit「產生 SQL」、由 wrangler「套用」；本機與遠端是兩個獨立資料庫，所以有 `:local` / `:remote` 兩組指令。
- 權限模型以「頁面」為單位，集中在 `shared/utils/pages.ts`；前端 guard 只是裝飾，後端 `requirePage` / `requireSuperAdmin` 才是權威。

更詳細的架構說明見 [`CLAUDE.md`](./CLAUDE.md)。
