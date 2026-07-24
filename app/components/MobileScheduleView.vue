<script setup lang="ts">
import { ref, computed } from 'vue'

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
  (e: 'change-month', year: number, month: number): void
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
const currentMonth = ref(new Date().getMonth()) // 0-indexed (0=Jan ... 11=Dec)

const monthTitle = computed(() => `${currentYear.value} 年 ${currentMonth.value + 1} 月`)

function notifyMonthChange() {
  emit('change-month', currentYear.value, currentMonth.value + 1)
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  notifyMonthChange()
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  notifyMonthChange()
}

function goToday() {
  const now = new Date()
  currentYear.value = now.getFullYear()
  currentMonth.value = now.getMonth()
  selectedDate.value = todayStr()
  notifyMonthChange()
}

/* ---------- 手機版左右滑動切換月份 (Touch Swipe Gestures) ---------- */
const gridTouchX = ref(0)
const gridTouchY = ref(0)
const gridDeltaX = ref(0)
const isDragging = ref(false)
const isAnimating = ref(false)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1 || isAnimating.value) return
  const t = e.touches[0]
  if (!t) return
  gridTouchX.value = t.clientX
  gridTouchY.value = t.clientY
  gridDeltaX.value = 0
  isDragging.value = false
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length !== 1 || isAnimating.value) return
  const t = e.touches[0]
  if (!t) return
  const dx = t.clientX - gridTouchX.value
  const dy = t.clientY - gridTouchY.value

  if (!isDragging.value && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
    isDragging.value = true
  }

  if (isDragging.value) {
    gridDeltaX.value = dx * 0.75
  }
}

function onTouchEnd() {
  if (!isDragging.value) return
  const dx = gridDeltaX.value
  const threshold = 40

  if (Math.abs(dx) > threshold) {
    isAnimating.value = true
    if (dx < 0) {
      nextMonth()
    } else {
      prevMonth()
    }
  }

  gridDeltaX.value = 0
  isDragging.value = false
  setTimeout(() => {
    isAnimating.value = false
  }, 250)
}

function onTouchCancel() {
  gridDeltaX.value = 0
  isDragging.value = false
}

