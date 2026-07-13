# 家聚活動紀錄改用課表式日曆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把家聚點「活動紀錄」分頁從清單改成與課表相同的 FullCalendar 日曆（月/週/日、點空白格快建、點事件詳情/編輯、拖曳改期）。

**Architecture:** 純前端。改寫 `app/components/GatheringRecords.vue`（保留現有豐富編輯 modal 與其 save/remove/建議邏輯，外面換成日曆 + 兩個浮動 popover），並新增唯讀詳情元件 `app/components/GatheringDetailPopover.vue`。後端 `/api/gatherings` 的 GET/POST/PUT/DELETE 已足夠，無 schema/API/migration 變更。

**Tech Stack:** Nuxt 4 + Vue 3 `<script setup>`、Nuxt UI（UPopover/USwitch/USelect/UInput/UModal…）、FullCalendar（@fullcalendar/vue3 + daygrid/timegrid/interaction）、TypeScript。

## Global Constraints

- 一律用 `just`（自動 pin node v24）：`just typecheck`、`just lint`、`just dev`。
- UI 文案與註解用**繁體中文**，比照現有風格。
- 顏色以名稱存取，Tailwind class 必須字面寫出；FullCalendar 用 `colorHex()` 取真實 hex（`app/utils/schedule.ts`）。
- 權限：編輯能力一律經 `useCanEdit('gathering')`；前端隱藏只是外觀，後端 `requirePage('gathering')` 才是權威（本次不改後端）。
- 家聚**不分教室、無重複、單一顏色**：不得引入教室分頁、重複展開、scope modal、顏色欄位。
- FullCalendar 必須包在 `<ClientOnly>`。本專案無自動化測試框架 → 每個 task 以 `just typecheck` + `just lint` + 瀏覽器實測驗證，並頻繁 commit（Conventional Commits，可用中文）。
- 統一顏色常數：`const GATHERING_COLOR = 'amber'`（key 存在於 `COLOR_HEX`）。

---

## File Structure

- **Create** `app/components/GatheringDetailPopover.vue` — 唯讀詳情浮層（家聚欄位：日期/時間、地點、地圖、操鍋/助手/採買 + 編輯/刪除鈕）。單一職責、可獨立理解。
- **Modify** `app/components/GatheringRecords.vue` — 清單 → 日曆 + 快建 popover + 詳情 popover 觸發；保留原有 modal 表單、`save()`/`remove()`、名單/食譜/活動名稱建議、`openPicker`/`selectAllOnFocus`。
- **Reuse (no change)** `app/utils/schedule.ts`：`HOUR_OPTIONS`、`MINUTE_OPTIONS`、`dateLabel`、`timeLabel`、`colorHex`、`COLOR_HEX`、`colorDot`。

`GatheringDetail` 型別在本次定義於 `GatheringRecords.vue` 並 `export`，供 popover 元件 `import type` 使用（家聚專用，不放 `schedule.ts` 以免與課表 `EventDetail` 混淆）。

---

### Task 1: 新增 `GatheringDetailPopover.vue` 唯讀詳情元件

**Files:**
- Create: `app/components/GatheringDetailPopover.vue`
- Modify: `app/components/GatheringRecords.vue`（僅新增並 export `GatheringDetail` 型別，供本元件 import）

**Interfaces:**
- Consumes: `dateLabel`, `timeLabel`, `colorHex` from `~/utils/schedule`（auto-import 亦可，但顏色點用 hex inline style）。
- Produces:
  - `GatheringDetail` 型別（在 `GatheringRecords.vue` 內 `export`）：
    ```ts
    export interface GatheringDetail {
      refId: number
      name: string
      dateLabel: string
      timeLabel: string
      location: string
      mapUrl: string
      cook: string
      assistant: string
      shopper: string
    }
    ```
  - 元件 props `{ detail: GatheringDetail, canEdit: boolean }`；emits `edit`、`delete`。

- [ ] **Step 1: 先在 `GatheringRecords.vue` 的 `<script setup>` 頂端 export 型別**

