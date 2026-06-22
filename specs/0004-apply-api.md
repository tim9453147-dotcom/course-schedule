# 0004 — 申請帳號 API

## 目的

公開端點，讓路人申請成為使用者，待超級管理員審核。

## 變更

- `server/api/auth/apply.post.ts`（新增，公開、不需登入）。

## 行為

- 輸入：`username`（trim, 非空）、`displayName`（trim, 非空）、`password`（≥6 碼）、`note`（選填, ≤500）。
- `username` 需唯一，重複 → 409「此帳號已被使用」。
- 密碼以 `hashPassword`（scrypt）雜湊後存入。
- 建立 `status='pending'`、`pages='[]'` 的 user。
- 成功回 201 `{ ok: true }`。

## 備註

- v1 不加 Turnstile（範圍外）。
