# 0005 — 使用者管理 API（超級管理員專用）

## 目的

讓超級管理員審核申請、調整頁面授權、改名、重設密碼、刪除帳號。

## 變更（皆 `requireSuperAdmin`）

- `GET /api/users` — 列出所有使用者（含 pending 申請者）。不回傳密碼雜湊；`pages` 轉成陣列。依 `createdAt` 由新到舊。
- `PUT /api/users/[id]` — 部分更新：
  - `displayName`（選填）
  - `status`：`pending|approved|rejected|disabled`；設為 `approved` 時記錄 `approvedAt`。
  - `pages`：陣列，經 `sanitizePages` 過濾合法 key 後存成 JSON。
  - `password`：重設密碼（≥6 碼，重新雜湊）。
  - 全空 → 400；查無 → 404。
- `DELETE /api/users/[id]` — 刪除；查無 → 404。

## 防呆

- 所有 DB 使用者都是「一般使用者」，超級管理員是環境變數帳號、不在表內，
  故不存在「刪到最後一個管理者」的鎖死問題。

## 備註

- 審核＝改 `status`；通過後再用 `pages` 授權頁面（前端會合併成一個流程）。
