# 名單明細「誰的朋友／開發夥伴」可維護下拉選單 — 設計稿

日期：2026-07-21
主題：名單明細編輯（ContactDetailModal）的「誰的朋友」「開發夥伴」改為可新增/刪除選項的共用下拉選單

## 背景與目標

名單明細 modal（`app/components/ContactDetailModal.vue`）目前「誰的朋友」`friendOf`、「開發夥伴」`devPartner`
是純文字 `UInput`。使用者希望：
- 點輸入框**立即展開下拉選單**（既有人名建議）
- 可**新增選項**（打字後選「新增『X』」持久化）
- 可**刪除選項**（每個選項右側 ✕，就地刪除，不另開視窗）

## 範圍與決策

- **共用一份名單（決策 A）**：兩個欄位共用同一組人名選項，非兩份獨立清單。
- 選項**持久化**、**每位使用者各自一份**——完全比照現有 `contact_stages` 的擁有者規則
  （一般使用者 `users.id`、超級管理員 `NULL`）。
- 只做「列出 / 新增 / 刪除」，**不做改名、排序**（YAGNI）。
- 欄位仍存**純文字人名**到 `contacts.friendOf/devPartner`，欄位型別不變。
- 沿用既有元件慣例：`UInputMenu` + `create-item`（見 `GatheringRecords.vue` 操鍋/助手/採買）。

### 非目標

- 不改動其他明細欄位（聯絡方式、新人資訊、等級、狀態）。
- 不做跨使用者共享名單、不接每日任務板、不改 `contacts` 欄位型別。

## 資料模型（`server/db/schema.ts`）

新增 `contact_options` 表（每位使用者各自一份、共用名單）：

```
contact_options
- id         integer PK autoincrement
- userId     integer NULL  → references users.id（一般使用者 users.id；超管 NULL）
- label      text NOT NULL  → 人名
- createdAt  integer NOT NULL default now
```

- 同一擁有者內 `label` 不重複：因擁有者可能為 `NULL`（super admin），SQLite unique index 對 NULL 視為相異、
  無法保證，故**去重在 API 端做**（`label` 去空白後比對現有）。
- 型別：`export type ContactOption = typeof contactOptions.$inferSelect`。
- Schema 變更流程：`just db-generate` → `just db-migrate-local`（部署前後另跑 `just db-migrate-remote`）。

## 後端 API（比照 `server/api/contact-stages/*`）

- `GET /api/contact-options`（`index.get.ts`）
  - `const actor = await requirePage(event, 'crm')`；`ownedBy(contactOptions.userId, ownerKey(actor))`。
  - **首次為空時自動收錄**：撈該擁有者 `contacts` 的 `friendOf`、`devPartner`，取非空、去空白、去重的值，
    批次 insert 成初始選項後回傳（比照 contact-stages 首次種子預設的做法）。
  - 回傳 `ContactOption[]`，依 `label` 排序。
- `POST /api/contact-options`（`index.post.ts`）
  - `requirePage(event,'crm')`；body `{ label: string }`（zod：trim、min 1）。
  - 去空白後，若該擁有者已有同名選項 → 直接回傳既有那筆（不重複建立）；否則 insert，回傳 201 + 建立的列。
- `DELETE /api/contact-options/[id]`（`[id].delete.ts`）
  - `requirePage(event,'crm')`；先確認該 id 屬於本擁有者（`ownedBy`），否則 404/403；delete；回 `{ ok: true }`。
  - **不動任何 `contacts` 已存的 `friendOf/devPartner` 值**（只從可挑清單移除）。

## 前端

### 型別（`app/utils/crm.ts`）
新增 `ContactOption { id:number; userId:number|null; label:string; createdAt:number }`。

### 新元件 `app/components/PersonSelect.vue`
`UInputMenu` 的輕包裝，單一職責＝「一個可挑/可加/可刪的人名輸入」。

- Props：`modelValue: string`、`options: ContactOption[]`。
- Emits：`update:modelValue`（選取/輸入的人名字串）、`add: [label: string]`、`delete: [id: number]`。
- items 由 `options` 映射為 `{ label, id }`，`value-key="label"` 讓 v-model 綁定人名字串（與存進 `contacts` 的純文字一致）。
- `create-item` + `@create="(v) => emit('add', v)"`：點「新增『X』」時，交給父層持久化，同時把欄位值設為 `X`。
- 每個選項用 `#item-trailing`（或 `#item` 尾端）插槽放小 ✕ 按鈕，`@click.stop.prevent="emit('delete', item.id)"`，
  避免點 ✕ 反而選取該項。
- 點輸入框即展開（`UInputMenu` 預設 focus 展開）——符合「點輸入框直接出現下拉」。

### `app/components/ContactDetailModal.vue`
- 以 `useFetch<ContactOption[]>('/api/contact-options', { deep: true })` 抓一次共用名單（單一真相來源）。
- 「誰的朋友」「開發夥伴」兩個 `UInput` → 兩個 `<PersonSelect>`，皆傳同一份 `:options`；兩者共用、即時同步。
- `onAdd(label)`：`POST /api/contact-options`，把回傳的列併入 options（若已存在則不重複併入）。
- `onDelete(id)`：`DELETE /api/contact-options/:id`，從 options 濾除；失敗 `notify.error` 並 refetch 還原。
- 兩欄位的 v-model 仍是 `form.friendOf` / `form.devPartner`（純文字），儲存邏輯 `save()` 不變。

## 邊界情況與錯誤處理

- 新增重複人名 → API 回既有列，前端併入時以 id 去重，不重複顯示。
- 刪除當前正被某名單使用的選項 → 該名單的值保留，只是選項清單少一項。
- 兩個 `PersonSelect` 共用同一 `options` 陣列 → 一邊增/刪，另一邊即時反映。
- 新增/刪除 API 失敗 → `notify.error` + refetch 還原（比照 ContactList/ContactDetailModal 既有模式）。

## 測試 / 驗證

- 無自動化測試框架（同專案現況）。
- Schema：`just db-generate` 產 migration → `just db-migrate-local` 套用；交付前跑 `just typecheck`、`just lint`。
- 端到端：`just dev` + headless Chrome 登入後——
  1) 開某名單「明細」，點「誰的朋友」→ 下拉即展開、含既有值；
  2) 打字新增一個選項 → 兩個欄位的下拉都出現該選項、重整後仍在（持久化）；
  3) 點某選項 ✕ → 從清單消失、DB 少一列，且該名單原值不受影響；
  4) 選一個值儲存 → `contacts.friendOf/devPartner` 存的是人名文字。

## 影響檔案

- 修改：`server/db/schema.ts`（新增 `contactOptions` 表 + 型別）
- 新增：`server/db/migrations/*`（drizzle-kit 產生）
- 新增：`server/api/contact-options/index.get.ts`、`index.post.ts`、`[id].delete.ts`
- 修改：`app/utils/crm.ts`（`ContactOption` 型別）
- 新增：`app/components/PersonSelect.vue`
- 修改：`app/components/ContactDetailModal.vue`（改用 PersonSelect + 抓共用名單）