在 `GatheringRecords.vue` 現有 `const canEdit = useCanEdit('gathering')` 之上插入：

```ts
// 唯讀詳情浮層的資料形狀（家聚專用；欄位與課表 EventDetail 不同）
export interface GatheringDetail {
  refId: number
  name: string
  dateLabel: string
  timeLabel: string
  location: string
  mapUrl: string
  cook: string
  assistant: string
  shopper: string
}
```

- [ ] **Step 2: 建立 `app/components/GatheringDetailPopover.vue`**

```vue
<script setup lang="ts">
import type { GatheringDetail } from './GatheringRecords.vue'
import { colorHex } from '~/utils/schedule'

// 唯讀詳情浮層：顯示被點家聚活動的資訊；有 gathering 權才顯示編輯/刪除
defineProps<{
  detail: GatheringDetail
  canEdit: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

// 角色欄（有值才顯示）
const ROLE_FIELDS: { key: 'cook' | 'assistant' | 'shopper', label: string }[] = [
  { key: 'cook', label: '操鍋' },
  { key: 'assistant', label: '助手' },
  { key: 'shopper', label: '採買' }
]
</script>

<template>
  <div class="w-[min(20rem,calc(100vw-1.5rem))] p-4">
    <!-- 標題列：顏色點＋名稱，右側編輯/刪除 -->
    <div class="flex items-start gap-2">
      <span
        class="mt-1.5 size-3 shrink-0 rounded-full"
        :style="{ backgroundColor: colorHex('amber') }"
      />
      <h3 class="flex-1 text-base font-semibold leading-6">
        {{ detail.name }}
      </h3>
      <div
        v-if="canEdit"
        class="flex shrink-0 gap-1"
      >
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="編輯"
          @click="emit('edit')"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          aria-label="刪除"
          @click="emit('delete')"
        />
      </div>
    </div>

    <!-- 日期 / 時間 -->
    <div class="mt-3 space-y-2 text-sm">
      <div class="text-muted flex items-center gap-2">
        <UIcon
          name="i-lucide-clock"
          class="size-4 shrink-0"
        />
        <span class="text-default">{{ detail.dateLabel }} · {{ detail.timeLabel }}</span>
      </div>
      <div
        v-if="detail.location"
        class="text-muted flex items-center gap-2"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0"
        />
        <span class="text-default">{{ detail.location }}</span>
      </div>
      <a
        v-if="detail.mapUrl"
        :href="detail.mapUrl"
        target="_blank"
        rel="noopener"
        class="text-primary inline-flex items-center gap-1"
      >
        <UIcon
          name="i-lucide-external-link"
          class="size-4 shrink-0"
        />開啟地圖
      </a>
    </div>

    <!-- 角色（有值才顯示） -->
    <div
      v-if="ROLE_FIELDS.some(f => detail[f.key])"
      class="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-sm"
    >
      <template
        v-for="f in ROLE_FIELDS"
        :key="f.key"
      >
        <div
          v-if="detail[f.key]"
          class="flex gap-1"
        >
          <span class="text-muted">{{ f.label }}</span>
          <span class="text-default">{{ detail[f.key] }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
```

> 顏色點用 `:style` inline hex（`colorHex('amber')`），避免動態 Tailwind class；與 Global Constraints 一致。

- [ ] **Step 3: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 通過（此時元件尚無 consumer，僅型別/語法檢查）。ESLint 若要求 self-closing 或屬性順序，依提示修正。

- [ ] **Step 4: Commit**

```bash
git add app/components/GatheringDetailPopover.vue app/components/GatheringRecords.vue
git commit -m "feat: 家聚活動唯讀詳情浮層元件 (spec 0024)"
```

---

### Task 2: `GatheringRecords.vue` 以 FullCalendar 取代清單（唯讀顯示）

先把清單換成日曆並正確渲染事件（單一顏色、月/週/日），保留 header 的「新增活動」鈕與現有 modal 可運作。互動（快建/詳情/拖曳）留待 Task 3，本任務結束時：能在日曆看到既有家聚、能用「新增活動」鈕開 modal 新增。

