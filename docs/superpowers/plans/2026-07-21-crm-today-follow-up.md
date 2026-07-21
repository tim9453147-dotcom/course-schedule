# 名單「今日跟進」智慧清單（先找誰）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** 在 `/crm` 名單頁新增「今日跟進」分頁，用透明的熱度分數把使用者自己名單中「今天該先聯絡的人」排序在最前。

**Architecture:** 熱度公式抽成 `shared/utils/leadScore.ts` 純函式（前後端自動匯入、單一真相來源）。前端新元件 `TodayFollowUp.vue` 重用既有 `/api/contacts`、`ContactDetailModal` 與跟進紀錄端點；不動資料庫、不加後端 API。

**Tech Stack:** Nuxt 4、@nuxt/ui、TypeScript。純函式以 `bun`（原生執行 .ts）驗證；UI 以 `just typecheck` / `just lint` + `bun dev` 手動檢查。

## Global Constraints

- 資料範圍不變：名單為每位使用者各自私有（`contacts.userId`），本功能純前端過濾/排序既有 `/api/contacts` 回傳，不跨使用者。
- 不碰 LINE、不新增資料表/欄位、不新增後端 API。
- `shared/utils/leadScore.ts` 必須是純函式：無副作用、**不呼叫 `Date.now()`**，「今天」一律由呼叫端以 `YYYY-MM-DD` 傳入（與 `server/utils/followup.ts` 一致）。不得 import `app/**`（shared 不可依賴 app）。
- 跟進頻率標籤沿用既有值（`app/utils/crm.ts` 的 `FOLLOW_UP_FREQ_OPTIONS`）：`一週一次 / 兩週一次 / 一個月一次 / 一季一次 / 半年一次 / 暫停`。
- 註解與 UI 文案用繁體中文，比照周邊風格。
- 所有指令透過 `just` 執行（已釘 node v24）。

---

### Task 1: 熱度公式純函式 `shared/utils/leadScore.ts`

**Files:**
- Create: `shared/utils/leadScore.ts`
- Test（暫存、不進版控）: `/tmp/claude-1001/-home-tim-githubRepo-amway-course-schedule/98ed1d95-7180-46b5-8516-639834f9129e/scratchpad/leadScore.test.ts`

**Interfaces:**
- Consumes: 無（純函式，自帶最小輸入型別）。
- Produces（後續 Task 2 依賴這些確切名稱）:
  - `interface LeadScoreInput { broached: boolean; completedStages: number[] | null; followUpFreq: string | null; lastFollowUp: string | null; nextFollowUp: string | null }`
  - `FOLLOW_UP_FREQ_WEIGHT: Record<string, number>`
  - `isTodayFollowUp(c: LeadScoreInput, today: string): boolean`
  - `leadScore(c: LeadScoreInput, today: string): number`
  - `topReason(c: LeadScoreInput, today: string): LeadReason`（`LeadReason` 為下方 union，含 `kind: 'overdue' | 'due' | 'pending'` 與 `label: string`）

- [ ] **Step 1: 先寫失敗測試** — 建立暫存測試檔（`bun` 原生跑 .ts；`shared/utils/leadScore.ts` 無 Nuxt 依賴可直接以絕對路徑 import）

