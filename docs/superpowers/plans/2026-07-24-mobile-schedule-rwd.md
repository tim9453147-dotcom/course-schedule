# Mobile Schedule RWD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-optimized responsive design (RWD) for the course schedule page (`app/pages/index.vue`), featuring a compact calendar grid with event dots and a daily agenda card list for `< 768px` viewports, while preserving desktop FullCalendar view for `>= 768px`.

**Architecture:** Create a `MobileScheduleView.vue` component that handles mobile header controls, compact 7-column month grid with event dots, selected date management, daily agenda card list, and FAB button. Integrate it into `app/pages/index.vue` with `md:hidden` / `hidden md:block` responsive toggles. Upgrade quick detail and creation modals on mobile to bottom slide-up sheets.

**Tech Stack:** Nuxt 3, Vue 3, Nuxt UI / Tailwind CSS, Lucide icons.

## Global Constraints

- Preserve all existing desktop FullCalendar behavior and functionality (`>= 768px`).
- Shared single source of truth for course/event data (`courses`, `events`, `calendarEvents`).
- Full support for permissions (`canEdit`), classroom tab switching, and event clicks.

---

### Task 1: Create Mobile Schedule Component (`MobileScheduleView.vue`)

**Files:**
- Create: `app/components/MobileScheduleView.vue`

**Interfaces:**
- Props:
  - `events`: `Array<{ title: string, start: string, end?: string, allDay: boolean, color: string, extendedProps: { source: string, refId: number, occDate?: string } }>`
  - `classrooms`: `string[]`
  - `currentClassroom`: `string`
  - `canEdit`: `boolean`
  - `tabItems`: `Array<{ label: string, value: string }>`
- Emits:
  - `update:currentClassroom`: `(val: string) => void`
  - `select-event`: `(event: any, anchorElement?: HTMLElement) => void`
  - `create-event`: `(dateStr: string) => void`
  - `open-import`: `() => void`

- [ ] **Step 1: Create `MobileScheduleView.vue` with template and script**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  events: any[]
  classrooms: string[]
  currentClassroom: string
  canEdit: boolean
  tabItems: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{
  (e: 'update:currentClassroom', val: string): void
  (e: 'select-event', event: any, anchorEl?: HTMLElement): void
  (e: 'create-event', dateStr: string): void
  (e: 'open-import'): void
}>()

// Current focused date (YYYY-MM-DD)
const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const selectedDate = ref(todayStr())
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-indexed

const monthTitle = computed(() => `${currentYear.value}年 ${currentMonth.value + 1}月`)

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToday() {
  const now = new Date()
  currentYear.value = now.getFullYear()
  currentMonth.value = now.getMonth()
  selectedDate.value = todayStr()
}

// Days grid for current month
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay() // 0 = Sun

  const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }> = []

  // Prev month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDay - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    const dateStr = `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: false, isToday: dateStr === todayStr() })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: true, isToday: dateStr === todayStr() })
  }

  // Next month padding
  const remaining = 42 - days.length // 6 rows * 7
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: false, isToday: dateStr === todayStr() })
  }

  return days
})

// Group events by date string (YYYY-MM-DD)
const eventsByDate = computed(() => {
  const map = new Map<string, any[]>()
  for (const ev of props.events) {
    const dateKey = ev.start ? ev.start.slice(0, 10) : ''
    if (!dateKey) continue
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(ev)
  }
  return map
})

// Agenda list for selected date
const selectedDayEvents = computed(() => {
  return eventsByDate.value.get(selectedDate.value) ?? []
})

