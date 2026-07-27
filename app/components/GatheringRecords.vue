<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type { CalendarOptions, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { GatheringDetail } from './GatheringDetailPopover.vue'
import GatheringDetailPopover from './GatheringDetailPopover.vue'
import { computeFinance } from '~/utils/gathering'
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  dateLabel
} from '~/utils/schedule'

function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}

function todayStr() {
  return toLocalDateStr(new Date())
}

const canEdit = useCanEdit('gathering')
const notify = useNotify()
const confirm = useConfirm()
const { isMobile } = useMobile()

const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

// 抓取活動列表
const { data: gatherings, refresh } = await useFetch<Gathering[]>('/api/gatherings', { deep: true })

// 抓取家聚收支
const { data: finances, refresh: refreshFinances } = await useFetch<GatheringFinanceRow[]>(
  '/api/gathering-finances',
  { deep: true, default: () => [], immediate: canEdit.value }
)
const financeById = computed(() => {
  const m = new Map<number, GatheringFinanceRow>()
  for (const r of finances.value ?? []) m.set(r.id, r)
  return m
})
function financeOf(id: number) {
  const f = financeById.value.get(id)
  if (!f) return null
  if (f.headcount == null && f.fee == null && f.expense == null) return null
  return f
}

// 名單 (操鍋/助手/採買)
const { data: contacts } = await useFetch<Contact[]>('/api/contacts', { key: 'global-contacts', default: () => [] })
const contactNames = computed(() => Array.from(new Set((contacts.value ?? []).map(c => c.name))))

// 食譜
const { data: recipes } = await useFetch<Recipe[]>('/api/recipes', { key: 'global-recipes', default: () => [] })
const recipeItems = computed(() => (recipes.value ?? []).map(r => ({ label: r.name, value: r.id })))
function recipeById(id: number | null) {
  return id == null ? null : (recipes.value ?? []).find(r => r.id === id) ?? null
}

// 活動名稱建議
const createdNames = ref<string[]>([])
const nameItems = computed(() => Array.from(new Set([
  '家聚',
  ...(gatherings.value ?? []).map(g => g.name),
  ...createdNames.value
])))
const nameMenuOpen = ref(false)

function onCreateName(v: string) {
  const name = v.trim()
  if (!name) return
  if (!createdNames.value.includes(name)) createdNames.value.push(name)
  form.name = name
  nextTick(() => (nameMenuOpen.value = false))
}

function selectAllOnFocus(e: FocusEvent) {
  const t = e.target
  if (t instanceof HTMLInputElement) {
    requestAnimationFrame(() => t.select())
  }
}

function openPicker(e: MouseEvent) {
  const root = e.currentTarget as HTMLElement | null
  if (!root) return
  const input = (root instanceof HTMLInputElement ? root : root.querySelector('input')) as HTMLInputElement | null
  if (input && !input.disabled) {
    try {
      input.showPicker()
    } catch { /* ignore browsers that don't support showPicker */ }
  }
}

/* ---------- 日曆視圖與事件 ---------- */
const currentViewType = ref('dayGridMonth')
const isTimeGrid = ref(false)

const calendarEvents = computed(() => {
  return (gatherings.value ?? []).map(g => ({
    title: g.name,
    start: g.startTime ? `${g.date}T${g.startTime}` : g.date,
    end: g.endTime ? `${g.date}T${g.endTime}` : undefined,
    allDay: !g.startTime,
    color: 'var(--ui-primary)',
    extendedProps: { refId: g.id }
  }))
})

function onDatesSet(arg: { view: { type: string } }) {
  isTimeGrid.value = arg.view.type.startsWith('timeGrid')
  currentViewType.value = arg.view.type
}

function setCalendarView(viewName: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') {
  currentViewType.value = viewName
  const api = calendarRef.value?.getApi()
  if (api) api.changeView(viewName)
}