**Files:**
- Modify: `app/components/GatheringRecords.vue`

**Interfaces:**
- Consumes: Task 1 的 `GatheringDetail`（本任務尚未使用，Task 3 才接）。`Gathering` 型別（既有 auto-import）。`colorHex`, `COLOR_HEX`（`~/utils/schedule`，auto-import）。
- Produces: `calendarOptions` computed、`calendarEvents` computed、`isTimeGrid` ref、`onDatesSet`、`toLocalDateStr`、`GATHERING_COLOR` 常數，供 Task 3 使用。

- [ ] **Step 1: 補 import 與常數**

在 `GatheringRecords.vue` `<script setup lang="ts">` 第一行後加入 FullCalendar 相關 import 與顏色常數（放在檔案頂端 import 區）：

```ts
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type { CalendarOptions, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'

// 家聚活動在日曆上一律用同一色（家聚無顏色欄位）
const GATHERING_COLOR = 'amber'
```

- [ ] **Step 2: 加入事件映射、時間格旗標、日期工具、日曆設定**

在 `<script setup>` 中（現有 `const { data: gatherings, refresh } = ...` 之後）插入：

```ts
// 把每筆家聚活動轉成 FullCalendar 事件（單次、單一顏色）
const calendarEvents = computed(() =>
  (gatherings.value ?? []).map(g => ({
    title: g.name,
    start: g.startTime ? `${g.date}T${g.startTime}` : g.date,
    end: g.endTime ? `${g.date}T${g.endTime}` : undefined,
    allDay: !g.startTime,
    color: colorHex(GATHERING_COLOR),
    extendedProps: { refId: g.id }
  }))
)

// 目前是否為時間格（週/日）檢視：只有時間格才顯示事件時間、圈選才帶時段
const isTimeGrid = ref(false)

// datesSet：換月/換檢視/初次渲染時更新時間格旗標（家聚不需重新展開重複事件）
function onDatesSet(arg: { view: { type: string } }) {
  isTimeGrid.value = arg.view.type.startsWith('timeGrid')
}

// Date → 本地時區 'YYYY-MM-DD'
function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhTwLocale,
  firstDay: 0,
  dayHeaderFormat: { weekday: 'narrow' },
  dayCellContent: (arg: { date: Date }) => String(arg.date.getDate()),
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  buttonText: { today: '今天', month: '月', week: '週', day: '日' },
  slotMinTime: '06:00:00',
  slotMaxTime: '23:00:00',
  allDaySlot: true,
  allDayText: '全天',
  height: 'auto',
  events: calendarEvents.value,
  displayEventTime: isTimeGrid.value,
  editable: canEdit.value,
  selectable: canEdit.value,
  selectMirror: true,
  eventStartEditable: canEdit.value,
  eventDurationEditable: false,
  // 以下三個 handler 於 Task 3 實作；此任務先只掛 datesSet
  datesSet: onDatesSet
}))
```

- [ ] **Step 3: 換掉 `<template>` 的清單為日曆**

把 `<template>` 中「目前沒有家聚活動」的 `v-if` 區塊與其下的 `<div class="space-y-2"> … v-for g in gatherings …</div>`（現有清單，約 `GatheringRecords.vue:146-168`）整段**刪除**，改為：

```vue
    <p
      v-if="canEdit"
      class="text-muted mb-2 text-sm"
    >
      <UIcon
        name="i-lucide-mouse-pointer-click"
        class="size-4 align-text-bottom"
      />
      點空白日期可新增、點活動可檢視/編輯、直接拖曳可改日期。
    </p>

    <div class="schedule-calendar">
      <ClientOnly>
        <FullCalendar :options="calendarOptions" />
        <template #fallback>
          <div class="text-muted py-16 text-center">
            月曆載入中…
          </div>
        </template>
      </ClientOnly>
    </div>
```

> 保留最上方 `活動紀錄` 標題列與「新增活動」`UButton`（現有 `openCreate`）。保留其下的 `<UModal>` 整段（表單、save/remove）不動。

- [ ] **Step 4: 讓 FullCalendar 沿用課表的明暗色樣式**

