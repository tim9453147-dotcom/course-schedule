<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

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

// 列表區的檢視模式：'day' (當日行程卡片) ↔ 'month' (整月所有課程清單)
const listScope = ref<'day' | 'month'>('day')

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

// 當切換教室時，自動歸位至今天與當月
watch(() => props.currentClassroom, () => {
  goToday()
})

onMounted(() => {
  goToday()
})

/* ---------- 原生級 60fps 手勢滑動切換月份 (Silky Touch Swipe) ---------- */
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartTime = ref(0)
const gridTranslateX = ref(0)
const isDragging = ref(false)
const isAnimating = ref(false)
const transitionStyle = ref('none')

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1 || isAnimating.value) return
  const t = e.touches[0]
  if (!t) return
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
  touchStartTime.value = Date.now()
  gridTranslateX.value = 0
  isDragging.value = false
  transitionStyle.value = 'none'
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length !== 1 || isAnimating.value) return
  const t = e.touches[0]
  if (!t) return
  const dx = t.clientX - touchStartX.value
  const dy = t.clientY - touchStartY.value

  if (!isDragging.value && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
    isDragging.value = true
  }

  if (isDragging.value) {
    gridTranslateX.value = dx * 0.85
  }
}

function onTouchEnd() {
  if (!isDragging.value) return
  const dx = gridTranslateX.value
  const deltaTime = Date.now() - touchStartTime.value
  const velocity = Math.abs(dx) / Math.max(deltaTime, 1)

  const isQuickSwipe = deltaTime < 300 && Math.abs(dx) > 25
  const isFarSwipe = Math.abs(dx) > 65

  if (isQuickSwipe || isFarSwipe || velocity > 0.3) {
    isAnimating.value = true
    const direction = dx < 0 ? 'next' : 'prev'
    const targetOutX = dx < 0 ? -320 : 320
    
    transitionStyle.value = 'transform 140ms cubic-bezier(0.4, 0, 1, 1), opacity 140ms ease-out'
    gridTranslateX.value = targetOutX

    setTimeout(() => {
      if (direction === 'next') nextMonth()
      else prevMonth()

      transitionStyle.value = 'none'
      gridTranslateX.value = direction === 'next' ? 280 : -280

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          transitionStyle.value = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out'
          gridTranslateX.value = 0
          setTimeout(() => {
            isAnimating.value = false
            isDragging.value = false
            transitionStyle.value = 'none'
          }, 200)
        })
      })
    }, 140)
  } else {
    transitionStyle.value = 'transform 240ms cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    gridTranslateX.value = 0
    setTimeout(() => {
      isDragging.value = false
      transitionStyle.value = 'none'
    }, 240)
  }
}

function onTouchCancel() {
  transitionStyle.value = 'transform 200ms ease-out'
  gridTranslateX.value = 0
  isDragging.value = false
}

/* ---------- 42 格月曆網格陣列 ---------- */
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay()

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

// 當月 (YYYY-MM) 前綴
const currentMonthPrefix = computed(() => {
  const y = currentYear.value
  const m = String(currentMonth.value + 1).padStart(2, '0')
  return `${y}-${m}`
})

// 📜【整個月的所有課程按日期分組】（下面表格切換至全月模式時使用）
const currentMonthGroupedEvents = computed(() => {
  const prefix = currentMonthPrefix.value
  const result: Array<{ dateStr: string; label: string; isToday: boolean; events: EventItem[] }> = []

  const dateKeys = Array.from(eventsByDate.value.keys())
    .filter(k => k.startsWith(prefix))
    .sort()

  for (const dateStr of dateKeys) {
    const evs = eventsByDate.value.get(dateStr) ?? []
    if (evs.length === 0) continue

    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y!, m! - 1, d!)
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
    const label = `${m}月${d}日 ${days[dt.getDay()]}`
    const isToday = dateStr === todayStr()

    const sortedEvents = [...evs].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return a.start.localeCompare(b.start)
    })

    result.push({
      dateStr,
      label,
      isToday,
      events: sortedEvents
    })
  }

  return result
})

// 「今天」的所有課程與活動行程
const todayEvents = computed(() => {
  const list = eventsByDate.value.get(todayStr()) ?? []
  return [...list].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return a.start.localeCompare(b.start)
  })
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

