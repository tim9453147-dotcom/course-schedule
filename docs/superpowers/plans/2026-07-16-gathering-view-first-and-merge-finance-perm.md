# 家聚點檢視優先 + 收支權限合併 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家聚點活動紀錄改成「點列先看精簡檢視、按編輯才進表單」,並把收支編輯權限併入 `gathering` 權。

**Architecture:** 後端與 `pages.ts` 移除 `gathering-finance` 權限,收支路由改用 `gathering`。前端 `GatheringRecords.vue` 把 `canFinance` 收斂為單一 `canEdit`,並在 modal 內加入 `view`/`edit` 模式:`view` 顯示精簡 info(時間/地點/流程/料理),有權者按「編輯」切到現有完整表單。

**Tech Stack:** Nuxt 4、Nuxt UI、Drizzle(D1)、TypeScript(vue-tsc)。所有指令用 `just`(自動 pin node v24)。

## Global Constraints

- 所有指令走 `just`(例:`just typecheck`、`just lint`、`just dev`);對應 `bun run <script>`。
- 註解與 UI 文案用繁體中文,配合現有風格。
- 本 repo **無自動化測試**:每個 task 的驗證是 `just typecheck` + `just lint`,最後一個 task 用 headless Chrome 對 `bun dev` 實測。
- 權限單一來源在 `shared/utils/pages.ts`;後端以 `requirePage(event, '<key>')` 守門,前端以 `useCanEdit('<key>')` 判斷。
- 合併後 `gathering-finance` key 不再存在;不寫資料 migration,既有只授該 key 的使用者由超管重新勾 `gathering`。

---

### Task 1: 移除 `gathering-finance` 權限(後端 + 登記表)

**Files:**
- Modify: `shared/utils/pages.ts`(刪除 `gathering-finance` 那筆 `PAGES`)
- Modify: `server/api/gathering-finances/index.get.ts`(守門 key + 註解)
- Modify: `server/api/gathering-finances/[gatheringId].put.ts`(守門 key + 註解)

**Interfaces:**
- Consumes: 既有 `requirePage(event, key)`、`PAGES` 陣列。
- Produces: 收支兩支路由改為需 `gathering` 權;`PAGE_KEYS` 不再含 `'gathering-finance'`。

- [ ] **Step 1: 刪除 pages.ts 的 gathering-finance 項目**

在 `shared/utils/pages.ts` 的 `PAGES` 陣列移除這一行:

```ts
  { key: 'gathering-finance', label: '家聚點·收支', path: '/gathering', access: 'private', icon: 'i-lucide-home', nav: false },
```

保留 `gathering` 與 `gathering-recipe` 兩筆不動。

- [ ] **Step 2: 收支列表路由改用 gathering 權**

`server/api/gathering-finances/index.get.ts`:把註解與守門改掉。

```ts
// 收支列表（需 gathering 權限）。左連接活動，全部活動都列出；
// 未填收支者財務欄位為 null。順帶算出 income / profit 供列表顯示 +/−。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')
```

- [ ] **Step 3: 收支 upsert 路由改用 gathering 權**

`server/api/gathering-finances/[gatheringId].put.ts`:

```ts
// upsert 一場活動的收支（需 gathering 權限）。回傳含 income/profit 的合併視圖。
export default defineEventHandler(async (event) => {
  await requirePage(event, 'gathering')
```

- [ ] **Step 4: 型別檢查與 lint**

Run: `just typecheck && just lint`
Expected: 皆通過,無錯誤。

- [ ] **Step 5: Commit**

```bash
git add shared/utils/pages.ts server/api/gathering-finances/index.get.ts server/api/gathering-finances/[gatheringId].put.ts
git commit -m "refactor(gathering): 收支權限併入 gathering，移除 gathering-finance"
```

---

### Task 2: 前端收斂 `canFinance` → `canEdit`

**Files:**
- Modify: `app/components/GatheringRecords.vue`(script 區塊)

**Interfaces:**
- Consumes: `useCanEdit('gathering')`、`useFetch` 的 finances 抓取、`save()`。
- Produces: 元件內僅剩單一 `canEdit`;清單盈餘徽章、收支抓取、`save()` 皆改看 `canEdit`。此 task 只動 script 與盈餘徽章的條件,`view`/`edit` 模式在 Task 3 加入。

