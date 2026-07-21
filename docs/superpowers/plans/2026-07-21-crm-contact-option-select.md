# 名單明細可維護共用下拉選單 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** 讓名單明細（ContactDetailModal）的「誰的朋友」「開發夥伴」變成點擊即展開、可新增/刪除選項的共用人名下拉選單，選項持久化於每位使用者各自的清單。

**Architecture:** 新增 per-user `contact_options` 表（擁有者規則同 `contact_stages`）＋三支 API（列/增/刪）。前端用 `UInputMenu`（沿用 `GatheringRecords.vue` 的 `create-item` 慣例）包成 `PersonSelect` 元件；兩個欄位共用 `ContactDetailModal` 抓來的同一份選項。欄位仍存純文字人名，`contacts` 欄位型別不變。

**Tech Stack:** Nuxt 4、Nitro server routes、Drizzle + Cloudflare D1、@nuxt/ui 4.8、zod。

## Global Constraints

- 擁有者規則同 `contacts`/`contact_stages`：`userId` 一般使用者為 `users.id`、超級管理員為 `NULL`；查詢一律 `ownedBy(col, ownerKey(actor))`，變更路由先 `await requirePage(event, 'crm')`。
- **共用一份名單**：單一選項清單，兩欄位共用（非兩份獨立）。
- 只做 列/增/刪，**不做改名、排序**（YAGNI）。
- 欄位存**純文字人名**到 `contacts.friendOf/devPartner`；不改 `contacts` 欄位型別。
- 刪除選項**不得**更動任何名單已存的 `friendOf/devPartner` 值。
- 註解與 UI 文案用繁體中文，比照周邊風格。
- 伺服器端 `requirePage`/`useDb`/`ownerKey`/`ownedBy`/`defineEventHandler`/`createError`/`getRouterParam`/`readValidatedBody`／validation schemas 皆為 Nitro 自動匯入——**不要手動 import**。前端 `Contact`/`ContactOption`/`useNotify` 與 `components/` 元件為 Nuxt 自動匯入。
- Schema 變更流程：`just db-generate` → `just db-migrate-local`。
- 品質基準（本分支自 `main` 切出）：typecheck 有 1 個既有錯誤 `app/pages/equipment.vue(342,22)`；full lint 約 326 problems（101 errors）——皆屬既有，**本任務觸及檔案不得新增任何 typecheck/lint 錯誤**。逐檔 lint：`PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" bunx eslint <file>`（期望 exit 0）。
- 所有指令透過 `just` 執行。

---

### Task 1: 資料表 `contact_options` + migration

**Files:**
- Modify: `server/db/schema.ts`
- Create: `server/db/migrations/*`（由 drizzle-kit 產生，勿手寫）

**Interfaces:**
- Produces: `contactOptions` table、`ContactOption` 型別（Task 2、3 依賴）。

- [ ] **Step 1: 在 `server/db/schema.ts` 新增資料表**（放在 `contactStages` 定義之後）

```ts
// 名單明細「誰的朋友／開發夥伴」共用人名選項（每位使用者各自一份，可增/刪）。
// 擁有者規則同 contacts/contact_stages：一般使用者 users.id，超級管理員 NULL。
export const contactOptions = sqliteTable('contact_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  // 人名
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
})
```

- [ ] **Step 2: 在型別匯出區（檔案末端 `export type ... $inferSelect` 那段）補上型別**

```ts
export type ContactOption = typeof contactOptions.$inferSelect
export type NewContactOption = typeof contactOptions.$inferInsert
```

- [ ] **Step 3: 產生 migration**
  Run: `just db-generate`
  Expected: 於 `server/db/migrations/` 新增一支含 `CREATE TABLE ... contact_options ...` 的 SQL（與 meta 檔）。

- [ ] **Step 4: 套用到本機 D1**
  Run: `just db-migrate-local`
  Expected: 顯示套用成功、無錯誤。

- [ ] **Step 5: 確認資料表存在**
  Run: `PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" wrangler d1 execute course-schedule-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='contact_options'"`
  Expected: 回傳一列 `contact_options`。

- [ ] **Step 6: 型別檢查**
  Run: `just typecheck`
  Expected: 只有既有的 `equipment.vue(342,22)`，無新增錯誤。

- [ ] **Step 7: Commit**（含 schema 與產生的 migration 檔；勿 `git add -A`，樹中另有無關的未提交檔）

