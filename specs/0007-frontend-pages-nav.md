# 0007 — 前端：申請頁、管理者頁、動態導覽、路由守門

## 目的

把後端能力接到使用者介面：申請、審核、依權限顯示頁面。

## 變更

### `shared/utils/pages.ts`
- `PageDef` 加 `icon`（導覽列圖示），讓新增頁面維持「一行登記」。

### `app/pages/apply.vue`（新增，公開）
- 帳號 / 顯示名稱 / 密碼 / 申請說明 表單 → `POST /api/auth/apply`。
- 成功顯示「等待審核」訊息。

### `app/pages/admin.vue`（新增，超級管理員）
- `useFetch('/api/users')` 取清單。
- 「待審核申請」區：通過 / 拒絕。
- 「所有帳號」區：狀態 badge、可用頁面 checkbox（即時存）、停用/啟用、重設密碼、刪除。

### `app/middleware/auth.global.ts`（新增）
- `/admin` 僅超級管理員，否則導回首頁。
- `access:'private'` 頁面需超級管理員或被授權，否則導回首頁。
- 僅前端體驗層，真正權限仍由後端 API 強制。

### `app/app.vue`
- 導覽列改為依 `visiblePages`（public 永遠顯示、private 需授權）動態渲染。
- 超級管理員多顯示「使用者管理」入口。
- 未登入者右側顯示「申請帳號」＋「登入」。

### `app/pages/login.vue`
- 標題由「管理員登入」改為「登入」，並加「申請帳號」連結。

## 驗證

- `typecheck`：新增檔案無新型別錯誤（既存 5 個與本次無關）。
- `lint`：新增檔案無 error（僅與全專案一致的 max-attributes-per-line warning）。
- 行為驗證見 0008。