- [ ] **Step 1: 移除 canFinance,收支抓取改看 canEdit**

在 `app/components/GatheringRecords.vue` 的 `<script setup>`:

刪掉這行:

```ts
// 收支：有此權限才顯示與抓取。無權限者不發此請求，後端亦守門。
const canFinance = useCanEdit('gathering-finance')
```

`canEdit` 保留(`const canEdit = useCanEdit('gathering')`),並更新其上方註解為:

```ts
// 有 gathering 權才能編輯活動與收支（收支權限已併入 gathering）。
const canEdit = useCanEdit('gathering')
```

finances 抓取的 `immediate` 改看 `canEdit`:

```ts
const { data: finances, refresh: refreshFinances } = await useFetch<GatheringFinanceRow[]>(
  '/api/gathering-finances',
  { deep: true, default: () => [], immediate: canEdit.value }
)
```

- [ ] **Step 2: 清單盈餘徽章條件改看 canEdit**

在 `<template>` 清單列的盈餘徽章,`v-if` 由 `canFinance && row.fin` 改為 `canEdit && row.fin`:

```vue
        <span
          v-if="canEdit && row.fin"
          class="font-mono font-semibold tabular-nums"
          :class="[row.fin.profit >= 0 ? 'text-success' : 'text-error', row.g.location ? '' : 'ml-auto']"
        >
          {{ row.fin.profit >= 0 ? '+' : '−' }}{{ money(Math.abs(row.fin.profit)) }}
        </span>
```

- [ ] **Step 3: 簡化 save() 的收支分支**

把 `save()` 內所有 `canFinance` 改成 `canEdit`,並更新註解。因為活動與收支現在同權,`canEdit` 為真時兩者一起處理:

```ts
  async function save() {
    // 有 gathering 權才會進到 edit 模式並按儲存；活動欄位驗證後先存活動、再補收支。
    if (!form.name.trim()) return notify.error('請輸入活動名稱')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return notify.error('請選擇日期')
    saving.value = true
    try {
      const url = editingId.value ? `/api/gatherings/${editingId.value}` : '/api/gatherings'
      await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body: { ...form } })
      // 僅編輯既有活動時才寫收支（新增時無收支區塊）
      if (editingId.value) {
        await $fetch(`/api/gathering-finances/${editingId.value}`, {
          method: 'PUT',
          body: { headcount: toNull(form.headcount), fee: toNull(form.fee), expense: toNull(form.expense) }
        })
      }
      open.value = false
      await Promise.all([refresh(), refreshFinances()])
      notify.success(editingId.value ? '已更新活動' : '已新增活動')
    } catch (err: unknown) {
      const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
      notify.error('儲存失敗', msg)
    } finally {
      saving.value = false
    }
  }
```

> 注意:此處移除了「finance-only 使用者不打 /api/gatherings」的舊分支。合併權限後不再有 finance-only 身分。

- [ ] **Step 4: 收支區塊與底部儲存鈕的條件改看 canEdit**

`<template>` 內收支折疊區塊外層 `v-if="canFinance && editingId"` → `v-if="canEdit && editingId"`;
收支三個 `UInput` 的 `:disabled="!canFinance"` → `:disabled="!canEdit"`;
底部儲存鈕 `v-if="canEdit || (canFinance && editingId)"` → `v-if="canEdit"`。

- [ ] **Step 5: 型別檢查與 lint**

Run: `just typecheck && just lint`
Expected: 皆通過;`canFinance` 已無任何引用(可用 `grep -n canFinance app/components/GatheringRecords.vue` 確認無輸出)。

- [ ] **Step 6: Commit**

```bash
git add app/components/GatheringRecords.vue
git commit -m "refactor(gathering): 前端收斂 canFinance 為單一 canEdit"
```

---

### Task 3: modal 加入 `view`/`edit` 模式與精簡 info 檢視

**Files:**
- Modify: `app/components/GatheringRecords.vue`(script + template)

**Interfaces:**
- Consumes: Task 2 後的 `canEdit`、既有 `open`/`editingId`/`form`/`selectedRecipe`/`showRecipe`/`openRow`/`openCreate`。
- Produces: 新增 `mode` ref 與 modal 標題 computed;`view` 模式顯示精簡 info,`edit` 模式為現有完整表單。