```bash
git add server/db/schema.ts server/db/migrations
git commit -m "feat(crm): 新增 contact_options 資料表（誰的朋友/開發夥伴共用選項）"
```

---

### Task 2: 後端 API（列/增/刪）+ validation schema

**Files:**
- Modify: `server/utils/validation.ts`
- Create: `server/api/contact-options/index.get.ts`
- Create: `server/api/contact-options/index.post.ts`
- Create: `server/api/contact-options/[id].delete.ts`

**Interfaces:**
- Consumes: `contactOptions`（Task 1）、`contacts`；自動匯入的 `requirePage`/`useDb`/`ownerKey`/`ownedBy`。
- Produces: `GET/POST/DELETE /api/contact-options`（Task 4 前端呼叫）。

- [ ] **Step 1: 在 `server/utils/validation.ts` 新增 schema**（放在 `contactStageInputSchema` 附近）

```ts
// 名單共用人名選項：新增
export const contactOptionInputSchema = z.object({
  label: z.string().trim().min(1, '請輸入名稱')
})

export type ContactOptionInput = z.infer<typeof contactOptionInputSchema>
```

- [ ] **Step 2: 建立 `server/api/contact-options/index.get.ts`**

```ts
import { asc } from 'drizzle-orm'
import { contactOptions, contacts } from '../../db/schema'

// 取得本人的「誰的朋友／開發夥伴」共用選項（需 crm 權限）。
// 首次為空時，自動收錄現有名單裡填過的 friendOf/devPartner 值當起始選項。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const db = useDb(event)
  const owner = ownerKey(actor)

  const list = () =>
    db
      .select()
      .from(contactOptions)
      .where(ownedBy(contactOptions.userId, owner))
      .orderBy(asc(contactOptions.label))

  const existing = await list()
  if (existing.length) return existing

  // 尚無選項 → 從現有名單的 friendOf/devPartner 收錄（非空、去空白、去重）
  const rows = await db
    .select({ friendOf: contacts.friendOf, devPartner: contacts.devPartner })
    .from(contacts)
    .where(ownedBy(contacts.userId, owner))
  const seen = new Set<string>()
  for (const r of rows) {
    for (const v of [r.friendOf, r.devPartner]) {
      const label = (v ?? '').trim()
      if (label) seen.add(label)
    }
  }
  if (seen.size) {
    const now = Math.floor(Date.now() / 1000)
    await db.insert(contactOptions).values(
      [...seen].map(label => ({ userId: owner, label, createdAt: now }))
    )
  }
  return await list()
})
```

- [ ] **Step 3: 建立 `server/api/contact-options/index.post.ts`**

```ts
import { and, eq } from 'drizzle-orm'
import { contactOptions } from '../../db/schema'

// 新增共用人名選項（需 crm 權限）：歸屬本人；同名（去空白）已存在則回傳既有那筆，不重複建立。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')
  const data = await readValidatedBody(event, contactOptionInputSchema.parse)
  const db = useDb(event)
  const owner = ownerKey(actor)

  const [existing] = await db
    .select()
    .from(contactOptions)
    .where(and(ownedBy(contactOptions.userId, owner), eq(contactOptions.label, data.label)))
    .limit(1)
  if (existing) return existing

  const [created] = await db
    .insert(contactOptions)
    .values({ userId: owner, label: data.label })
    .returning()
  setResponseStatus(event, 201)
  return created
})
```

- [ ] **Step 4: 建立 `server/api/contact-options/[id].delete.ts`**

```ts
import { and, eq } from 'drizzle-orm'
import { contactOptions } from '../../db/schema'

// 刪除共用人名選項（需 crm 權限）：僅限本人；不動任何名單已存的 friendOf/devPartner 值。
export default defineEventHandler(async (event) => {
  const actor = await requirePage(event, 'crm')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '選項 id 不正確' })
  }

  const db = useDb(event)
  const owner = ownedBy(contactOptions.userId, ownerKey(actor))

  const [deleted] = await db
    .delete(contactOptions)
    .where(and(eq(contactOptions.id, id), owner))
    .returning()
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個選項' })
  }
  return { ok: true }
})
```

- [ ] **Step 5: 型別檢查 + lint（三個新檔 + validation.ts）**
  Run: `just typecheck` 然後 `PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" bunx eslint server/api/contact-options server/utils/validation.ts`
  Expected: typecheck 僅既有 equipment.vue 錯誤；eslint exit 0。
  （執行期正確性由最終 controller 瀏覽器 E2E 驗證；此處不需啟 dev server。）

