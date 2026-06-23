# 0006 — 既有寫入 API 改用 requirePage

## 目的

把既有「只要登入就能改」的寫入路由，改成「需有對應頁面權限才能改」。

## 變更（`requireUserSession` → `requirePage`）

| 路由群組 | 權限 key |
|---|---|
| `courses` 新增/修改/刪除 | `calendar` |
| `events` 新增/修改/刪除 | `calendar` |
| `equipment` 新增/修改/刪除 | `equipment` |
| `rentals` 新增/修改/刪除 | `equipment` |

共 12 個檔案。讀取路由（`*.get.ts`）維持公開不變。

## 效果

- 超級管理員全通。
- 一般使用者需被授權該頁才能編輯；未授權 → 403。
- 因 `requirePage` 每次查 DB，停用/收回權限即時生效。