function goToday() {
  const api = calendarRef.value?.getApi()
  if (api) api.today()
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhTwLocale,
  firstDay: 0,
  dayHeaderFormat: { weekday: 'narrow' },
  dayCellContent: (arg: { date: Date }) => String(arg.date.getDate()),
  headerToolbar: isMobile.value
    ? { left: 'prev', center: 'title', right: 'next' }
    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
  buttonText: { today: '今天', month: '月', week: '週', day: '日' },
  titleFormat: isMobile.value ? { year: 'numeric', month: 'short' } : undefined,
  slotMinTime: '06:00:00',
  slotMaxTime: '23:00:00',
  allDaySlot: true,
  allDayText: '全天',
  height: 'auto',
  dayMaxEventRows: isMobile.value ? 3 : undefined,
  events: calendarEvents.value,
  displayEventTime: isTimeGrid.value,
  editable: canEdit.value,
  selectable: canEdit.value,
  selectMirror: true,
  eventStartEditable: canEdit.value,
  eventDurationEditable: false,
  eventClick: onEventClick,
  dateClick: onDateClick,
  select: onSelect,
  eventDrop: onEventDrop,
  datesSet: onDatesSet
}))

/* ---------- 互動彈窗 (Quick Create & Detail Popover) ---------- */
const quickOpen = ref(false)
const detailOpen = ref(false)
const anchorRef = ref<{ x: number, y: number } | null>(null)

const virtualAnchor = computed(() => {
  const a = anchorRef.value
  if (!a) return undefined
  const rect = { x: a.x, y: a.y, top: a.y, left: a.x, right: a.x, bottom: a.y, width: 0, height: 0 }
  return { getBoundingClientRect: () => rect }
})

const detail = ref<GatheringDetail | null>(null)
const selectedDetailRecipe = computed(() => recipeById(detail.value?.recipeId ?? null))

function setAnchor(e: { jsEvent?: MouseEvent | null }) {
  if (e.jsEvent) {
    anchorRef.value = { x: e.jsEvent.clientX, y: e.jsEvent.clientY }
  }
}

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

const ALL_DAY = '__allday__'
const hourItems = [{ label: '不指定', value: ALL_DAY }, ...HOUR_OPTIONS]
const minuteItems = MINUTE_OPTIONS

function hourModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[0]! : ALL_DAY,
    set: (val: string) => {
      if (val === ALL_DAY) {
        form.startTime = ''
        form.endTime = ''
      } else {
        const m = minuteModel(key).value
        form[key] = `${val}:${m}`
      }
    }
  })
}

function minuteModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[1] || '00' : '00',
    set: (val: string) => {
      const h = hourModel(key).value
      if (h !== ALL_DAY) {
        form[key] = `${h}:${val}`
      }
    }
  })
}

const startHour = hourModel('startTime')
const startMinute = minuteModel('startTime')
const endHour = hourModel('endTime')
const endMinute = minuteModel('endTime')

function onDateClick(arg: DateClickArg) {
  if (!canEdit.value) return
  setAnchor(arg)
  detailOpen.value = false
  editingId.value = null
  resetForm()
  form.date = arg.dateStr.slice(0, 10)
  if (arg.dateStr.includes('T')) {
    const timePart = arg.dateStr.split('T')[1]?.slice(0, 5) ?? '19:00'
    form.startTime = timePart
    const [h, m] = timePart.split(':').map(Number)
    const endH = String((h! + 2) % 24).padStart(2, '0')
    form.endTime = `${endH}:${String(m).padStart(2, '0')}`
  }
  quickOpen.value = true
}

function onSelect(arg: DateSelectArg) {
  if (!canEdit.value) return
  setAnchor(arg)
  detailOpen.value = false
  editingId.value = null
  resetForm()
  form.date = arg.startStr.slice(0, 10)
  if (arg.startStr.includes('T')) {
    form.startTime = arg.startStr.split('T')[1]!.slice(0, 5)
    form.endTime = arg.endStr.split('T')[1]!.slice(0, 5)
  }
  quickOpen.value = true
}

function onEventClick(arg: EventClickArg) {
  setAnchor(arg)
  quickOpen.value = false
  const refId = arg.event.extendedProps.refId as number
  const g = (gatherings.value ?? []).find(item => item.id === refId)
  if (!g) return
  const fin = financeOf(g.id)
  detail.value = {
    id: g.id,
    name: g.name,
    date: g.date,
    startTime: g.startTime,
    endTime: g.endTime,
    location: g.location,
    mapUrl: g.mapUrl,
    cook: g.cook,
    assistant: g.assistant,
    shopper: g.shopper,
    process: g.process,
    attendees: g.attendees,
    recipeId: g.recipeId,
    note: g.note,
    fin: fin ? { headcount: fin.headcount, fee: fin.fee, expense: fin.expense, income: fin.income, profit: fin.profit } : null
  }
  detailOpen.value = true
}