在 `GatheringRecords.vue` 末端加入（或確認已有）`<style>` 區塊。複製 `app/pages/index.vue` 檔尾 `/* 讓 FullCalendar 配合 Nuxt UI 的明暗色與字級 */` 之後、`.schedule-calendar` 相關的整段 CSS 到本檔（class 名沿用 `.schedule-calendar`）。

先查看來源：

Run: `sed -n '1280,1349p' app/pages/index.vue`
把其中 `<style>…</style>` 內以 `.schedule-calendar` 為前綴的規則整段貼入 `GatheringRecords.vue` 的 `<style scoped>`（若原為全域 `:deep` 寫法，保持相同寫法）。

- [ ] **Step 5: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 通過。若 ESLint 報 `onDatesSet` 型別或未用變數（Task 3 才用的 import 型別 `EventClickArg` 等），暫時允許——它們在 Task 3 會被使用；若 lint 擋 unused，先在 Task 3 一起加 handler，或本步驟先不 import 尚未使用的型別，改在 Task 3 補。**建議：本任務只 import 目前用到的 `CalendarOptions`，其餘型別（`EventClickArg`/`EventDropArg`/`DateSelectArg`/`DateClickArg`）留到 Task 3 再加。**

- [ ] **Step 6: 瀏覽器實測**

Run: `just dev`（背景），以超級管理員登入 `/gathering` → 活動紀錄 tab。
Expected: 日曆渲染，既有家聚出現在對應日期、皆為 amber 色；可切月/週/日；「新增活動」鈕仍能開 modal 新增並存檔、日曆隨即出現新事件。此時點空白格/事件尚無反應（Task 3）。

- [ ] **Step 7: Commit**

```bash
git add app/components/GatheringRecords.vue
git commit -m "feat: 家聚活動紀錄改以 FullCalendar 顯示 (spec 0024)"
```

---

### Task 3: 快建 popover、詳情 popover、拖曳改期

補齊三件套互動：點空白格/圈選 → 快建浮層；點事件 → 詳情浮層（編輯/刪除）；拖曳 → 改日期。

**Files:**
- Modify: `app/components/GatheringRecords.vue`

**Interfaces:**
- Consumes: Task 1 `GatheringDetail` 與 `GatheringDetailPopover` 元件；Task 2 的 `calendarOptions`/`isTimeGrid`/`toLocalDateStr`/`GATHERING_COLOR`；`form`/`blank()`/`openRow()`/`save()`/`remove()`/`editingId`（現有）；`HOUR_OPTIONS`/`MINUTE_OPTIONS`/`dateLabel`/`timeLabel`（`~/utils/schedule`）。
- Produces: 無（終端功能）。

- [ ] **Step 1: 補齊 Task 2 暫緩的型別 import**

確認 `<script setup>` 頂端 import 含（Task 2 若已加可略）：

```ts
import type { CalendarOptions, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
```

- [ ] **Step 2: 加入浮層狀態、時間下拉 model、詳情資料**

在 `<script setup>` 加入（放在 `open`/`editingId` 等現有明細 modal 狀態附近）：

