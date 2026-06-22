# 0002 — users 資料表與 migration

## 目的

新增 `users` 表，承載多帳號、頁面權限與申請審核狀態。

## 變更

- `server/db/schema.ts`：新增 `users` 表與 `User` / `NewUser` 型別。
- `server/db/migrations/0007_boring_paper_doll.sql`：drizzle-kit 產生的建表 SQL（含 `username` 唯一索引）。

## 欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | integer PK autoincrement | 主鍵 |
| username | text not null unique | 登入帳號（建議 email） |
| display_name | text not null | 顯示名稱 |
| password_hash | text not null | scrypt 雜湊 |
| status | text not null default 'pending' | pending / approved / rejected / disabled |
| pages | text not null default '[]' | JSON 字串陣列，授權頁面 key |
| note | text | 申請備註 |
| created_at | integer not null | Unix 秒，預設 now |
| approved_at | integer | 審核通過時間 |

## 套用

- `bun run db:generate` 產生 SQL。
- `bun run db:migrate:local` 已套用至本地 D1。
- 遠端（`db:migrate:remote`）留待部署前一併執行（見 0008）。

## 備註

- 超級管理員不在此表，靠環境變數帳號登入特判。
- 不設 role 欄位（v1 僅單一超級管理員）。