async function onEventDrop(arg: EventDropArg) {
  if (!canEdit.value) return arg.revert()
  const refId = arg.event.extendedProps.refId as number
  const g = (gatherings.value ?? []).find(item => item.id === refId)
  if (!g) return arg.revert()

  const newDate = toLocalDateStr(arg.event.start!)
  let newStart = g.startTime
  let newEnd = g.endTime
  if (arg.event.startStr.includes('T')) {
    newStart = arg.event.startStr.split('T')[1]!.slice(0, 5)
    newEnd = arg.event.end ? arg.event.endStr.split('T')[1]!.slice(0, 5) : newStart
  }

  try {
    await $fetch(`/api/gatherings/${g.id}`, {
      method: 'PUT',
      body: {
        ...g,
        date: newDate,
        startTime: newStart,
        endTime: newEnd
      }
    })
    await refresh()
    notify.success('已移動家聚活動日期')
  } catch {
    notify.error('移動失敗')
    arg.revert()
  }
}

/* ---------- 完整編輯 Form & Modal ---------- */
const open = ref(false)
const editingId = ref<number | null>(null)
const mode = ref<'view' | 'edit'>('view')
const modalTitle = computed(() => {
  if (mode.value === 'view') return '活動明細'
  return editingId.value ? '編輯活動' : '新增活動'
})
const saving = ref(false)
const showRecipe = ref(false)
const showFinance = ref(false)

const blank = () => ({
  name: '家聚',
  date: todayStr(),
  startTime: '19:00',
  endTime: '21:00',
  location: '吾心家',
  mapUrl: '',
  cook: '',
  assistant: '',
  shopper: '',
  process: '',
  attendees: '',
  recipeId: null as number | null,
  note: '',
  headcount: '',
  fee: '',
  expense: '',
  syncToCalendar: false,
  classroom: '中壢'
})
const form = reactive(blank())

function resetForm() {
  Object.assign(form, blank())
}

const financePreview = computed(() =>
  computeFinance(Number(form.headcount) || 0, Number(form.fee) || 0, Number(form.expense) || 0)
)
function toNull(v: string) {
  const s = String(v ?? '').trim()
  return s === '' ? null : Number(s)
}

function openCreate() {
  editingId.value = null
  resetForm()
  showRecipe.value = false
  showFinance.value = false
  mode.value = 'edit'
  quickOpen.value = false
  detailOpen.value = false
  open.value = true
}

function openMore() {
  quickOpen.value = false
  mode.value = 'edit'
  showRecipe.value = false
  showFinance.value = false
  open.value = true
}

function openDetailEdit() {
  if (!detail.value) return
  detailOpen.value = false
  const g = (gatherings.value ?? []).find(item => item.id === detail.value!.id)
  if (!g) return
  openRow(g)
  mode.value = 'edit'
}

async function onDetailDelete() {
  if (!detail.value) return
  const id = detail.value.id
  const ok = await confirm({ title: '刪除活動', description: '確定刪除這場家聚活動？其收支紀錄也會一併刪除。', confirmLabel: '刪除', danger: true })
  if (!ok) return
  try {
    await $fetch(`/api/gatherings/${id}`, { method: 'DELETE' })
    detailOpen.value = false
    await refresh()
    notify.success('已刪除活動')
  } catch {
    notify.error('刪除失敗')
  }
}

function openRow(g: Gathering) {
  editingId.value = g.id
  const fin = financeById.value.get(g.id)
  Object.assign(form, {
    name: g.name,
    date: g.date,
    startTime: g.startTime ?? '',
    endTime: g.endTime ?? '',
    location: g.location ?? '',
    mapUrl: g.mapUrl ?? '',
    cook: g.cook ?? '',
    assistant: g.assistant ?? '',
    shopper: g.shopper ?? '',
    process: g.process ?? '',
    attendees: g.attendees ?? '',
    recipeId: g.recipeId,
    note: g.note ?? '',
    headcount: fin?.headcount == null ? '' : String(fin.headcount),
    fee: fin?.fee == null ? '' : String(fin.fee),
    expense: fin?.expense == null ? '' : String(fin.expense),
    syncToCalendar: false,
    classroom: '中壢'
  })
  showRecipe.value = false
  showFinance.value = false
  mode.value = 'view'
  open.value = true
}

const selectedRecipe = computed(() => recipeById(form.recipeId))