```ts
/* ---------- Google 日曆式浮層 ---------- */
const quickOpen = ref(false)
const detailOpen = ref(false)
const anchorRef = ref<{ x: number, y: number } | null>(null)
const virtualAnchor = computed(() => {
  const a = anchorRef.value
  if (!a) return undefined
  const rect = { x: a.x, y: a.y, top: a.y, left: a.x, right: a.x, bottom: a.y, width: 0, height: 0 }
  return { getBoundingClientRect: () => rect }
})
function setAnchor(ev: MouseEvent) {
  anchorRef.value = { x: ev.clientX, y: ev.clientY }
}
const detail = ref<GatheringDetail | null>(null)

// 「不指定（整天）」的哨兵值：Reka Select 不允許空字串
const ALL_DAY = '__allday__'
const hourItems = [{ label: '不指定', value: ALL_DAY }, ...HOUR_OPTIONS]
const minuteItems = MINUTE_OPTIONS

// 把 form.startTime/endTime（'HH:MM' 或 ''）拆成時/分兩個下拉的 v-model
function hourModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[0]! : ALL_DAY,
    set: (v: string) => {
      form[key] = v === ALL_DAY ? '' : `${v}:${form[key] ? form[key].split(':')[1] : '00'}`
    }
  })
}
function minuteModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[1]! : '00',
    set: (v: string) => {
      form[key] = `${form[key] ? form[key].split(':')[0] : '00'}:${v}`
    }
  })
}
const startHour = hourModel('startTime')
const startMinute = minuteModel('startTime')
const endHour = hourModel('endTime')
const endMinute = minuteModel('endTime')

// 快建的「全天」開關：關掉時帶預設時段 19:00–21:00（家聚預設）
const quickAllDay = computed({
  get: () => !form.startTime,
  set: (v: boolean) => {
    if (v) {
      form.startTime = ''
      form.endTime = ''
    } else {
      form.startTime = '19:00'
      form.endTime = '21:00'
    }
  }
})

// Date → 本地 'HH:MM'
function toLocalTimeStr(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function plusOneHour(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const nh = ((h ?? 0) + 1) % 24
  return `${String(nh).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
}
```

> 需要 `HOUR_OPTIONS`/`MINUTE_OPTIONS`/`dateLabel`/`timeLabel` —皆為 `~/utils/schedule` 的 auto-import，無需顯式 import；若 lint 要求顯式，`import { HOUR_OPTIONS, MINUTE_OPTIONS, dateLabel, timeLabel } from '~/utils/schedule'`。

- [ ] **Step 3: 加入日曆互動 handler**

在 `<script setup>` 加入四個 handler（`openCreate`/`openRow`/`save`/`remove` 已存在，直接沿用）：

```ts
// 點空白格 → 快建浮層
function onDateClick(info: DateClickArg) {
  if (!canEdit.value) return
  Object.assign(form, blank())
  editingId.value = null
  form.date = info.dateStr.slice(0, 10)
  if (info.dateStr.includes('T') && !info.allDay) {
    const start = toLocalTimeStr(info.date)
    form.startTime = start
    form.endTime = plusOneHour(start)
  }
  setAnchor(info.jsEvent as MouseEvent)
  detailOpen.value = false
  quickOpen.value = true
}

// 圈選一段（月＝多日、時間格＝時段）→ 快建浮層；單筆只存起始日
function onSelect(info: DateSelectArg) {
  if (!canEdit.value) return
  Object.assign(form, blank())
  editingId.value = null
  form.date = toLocalDateStr(info.start)
  if (!info.allDay) {
    form.startTime = toLocalTimeStr(info.start)
    form.endTime = toLocalTimeStr(info.end)
  }
  setAnchor(info.jsEvent as MouseEvent)
  detailOpen.value = false
  quickOpen.value = true
}

// 點事件 → 唯讀詳情浮層
function onEventClick(info: EventClickArg) {
  const refId = info.event.extendedProps.refId as number
  const g = gatherings.value?.find(x => x.id === refId)
  if (!g) return
  detail.value = {
    refId,
    name: g.name,
    dateLabel: dateLabel(g.date),
    timeLabel: timeLabel(g.startTime, g.endTime),
    location: g.location ?? '',
    mapUrl: g.mapUrl ?? '',
    cook: g.cook ?? '',
    assistant: g.assistant ?? '',
    shopper: g.shopper ?? ''
  }
  setAnchor(info.jsEvent as MouseEvent)
  quickOpen.value = false
  detailOpen.value = true
}

// 快建「更多選項」→ 把目前內容帶進完整 modal
function openMore() {
  quickOpen.value = false
  open.value = true
}

// 詳情「編輯」→ 開完整 modal（預填該筆）
function openDetailEdit() {
  const g = gatherings.value?.find(x => x.id === detail.value?.refId)
  if (!g) return
  detailOpen.value = false
  openRow(g)
}

// 詳情「刪除」
async function onDetailDelete() {
  if (!detail.value) return
  editingId.value = detail.value.refId
  detailOpen.value = false
  await remove()
}

