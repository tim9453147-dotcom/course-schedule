<script setup lang="ts">
import { ref, computed } from 'vue'
import { colorDot, colorHex } from '~/utils/schedule'

interface EventItem {
  title: string
  start: string
  end?: string
  allDay?: boolean
  color?: string
  extendedProps?: {
    source: 'course' | 'event'
    refId: number
    occDate?: string
  }
}

const props = defineProps<{
  events: EventItem[]
  classrooms: string[]
  currentClassroom: string
  canEdit: boolean
  tabItems: Array<{ label: string; value: string }>
  courses?: any[]
  rawEvents?: any[]
}>()

const emit = defineEmits<{
  (e: 'update:currentClassroom', val: string): void
  (e: 'select-event', event: EventItem, anchorEl?: HTMLElement): void
  (e: 'create-event', dateStr: string): void
  (e: 'open-import'): void
}>()

// Helper for local date string YYYY-MM-DD
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return toLocalDateStr(new Date())
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

// 42-day calendar matrix for 6 weeks
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay() // 0 = Sunday

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

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: true, isToday: dateStr === todayStr() })
  }

  // Next month padding
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: false, isToday: dateStr === todayStr() })
  }

  return days
})

// Group events by YYYY-MM-DD date string
const eventsByDate = computed(() => {
  const map = new Map<string, EventItem[]>()
  for (const ev of props.events) {
    const dateKey = ev.start ? ev.start.slice(0, 10) : ''
    if (!dateKey) continue
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(ev)
  }
  return map
})

// Agenda list for currently selected date
const selectedDayEvents = computed(() => {
  const list = eventsByDate.value.get(selectedDate.value) ?? []
  // Sort events by start time (allDay events first)
  return [...list].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return a.start.localeCompare(b.start)
  })
})

// Formatted selected date label (e.g., "7/24 週五")
const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  if (!y || !m || !d) return selectedDate.value
  const dt = new Date(y, m - 1, d)
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  return `${m}月${d}日 ${days[dt.getDay()]}`
})

// Find raw details for extra role / note info if available
function getEventExtra(ev: EventItem) {
  const { source, refId } = ev.extendedProps ?? {}
  if (source === 'course' && props.courses) {
    const c = props.courses.find(x => x.id === refId)
    if (c) {
      const roles = [
        c.host ? `主持: ${c.host}` : '',
        c.sharer ? `分享: ${c.sharer}` : '',
        c.summarizer ? `總結: ${c.summarizer}` : '',
        c.pm ? `PM: ${c.pm}` : ''
      ].filter(Boolean)
      return { location: c.location, roles, note: c.note }
    }
  } else if (source === 'event' && props.rawEvents) {
    const e = props.rawEvents.find(x => x.id === refId)
    if (e) {
      const roles = [
        e.host ? `主持: ${e.host}` : '',
        e.sharer ? `分享: ${e.sharer}` : '',
        e.summarizer ? `總結: ${e.summarizer}` : '',
        e.pm ? `PM: ${e.pm}` : ''
      ].filter(Boolean)
      return { location: e.location, roles, note: e.note }
    }
  }
  return { location: '', roles: [], note: '' }
}

function onDayClick(dateStr: string) {
  selectedDate.value = dateStr
}
</script>

<template>
  <div class="mobile-schedule space-y-4">
    <!-- Top Control Bar: Classroom Selector & Action Buttons -->
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
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          size="sm"
          @click="emit('open-import')"
        >
          匯入
        </UButton>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          @click="emit('create-event', selectedDate)"
        >
          新增
        </UButton>
      </div>
    </div>

    <!-- Calendar Month Header -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-default">
          {{ monthTitle }}
        </h2>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          class="text-xs"
          @click="goToday"
        >
          今天
        </UButton>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="上個月"
          @click="prevMonth"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="下個月"
          @click="nextMonth"
        />
      </div>
    </div>

    <!-- Compact Month Grid Card -->
    <div class="rounded-xl border border-default bg-elevated/40 p-2 shadow-sm">
      <div class="grid grid-cols-7 text-center text-xs text-muted mb-1 py-1 font-medium">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="grid grid-cols-7 gap-y-1 text-center">
        <button
          v-for="d in calendarDays"
          :key="d.dateStr"
          type="button"
          class="relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all text-sm min-h-[38px]"
          :class="[
            !d.isCurrentMonth ? 'text-muted/40' : 'text-default',
            selectedDate === d.dateStr ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'hover:bg-accent/10',
            d.isToday && selectedDate !== d.dateStr ? 'ring-1 ring-primary font-semibold text-primary' : ''
          ]"
          @click="onDayClick(d.dateStr)"
        >
          <span>{{ d.dayNum }}</span>
          <!-- Event Status Dots -->
          <div v-if="eventsByDate.has(d.dateStr)" class="flex items-center justify-center gap-0.5 mt-0.5 h-1.5">
            <span
              v-for="(ev, idx) in (eventsByDate.get(d.dateStr) || []).slice(0, 3)"
              :key="idx"
              class="size-1.5 rounded-full shrink-0"
              :style="{ backgroundColor: ev.color || '#3b82f6' }"
            />
          </div>
        </button>
      </div>
    </div>

    <!-- Selected Day Agenda Header -->
    <div class="flex items-center justify-between pt-2 px-1">
      <h3 class="text-sm font-bold text-default flex items-center gap-1.5">
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
        class="group relative flex items-start gap-3 rounded-xl border border-default bg-card p-3.5 shadow-sm transition hover:border-primary/50 cursor-pointer active:scale-[0.99]"
        @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
      >
        <!-- Time Column -->
        <div class="flex flex-col items-center justify-center shrink-0 w-16 pt-0.5">
          <span class="text-xs font-bold text-default">
            {{ ev.allDay ? '全天' : ev.start.slice(11, 16) }}
          </span>
          <span v-if="!ev.allDay && ev.end" class="text-[10px] text-muted">
            {{ ev.end.slice(11, 16) }}
          </span>
        </div>

        <!-- Color Bar -->
        <div
          class="w-1 self-stretch rounded-full shrink-0"
          :style="{ backgroundColor: ev.color || '#3b82f6' }"
        />

        <!-- Event Details -->
        <div class="flex-1 min-w-0 space-y-1">
          <p class="text-sm font-semibold text-default truncate">
            {{ ev.title }}
          </p>

          <!-- Roles / Location Info Pills -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              v-if="getEventExtra(ev).location"
              class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/20 text-muted"
            >
              <UIcon name="i-lucide-map-pin" class="size-3" />
              {{ getEventExtra(ev).location }}
            </span>
            <span
              v-for="(role, rIdx) in getEventExtra(ev).roles"
              :key="rIdx"
              class="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
            >
              {{ role }}
            </span>
          </div>

          <!-- Note Preview -->
          <p v-if="getEventExtra(ev).note" class="text-xs text-muted truncate pt-0.5">
            {{ getEventExtra(ev).note }}
          </p>
        </div>

        <!-- Action Arrow Icon -->
        <UIcon name="i-lucide-chevron-right" class="size-4 text-muted/40 shrink-0 self-center" />
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
        aria-label="新增行程"
        @click="emit('create-event', selectedDate)"
      />
    </div>
  </div>
</template>
