# 0003 — 後端 auth 基礎與登入改寫

## 目的

建立權限的後端核心：頁面登記表、`requirePage` / `requireSuperAdmin`，並改寫登入以支援
「超級管理員（環境變數）＋ 一般使用者（DB）」雙軌。

## 變更

### 1. `shared/utils/pages.ts`（新增，前後端共用）
- `PAGES` 頁面登記表（單一來源）：`calendar`、`equipment`（皆 public），CRM 註解保留位。
- `PAGE_KEYS`、`pageByKey`、`pageByPath`、`sanitizePages`。
- `access: 'public' | 'private'` 區分「公開可看、權限控編輯」與「登入限定、權限控可見」。

### 2. `server/utils/auth.ts`（新增）
- 擴充 `#auth-utils` 的 `User` / `UserSession` 型別（`userId` / `isSuperAdmin` / `pages`）。
- `parsePages()`：安全解析 `users.pages`。
- `getActor(event)`：**每次查 DB** 取得即時狀態；非 approved 一律視為無權限 → 停用/改權限即時生效。
- `requirePage(event, key)`：超級管理員全通；否則需 `pages` 含該 key。
- `requireSuperAdmin(event)`：管理者頁與使用者管理 API 用。

### 3. `server/api/auth/login.post.ts`（改寫）
- 先比對超級管理員（環境變數）→ session 帶 `isSuperAdmin:true` 與全頁面。
- 否則查 DB：**先驗證密碼再看狀態**（避免帳號狀態被探測）。
  - 密碼錯/查無 → 401「帳號或密碼錯誤」。
  - `pending` / `rejected` / `disabled` → 403 對應訊息。
  - `approved` → session 帶 `userId / pages`。

## 安全要點

- 後端強制權限一律重查 DB，不信任 session 內的 `pages`（那只給前端 UI 用）。
- 密碼用 nuxt-auth-utils `verifyPassword`（scrypt）。

## 驗證

- `bun run typecheck`：本步新增檔案無型別錯誤（既有 5 個錯誤為先前既存，與本次無關）。