- [ ] **Step 6: Commit**

```bash
git add server/utils/validation.ts server/api/contact-options
git commit -m "feat(crm): contact-options 列/增/刪 API（首次自動收錄既有值）"
```

---

### Task 3: 前端型別 + `PersonSelect` 元件

**Files:**
- Modify: `app/utils/crm.ts`
- Create: `app/components/PersonSelect.vue`

**Interfaces:**
- Consumes: `ContactOption`（本任務新增型別）。
- Produces: `<PersonSelect>` — props `modelValue: string`、`options: ContactOption[]`；emits `update:modelValue`、`add: [string]`、`delete: [number]`（Task 4 使用）。

- [ ] **Step 1: 在 `app/utils/crm.ts` 新增型別**（放在 `Contact` interface 之後）

```ts
// 名單明細「誰的朋友／開發夥伴」共用人名選項（對應後端 contact_options 表）
export interface ContactOption {
  id: number
  userId: number | null
  label: string
  createdAt: number
}
```

- [ ] **Step 2: 建立 `app/components/PersonSelect.vue`**

```vue
<script setup lang="ts">
// 可挑/可加/可刪的人名輸入（UInputMenu 包裝），用於名單明細「誰的朋友／開發夥伴」。
// 存純文字人名；選項清單由父層（ContactDetailModal）持有並持久化，本元件只呈現與發事件。
const props = defineProps<{ modelValue: string, options: ContactOption[] }>()
const emit = defineEmits<{
  'update:modelValue': [string]
  'add': [string] // 使用者輸入的新名稱，父層負責 POST 持久化
  'delete': [number] // 要刪除的選項 id，父層負責 DELETE
}>()

// UInputMenu 以字串清單呈現即可（人名唯一）；刪除時用 label 反查 id。
const items = computed(() => props.options.map(o => o.label))

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v ?? '')
})

// UInputMenu 的 item slot 對字串項目可能傳字串、也可能傳正規化後的物件；兩者都取得到 label。
function itemLabel(item: unknown): string {
  return typeof item === 'string' ? item : String((item as { label?: string })?.label ?? '')
}

function onCreate(label: string) {
  emit('add', label)
  emit('update:modelValue', label)
}

function onDelete(item: unknown) {
  const label = itemLabel(item)
  const opt = props.options.find(o => o.label === label)
  if (opt) emit('delete', opt.id)
}
</script>

<template>
  <UInputMenu
    v-model="value"
    :items="items"
    create-item
    placeholder="選擇或輸入"
    class="w-full"
    @create="onCreate"
  >
    <template #item-trailing="{ item }">
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`刪除選項 ${itemLabel(item)}`"
        @pointerdown.stop.prevent
        @click.stop.prevent="onDelete(item)"
      />
    </template>
  </UInputMenu>
</template>
```

> 實作備註（UInputMenu 是本功能唯一不確定處）：目標是「點輸入框即展開、底部『新增』可加、每項右側 ✕ 就地刪且不會誤選」。若 `#item-trailing` 對字串項目不渲染，改用 `#item` slot 自行排版（label 靠左、✕ 靠右），並保留 `@pointerdown.stop.prevent` 阻止 reka-ui 選取。務必實際確認 ✕ 可刪且不觸發選取（最終 controller 會以無頭瀏覽器實測此互動）。

- [ ] **Step 3: 型別檢查 + lint**
  Run: `just typecheck` 然後 `PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" bunx eslint app/components/PersonSelect.vue app/utils/crm.ts`
  Expected: typecheck 僅既有 equipment.vue 錯誤；eslint exit 0。

- [ ] **Step 4: Commit**

```bash
git add app/utils/crm.ts app/components/PersonSelect.vue
git commit -m "feat(crm): 新增 PersonSelect 人名選單元件（可挑/加/刪）"
```

---

### Task 4: 接進 `ContactDetailModal`

**Files:**
- Modify: `app/components/ContactDetailModal.vue`

**Interfaces:**
- Consumes: `<PersonSelect>`（Task 3）、`GET/POST/DELETE /api/contact-options`（Task 2）。

- [ ] **Step 1: script 內新增共用選項的抓取與增/刪處理**（放在既有 `const saving = ref(false)` 之後）