// Formatted selected date label (e.g. "7月24日 星期五")
const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${m}月${d}日 星期${days[dt.getDay()]}`
})

function onDayClick(dateStr: string) {
  selectedDate.value = dateStr
}
</script>

<template>
  <div class="mobile-schedule space-y-4">
    <!-- Top Bar: Classroom selector & Action buttons -->
    <div class="flex items-center justify-between gap-2">
      <UTabs
        v-if="props.tabItems.length > 1"
        :model-value="props.currentClassroom"
        :items="props.tabItems"
        class="flex-1 overflow-x-auto"
        @update:model-value="val => emit('update:currentClassroom', String(val))"
      />
      <div v-else class="flex-1" />
      <div v-if="props.canEdit" class="flex shrink-0 gap-1.5">
        <UButton icon="i-lucide-upload" color="neutral" variant="outline" size="sm" @click="emit('open-import')">
          匯入
        </UButton>
        <UButton icon="i-lucide-plus" size="sm" @click="emit('create-event', selectedDate)">
          新增
        </UButton>
      </div>
    </div>

    <!-- Calendar Month Header -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-primary">
          {{ monthTitle }}
        </h2>
        <UButton color="neutral" variant="ghost" size="xs" @click="goToday">
          今天
        </UButton>
      </div>
      <div class="flex items-center gap-1">
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" @click="prevMonth" />
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" @click="nextMonth" />
      </div>
    </div>

    <!-- Compact Month Grid -->
    <div class="rounded-xl border border-default bg-elevated/40 p-2 shadow-sm">
      <div class="grid grid-cols-7 text-center text-xs text-muted mb-1 py-1 font-medium">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="grid grid-cols-7 gap-y-1 text-center">
        <button
          v-for="d in calendarDays"
          :key="d.dateStr"
          type="button"
          class="relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors text-sm"
          :class="[
            !d.isCurrentMonth ? 'text-muted/40' : 'text-default',
            selectedDate === d.dateStr ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'hover:bg-accent/10',
            d.isToday && selectedDate !== d.dateStr ? 'ring-1 ring-primary font-semibold text-primary' : ''
          ]"
          @click="onDayClick(d.dateStr)"
        >
          <span>{{ d.dayNum }}</span>
          <!-- Event Dots -->
          <div v-if="eventsByDate.has(d.dateStr)" class="flex items-center justify-center gap-0.5 mt-0.5 h-1.5">
            <span
              v-for="(ev, idx) in (eventsByDate.get(d.dateStr) || []).slice(0, 3)"
              :key="idx"
              class="size-1 rounded-full"
              :style="{ backgroundColor: ev.color || '#3b82f6' }"
            />
          </div>
        </button>
      </div>
    </div>

    <!-- Selected Day Agenda Header -->
    <div class="flex items-center justify-between pt-2 px-1">
      <h3 class="text-sm font-bold text-muted flex items-center gap-1.5">
        <UIcon name="i-lucide-calendar-days" class="size-4 text-primary" />
        {{ selectedDateLabel }}
      </h3>
      <span class="text-xs text-muted">
        {{ selectedDayEvents.length }} 則行程
      </span>
    </div>

    <!-- Agenda Card List -->
    <div v-if="selectedDayEvents.length > 0" class="space-y-2.5">
      <div
        v-for="(ev, i) in selectedDayEvents"
        :key="i"
        class="group relative flex items-start gap-3 rounded-xl border border-default bg-card p-3.5 shadow-sm transition hover:border-primary/50 cursor-pointer"
        @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
      >
        <!-- Time Side Bar -->
        <div class="flex flex-col items-center justify-center shrink-0 w-16 pt-0.5">
          <span class="text-xs font-bold text-default">
            {{ ev.allDay ? '全天' : ev.start.slice(11, 16) }}
          </span>
          <span v-if="!ev.allDay && ev.end" class="text-[10px] text-muted">
            {{ ev.end.slice(11, 16) }}
          </span>
        </div>

        <!-- Color Indicator Line -->
        <div
          class="w-1 self-stretch rounded-full shrink-0"
          :style="{ backgroundColor: ev.color || '#3b82f6' }"
        />

        <!-- Event Details -->
        <div class="flex-1 min-w-0 space-y-1">
          <p class="text-sm font-semibold text-default truncate">
            {{ ev.title }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-default bg-elevated/20">
      <UIcon name="i-lucide-calendar-x" class="size-8 text-muted/50 mb-2" />
      <p class="text-sm text-muted">當天尚無排課或活動</p>
      <UButton
        v-if="props.canEdit"
        icon="i-lucide-plus"
        variant="ghost"
        size="xs"
        class="mt-2"
        @click="emit('create-event', selectedDate)"
      >
        按此新增行程
      </UButton>
    </div>

    <!-- Floating Action Button (FAB) -->
    <div v-if="props.canEdit" class="fixed bottom-6 right-6 z-40">
      <UButton
        icon="i-lucide-plus"
        size="lg"
        class="rounded-full shadow-lg size-12 flex items-center justify-center p-0"
        @click="emit('create-event', selectedDate)"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit `MobileScheduleView.vue`**

```bash
git add app/components/MobileScheduleView.vue
git commit -m "feat: create MobileScheduleView component for responsive schedule layout"
```

---

### Task 2: Integrate `MobileScheduleView` into `app/pages/index.vue`

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `MobileScheduleView.vue`
- RWD Toggles: `md:hidden` for mobile view, `hidden md:block` for desktop FullCalendar view.

- [ ] **Step 1: Add MobileScheduleView to index.vue template**

In `app/pages/index.vue`, update the main container section:
Wrap existing desktop top bar and FullCalendar with `hidden md:block` (or `hidden md:flex`).
Add `<MobileScheduleView>` inside an `md:hidden` wrapper, wiring up events and props.

```vue
<!-- Mobile View (<768px) -->
<div class="md:hidden">
  <MobileScheduleView
    v-model:current-classroom="classroom"
    :events="calendarEvents"
    :classrooms="visibleClassrooms"
    :can-edit="canEdit"
    :tab-items="tabItems"
    @select-event="onMobileEventClick"
    @create-event="onMobileCreate"
    @open-import="openImport"
  />