```ts
// scratchpad/leadScore.test.ts
import { isTodayFollowUp, leadScore, topReason } from '/home/tim/githubRepo/amway/course-schedule/shared/utils/leadScore.ts'

const T = '2026-07-21'
let fail = 0
function ok(name: string, cond: boolean) {
  if (!cond) { console.error('FAIL:', name); fail++ } else { console.log('ok:', name) }
}
const base = { broached: false, completedStages: [] as number[], followUpFreq: null as string | null, lastFollowUp: null as string | null, nextFollowUp: null as string | null }

// 逾期 11 天
const overdue = { ...base, nextFollowUp: '2026-07-10', followUpFreq: '一週一次', lastFollowUp: '2026-07-03' }
ok('overdue included', isTodayFollowUp(overdue, T) === true)
ok('overdue reason', topReason(overdue, T)?.kind === 'overdue' && topReason(overdue, T)?.label === '逾期 11 天')
ok('overdue score = 11*3 + 20(週)', leadScore(overdue, T) === 11 * 3 + 20)

// 今天到期
const due = { ...base, nextFollowUp: T, followUpFreq: '一個月一次', lastFollowUp: '2026-06-21', broached: true, completedStages: [1, 2] }
ok('due included', isTodayFollowUp(due, T) === true)
ok('due reason', topReason(due, T)?.kind === 'due')
ok('due score = 40 + 8 + 2*5 + 10', leadScore(due, T) === 40 + 8 + 10 + 10)

// 待啟動：有頻率、沒跟過
const pending = { ...base, followUpFreq: '兩週一次' }
ok('pending included', isTodayFollowUp(pending, T) === true)
ok('pending reason', topReason(pending, T)?.kind === 'pending')
ok('pending score = 35 + 14', leadScore(pending, T) === 35 + 14)

// 暫停 → 不入列
ok('paused excluded', isTodayFollowUp({ ...base, followUpFreq: '暫停' }, T) === false)

// 未到期 → 不入列
ok('future excluded', isTodayFollowUp({ ...base, nextFollowUp: '2026-08-01', followUpFreq: '一週一次', lastFollowUp: '2026-07-25' }, T) === false)

console.log(fail === 0 ? 'ALL PASS' : `${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
```

- [ ] **Step 2: 跑測試確認失敗**
  Run: `just proxy bun run "$SCRATCH/leadScore.test.ts"`（`$SCRATCH` 為上方暫存目錄；或直接用完整路徑）
  Expected: FAIL — 找不到模組 `shared/utils/leadScore.ts`（檔案還沒建）

- [ ] **Step 3: 寫最小實作**

```ts
// shared/utils/leadScore.ts
// 名單「今日跟進」熱度公式（先找誰）。純函式、無副作用、前後端共用（shared/ 自動匯入）。
// 比照 followup.ts：「今天」由呼叫端傳入（YYYY-MM-DD），不在此呼叫 Date.now()，方便測試與 SSR。

// 計算所需的最小名單欄位；app/utils 的 Contact 結構上相容。
export interface LeadScoreInput {
  broached: boolean
  completedStages: number[] | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
}

// 跟進頻率 → 權重（越高頻越該顧）。「暫停」與未設為 0。
export const FOLLOW_UP_FREQ_WEIGHT: Record<string, number> = {
  一週一次: 20,
  兩週一次: 14,
  一個月一次: 8,
  一季一次: 4,
  半年一次: 2,
  暫停: 0
}

const MS_PER_DAY = 86_400_000

// 兩個 YYYY-MM-DD 相差天數（a - b），無法解析回 0。
function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(da) || Number.isNaN(db)) return 0
  return Math.round((da - db) / MS_PER_DAY)
}

// 有設頻率（非暫停）但從沒跟進過 → 待啟動。
function isPending(c: LeadScoreInput): boolean {
  return !!c.followUpFreq && c.followUpFreq !== '暫停' && !c.lastFollowUp
}

// 是否列入「今日跟進」：逾期 ∪ 今天到期 ∪ 待啟動。
export function isTodayFollowUp(c: LeadScoreInput, today: string): boolean {
  if (isPending(c)) return true
  if (!c.nextFollowUp) return false
  return c.nextFollowUp <= today
}

// 熱度分數（越高越前）。
export function leadScore(c: LeadScoreInput, today: string): number {
  let score = 0
  if (c.nextFollowUp) {
    const overdue = dayDiff(today, c.nextFollowUp) // >0 逾期、=0 今天、<0 未到
    if (overdue > 0) score += Math.min(overdue, 30) * 3
    else if (overdue === 0) score += 40
  }
  if (isPending(c)) score += 35
  score += FOLLOW_UP_FREQ_WEIGHT[c.followUpFreq ?? ''] ?? 0
  score += (c.completedStages?.length ?? 0) * 5
  if (c.broached) score += 10
  return score
}

export type LeadReason =
  | { kind: 'overdue', label: string, days: number }
  | { kind: 'due', label: string }
  | { kind: 'pending', label: string }
  | null

