# 0032 — Cloudflare Access 身分驗證與應用程式權限

## 目的

以 Cloudflare Access 取代自建帳密登入，同時保留 D1 的使用者審核、頁面/教室權限與超級管理員能力。

## 責任邊界

- Access：Google 等多 IdP 登入、SSO/session、整站到達控制。
- 應用程式：驗證 Access JWT；以 email 對應 user；強制 `status/pages/classrooms`；超管 email allowlist。
- 前端 session：只做 UI 快取，後端不信任 session 的角色或權限。

## 實作

- `server/utils/cloudflareAccess.ts`：以 remote JWKS 驗 RS256、issuer、AUD，正規化 email，映射/建立 D1 user。
- `server/middleware/00.cloudflare-access.ts`：同步 UI session；production 缺 JWT 時 fail closed。LINE webhook 與 daily digest 因另有 signature/Bearer 驗證而豁免。
- `users.access_email`：nullable unique；既有 username=email 使用者首次登入時自動 claim 原 user id。
- 超管由 `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS` 決定，不存在 D1，永遠取得全部 pages/classrooms。
- 一般新身分自動建立 `pending`，由 `/admin` 核准。
- 移除登入、申請、修改/重設密碼 API 與 UI；登出改用 Access logout URL。

## 驗證案例

- JWT 缺少、issuer/AUD/signature 錯誤：401。
- 超管 email：可進 `/admin` 與所有功能。
- 新 email：建立 pending，只可看原 public 唯讀頁面。
- approved：依 pages/classrooms 使用；disabled/rejected/pending 的受保護 API 拒絕。
- 舊 email username：綁回原 id，私人 CRM 資料不變。
- 普通使用者呼叫超管 API：403。
- LINE webhook/daily digest：無 Access JWT 仍交由端點既有驗證。