```ts
// 「誰的朋友／開發夥伴」共用人名選項（單一真相來源，兩個 PersonSelect 共用）。
// 比照 ContactList：本元件已在頁面 Suspense 邊界內（ContactList 亦用 top-level await useFetch）。
const { data: options, refresh: refreshOptions } = await useFetch<ContactOption[]>('/api/contact-options', { deep: true })

async function addOption(label: string) {
  try {
    const created = await $fetch<ContactOption>('/api/contact-options', { method: 'POST', body: { label } })
    if (!(options.value ?? []).some(o => o.id === created.id)) {
      options.value = [...(options.value ?? []), created]
    }
  } catch {
    notify.error('新增選項失敗')
    await refreshOptions()
  }
}

async function removeOption(id: number) {
  const prev = options.value ?? []
  options.value = prev.filter(o => o.id !== id) // 樂觀移除
  try {
    await $fetch(`/api/contact-options/${id}`, { method: 'DELETE' })
  } catch {
    notify.error('刪除選項失敗')
    await refreshOptions()
  }
}
```

- [ ] **Step 2: template 把「誰的朋友／開發夥伴」兩個 `UInput` 換成 `PersonSelect`**

原：
```vue
          <UFormField label="誰的朋友">
            <UInput
              v-model="form.friendOf"
              class="w-full"
            />
          </UFormField>
          <UFormField label="開發夥伴">
            <UInput
              v-model="form.devPartner"
              class="w-full"
            />
          </UFormField>
```
改為：
```vue
          <UFormField label="誰的朋友">
            <PersonSelect
              v-model="form.friendOf"
              :options="options ?? []"
              @add="addOption"
              @delete="removeOption"
            />
          </UFormField>
          <UFormField label="開發夥伴">
            <PersonSelect
              v-model="form.devPartner"
              :options="options ?? []"
              @add="addOption"
              @delete="removeOption"
            />
          </UFormField>
```

- [ ] **Step 3: 型別檢查 + lint**
  Run: `just typecheck` 然後 `PATH="$HOME/.local/share/fnm/node-versions/v24.17.0/installation/bin:$PATH" bunx eslint app/components/ContactDetailModal.vue`
  Expected: typecheck 僅既有 equipment.vue 錯誤；eslint exit 0。

- [ ] **Step 4: Commit**

```bash
git add app/components/ContactDetailModal.vue
git commit -m "feat(crm): 名單明細誰的朋友/開發夥伴改用可維護共用下拉"
```

> 交付後由 controller 執行無頭瀏覽器 E2E（不在本計畫任務內）：登入→開某名單明細→點「誰的朋友」下拉即展開含既有值→打字新增選項（兩欄位皆出現、重整後仍在）→點某項 ✕（清單消失、DB 少一列、名單原值不受影響）→選值儲存（`contacts.friendOf/devPartner` 存人名文字）。

---

## Self-Review

**Spec coverage：**
- 共用一份名單、per-user、擁有者規則 → Task 1（表）+ Global Constraints ✅
- 首次自動收錄既有 friendOf/devPartner → Task 2 GET ✅
- 列/增/刪 API、刪除不動名單值 → Task 2 三支路由 ✅
- 點擊即展開 + 底部新增 + 就地 ✕ 刪 → Task 3 PersonSelect（`UInputMenu` create-item + item-trailing ✕）✅
- 兩欄位共用同一份、即時同步 → Task 4 單一 options 傳給兩個 PersonSelect ✅
- 欄位仍存純文字、型別不變 → Task 3/4 v-model 綁字串 ✅
- 非目標（不改名/排序、不動其他欄位）→ 無對應任務，未逾越 ✅

**Placeholder scan：** 無 TBD/TODO；每個動程式的步驟均附完整程式碼與確切指令。UInputMenu 的不確定性以「實作備註 + 明確 fallback + controller E2E」承接，非 placeholder。

**Type consistency：** `ContactOption`（Task 3）欄位與 `contactOptions.$inferSelect`（Task 1）一致；`PersonSelect` 的 emits（`add:[string]`、`delete:[number]`）對應 Task 4 的 `addOption(label:string)`、`removeOption(id:number)`；`contactOptionInputSchema`（Task 2）欄位 `label` 與前端送出的 body `{ label }` 一致。

**測試策略 Note：** 專案無自動化測試框架。後端/前端各以 `just typecheck` + 逐檔 `eslint` 為關卡；整體行為（含 ✕ 刪除互動）由 controller 無頭瀏覽器 E2E 驗證——符合 CLAUDE.md（無自動化測試、以 headless Chrome 驗證）。