async function saveQuick() {
  if (!form.name.trim()) return notify.error('請輸入活動名稱')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return notify.error('請選擇日期')
  saving.value = true
  try {
    const synced = form.syncToCalendar
    await $fetch('/api/gatherings', { method: 'POST', body: { ...form } })
    quickOpen.value = false
    await refresh()
    notify.success(synced ? '已新增家聚活動並同步至課表' : '已新增家聚活動')
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('儲存失敗', msg)
  } finally {
    saving.value = false
  }
}

async function save() {
  if (!form.name.trim()) return notify.error('請輸入活動名稱')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return notify.error('請選擇日期')
  saving.value = true
  try {
    const url = editingId.value ? `/api/gatherings/${editingId.value}` : '/api/gatherings'
    const synced = form.syncToCalendar
    await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body: { ...form } })
    if (editingId.value) {
      await $fetch(`/api/gathering-finances/${editingId.value}`, {
        method: 'PUT',
        body: { headcount: toNull(form.headcount), fee: toNull(form.fee), expense: toNull(form.expense) }
      })
    }
    open.value = false
    await Promise.all([refresh(), refreshFinances()])
    notify.success(
      editingId.value
        ? (synced ? '已更新活動並同步至課表' : '已更新活動')
        : (synced ? '已新增活動並同步至課表' : '已新增活動')
    )
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('儲存失敗', msg)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!editingId.value) return
  const ok = await confirm({ title: '刪除活動', description: '確定刪除這場活動？其收支紀錄也會一併刪除。', confirmLabel: '刪除', danger: true })
  if (!ok) return
  try {
    await $fetch(`/api/gatherings/${editingId.value}`, { method: 'DELETE' })
    open.value = false
    await refresh()
    notify.success('已刪除活動')
  } catch {
    notify.error('刪除失敗')
  }
}

/* ---------- 手機版 1:1 跟手滑動換月動畫 ---------- */
let touchStartX = 0
let touchStartY = 0
let touchStartTime = 0
let touchIsDragging = false
const isAnimating = ref(false)

function getHarnessEl(): HTMLElement | null {
  const calEl = calendarRef.value?.$el as HTMLElement | undefined
  return calEl?.querySelector('.fc-view-harness') as HTMLElement | null
}

function animateMonthChange(direction: 'prev' | 'next') {
  const harness = getHarnessEl()
  const api = calendarRef.value?.getApi()
  if (!api || isAnimating.value) return

  isAnimating.value = true
  const exitX = direction === 'next' ? -100 : 100

  if (harness) {
    harness.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease-out'
    harness.style.transform = `translateX(${exitX}%)`
    harness.style.opacity = '0'
  }

  setTimeout(() => {
    if (direction === 'next') api.next()
    else api.prev()

    if (harness) {
      const enterX = direction === 'next' ? 60 : -60
      harness.style.transition = 'none'
      harness.style.transform = `translateX(${enterX}%)`
      harness.style.opacity = '0'

      void harness.offsetHeight

      harness.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out'
      harness.style.transform = 'translateX(0)'
      harness.style.opacity = '1'
    }

    setTimeout(() => {
      if (harness) {
        harness.style.transition = ''
        harness.style.transform = ''
        harness.style.opacity = ''
      }
      isAnimating.value = false
    }, 270)
  }, 180)
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1 || isAnimating.value) return
  const touch = e.touches[0]
  if (!touch) return

  const target = e.target as HTMLElement | null
  if (target?.closest('.fc-popover, button, input, textarea, select, [role="dialog"]')) {
    touchStartX = 0
    touchStartY = 0
    touchStartTime = 0
    touchIsDragging = false
    return
  }

  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchStartTime = Date.now()
  touchIsDragging = false
}

