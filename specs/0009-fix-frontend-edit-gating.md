# 0009 — 修正：前端編輯介面未依頁面權限隱藏

## 問題

`/` 課表與 `/equipment` 器材室的編輯介面只用「是否登入（`loggedIn`）」判斷，
沒有檢查「該帳號是否擁有這一頁的權限」。因此被取消授權的使用者登入後，
仍看得到並可點擊編輯按鈕（雖然後端 API 會以 403 擋下實際寫入，但 UI 誤導）。

## 修正

- 新增 composable `app/composables/usePermissions.ts`：`useCanEdit(key)`
  - 超級管理員 → true；一般使用者 → 已登入且 `session.pages` 含該 key。
- `app/pages/index.vue`：編輯相關 gating（FullCalendar `editable`/`eventStartEditable`、
  點擊/拖曳 handler、編輯按鈕、`is-editable` class）由 `loggedIn` 改為 `useCanEdit('calendar')`。
- `app/pages/equipment.vue`：所有編輯按鈕（新增器材、借出、編輯、刪除、歸還）
  由 `loggedIn` 改為 `useCanEdit('equipment')`。

## 驗證（bun dev + 本地 D1）

| 情境 | 預期 | 結果 |
|---|---|---|
| 只有 calendar 權限的使用者開 `/equipment` | 看不到「新增器材」按鈕 | ✅（count 0） |
| 只有 calendar 權限的使用者開 `/` | 課表可編輯（`is-editable`） | ✅（count 1） |
| 超級管理員開 `/equipment` | 看得到「新增器材」 | ✅（count 1） |

## 備註

- 前端權限以「上次登入時的 `session.pages`」為準；管理者調整權限後，使用者**重新登入**即反映。
- 後端 `requirePage` 仍每請求查 DB，為真正的安全把關（即時生效）；前端僅為顯示體驗。