// 今日日期中文標籤
const todayFormattedLabel = computed(() => {
  const [y, m, d] = todayStr().split('-').map(Number)
  if (!y || !m || !d) return todayStr()
  const dt = new Date(y, m - 1, d)
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  return `${m}月${d}日 ${days[dt.getDay()]}`
})

// 目前選中日期的標籤
const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  if (selectedDate.value === todayStr()) {
    return `${todayFormattedLabel.value} (今天)`
  }
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  if (!y || !m || !d) return selectedDate.value
  const dt = new Date(y, m - 1, d)
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  return `${m}月${d}日 ${days[dt.getDay()]}`
})

// 取得該筆活動/課程的完整詳細屬性
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
  listScope.value = 'day'
}
</script>

<template>
  <div class="mobile-schedule space-y-4 select-none pb-24">
    <!-- 頂部列：教室分頁選單 & 匯入課表按鈕 -->
    <div class="flex items-center justify-between gap-2 px-1">
      <UTabs
        v-if="props.tabItems.length > 1"
        :model-value="props.currentClassroom"
        :items="props.tabItems"
        class="flex-1 max-w-[calc(100%-5.5rem)]"
        @update:model-value="val => emit('update:currentClassroom', String(val))"
      />
      <div v-else class="flex-1" />
      
      <!-- 匯入課表按鈕 -->
      <UButton
        v-if="props.canEdit"
        icon="i-lucide-file-up"
        color="neutral"
        variant="soft"
        size="sm"
        class="rounded-full px-3 shadow-xs border border-default/40 hover:bg-elevated transition"
        @click="emit('open-import')"
      >
        匯入課表
      </UButton>
    </div>

    <!-- 月曆控制區 (標題 + 今天鈕 + 月份切換按鈕) -->
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
          回到今天
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

    <!-- 月曆網格 (支援流暢 Touch Swipe 滑動切換月份) -->
    <div
      class="relative overflow-hidden rounded-2xl border border-default bg-elevated/40 p-2.5 shadow-xs transition-all"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <div
        :style="{ transform: `translateX(${gridTranslateX}px)`, transition: transitionStyle }"
      >
        <!-- 星期欄頭 -->
        <div class="grid grid-cols-7 text-center text-xs text-muted mb-1.5 py-1 font-semibold">
          <span class="text-rose-500/90">日</span>
          <span>一</span>
          <span>二</span>
          <span>三</span>
          <span>四</span>
          <span>五</span>
          <span class="text-sky-500/90">六</span>
        </div>

        <!-- 42 格日期矩陣 -->
        <div class="grid grid-cols-7 gap-y-1.5 text-center">
          <button
            v-for="d in calendarDays"
            :key="d.dateStr"
            type="button"
            class="relative flex flex-col items-center justify-between py-1.5 rounded-xl transition-all text-sm min-h-[46px]"
            :class="[
              !d.isCurrentMonth ? 'text-muted/30' : 'text-default font-medium',
              selectedDate === d.dateStr ? 'bg-primary text-primary-foreground font-bold shadow-md scale-105 z-10' : 'hover:bg-accent/10 active:scale-95',
              d.isToday && selectedDate !== d.dateStr ? 'ring-2 ring-primary/80 font-bold text-primary bg-primary/5' : ''
            ]"
            @click="onDayClick(d.dateStr)"
          >
            <span>{{ d.dayNum }}</span>

            <!-- 格子內部：課程名稱預覽簡籤與彩色小點 -->
            <div v-if="eventsByDate.has(d.dateStr)" class="flex flex-col items-center justify-center w-full px-0.5 mt-0.5 space-y-0.5">
              <span
                v-if="eventsByDate.get(d.dateStr)?.[0]"
                class="w-full text-[9px] truncate leading-none py-0.5 px-0.5 rounded font-semibold scale-90"
                :class="selectedDate === d.dateStr ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
              >
                {{ eventsByDate.get(d.dateStr)?.[0]?.title }}
              </span>
              <div class="flex items-center justify-center gap-0.5 h-1">
                <span
                  v-for="(ev, idx) in (eventsByDate.get(d.dateStr) || []).slice(0, 3)"
                  :key="idx"
                  class="size-1 rounded-full shrink-0 shadow-xs"
                  :style="{ backgroundColor: selectedDate === d.dateStr ? '#ffffff' : (ev.color || '#3b82f6') }"
                />
              </div>
            </div>
            <div v-else class="h-2" />
          </button>
        </div>
      </div>
    </div>

    <!-- ⚡ 今日課程速覽 Banner (不在今天時醒目提示) -->
    <div
      v-if="selectedDate !== todayStr() && todayEvents.length > 0 && listScope === 'day'"
      class="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs space-y-2"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="flex size-2.5 rounded-full bg-primary animate-ping" />
          <h3 class="text-sm font-bold text-primary flex items-center gap-1">
            <UIcon name="i-lucide-sparkles" class="size-4" />
            今日課程速覽 ({{ todayFormattedLabel }})
          </h3>
        </div>
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          class="rounded-full font-medium"
          @click="goToday"
        >
          查看今天
        </UButton>
      </div>

      <div class="space-y-1.5">
        <div
          v-for="(ev, tIdx) in todayEvents.slice(0, 2)"
          :key="tIdx"
          class="flex items-center justify-between text-xs bg-card/80 p-2 rounded-xl border border-default/50 cursor-pointer hover:border-primary/50 transition"
          @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span
              class="size-2 rounded-full shrink-0"
              :style="{ backgroundColor: ev.color || '#3b82f6' }"
            />
            <span class="font-bold text-default truncate">{{ ev.title }}</span>
          </div>
          <span class="text-muted shrink-0 text-[11px] font-medium ml-2">
            {{ ev.allDay ? '全天' : ev.start.slice(11, 16) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 🌟 下方列表區標頭：左側為日期 / 月份標題，右側提供【當日行程 | 整月總覽】精緻切換開關 -->
    <div class="flex items-center justify-between pt-1 px-1 gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon
          :name="listScope === 'day' ? 'i-lucide-calendar-days' : 'i-lucide-list-todo'"
          class="size-5 text-primary shrink-0"
        />
        <h3 class="text-base font-bold text-default truncate">
          {{ listScope === 'day' ? selectedDateLabel : `${currentYear}年${currentMonth + 1}月 全月課程` }}
        </h3>
      </div>

      <!-- 下方表格右上方精緻的 【當日 | 整月】 切換切換開關 (Segment Switch) -->
      <div class="flex items-center shrink-0 bg-elevated p-0.5 rounded-lg border border-default/60">
        <button
          type="button"
          class="px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1"
          :class="listScope === 'day' ? 'bg-card text-primary shadow-xs' : 'text-muted hover:text-default'"
          @click="listScope = 'day'"
        >
          <span>當日</span>
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1"
          :class="listScope === 'month' ? 'bg-card text-primary shadow-xs' : 'text-muted hover:text-default'"
          @click="listScope = 'month'"
        >
          <span>整月</span>
        </button>
      </div>
    </div>

    <!-- 🌟【模式 1：當日行程列表】 -->
    <template v-if="listScope === 'day'">
      <div v-if="selectedDayEvents.length > 0" class="space-y-3">
        <div
          v-for="(ev, i) in selectedDayEvents"
          :key="i"
          class="group relative flex flex-col gap-2.5 rounded-2xl border border-default/80 bg-card p-4 shadow-xs hover:shadow-md transition-all active:scale-[0.99] overflow-hidden"
          @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
        >
          <div
            class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
            :style="{ backgroundColor: ev.color || '#3b82f6' }"
          />

          <div class="flex items-center justify-between gap-2 pl-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md"
                :class="getEventExtra(ev).kind === 'course' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
              >
                {{ getEventExtra(ev).kindLabel }}
              </span>
              <span v-if="getEventExtra(ev).repeatLabel" class="text-[11px] text-muted font-medium">
                {{ getEventExtra(ev).repeatLabel }}
              </span>
            </div>

            <div class="flex items-center gap-1 text-xs font-bold text-default bg-elevated px-2.5 py-1 rounded-full border border-default/60 shadow-2xs">
              <UIcon name="i-lucide-clock" class="size-3.5 text-primary" />
              <span>{{ ev.allDay ? '全天' : (ev.end ? `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}` : ev.start.slice(11, 16)) }}</span>
            </div>
          </div>

          <div class="pl-1">
            <h4 class="text-base font-bold text-default group-hover:text-primary transition-colors leading-snug">
              {{ ev.title }}
            </h4>
          </div>

          <div v-if="getEventExtra(ev).location" class="flex items-center gap-1.5 pl-1 text-xs text-muted">
            <UIcon name="i-lucide-map-pin" class="size-3.5 text-rose-500 shrink-0" />
            <span class="font-medium text-default/90">{{ getEventExtra(ev).location }}</span>
          </div>

          <div v-if="getEventExtra(ev).roles.length > 0" class="flex flex-wrap items-center gap-1.5 pl-1 pt-1.5 border-t border-default/40">
            <div
              v-for="(r, rIdx) in getEventExtra(ev).roles"
              :key="rIdx"
              class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-muted/15 text-default border border-default/30"
            >
              <span class="text-muted text-[11px] font-normal">{{ r.label }}:</span>
              <span class="font-bold text-primary">{{ r.name }}</span>
            </div>
          </div>

          <div v-if="getEventExtra(ev).note" class="pl-1 pt-1 text-xs text-muted flex items-start gap-1">
            <UIcon name="i-lucide-align-left" class="size-3.5 mt-0.5 shrink-0 text-muted/60" />
            <span class="line-clamp-2">{{ getEventExtra(ev).note }}</span>
          </div>

          <UIcon name="i-lucide-chevron-right" class="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted/30 group-hover:text-primary transition" />
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-default/70 bg-elevated/20 px-4">
        <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <UIcon name="i-lucide-calendar-x" class="size-6 text-primary" />
        </div>
        <p class="text-base font-bold text-default">該日無排課或活動</p>
        <p class="text-xs text-muted mt-1">點選右下角「＋」可新增行程</p>
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
    </template>

    <!-- 🌟【模式 2：整月課程總覽列表】 (下方表格切換成全月顯示) -->
    <template v-else-if="listScope === 'month'">
      <div v-if="currentMonthGroupedEvents.length > 0" class="space-y-4">
        <div
          v-for="group in currentMonthGroupedEvents"
          :key="group.dateStr"
          class="space-y-2"
        >
          <div class="sticky top-0 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-md py-1.5 px-1 border-b border-default/40">
            <span
              class="size-2.5 rounded-full"
              :class="group.isToday ? 'bg-primary ring-4 ring-primary/20 animate-pulse' : 'bg-muted/60'"
            />
            <span class="text-sm font-bold text-default" :class="{ 'text-primary font-extrabold': group.isToday }">
              {{ group.label }}
            </span>
            <span v-if="group.isToday" class="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              今天
            </span>
          </div>

          <div class="space-y-2.5 pl-1">
            <div
              v-for="(ev, evIdx) in group.events"
              :key="evIdx"
              class="group relative flex flex-col gap-2 rounded-2xl border border-default/70 bg-card p-3.5 shadow-xs hover:shadow-md transition-all active:scale-[0.99] overflow-hidden cursor-pointer"
              @click="emit('select-event', ev, $event.currentTarget as HTMLElement)"
            >
              <div
                class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
                :style="{ backgroundColor: ev.color || '#3b82f6' }"
              />

              <div class="flex items-center justify-between gap-2 pl-1">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md"
                    :class="getEventExtra(ev).kind === 'course' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
                  >
                    {{ getEventExtra(ev).kindLabel }}
                  </span>
                  <span v-if="getEventExtra(ev).location" class="text-xs text-muted font-medium flex items-center gap-1">
                    <UIcon name="i-lucide-map-pin" class="size-3 text-rose-500 shrink-0" />
                    {{ getEventExtra(ev).location }}
                  </span>
                </div>

                <div class="flex items-center gap-1 text-xs font-bold text-default bg-elevated px-2 py-0.5 rounded-full border border-default/50">
                  <UIcon name="i-lucide-clock" class="size-3 text-primary" />
                  <span>{{ ev.allDay ? '全天' : (ev.end ? `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}` : ev.start.slice(11, 16)) }}</span>
                </div>
              </div>

              <div class="pl-1">
                <h4 class="text-base font-bold text-default group-hover:text-primary transition-colors leading-snug">
                  {{ ev.title }}
                </h4>
              </div>

              <div v-if="getEventExtra(ev).roles.length > 0" class="flex flex-wrap items-center gap-1.5 pl-1 pt-1 border-t border-default/30">
                <div
                  v-for="(r, rIdx) in getEventExtra(ev).roles"
                  :key="rIdx"
                  class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted/15 text-default"
                >
                  <span class="text-muted text-[11px]">{{ r.label }}:</span>
                  <span class="font-bold text-primary">{{ r.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-default/70 bg-elevated/20 px-4">
        <UIcon name="i-lucide-calendar-x" class="size-8 text-muted/50 mb-2" />
        <p class="text-base font-bold text-default">本月份尚無任何課程或活動</p>
      </div>
    </template>

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