- [ ] **Step 1: 新增 mode 狀態與標題**

在 `<script setup>` 的「明細 modal」區塊新增:

```ts
// modal 模式：view=精簡檢視、edit=完整表單。無 gathering 權者只會停在 view。
const mode = ref<'view' | 'edit'>('view')
const modalTitle = computed(() => {
  if (mode.value === 'view') return '活動明細'
  return editingId.value ? '編輯活動' : '新增活動'
})
```

- [ ] **Step 2: openRow/openCreate 設定模式**

`openCreate()` 結尾加 `mode.value = 'edit'`;`openRow()` 結尾加 `mode.value = 'view'`:

```ts
  function openCreate() {
    editingId.value = null
    Object.assign(form, blank())
    showRecipe.value = false
    showFinance.value = false
    mode.value = 'edit'
    open.value = true
  }
  function openRow(g: Gathering) {
    editingId.value = g.id
    const fin = financeById.value.get(g.id)
    Object.assign(form, {
      name: g.name, date: g.date, startTime: g.startTime ?? '', endTime: g.endTime ?? '',
      location: g.location ?? '', mapUrl: g.mapUrl ?? '', cook: g.cook ?? '',
      assistant: g.assistant ?? '', shopper: g.shopper ?? '', process: g.process ?? '',
      attendees: g.attendees ?? '', recipeId: g.recipeId, note: g.note ?? '',
      headcount: fin?.headcount == null ? '' : String(fin.headcount),
      fee: fin?.fee == null ? '' : String(fin.fee),
      expense: fin?.expense == null ? '' : String(fin.expense)
    })
    showRecipe.value = false
    showFinance.value = false
    mode.value = 'view'
    open.value = true
  }
```

- [ ] **Step 3: modal 標題改用 modalTitle**

`<UModal>` 的 `:title` 由原本三元式改為:

```vue
    <UModal
      :open="open"
      :title="modalTitle"
      :ui="{ content: 'max-w-2xl' }"
      @update:open="open = $event"
    >
```

- [ ] **Step 4: 精簡 info 檢視區塊(view 模式)**

在 `<template #body>` 最外層 `<div class="space-y-4">` 內,現有表單欄位最前面加入 `view` 模式區塊,並把現有整段表單(從活動名稱那組 grid 到收支折疊區塊)包在 `v-if="mode === 'edit'"` 的容器裡。`view` 區塊如下:

```vue
        <div
          v-if="mode === 'view'"
          class="space-y-4"
        >
          <div>
            <div class="text-muted text-xs">時間</div>
            <div class="font-medium">
              <span class="font-mono tabular-nums">{{ form.date }}</span>
              <span
                v-if="form.startTime || form.endTime"
                class="text-muted ml-2 font-mono tabular-nums"
              >{{ form.startTime }}<template v-if="form.endTime">–{{ form.endTime }}</template></span>
            </div>
          </div>
          <div v-if="form.location">
            <div class="text-muted text-xs">地點</div>
            <div class="font-medium">{{ form.location }}</div>
            <a
              v-if="form.mapUrl"
              :href="form.mapUrl"
              target="_blank"
              rel="noopener"
              class="text-primary inline-flex items-center gap-1 text-sm"
            >
              <UIcon name="i-lucide-map-pin" />開啟地圖
            </a>
          </div>
          <div v-if="form.process">
            <div class="text-muted text-xs">流程</div>
            <p class="whitespace-pre-wrap">{{ form.process }}</p>
          </div>
          <div v-if="selectedRecipe">
            <div class="text-muted text-xs">料理</div>
            <UButton
              variant="soft"
              color="primary"
              icon="i-lucide-chef-hat"
              size="sm"
              @click="showRecipe = !showRecipe"
            >
              {{ selectedRecipe.name }}
              <UIcon :name="showRecipe ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
            </UButton>
            <div
              v-if="showRecipe"
              class="bg-elevated/50 mt-2 space-y-2 rounded-lg p-3 text-sm"
            >
              <div>
                <span class="font-semibold">食材：</span>
                <p class="whitespace-pre-wrap">{{ selectedRecipe.ingredients || '—' }}</p>
              </div>
              <div>
                <span class="font-semibold">作法：</span>
                <p class="whitespace-pre-wrap">{{ selectedRecipe.steps || '—' }}</p>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 5: 把現有完整表單包進 edit 模式**

在現有第一組欄位 grid(活動名稱/日期)之前加開 `<div v-if="mode === 'edit'" class="space-y-4">`,並在收支折疊區塊 `</div>` 之後、底部按鈕列 `<div class="flex items-center justify-between pt-2">` 之前關閉這個 `</div>`。底部按鈕列維持在兩個模式共用(不包進 edit 容器)。

> 提示:確保 view 容器與 edit 容器是同層兄弟,底部按鈕列在兩者之後、共用。

- [ ] **Step 6: 底部按鈕列依模式顯示「編輯 / 儲存」**

把底部按鈕列改成:`view` 模式且有權 → 顯示「編輯」;`edit` 模式 → 顯示「儲存」;刪除鈕只在 `edit` 且既有活動時顯示;關閉/取消鈕文案依模式。

```vue
          <div class="flex items-center justify-between pt-2">
            <UButton
              v-if="mode === 'edit' && canEdit && editingId"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="remove"
            >
              刪除
            </UButton>
            <div class="ml-auto flex gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="open = false"
              >
                {{ mode === 'edit' ? '取消' : '關閉' }}
              </UButton>
              <UButton
                v-if="mode === 'view' && canEdit"
                icon="i-lucide-pencil"
                @click="mode = 'edit'"
              >
                編輯
              </UButton>
              <UButton
                v-if="mode === 'edit'"
                :loading="saving"
                @click="save"
              >
                儲存
              </UButton>
            </div>
          </div>
