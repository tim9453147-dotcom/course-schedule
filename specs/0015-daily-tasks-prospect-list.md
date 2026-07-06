# 0015 — 每日任務（個人名單表，關聯總名單）

## 背景

名單頁（`/crm`）新增「每日任務」名單系統，內容參考 `public/每日任務.pdf`（安利「個人名單表」），原本的總名單移到第二個分頁。

每日任務**不是獨立資料**：每一列都是「把總名單（contacts）的某個人放進某個區塊」。姓名與延伸欄位皆來自所引用的 contact；使用者從總名單挑人加入即可。

## 決策

- `/crm` 改為分頁：第一頁「每日任務」（`ProspectWorksheet`）、第二頁「總名單」（`ContactList`，原 CRM 主體）。導覽列維持「名單 → /crm」，兩分頁共用 `crm` 權限。
- 「個人名單表」的延伸欄位（誰的朋友、開發夥伴、聯絡方式、新人資訊、等級、狀態）**掛在 contact 上**，不在總名單表格顯示，改由每列的「編輯明細」icon 開 modal 編輯（`ContactDetailModal`，總名單列與每日任務列共用）。
- 每日任務列唯讀顯示這些欄位；只有「日期」屬於這一列自己、可 inline 修改。
- 同一個人在同一區塊不重複，但可同時出現在不同區塊。
- 從區塊「移除」只刪 `prospects` 關聯列，不刪 contact；反之刪除 contact 會一併移除其所有 prospects 列。

## 資料模型

### `contacts` 新增欄位（`server/db/schema.ts`）
`friendOf`(誰的朋友)、`devPartner`(開發夥伴)、`info`(新人資訊)、`level`(等級 SSR/SR/R)、`status`(狀態)。
（`contact` 聯絡方式沿用原有欄位。）

### `prospects` 表（重構為關聯列）
`id`、`userId`（擁有者，同 contacts）、`contactId`（FK → contacts）、`section`（develop/reserve/five/network）、`date`、`createdAt`。

- Migration：`0014_unknown_blazing_skull.sql`（CREATE prospects + 5 個 ALTER contacts）。已套用 local；部署前需 `db:migrate:remote`。

## API（`server/api/prospects/`，皆 `requirePage('crm')` + owner 範圍）

- `GET /api/prospects` — inner join contacts，回傳每列 + 巢狀 `contact`。
- `POST /api/prospects` — body `{ section, contactId, date? }`；驗證 contact 屬於自己；同區塊重複則冪等回傳既有列。
- `PATCH /api/prospects/[id]` — 只可改 `date`。
- `DELETE /api/prospects/[id]` — 移出區塊。

延伸欄位透過既有 `PATCH /api/contacts/[id]`（`contactInputSchema` 已加入這些欄位；`level` 空字串正規化為 null）。`DELETE /api/contacts/[id]` 一併刪除該 contact 的 prospects。

## 前端

- `app/pages/crm.vue` — 分頁殼（`UTabs`，`default-value="daily"`）。
- `app/components/ProspectWorksheet.vue` — 四區塊；每區塊「從總名單加入」開多選 picker（排除已在此區塊者、可搜尋）；列唯讀＋日期 inline＋編輯明細/移除。
- `app/components/ContactDetailModal.vue` — 延伸欄位編輯 modal，總名單與每日任務共用，儲存後 `emit('saved', contact)`，各引用列同步更新。
- `app/components/ContactList.vue` — 原 CRM 主體；每列操作區加「編輯明細」icon。
- `app/utils/prospects.ts`（`Prospect` 巢狀 contact、等級選項/顏色、區塊標題）、`app/utils/crm.ts`（`Contact` 加延伸欄位）。

### 注意事項

- reka-ui `SelectItem` 不允許空字串值：等級下拉的「未設」以 placeholder 呈現，清除用 `'__none__'` 哨兵。ProspectWorksheet 本身不含 USelect（等級只在明細 modal 編輯），避免先前的 SSR 崩潰。
- `ProspectWorksheet` 用非 await 的 `useFetch(..., { lazy, default: () => [] })`，避免分頁延遲掛載觸發 async setup 需要 `<Suspense>`。

## 驗證

以 curl 走完整流程（本機）：登入 → 建立 contact → PATCH 明細（friendOf/level/status…）→ 加入 develop（重複加入冪等、同人可再加入 network）→ GET 帶出巢狀 contact → PATCH date → 移出區塊 → 刪除 contact 連帶清除 prospects。並確認 `/crm` SSR 200、四區塊與「從總名單加入」皆渲染、唯讀列正確帶出姓名/誰的朋友/等級徽章、無 500。typecheck / lint 於本次改動檔案皆乾淨。