// 拖曳事件 → 改日期（時間格拖曳連時間一起，保留時長）
async function onEventDrop(info: EventDropArg) {
  if (!canEdit.value) {
    info.revert()
    return
  }
  const refId = info.event.extendedProps.refId as number
  const g = gatherings.value?.find(x => x.id === refId)
  if (!g || !info.event.start) {
    info.revert()
    return
  }
  const newDate = toLocalDateStr(info.event.start)
  let startTime = g.startTime ?? ''
  let endTime = g.endTime ?? ''
  if (isTimeGrid.value && !info.event.allDay) {
    startTime = toLocalTimeStr(info.event.start)
    endTime = info.event.end ? toLocalTimeStr(info.event.end) : plusOneHour(startTime)
  }
  try {
    await $fetch(`/api/gatherings/${refId}`, {
      method: 'PUT',
      body: { ...g, date: newDate, startTime, endTime }
    })
    await refresh()
    notify.success(`已移到 ${newDate}${startTime ? ` ${startTime}` : ''}`)
  } catch {
    notify.error('改期失敗')
    info.revert()
  }
}
```

> `blank()`/`open`/`editingId`/`openRow`/`remove`/`save`/`notify`/`refresh` 皆為 `GatheringRecords.vue` 現有符號。`onDetailDelete` 藉由設 `editingId` 後呼叫既有 `remove()` 沿用其確認流程。

- [ ] **Step 4: 把四個 handler 掛進 `calendarOptions`**

在 Task 2 的 `calendarOptions` computed 的 `datesSet: onDatesSet` 上方，補上：

```ts
  eventClick: onEventClick,
  dateClick: onDateClick,
  select: onSelect,
  eventDrop: onEventDrop,
```

- [ ] **Step 5: 在 `<template>` 加入兩個 popover**

在日曆 `<div class="schedule-calendar">…</div>` 之後、現有 `<UModal>` 之前插入：

```vue
    <!-- 快建浮層（點空白格） -->
    <UPopover
      v-model:open="quickOpen"
      :reference="virtualAnchor"
      :content="{ side: 'bottom', align: 'start' }"
    >
      <template #content>
        <div class="w-[min(20rem,calc(100vw-1.5rem))] space-y-3 p-4">
          <p class="text-muted text-sm">
            {{ dateLabel(form.date) }}
          </p>
          <UInput
            v-model="form.name"
            autofocus
            placeholder="加入活動名稱"
            size="lg"
            class="w-full"
            @keydown.enter="save"
          />
          <div class="flex items-center gap-2 text-sm">
            <USwitch
              v-model="quickAllDay"
              size="sm"
            />
            <span class="text-muted">全天</span>
          </div>
          <div
            v-if="!quickAllDay"
            class="grid grid-cols-2 gap-2"
          >
            <div class="grid grid-cols-2 gap-1">
              <USelect
                v-model="startHour"
                :items="hourItems"
                placeholder="時"
                class="w-full"
              />
              <USelect
                v-model="startMinute"
                :items="minuteItems"
                :disabled="startHour === ALL_DAY"
                placeholder="分"
                class="w-full"
              />
            </div>
            <div class="grid grid-cols-2 gap-1">
              <USelect
                v-model="endHour"
                :items="hourItems"
                placeholder="時"
                class="w-full"
              />
              <USelect
                v-model="endMinute"
                :items="minuteItems"
                :disabled="endHour === ALL_DAY"
                placeholder="分"
                class="w-full"
              />
            </div>
          </div>
          <div class="flex items-center justify-between pt-1">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="openMore"
            >
              更多選項
            </UButton>
            <UButton
              :loading="saving"
              @click="save"
            >
              儲存
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>

    <!-- 詳情浮層（點事件） -->
    <UPopover
      v-model:open="detailOpen"
      :reference="virtualAnchor"
      :content="{ side: 'bottom', align: 'start' }"
    >
      <template #content>
        <GatheringDetailPopover
          v-if="detail"
          :detail="detail"
          :can-edit="canEdit"
          @edit="openDetailEdit"
          @delete="onDetailDelete"
        />
      </template>
    </UPopover>