</div>

<!-- Desktop View (>=768px) -->
<div class="hidden md:block">
  <!-- Existing Desktop Toolbar & FullCalendar -->
</div>
```

In `<script setup>`, add handlers for mobile event click and create:

```typescript
function onMobileEventClick(ev: any, targetEl?: HTMLElement) {
  // Populate detail popover / modal state
  const { source, refId, occDate } = ev.extendedProps ?? {}
  if (source === 'course') {
    const c = (courses.value ?? []).find(x => x.id === refId)
    if (c) {
      detail.value = {
        source: 'course',
        id: c.id,
        title: c.title,
        date: occDate || c.startDate || '',
        startTime: c.startTime || '',
        endTime: c.endTime || '',
        location: c.location || '',
        classroom: c.classroom,
        color: c.color,
        host: c.host,
        sharer: c.sharer,
        summarizer: c.summarizer,
        pm: c.pm,
        note: c.note
      }
    }
  } else if (source === 'event') {
    const e = (events.value ?? []).find(x => x.id === refId)
    if (e) {
      detail.value = {
        source: 'event',
        id: e.id,
        title: e.title,
        date: e.date,
        startTime: e.startTime || '',
        endTime: e.endTime || '',
        location: e.location || '',
        classroom: e.classroom,
        color: e.color,
        note: e.note
      }
    }
  }
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect()
    anchorRef.value = { x: rect.left + rect.width / 2, y: rect.top }
  }
  detailOpen.value = true
}

function onMobileCreate(dateStr: string) {
  resetForm()
  mode.value = 'create'
  form.date = dateStr || todayStr()
  open.value = true
}
```

- [ ] **Step 2: Commit updates to `app/pages/index.vue`**

```bash
git add app/pages/index.vue
git commit -m "feat: integrate MobileScheduleView into course schedule index page"
```

---

### Task 3: Verification & Polish

**Files:**
- Check: `app/pages/index.vue`
- Check: `app/components/MobileScheduleView.vue`

- [ ] **Step 1: Test Nuxt build**

Run: `npx nuxi typecheck` or `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Verify git status and commit final polish**

Run: `git status`
Expected: Clean working tree.