function handleTouchMove(e: TouchEvent) {
  if (!touchStartTime || e.touches.length !== 1 || isAnimating.value) return
  const touch = e.touches[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX
  const deltaY = touch.clientY - touchStartY

  if (!touchIsDragging && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
    touchIsDragging = true
  }

  if (touchIsDragging) {
    const harness = getHarnessEl()
    if (harness) {
      harness.style.transition = 'none'
      const dampenedX = deltaX * 0.7
      harness.style.transform = `translateX(${dampenedX}px)`
      harness.style.opacity = `${Math.max(0.65, 1 - Math.abs(deltaX) / 600)}`
    }
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (!touchStartTime || e.changedTouches.length !== 1) return
  const touch = e.changedTouches[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX
  const deltaY = touch.clientY - touchStartY
  const deltaTime = Date.now() - touchStartTime

  touchStartX = 0
  touchStartY = 0
  touchStartTime = 0
  const wasDragging = touchIsDragging
  touchIsDragging = false

  const minSwipeDistance = 35
  const maxVerticalDistance = 80
  const maxSwipeTime = 600

  if (
    deltaTime <= maxSwipeTime
    && Math.abs(deltaX) >= minSwipeDistance
    && Math.abs(deltaY) <= maxVerticalDistance
    && Math.abs(deltaX) > Math.abs(deltaY) * 1.2
  ) {
    const direction = deltaX < 0 ? 'next' : 'prev'
    animateMonthChange(direction)
  } else if (wasDragging) {
    const harness = getHarnessEl()
    if (harness) {
      harness.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease-out'
      harness.style.transform = 'translateX(0)'
      harness.style.opacity = '1'
      setTimeout(() => {
        harness.style.transition = ''
        harness.style.transform = ''
        harness.style.opacity = ''
      }, 250)
    }
  }
}

function handleTouchCancel() {
  touchStartX = 0
  touchStartY = 0
  touchStartTime = 0
  touchIsDragging = false
  const harness = getHarnessEl()
  if (harness) {
    harness.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
    harness.style.transform = 'translateX(0)'
    harness.style.opacity = '1'
    setTimeout(() => {
      harness.style.transition = ''
      harness.style.transform = ''
      harness.style.opacity = ''
    }, 200)
  }
}
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- 桌機頭部 / 標題列 -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">
        活動紀錄
      </h2>
      <div
        v-if="canEdit"
        class="hidden sm:block"
      >
        <UButton
          icon="i-lucide-plus"
          @click="openCreate"
        >
          新增活動
        </UButton>
      </div>
    </div>

    <!-- 手機版專用日曆控制列（檢視切換：月 / 週 / 日 + 今天） -->
    <div class="sm:hidden flex items-center justify-between gap-2 bg-elevated/40 p-1.5 rounded-xl border border-default/50">
      <div class="flex items-center gap-1">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-calendar"
          @click="goToday"
        >
          今天
        </UButton>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          size="xs"
          :color="currentViewType === 'dayGridMonth' ? 'primary' : 'neutral'"
          :variant="currentViewType === 'dayGridMonth' ? 'solid' : 'ghost'"
          @click="setCalendarView('dayGridMonth')"
        >
          月
        </UButton>
        <UButton
          size="xs"
          :color="currentViewType === 'timeGridWeek' ? 'primary' : 'neutral'"
          :variant="currentViewType === 'timeGridWeek' ? 'solid' : 'ghost'"
          @click="setCalendarView('timeGridWeek')"
        >
          週
        </UButton>
        <UButton
          size="xs"
          :color="currentViewType === 'timeGridDay' ? 'primary' : 'neutral'"
          :variant="currentViewType === 'timeGridDay' ? 'solid' : 'ghost'"
          @click="setCalendarView('timeGridDay')"
        >
          日
        </UButton>
      </div>
    </div>

    <!-- FullCalendar 主日曆包覆區域（含 1:1 Touch 滑動手勢監聽） -->
    <div
      class="schedule-calendar"
      :class="{ 'is-editable': canEdit }"
      @touchstart.capture="handleTouchStart"
      @touchmove.capture="handleTouchMove"
      @touchend.capture="handleTouchEnd"
      @touchcancel.capture="handleTouchCancel"
    >
      <ClientOnly>
        <FullCalendar
          ref="calendarRef"
          :options="calendarOptions"
        />
        <template #fallback>
          <div class="text-muted py-16 text-center">
            家聚日曆載入中…
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- 手機版 FAB Floating Action Button (參考 Google Calendar) -->
    <div
      v-if="canEdit"
      class="sm:hidden fixed bottom-6 right-5 z-40"
    >
      <UButton
        icon="i-lucide-plus"
        size="xl"
        color="primary"
        class="rounded-full shadow-lg p-3.5 ring-4 ring-background"
        aria-label="新增家聚活動"
        @click="openCreate"
      />
    </div>

    <!-- 快速建立彈窗（桌機版 UPopover / 手機版 UDrawer 底部抽屜） -->
    <template v-if="!isMobile">
      <UPopover
        v-model:open="quickOpen"
        :reference="virtualAnchor"
        :content="{ side: 'bottom', align: 'start' }"
      >
        <template #content>
          <div class="w-[min(20rem,calc(100vw-1.5rem))] space-y-3 p-4">
            <p class="text-sm text-muted">
              {{ dateLabel(form.date) }}
            </p>
            <UInput
              v-model="form.name"
              autofocus
              placeholder="家聚活動名稱"
              size="lg"
              class="w-full"
              @keydown.enter="saveQuick"
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
            <div class="border-default/60 bg-elevated/40 space-y-2 rounded-lg border p-2.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-muted font-medium">同步新增至課表</span>
                <USwitch
                  v-model="form.syncToCalendar"
                  size="sm"
                />
              </div>
              <div
                v-if="form.syncToCalendar"
                class="flex items-center justify-between gap-2 pt-1"
              >
                <span class="text-muted">目標教室</span>
                <USelect
                  v-model="form.classroom"
                  :items="CLASSROOMS"
                  size="xs"
                  class="w-24"
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
                @click="saveQuick"
              >
                儲存
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>
    </template>
    <template v-else>
      <UDrawer
        v-model:open="quickOpen"
        title="快速建立家聚活動"
      >
        <template #body>
          <div class="space-y-4 pb-4">
            <p class="text-sm text-muted">
              {{ dateLabel(form.date) }}
            </p>
            <UInput
              v-model="form.name"
              autofocus
              placeholder="家聚活動名稱"
              size="lg"
              class="w-full"
              @keydown.enter="saveQuick"
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
            <div class="border-default/60 bg-elevated/40 space-y-2 rounded-lg border p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted font-medium">同步新增至課表</span>
                <USwitch
                  v-model="form.syncToCalendar"
                  size="sm"
                />
              </div>
              <div
                v-if="form.syncToCalendar"
                class="flex items-center justify-between gap-2 pt-1"
              >
                <span class="text-muted text-xs">目標教室</span>
                <USelect
                  v-model="form.classroom"
                  :items="CLASSROOMS"
                  size="sm"
                  class="w-28"
                />
              </div>
            </div>
            <div class="flex items-center justify-between pt-2">
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
                size="lg"
                class="px-6"
                @click="saveQuick"
              >
                儲存
              </UButton>
            </div>
          </div>
        </template>
      </UDrawer>
    </template>

    <!-- 明細彈窗（桌機版 UPopover / 手機版 UDrawer 底部抽屜） -->
    <template v-if="!isMobile">
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
            :recipe="selectedDetailRecipe"
            @edit="openDetailEdit"
            @delete="onDetailDelete"
          />
        </template>
      </UPopover>
    </template>
    <template v-else>
      <UDrawer v-model:open="detailOpen">
        <template #body>
          <GatheringDetailPopover
            v-if="detail"
            :detail="detail"
            :can-edit="canEdit"
            :recipe="selectedDetailRecipe"
            class="w-full p-0"
            @edit="openDetailEdit"
            @delete="onDetailDelete"
          />
        </template>
      </UDrawer>
    </template>

    <!-- 完整編輯 Modal -->
    <UModal
      :open="open"
      :title="modalTitle"
      :ui="{ content: 'max-w-2xl' }"
      @update:open="open = $event"
    >
      <template #body>
        <div class="space-y-4">
          <div
            v-if="mode === 'view'"
            class="space-y-4"
          >
            <div>
              <div class="text-muted text-xs">
                時間
              </div>
              <div class="font-medium">
                <span class="font-mono tabular-nums">{{ form.date }}</span>
                <span
                  v-if="form.startTime || form.endTime"
                  class="text-muted ml-2 font-mono tabular-nums"
                >{{ form.startTime }}<template v-if="form.endTime">–{{ form.endTime }}</template></span>
              </div>
            </div>
            <div v-if="form.location">
              <div class="text-muted text-xs">
                地點
              </div>
              <div class="font-medium">
                {{ form.location }}
              </div>
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
              <div class="text-muted text-xs">
                流程
              </div>
              <p class="whitespace-pre-wrap">
                {{ form.process }}
              </p>
            </div>
            <div v-if="selectedRecipe">
              <div class="text-muted text-xs">
                料理
              </div>
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
                  <p class="whitespace-pre-wrap">
                    {{ selectedRecipe.ingredients || '—' }}
                  </p>
                </div>
                <div>
                  <span class="font-semibold">作法：</span>
                  <p class="whitespace-pre-wrap">
                    {{ selectedRecipe.steps || '—' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="mode === 'edit'"
            class="space-y-4"
          >
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="活動名稱">
                <div
                  class="w-full"
                  @focusin="selectAllOnFocus"
                >
                  <UInputMenu
                    v-model="form.name"
                    v-model:open="nameMenuOpen"
                    :items="nameItems"
                    create-item
                    :disabled="!canEdit"
                    placeholder="選擇或輸入"
                    class="w-full"
                    @create="onCreateName"
                  />
                </div>
              </UFormField>
              <UFormField label="日期">
                <UInput
                  v-model="form.date"
                  type="date"
                  :disabled="!canEdit"
                  class="w-full"
                  @click="openPicker"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="開始時間">
                <UInput
                  v-model="form.startTime"
                  type="time"
                  :disabled="!canEdit"
                  class="w-full"
                  @click="openPicker"
                />
              </UFormField>
              <UFormField label="結束時間">
                <UInput
                  v-model="form.endTime"
                  type="time"
                  :disabled="!canEdit"
                  class="w-full"
                  @click="openPicker"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="地點">
                <UInput
                  v-model="form.location"
                  :disabled="!canEdit"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="地圖連結">
                <UInput
                  v-model="form.mapUrl"
                  :disabled="!canEdit"
                  placeholder="https://maps.app.goo.gl/…"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="border-default bg-elevated/30 space-y-3 rounded-lg border p-3.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <UIcon
                    name="i-lucide-calendar-plus"
                    class="text-primary h-4 w-4"
                  />
                  同步新增至課表
                </div>
                <USwitch
                  v-model="form.syncToCalendar"
                  :disabled="!canEdit"
                />
              </div>
              <div
                v-if="form.syncToCalendar"
                class="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2"
              >
                <UFormField label="目標教室">
                  <USelect
                    v-model="form.classroom"
                    :items="CLASSROOMS"
                    :disabled="!canEdit"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <UFormField label="操鍋">
                <UInputMenu
                  v-model="form.cook"
                  :items="contactNames"
                  create-item
                  :disabled="!canEdit"
                  placeholder="選擇或輸入"
                  class="w-full"
                  @create="(v: string) => (form.cook = v)"
                />
              </UFormField>
              <UFormField label="助手">
                <UInputMenu
                  v-model="form.assistant"
                  :items="contactNames"
                  create-item
                  :disabled="!canEdit"
                  placeholder="選擇或輸入"
                  class="w-full"
                  @create="(v: string) => (form.assistant = v)"
                />
              </UFormField>
              <UFormField label="採買">
                <UInputMenu
                  v-model="form.shopper"
                  :items="contactNames"
                  create-item
                  :disabled="!canEdit"
                  placeholder="選擇或輸入"
                  class="w-full"
                  @create="(v: string) => (form.shopper = v)"
                />
              </UFormField>
            </div>

            <UFormField label="流程">
              <UTextarea
                v-model="form.process"
                :disabled="!canEdit"
                :rows="6"
                placeholder="19:00 集合備料&#10;19:20 新朋友到…"
                class="w-full"
              />
            </UFormField>

            <UFormField label="參加名單">
              <UTextarea
                v-model="form.attendees"
                :disabled="!canEdit"
                :rows="6"
                placeholder="1. 雅萍&#10;2. 浩廷…"
                class="w-full"
              />
            </UFormField>

            <UFormField label="食譜">
              <div class="space-y-2">
                <USelectMenu
                  v-if="canEdit"
                  :model-value="form.recipeId ?? undefined"
                  :items="recipeItems"
                  value-key="value"
                  label-key="label"
                  placeholder="（不引用）"
                  class="w-full"
                  @update:model-value="(v: number | null) => (form.recipeId = v)"
                />
                <div v-if="selectedRecipe">
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
                      <p class="whitespace-pre-wrap">
                        {{ selectedRecipe.ingredients || '—' }}
                      </p>
                    </div>
                    <div>
                      <span class="font-semibold">作法：</span>
                      <p class="whitespace-pre-wrap">
                        {{ selectedRecipe.steps || '—' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </UFormField>

            <UFormField label="備註">
              <UTextarea
                v-model="form.note"
                :disabled="!canEdit"
                :rows="2"
                class="w-full"
              />
            </UFormField>

            <div
              v-if="canEdit && editingId"
              class="border-default rounded-lg border"
            >
              <button
                type="button"
                class="hover:bg-elevated/50 flex w-full items-center gap-2 px-4 py-3 text-left font-medium transition"
                @click="showFinance = !showFinance"
              >
                <UIcon
                  name="i-lucide-wallet"
                  class="text-primary"
                />
                收支
                <span class="text-muted ml-2 font-mono text-sm tabular-nums">
                  盈餘 {{ financePreview.profit >= 0 ? '+' : '−' }}{{ financePreview.profit.toLocaleString('zh-TW') }}
                </span>
                <UIcon
                  :name="showFinance ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="ml-auto"
                />
              </button>
              <div
                v-if="showFinance"
                class="space-y-4 px-4 pb-4"
              >
                <div class="grid grid-cols-3 gap-4">
                  <UFormField label="人數">
                    <UInput
                      v-model="form.headcount"
                      type="number"
                      min="0"
                      :disabled="!canEdit"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="收費（每人）">
                    <UInput
                      v-model="form.fee"
                      type="number"
                      min="0"
                      :disabled="!canEdit"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="支出">
                    <UInput
                      v-model="form.expense"
                      type="number"
                      min="0"
                      :disabled="!canEdit"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <div class="bg-elevated/50 grid grid-cols-2 gap-4 rounded-lg p-4">
                  <div>
                    <div class="text-muted text-xs">
                      收入（人數×收費）
                    </div>
                    <div class="font-mono text-lg font-semibold tabular-nums">
                      {{ financePreview.income.toLocaleString('zh-TW') }}
                    </div>
                  </div>
                  <div>
                    <div class="text-muted text-xs">
                      盈餘（收入−支出）
                    </div>
                    <div
                      class="font-mono text-lg font-semibold tabular-nums"
                      :class="financePreview.profit >= 0 ? 'text-success' : 'text-error'"
                    >
                      {{ financePreview.profit.toLocaleString('zh-TW') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.schedule-calendar,
.schedule-calendar :deep(.fc),
.schedule-calendar :deep(.fc-view-harness) {
  touch-action: pan-y;
}

/* 讓 FullCalendar 配合 Nuxt UI 的明暗色與字級 */
.schedule-calendar :deep(.fc) {
  --fc-border-color: var(--ui-border);
  --fc-today-bg-color: color-mix(in oklab, var(--ui-primary) 12%, transparent);
  --fc-page-bg-color: transparent;
  font-size: 0.8125rem;
}
.schedule-calendar :deep(.fc .fc-button-primary) {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}
.schedule-calendar :deep(.fc .fc-button-primary:disabled) {
  opacity: 0.5;
}

/* 拿掉最外層外框，只保留內部分隔線，版面更乾淨 */
.schedule-calendar :deep(.fc .fc-scrollgrid) {
  border: none;
}
.schedule-calendar :deep(.fc .fc-scrollgrid > tbody > tr > td),
.schedule-calendar :deep(.fc .fc-scrollgrid > thead > tr > th) {
  border-right: none;
  border-bottom: none;
}

/* 星期標題：較小、置中、淡色，排版整齊 */
.schedule-calendar :deep(.fc .fc-col-header-cell-cushion) {
  padding: 8px 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ui-text-muted, inherit);
}

/* 日期數字：較小、淡色、間距一致 */
.schedule-calendar :deep(.fc .fc-daygrid-day-number) {
  padding: 5px 7px;
  font-size: 0.75rem;
  color: var(--ui-text-muted, inherit);
}
.schedule-calendar :deep(.fc .fc-day-today .fc-daygrid-day-number) {
  color: var(--ui-primary);
  font-weight: 600;
}

/* 事件：字略小、行高緊湊、可換行；加上平滑過渡供 hover 使用 */
.schedule-calendar :deep(.fc-daygrid-event) {
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: normal;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    filter 0.12s ease;
}

/* 滑鼠移到事件上：浮起 + 輕微放大 + 陰影 + 提亮 */
.schedule-calendar :deep(.fc-daygrid-event:hover) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
  filter: brightness(1.08);
  position: relative;
  z-index: 5;
}

/* 登入後：日期格子與事件顯示可點游標 */
.schedule-calendar.is-editable :deep(.fc-daygrid-day),
.schedule-calendar.is-editable :deep(.fc-event) {
  cursor: pointer;
}
</style>