/* ---------- 42 格月曆陣列 ---------- */
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay() // 0 = Sunday

  const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }> = []

  // 上個月補格
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDay - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    const dateStr = `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: false, isToday: dateStr === todayStr() })
  }

  // 當月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: true, isToday: dateStr === todayStr() })
  }

  // 下個月補格
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    const dateStr = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dateStr, dayNum: d, isCurrentMonth: false, isToday: dateStr === todayStr() })
  }

  return days
})

// 按日期 YYYY-MM-DD 歸類所有行程/課程
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

// 目前選中日期的行程清單
const selectedDayEvents = computed(() => {
  const list = eventsByDate.value.get(selectedDate.value) ?? []
  return [...list].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return a.start.localeCompare(b.start)
  })
})

// 選中日期標題 (例如 "7/24 週五")
const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  if (!y || !m || !d) return selectedDate.value
  const dt = new Date(y, m - 1, d)
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  return `${m}月${d}日 ${days[dt.getDay()]}`
})

// 取得該筆活動/課程的完整詳細屬性（講師、主持人、地點、種類標籤等）
function getEventExtra(ev: EventItem) {
  const { source, refId } = ev.extendedProps ?? {}
  if (source === 'course' && props.courses) {
    const c = props.courses.find(x => x.id === refId)
    if (c) {
      const roles = [
        c.host ? { label: '主持', name: c.host } : null,
        c.sharer ? { label: '分享', name: c.sharer } : null,
        c.summarizer ? { label: '總結', name: c.summarizer } : null,
        c.pm ? { label: 'PM', name: c.pm } : null
      ].filter(Boolean)
      return {
        kind: c.kind ?? 'course',
        kindLabel: (c.kind === 'course' ? '課程' : '活動'),
        location: c.location || `${props.currentClassroom}教室`,
        roles,
        note: c.note || '',
        repeatLabel: `每週固定`
      }
    }
  } else if (source === 'event' && props.rawEvents) {
    const e = props.rawEvents.find(x => x.id === refId)
    if (e) {
      const roles = [
        e.host ? { label: '主持', name: e.host } : null,
        e.sharer ? { label: '分享', name: e.sharer } : null,
        e.summarizer ? { label: '總結', name: e.summarizer } : null,
        e.pm ? { label: 'PM', name: e.pm } : null
      ].filter(Boolean)
      return {
        kind: e.kind ?? 'activity',
        kindLabel: (e.kind === 'course' ? '課程' : '活動'),
        location: e.location || `${props.currentClassroom}教室`,
        roles,
        note: e.note || '',
        repeatLabel: '單次活動'
      }
    }
  }
  return {
    kind: 'activity',
    kindLabel: '行程',
    location: `${props.currentClassroom}教室`,
    roles: [],
    note: '',
    repeatLabel: ''
  }
}

function onDayClick(dateStr: string) {
  selectedDate.value = dateStr
}
</script>

<template>
  <div class="mobile-schedule space-y-4 select-none pb-20">
    <!-- 頂部控制列：教室分頁選單 & 精緻匯入按鈕（移除右上角冗餘的新增按鈕） -->
    <div class="flex items-center justify-between gap-2 px-1">
      <UTabs
        v-if="props.tabItems.length > 1"
        :model-value="props.currentClassroom"
        :items="props.tabItems"
        class="flex-1 max-w-[calc(100%-5rem)]"
        @update:model-value="val => emit('update:currentClassroom', String(val))"
      />
      <div v-else class="flex-1" />
      
      <!-- 精緻美化的「匯入」按鈕 -->
      <UButton
        v-if="props.canEdit"
        icon="i-lucide-file-up"
        color="neutral"
        variant="soft"
        size="sm"
        class="rounded-full px-3 shadow-xs border border-default/50 hover:bg-elevated transition"
        @click="emit('open-import')"
      >
        匯入課表
      </UButton>
    </div>

    <!-- 月曆控制 Header (年月標題 + 前後月切換) -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-bold text-default tracking-tight">
          {{ monthTitle }}
        </h2>
        <UButton
          color="primary"
          variant="soft"
          size="xs"
          class="rounded-full px-2.5 font-medium"
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
          class="rounded-full"
          aria-label="上個月"
          @click="prevMonth"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          class="rounded-full"
          aria-label="下個月"
          @click="nextMonth"
        />
      </div>
    </div>

    <!-- 支援左右滑動的月曆大盤區 (Touch Swipe Grid) -->
    <div
      class="relative overflow-hidden rounded-2xl border border-default bg-elevated/40 p-2.5 shadow-xs transition-all"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <div
        class="transition-transform duration-150 ease-out"
        :style="{ transform: `translateX(${gridDeltaX}px)` }"
      >
        <!-- 星期標題 -->
        <div class="grid grid-cols-7 text-center text-xs text-muted mb-1 py-1 font-semibold">
          <span class="text-rose-500/90">日</span>
          <span>一</span>
          <span>二</span>
          <span>三</span>
          <span>四</span>
          <span>五</span>
          <span class="text-sky-500/90">六</span>
        </div>

        <!-- 42 格日期區 -->
        <div class="grid grid-cols-7 gap-y-1.5 text-center">
          <button
            v-for="d in calendarDays"
            :key="d.dateStr"
            type="button"
            class="relative flex flex-col items-center justify-between py-1.5 rounded-xl transition-all text-sm min-h-[44px]"
            :class="[
              !d.isCurrentMonth ? 'text-muted/30' : 'text-default font-medium',
              selectedDate === d.dateStr ? 'bg-primary text-primary-foreground font-bold shadow-md scale-105 z-10' : 'hover:bg-accent/10 active:scale-95',
              d.isToday && selectedDate !== d.dateStr ? 'ring-2 ring-primary/80 font-bold text-primary bg-primary/5' : ''
            ]"
            @click="onDayClick(d.dateStr)"
          >
            <span>{{ d.dayNum }}</span>

            <!-- 行程狀態彩色圓點 (Dots) -->
            <div v-if="eventsByDate.has(d.dateStr)" class="flex items-center justify-center gap-1 mt-0.5 h-2">
              <span
                v-for="(ev, idx) in (eventsByDate.get(d.dateStr) || []).slice(0, 3)"
                :key="idx"
                class="size-1.5 rounded-full shrink-0 shadow-xs"
                :style="{ backgroundColor: ev.color || '#3b82f6' }"
              />
            </div>
            <div v-else class="h-2" />
          </button>
        </div>
      </div>
    </div>

    <!-- 選中日期的行程列表 Header -->
    <div class="flex items-center justify-between pt-2 px-1">
      <div class="flex items-center gap-2">
        <div class="size-2 rounded-full bg-primary animate-pulse" />
        <h3 class="text-base font-bold text-default">
          {{ selectedDateLabel }}
        </h3>
      </div>
      <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-muted/20 text-muted">
        共 {{ selectedDayEvents.length }} 項活動
      </span>
    </div>

    <!-- 當日行程卡片列表 (High Quality Agenda Cards Design) -->
    <div v-if="selectedDayEvents.length > 0" class="space-y-3">
      <div
        v-for="(ev, i) in selectedDayEvents"
        :key="i"
        class="group relative flex flex-col gap-2.5 rounded-2xl border border-default/70 bg-card p-4 shadow-xs hover:shadow-md transition-all active:scale-[0.99] overflow-hidden"
        @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
      >
        <!-- 左側彩色邊條點綴 -->
        <div
          class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
          :style="{ backgroundColor: ev.color || '#3b82f6' }"
        />

        <!-- 第一層：分類 Badges + 時間 -->
        <div class="flex items-center justify-between gap-2 pl-1">
          <div class="flex items-center gap-2">
            <!-- 類型 Badge (課程 / 活動) -->
            <span
              class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md"
              :class="getEventExtra(ev).kind === 'course' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'"
            >
              {{ getEventExtra(ev).kindLabel }}
            </span>
            <span v-if="getEventExtra(ev).repeatLabel" class="text-[11px] text-muted">
              {{ getEventExtra(ev).repeatLabel }}
            </span>
          </div>

          <!-- 時間 Badge -->
          <div class="flex items-center gap-1 text-xs font-bold text-default bg-elevated/60 px-2.5 py-1 rounded-full border border-default/40">
            <UIcon name="i-lucide-clock" class="size-3.5 text-primary" />
            <span>{{ ev.allDay ? '全天' : (ev.end ? `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}` : ev.start.slice(11, 16)) }}</span>
          </div>
        </div>

        <!-- 第二層：標題 (Bold) -->
        <div class="pl-1">
          <h4 class="text-base font-bold text-default group-hover:text-primary transition-colors leading-snug">
            {{ ev.title }}
          </h4>
        </div>

        <!-- 第三層：地點 & 教室 -->
        <div v-if="getEventExtra(ev).location" class="flex items-center gap-1.5 pl-1 text-xs text-muted">
          <UIcon name="i-lucide-map-pin" class="size-3.5 text-rose-500/80 shrink-0" />
          <span class="font-medium text-default/90">{{ getEventExtra(ev).location }}</span>
        </div>

        <!-- 第四層：課程角色 Badges (主持/分享/總結/PM) -->
        <div v-if="getEventExtra(ev).roles.length > 0" class="flex flex-wrap items-center gap-1.5 pl-1 pt-1 border-t border-default/30">
          <div
            v-for="(r, rIdx) in getEventExtra(ev).roles"
            :key="rIdx"
            class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted/15 text-default border border-default/30"
          >
            <span class="text-muted text-[11px]">{{ r.label }}:</span>
            <span class="font-semibold text-primary">{{ r.name }}</span>
          </div>
        </div>

        <!-- 第五層：備註 (如有) -->
        <div v-if="getEventExtra(ev).note" class="pl-1 pt-1 text-xs text-muted flex items-start gap-1">
          <UIcon name="i-lucide-align-left" class="size-3.5 mt-0.5 shrink-0 text-muted/60" />
          <span class="line-clamp-2">{{ getEventExtra(ev).note }}</span>
        </div>

        <!-- 點擊展開箭頭提示 -->
        <UIcon name="i-lucide-chevron-right" class="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted/30 group-hover:text-primary transition" />
      </div>
    </div>

    <!-- 空狀態 Prompt (當天無行程) -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-default/70 bg-elevated/20 px-4">
      <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <UIcon name="i-lucide-calendar-x" class="size-6 text-primary" />
      </div>
      <p class="text-base font-semibold text-default">本日無排課或活動</p>
      <p class="text-xs text-muted mt-1">點選右下角「＋」可立即新增行程</p>
      <UButton
        v-if="props.canEdit"
        icon="i-lucide-plus"
        variant="ghost"
        color="primary"
        size="sm"
        class="mt-3 font-medium"
        @click="emit('create-event', selectedDate)"
      >
        新增當日行程
      </UButton>
    </div>

    <!-- 右下角懸浮新增按鈕 (FAB Button) -->
    <div v-if="props.canEdit" class="fixed bottom-6 right-5 z-40">
      <UButton
        icon="i-lucide-plus"
        size="xl"
        class="rounded-full shadow-xl size-14 flex items-center justify-center p-0 bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all"
        aria-label="新增行程"
        @click="emit('create-event', selectedDate)"
      />
    </div>
  </div>
</template>