```

- [ ] **Step 7: 型別檢查與 lint**

Run: `just typecheck && just lint`
Expected: 皆通過。

- [ ] **Step 8: Commit**

```bash
git add app/components/GatheringRecords.vue
git commit -m "feat(gathering): 活動明細改為檢視優先，按編輯才進表單"
```

---

### Task 4: 端到端實測(headless Chrome)

**Files:**
- 無(僅驗證)

**Interfaces:**
- Consumes: 前三個 task 的成果。

- [ ] **Step 1: 啟動 dev server**

Run: `just dev`(背景執行)。首次載入需等 Vite 編譯(約 20s)。

- [ ] **Step 2: 驗證有 gathering 權身分**

以有 `gathering` 權的帳號(或超管,經 `ctx.request.post('/api/auth/login')` 登入)進 `/gathering`:
- 點任一活動列 → 出現精簡 info(時間/地點/流程/料理),右下有「編輯」鈕。
- 點料理 → 展開食材/作法。
- 按「編輯」→ 進完整表單,可改活動與收支並儲存成功。
- 清單列盈餘徽章正常顯示。

- [ ] **Step 3: 驗證無 gathering 權身分**

以無 `gathering` 權的帳號(例:新申請或只給其他頁的帳號)進 `/gathering`:
- 點活動列 → 只見精簡 info,無「編輯」鈕、無收支。

- [ ] **Step 4: 驗證新增活動**

按「新增活動」→ 直接是空白編輯表單 → 填必填後儲存成功、清單出現新列。

- [ ] **Step 5: 收尾**

確認 `just typecheck && just lint` 通過;dev server 可關閉。實測結果如實記錄(通過/失敗與畫面)。

---

## Self-Review

**Spec coverage:**
- 權限合併(pages.ts + 兩支後端路由 + 前端 canFinance)→ Task 1、Task 2。✓
- 精簡 info 檢視(時間/地點/流程/料理 + 點料理展開)→ Task 3 Step 4。✓
- 「編輯」按鈕僅 view+canEdit 顯示、edit 為現有表單 → Task 3 Step 6。✓
- 新增直接進 edit → Task 3 Step 2。✓
- 清單盈餘徽章保留、改看 canEdit → Task 2 Step 2。✓
- 既有資料不寫 migration → spec 已註明,計畫 Global Constraints 重述。✓
- 三身分驗證 → Task 4。✓

**Placeholder scan:** 無 TBD/TODO;所有程式步驟含實際程式碼。✓

**Type consistency:** `canEdit`(Task 2 起單一來源)、`mode: 'view' | 'edit'`、`modalTitle`、`selectedRecipe`/`showRecipe`(既有)、`toNull`(既有)前後一致。✓