// 主要理由（畫面主 chip 用）。優先序：逾期 → 今天到期 → 待啟動。
export function topReason(c: LeadScoreInput, today: string): LeadReason {
  if (c.nextFollowUp) {
    const overdue = dayDiff(today, c.nextFollowUp)
    if (overdue > 0) return { kind: 'overdue', label: `逾期 ${overdue} 天`, days: overdue }
    if (overdue === 0) return { kind: 'due', label: '今天到期' }
  }
  if (isPending(c)) return { kind: 'pending', label: '待啟動' }
  return null
}
```

- [ ] **Step 4: 跑測試確認通過**
  Run: `just proxy bun run "$SCRATCH/leadScore.test.ts"`
  Expected: 每行 `ok:` 後印出 `ALL PASS`，exit 0

- [ ] **Step 5: 型別檢查**
  Run: `just typecheck`
  Expected: 無錯誤（新純函式檔）

- [ ] **Step 6: Commit**

```bash
git add shared/utils/leadScore.ts
git commit -m "feat(crm): 新增名單熱度公式 leadScore（純函式、前後端共用）"
```

---

### Task 2: 「今日跟進」元件 `app/components/TodayFollowUp.vue`

**Files:**
- Create: `app/components/TodayFollowUp.vue`

**Interfaces:**
- Consumes: `isTodayFollowUp` / `leadScore` / `topReason`（Task 1，shared/ 自動匯入）；`Contact`、`timeAgo`（`app/utils/crm.ts`）；`todayStr`（`app/utils/equipment.ts`）；`useNotify`；`ContactDetailModal`（既有元件）。API：`GET /api/contacts`（deep）、`POST /api/contacts/:id/logs`。
- Produces: 供 Task 3 以 `<TodayFollowUp />` 掛載（Nuxt 元件自動匯入，無 props）。

- [ ] **Step 1: 建立元件**（無測試框架；此為 UI，於 Task 3 掛好後以瀏覽器驗證）

```vue
<script setup lang="ts">
// 名單「今日跟進」分頁：從使用者自己的名單挑出今天該先找的人，用熱度分數排序。
// 純站內、資料範圍與總名單相同（各看各的）；熱度公式來自 shared/utils/leadScore.ts。
const notify = useNotify()

// deep: true → 樂觀更新能即時反映（比照 ContactList）。與 ContactList 共用同一 /api/contacts 快取（useFetch 依 URL 去重）。
const { data: contacts, refresh: refreshContacts } = await useFetch<Contact[]>('/api/contacts', { deep: true })

const today = todayStr()

// 入列 + 依熱度分數排序（高→低）
const list = computed(() =>
  (contacts.value ?? [])
    .filter(c => isTodayFollowUp(c, today))
    .map(c => ({ c, score: leadScore(c, today), reason: topReason(c, today) }))
    .sort((a, b) => b.score - a.score)
)

function reasonColor(kind?: string) {
  return kind === 'overdue' ? 'error' : kind === 'due' ? 'warning' : 'neutral'
}

// 勾「今天已跟進」＝新增一筆今天的跟進紀錄；後端回算 lastFollowUp/nextFollowUp，重新整理後該人離開清單。
async function markDone(c: Contact) {
  try {
    await $fetch(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: today, content: '' } })
    await refreshContacts()
  } catch {
    notify.error('更新失敗')
    await refreshContacts()
  }
}

