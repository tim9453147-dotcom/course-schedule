# 0001 — 使用者帳號與頁面權限系統（總覽）

Branch: `feature/user-accounts-permissions`

## 背景

目前系統是「單一管理員（帳密寫在環境變數）＋沒有 users 表」：全站公開可看，只有登入後能編輯。
本功能升級為「多帳號 ＋ 每帳號可用頁面權限 ＋ 申請審核」。

## 角色

| 角色 | 來源 | 公開頁（課表/器材室） | 登入限定頁（CRM…） | 管理者頁 `/admin` |
|---|---|---|---|---|
| 路人 | 未登入 | 只能看，不能編輯 | 看不到 | 看不到 |
| 使用者 | DB 帳號、審核通過、被授權 | 看＋編輯（被授權頁） | 看見並使用（被授權頁） | 看不到 |
| 超級管理員 | 環境變數帳號 `NUXT_ADMIN_*` | 全部可編輯 | 全部可用 | 可進，管理所有使用者與權限 |

- 超級管理員不進 DB、不可刪改、永遠全權限（逃生門：DB 壞掉也能登入）。
- v1 只有一位超級管理員，其餘一律是「使用者」，不可被升級成管理員。

## 頁面登記表（單一來源）

集中定義於共用 util，前後端共用。之後新增頁面（如 CRM）只需加一筆 ＋ 做頁面與 API。

```ts
PAGES = [
  { key: 'calendar',  label: '課表',       path: '/',          access: 'public'  },
  { key: 'equipment', label: '器材室管理', path: '/equipment', access: 'public'  },
  // { key: 'crm',     label: 'CRM',        path: '/crm',       access: 'private' }, // 日後
]
```

- `access: 'public'`：人人可看；`pages` 權限決定「能不能編輯」。
- `access: 'private'`：未登入/無權限者完全看不到；`pages` 權限決定「能不能看見並使用」。

## 權限模型

- 每個使用者有一個 `pages` 字串陣列，同時涵蓋「public 頁可編輯」與「private 頁可見/可用」。
- 後端強制權限時**一律重查 DB**（不只看 session），所以管理者改權限/停用帳號**即時生效**。
- 讀取：public 頁開放、private 頁需授權。寫入：一律需授權。

## 資料表 `users`

| 欄位 | 說明 |
|---|---|
| id | 主鍵 |
| username | 登入帳號，唯一（建議 email，不強制格式） |
| displayName | 顯示名稱 |
| passwordHash | 密碼雜湊（nuxt-auth-utils `hashPassword`，scrypt，Workers 相容） |
| status | `pending` / `approved` / `rejected` / `disabled` |
| pages | JSON 字串陣列，授權的頁面 key |
| note | 申請備註 |
| createdAt | Unix 秒 |
| approvedAt | 審核通過時間 |

申請者＝`status='pending'` 的一筆 user，不另開表。

## 流程

- **申請** `/apply`（公開）→ 建立 `pending` user → 顯示「等待審核」。
- **審核** `/admin`（超級管理員）→ 通過時勾選授權頁面 → `approved`；或 `rejected`。
- **登入** `/api/auth/login` → 先特判超級管理員（環境變數）；否則查 DB，需 `approved` 且密碼正確；session 帶 `userId / isSuperAdmin / pages`。

## 安全要點

1. 密碼一律雜湊，不存明碼。
2. 權限後端強制，不只前端隱藏導覽列。
3. 超級管理員逃生門（環境變數，不進 DB）。
4. 防呆：`pending/rejected/disabled` 不能登入；登入錯誤訊息區分「審核中」與「帳密錯誤」。
5. 停用即時生效（每請求查 DB）。

## 實作順序（每步一份 spec ＋ commit）

1. 0001 總覽（本檔）
2. 0002 users schema ＋ migration
3. 0003 後端 auth 基礎（頁面登記表、`requirePage`、改寫 login）
4. 0004 申請帳號 API
5. 0005 使用者管理 API
6. 0006 既有寫入 API 換 `requirePage`
7. 0007 前端頁面與導覽（/apply、/admin、導覽列、middleware）
8. 0008 驗證與部署

## 範圍外（日後）

- 申請頁 Turnstile 人機驗證。
- 自助忘記密碼（v1 由超級管理員後台重設）。
- 多管理員。
- 課表權限細分到單一教室。
- 審核通過的 email 通知。
