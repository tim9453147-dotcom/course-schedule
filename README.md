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

然後編輯 `.env`。本機開發至少要填：

| 變數 | 用途 | 備註 |
| --- | --- | --- |
| `NUXT_CLOUDFLARE_ACCESS_DEV_EMAIL` | 本機模擬 Access email | 只在 dev build 生效 |
| `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS` | 超管 email allowlist | 多位用逗號分隔 |
| `NUXT_SESSION_PASSWORD` | UI session cookie 加密 | 至少 32 字元；後端權限不信任此快取 |
| `NUXT_GEMINI_API_KEY` | 圖片辨識（選填） | 留空不影響手動 JSON 匯入 |

> 正式環境另需 Access team domain 與 AUD；完整步驟見 [`docs/cloudflare-access-setup.md`](./docs/cloudflare-access-setup.md)。本機 D1 用 `--local`，不需要 `wrangler.toml` 的 `database_id`。

### 3. 建立本機資料庫

```bash
just db-migrate-local      # 套用 migration 到本機 D1（.wrangler/state）
just db-seed-local         # （選填）載入 server/db/seed.sql 範例資料
```

### 4. 啟動 dev server

```bash
just dev                   # = bun dev；http://localhost:1125，D1 透過 wrangler 綁定
```

`.env` 的 dev email 若同時在超管 allowlist，即會以超級管理員身分啟動。

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

線上 Pages 專案：**course-schedule-2689336**。正式登入建議使用 Cloudflare 管理的 custom domain 並在該 hostname 前建立 Access application。

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

3. **設定 Cloudflare Access 與 Pages 環境變數**

   依 [`docs/cloudflare-access-setup.md`](./docs/cloudflare-access-setup.md) 加入 Google 等 IdP、建立 self-hosted application 與 pilot Allow policy，再設定：

   - `NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN` — `https://<team>.cloudflareaccess.com`
   - `NUXT_CLOUDFLARE_ACCESS_AUDIENCE` — application AUD tag
   - `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS` — 一或多個超管 email
   - `NUXT_SESSION_PASSWORD` — cookie 加密金鑰
   - 既有 Gemini / LINE secrets（依功能選填或必填）

   > 先完成 Access 與環境變數，再部署這個 fail-closed 版本；否則 production SSR/API 會回 401。環境變數變更需重新部署。

### 部署

```bash
just deploy                # = bun run deploy：nuxt build + wrangler pages deploy dist
```

---

## 三、帳號與權限概念

- **身分驗證**：Cloudflare Access 提供 Google、GitHub、Microsoft、OTP 或其他 OIDC/SAML 登入；應用程式會再次驗證 JWT。
- **超級管理員**：Access email 出現在 `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS`，不依賴 D1，擁有全部頁面與教室權限。
- **一般使用者**：首次登入自動成為 `pending`，由超管到 `/admin` 核准並指派頁面/教室。

---

## 四、技術重點

- 全端 Nuxt 4，API 在 `server/api/**`，部署為 Cloudflare Worker。
- 資料庫只透過 `useDb(event)`（Drizzle 包 D1）存取。
- migration 由 drizzle-kit「產生 SQL」、由 wrangler「套用」；本機與遠端是兩個獨立資料庫，所以有 `:local` / `:remote` 兩組指令。
- 權限模型以「頁面」為單位，集中在 `shared/utils/pages.ts`；前端 guard 只是裝飾，後端 `requirePage` / `requireSuperAdmin` 才是權威。

更詳細的架構說明見 [`CLAUDE.md`](./CLAUDE.md)。