```

> `save()`（現有）在成功時已 `open.value = false` 並 `refresh()`；本任務讓它同時關快建浮層——在 `save()` 成功分支加一行 `quickOpen.value = false`（若 `save` 目前只設 `open.value=false`，補上 `quickOpen.value = false`）。

- [ ] **Step 6: 在 `save()` 成功分支關閉快建浮層**

找到 `GatheringRecords.vue` 現有 `save()` 內 `open.value = false`（成功後那行），其後補：

```ts
    quickOpen.value = false
```

- [ ] **Step 7: typecheck + lint**

Run: `just typecheck && just lint`
Expected: 通過。修正 ESLint 屬性順序/self-closing 等格式提示。

- [ ] **Step 8: 瀏覽器實測（超級管理員）**

Run: `just dev`（背景），登入後至 `/gathering` 活動紀錄 tab：
- 點月檢視空白格 → 快建浮層出現、日期正確；輸入名稱、切「全天」開/關（關時預設 19:00–21:00）；`儲存` → 事件出現。
- 點週/日檢視時段圈選 → 快建帶入起訖時間。
- 快建「更多選項」→ 完整 modal 帶入已填名稱/時間，補操鍋/食譜後存檔正確。
- 點事件 → 詳情浮層顯示 日期·時間 / 地點 / 操鍋·助手·採買，地圖連結可開；「編輯」開 modal、改欄位存檔;「刪除」確認後事件消失。
- 拖曳事件到別天（月檢視）→ date 更新、toast 顯示新日期;週/日檢視拖曳連時間更新。

- [ ] **Step 9: 瀏覽器實測（無 gathering 權者）**

以只授其他頁、無 `gathering` 權的一般使用者（或登出的匿名者）開 `/gathering`：
Expected: 看得到日曆與事件、點事件可看詳情浮層（無編輯/刪除鈕）；無「新增活動」鈕、點空白格無快建、無法拖曳事件（`editable:false`）。

- [ ] **Step 10: Commit**

```bash
git add app/components/GatheringRecords.vue
git commit -m "feat: 家聚日曆快建/詳情浮層與拖曳改期 (spec 0024)"
```

---

## Self-Review

**Spec coverage（對照 `specs/0024`）：**
- 日曆本體、事件映射、單一顏色、月/週/日 → Task 2 ✓
- 無教室分頁/無重複/無 scope → 三個 task 皆未引入 ✓
- 快建 popover（名稱、全天、時分、更多選項、儲存）→ Task 3 Step 5/6 ✓
- 詳情 popover（唯讀 + 編輯/刪除）→ Task 1 + Task 3 ✓
- 完整 modal 沿用 → Task 2 保留、Task 3 由 openMore/openDetailEdit 開啟 ✓
- 拖曳改期（含時間格連時間）→ Task 3 `onEventDrop` ✓
- 重用 schedule.ts 工具 → 各 task Interfaces 標明 ✓
- 權限 `useCanEdit('gathering')` → 沿用現有 `canEdit`，Task 3 Step 9 驗證 ✓
- 無後端變更 → 確認 `/api/gatherings` GET/POST/PUT/DELETE 已具備（Task 皆不碰 server/）✓

**Placeholder scan：** 無 TBD/TODO；所有程式步驟均含完整程式碼；驗證步驟含實際指令與預期。

**Type consistency：** `GatheringDetail`（Task 1 定義、Task 3 建構、popover 消費）欄位一致：`refId/name/dateLabel/timeLabel/location/mapUrl/cook/assistant/shopper`。`GATHERING_COLOR='amber'` 與 popover 內 `colorHex('amber')` 一致（建議 Task 3 檢查時，若要更嚴謹可把 popover 改成 prop 傳色；本版因單一色直接寫 'amber'，已於 Task 1 註記）。handler 名稱（`onDateClick/onSelect/onEventClick/onEventDrop/openMore/openDetailEdit/onDetailDelete`）在 Step 3 定義、Step 4 掛載、Step 5 模板引用，一致。