// 明細 modal（重用總名單的 ContactDetailModal）
const metaOpen = ref(false)
const metaContact = ref<Contact | null>(null)
function openMeta(c: Contact) {
  metaContact.value = c
  metaOpen.value = true
}
function onMetaSaved(updated: Contact) {
  const row = (contacts.value ?? []).find(x => x.id === updated.id)
  if (row) Object.assign(row, updated)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">
        今日跟進
      </h1>
      <UBadge
        v-if="list.length"
        color="primary"
        variant="subtle"
        size="lg"
      >
        今天有 {{ list.length }} 位待跟進
      </UBadge>
    </div>

    <div
      v-if="!list.length"
      class="text-muted text-center py-16"
    >
      今天沒有待跟進的名單 🎉
    </div>

    <ul
      v-else
      class="space-y-2"
    >
      <li
        v-for="{ c, score, reason } in list"
        :key="c.id"
        class="flex items-center gap-3 border border-default rounded-lg px-4 py-3 hover:bg-elevated/30"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium">{{ c.name }}</span>
            <span
              v-if="c.location"
              class="text-muted text-sm"
            >{{ c.location }}</span>
            <UBadge
              v-if="reason"
              :color="reasonColor(reason.kind)"
              variant="subtle"
              size="sm"
            >
              {{ reason.label }}
            </UBadge>
            <span class="text-dimmed text-xs tabular-nums">熱度 {{ score }}</span>
          </div>
          <div class="text-muted text-sm mt-0.5">
            上次跟進：{{ timeAgo(c.lastFollowUp) }}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            icon="i-lucide-check"
            color="primary"
            variant="soft"
            size="sm"
            @click="markDone(c)"
          >
            <span class="hidden sm:inline">今天已跟進</span>
          </UButton>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            title="明細"
            @click="openMeta(c)"
          />
        </div>
      </li>
    </ul>

    <ContactDetailModal
      v-model:open="metaOpen"
      :contact="metaContact"
      @saved="onMetaSaved"
    />
  </div>
</template>
```

- [ ] **Step 2: 型別檢查 + lint**
  Run: `just typecheck && just lint`
  Expected: 無錯誤（`isTodayFollowUp`/`leadScore`/`topReason`、`Contact`、`timeAgo`、`todayStr`、`ContactDetailModal` 皆可解析）

- [ ] **Step 3: Commit**

```bash
git add app/components/TodayFollowUp.vue
git commit -m "feat(crm): 新增今日跟進清單元件 TodayFollowUp"
```

---

### Task 3: 掛進名單頁 `app/pages/crm.vue`（新分頁 + 設為預設）

**Files:**
- Modify: `app/pages/crm.vue`

**Interfaces:**
- Consumes: `<TodayFollowUp />`（Task 2）。

- [ ] **Step 1: 加分頁並設為預設** — 把 `tabItems` 最前面加一筆、`UTabs` 的 `default-value` 改為 `today`、新增對應 slot

原（`app/pages/crm.vue`）:
```ts
const tabItems = [
  { label: '每日任務', icon: 'i-lucide-list-todo', slot: 'daily', value: 'daily' },
  { label: '總名單', icon: 'i-lucide-contact', slot: 'contacts', value: 'contacts' }
]
```
改為:
```ts
const tabItems = [
  { label: '今日跟進', icon: 'i-lucide-target', slot: 'today', value: 'today' },
  { label: '每日任務', icon: 'i-lucide-list-todo', slot: 'daily', value: 'daily' },
  { label: '總名單', icon: 'i-lucide-contact', slot: 'contacts', value: 'contacts' }
]
```

`<UTabs>` 的 `default-value="daily"` → `default-value="today"`。

在 template 內、`#daily` slot 之前加入:
```vue
      <template #today>
        <TodayFollowUp />
      </template>
```

- [ ] **Step 2: 型別檢查 + lint**
  Run: `just typecheck && just lint`
  Expected: 無錯誤

- [ ] **Step 3: 瀏覽器手動驗證**
  Run: `just dev`，登入具 `crm` 權限的帳號，開 `/crm`
  Expected:
  - 預設停在「今日跟進」分頁。
  - 逾期 / 今天到期 / 待啟動 的名單出現，逾期天數多者排前面；每列有理由 chip 與熱度分。
  - 勾「今天已跟進」後該列消失（已寫入今天的跟進紀錄）。
  - 「明細」開啟 `ContactDetailModal`。
  - 沒有待跟進時顯示「今天沒有待跟進的名單 🎉」。

- [ ] **Step 3.5: 清掉暫存測試檔**（不進版控）
  Run: `rm -f "$SCRATCH/leadScore.test.ts"`

- [ ] **Step 4: Commit**

```bash
git add app/pages/crm.vue
git commit -m "feat(crm): 名單頁新增今日跟進分頁並設為預設"
```

---

## Self-Review

**Spec coverage:**
- 熱度公式（入列規則 + 分數表 + 主要理由）→ Task 1 ✅
- 做法 3（shared 純函式、不動 DB/API）→ Task 1 檔案位置與 Global Constraints ✅
- 畫面：新分頁「今日跟進」設為預設、卡片列表、理由 chip、熱度分、上次跟進、Done、明細、空狀態 → Task 2 + Task 3 ✅
- 資料範圍不變（各看各的、重用 `/api/contacts` 已 `ownedBy` 過濾）→ Global Constraints + Task 2 ✅
- 非目標（不碰 LINE）→ 無任何 LINE 相關任務 ✅

**Placeholder scan:** 無 TBD/TODO；每個會動到程式的步驟都附完整程式碼與確切指令。✅

**Type consistency:** Task 2 使用的 `isTodayFollowUp` / `leadScore` / `topReason` 名稱與簽章、`LeadReason.kind` 值（`overdue`/`due`/`pending`）皆與 Task 1 定義一致；`reasonColor` 接受 `reason.kind`，`reason` 可能為 `null`（模板以 `v-if="reason"` 守住）。✅

**Note（測試策略）:** 專案無自動化測試框架。純函式 `leadScore.ts` 以 `bun` 直接執行暫存測試檔驗證（真實 import 該檔）；UI 以 `just typecheck` / `just lint` + `bun dev` 手動檢查——符合專案現況（CLAUDE.md：無自動化測試，以 headless Chrome 驗證）。
