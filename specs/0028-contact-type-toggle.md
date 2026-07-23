# 0028 名單類型:顧客／準領導人 每筆切換

日期:2026-07-22

## 任務目標

在「總名單」(`ContactList.vue`)每筆名單上新增一個「顧客／準領導人」的二選一切換,做法完全比照既有的「破題／未破題」(`broached`):表格列上一個分段切換鈕、inline 樂觀更新、新增名單 modal 也有對應欄位。

這是每筆名單各自的分類(每筆是顧客 **或** 準領導人),**不是**頁面上方的分頁,也**不是**篩選器。

## 最終設計決策

- **資料表示用文字列舉,不用布林**:新增欄位 `contact_type`(text),值為 `'customer'` / `'leader'`,預設 `'customer'`(顧客)。語意上「顧客/準領導人」不是 true/false,文字列舉未來若要加第三種類型也保有彈性(與 `broached` 固定二元不同)。
- **預設值 = 顧客(`customer`)**:新名單先當顧客,之後再改為準領導人。
- **切換鈕左右順序 = 顧客在左、準領導人在右**(與破題「未破題在左、預設在左」一致)。
- **範圍收斂**:只做表格列切換鈕 + 新增名單 modal 欄位。**不做**頁面分頁、**不做**stats 篩選 chip。

## 實作規劃

### 後端

- `server/db/schema.ts`:`contacts` 表新增
  `contactType: text('contact_type').notNull().default('customer')`,置於 `broached` 附近並加中文註解。
- 產生 migration:`just db-generate` → 新檔 `server/db/migrations/0020_*.sql`;之後 `just db-migrate-local`(部署前後再 `db:migrate:remote`)。
- `server/utils/validation.ts`:
  - `contactInputSchema` 加 `contactType: z.enum(['customer', 'leader']).default('customer')`。
  - `contactPatchSchema` 覆寫 `contactType: z.enum(['customer', 'leader']).optional()`(同 `broached`/`completedStages` 的技巧,避免部分更新被重設回預設)。
- POST(`index.post.ts`)/ PATCH(`[id].patch.ts`)路由**不需改動**:兩者皆 `...data` 展開帶入。

### 前端

- `app/utils/crm.ts`:
  - `Contact` 介面加 `contactType: 'customer' | 'leader'`。
  - 在 `BROACHED_OPTIONS` 旁新增
    `CONTACT_TYPE_OPTIONS = [{ label: '顧客', value: 'customer' }, { label: '準領導人', value: 'leader' }] as const`。
- `app/components/ContactList.vue`:
  - 新增 `setContactType(c, value)` inline handler,完全比照 `setBroached`(樂觀更新 + PATCH + 失敗還原 + `notify.error`)。
  - 表格:表頭 `位置` 後新增一欄 `類型`;對應 `<td>` 放分段切換鈕,markup 複製破題那段(圓角 border、選中 `bg-primary text-inverted`、未選 `text-dimmed hover:bg-elevated`)。
    - 注意破題目前沒有獨立表頭(它被算進「進度」的 `colspan = stages + 1`)。新增的類型欄要有自己的 `<th>類型</th>`,不動進度的 colspan。
  - 新增名單 modal:複製「破題狀態」那個 `UFormField`,改成「類型」+ 顧客/準領導人兩顆鈕,綁 `form.contactType`。
  - `openCreate()`:`form` 加入 `contactType: 'customer'`。

## 結果與驗證

- `just typecheck`:通過(exit 0)。
- `just lint`:與 main 基準完全相同(334 problems / 109 errors / 225 warnings),本次改動未新增任何 lint 問題;既有錯誤(schema.ts arrow-parens、nuxt.config.ts key order、validation.ts 空行等)為既存,與本次無關。
- API round-trip(super admin 登入,對 `bun dev`):
  - `POST /api/contacts` 帶 `contactType: 'leader'` → 回存 `leader`。
  - `POST /api/contacts` 未帶 `contactType` → 預設 `customer`。
  - `PATCH /api/contacts/:id` 帶 `contactType: 'customer'` → 更新成功,且 `name` 等其他欄位不受影響(驗證 `contactPatchSchema` 的 `.optional()` 覆寫正確,部分更新不會誤清)。
