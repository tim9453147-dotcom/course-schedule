<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type { CalendarOptions, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'

const { loggedIn } = useUserSession()
const toast = useToast()

const { data: courses, refresh: refreshCourses } = await useFetch<Course[]>('/api/courses')
const { data: events, refresh: refreshEvents } = await useFetch<CalEvent[]>('/api/events')

// 目前選到的教室分頁
const classroom = ref(CLASSROOMS[0])
const tabItems = CLASSROOMS.map(name => ({ label: name, value: name }))

const dayItems = DAY_NAMES.map((name, i) => ({ label: name, value: i + 1 }))
const colorItems = COLOR_OPTIONS.map(c => ({ label: c.label, value: c.value }))
const typeItems = [
  { label: '單次活動', value: 'event' as const },
  { label: '每週課程', value: 'course' as const }
]

// 把「每週固定課」+「單次活動」都轉成 FullCalendar 的事件（只取目前教室）
const calendarEvents = computed(() => {
  const recurring = (courses.value ?? [])
    .filter(c => c.classroom === classroom.value)
    .map(c => ({
      title: c.location ? `${c.title}＠${c.location}` : c.title,
      // FullCalendar 的星期：0=週日 ... 6=週六，我們的 7=週日要轉成 0
      daysOfWeek: [c.dayOfWeek % 7],
      startTime: c.startTime,
      endTime: c.endTime,
      color: colorHex(c.color),
      extendedProps: { kind: 'course', refId: c.id }
    }))

  const oneOff = (events.value ?? [])
    .filter(e => e.classroom === classroom.value)
    .map(e => ({
      title: e.location ? `${e.title}＠${e.location}` : e.title,
      start: e.startTime ? `${e.date}T${e.startTime}` : e.date,
      end: e.endTime ? `${e.date}T${e.endTime}` : undefined,
      allDay: !e.startTime,
      color: colorHex(e.color),
      extendedProps: { kind: 'event', refId: e.id }
    }))

  return [...recurring, ...oneOff]
})

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhTwLocale,
  firstDay: 1, // 週一開始
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
  },
  buttonText: { today: '今天' },
  height: 'auto',
  events: calendarEvents.value,
  displayEventTime: true,
  // 登入後才能點選與拖曳
  editable: loggedIn.value,
  eventStartEditable: loggedIn.value,
  eventDurationEditable: false, // 不允許用拖拉改長度（時間請用編輯視窗）
  eventClick: onEventClick,
  dateClick: onDateClick,
  eventDrop: onEventDrop
}))

/* ---------- 新增 / 編輯視窗 ---------- */
const open = ref(false)
const mode = ref<'create' | 'edit'>('create')
const formType = ref<'event' | 'course'>('event')
const editingId = ref<number | null>(null)
const saving = ref(false)

const form = reactive({
  classroom: CLASSROOMS[0],
  title: '',
  teacher: '',
  dayOfWeek: 1,
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  color: 'sky',
  note: ''
})

function resetForm() {
  Object.assign(form, {
    classroom: classroom.value,
    title: '',
    teacher: '',
    dayOfWeek: 1,
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    color: 'sky',
    note: ''
  })
}

// 把 'YYYY-MM-DD' 轉成我們的星期（1=週一 ... 7=週日）
function weekdayOf(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay() // 0=週日 ... 6=週六
  return js === 0 ? 7 : js
}

// 點空白日期 → 新增
function onDateClick(info: DateClickArg) {
  if (!loggedIn.value) return
  resetForm()
  mode.value = 'create'
  formType.value = 'event'
  form.date = info.dateStr
  form.dayOfWeek = weekdayOf(info.dateStr)
  form.color = 'rose'
  open.value = true
}

// 點現有事件 → 編輯
function onEventClick(info: EventClickArg) {
  if (!loggedIn.value) return
  const kind = info.event.extendedProps.kind as 'course' | 'event'
  const refId = info.event.extendedProps.refId as number
  mode.value = 'edit'
  editingId.value = refId

  if (kind === 'course') {
    const c = courses.value?.find(x => x.id === refId)
    if (!c) return
    formType.value = 'course'
    Object.assign(form, {
      classroom: c.classroom, title: c.title, teacher: c.teacher ?? '',
      dayOfWeek: c.dayOfWeek, date: '', startTime: c.startTime, endTime: c.endTime,
      location: c.location ?? '', color: c.color, note: c.note ?? ''
    })
  } else {
    const e = events.value?.find(x => x.id === refId)
    if (!e) return
    formType.value = 'event'
    Object.assign(form, {
      classroom: e.classroom, title: e.title, teacher: '',
      dayOfWeek: 1, date: e.date, startTime: e.startTime ?? '', endTime: e.endTime ?? '',
      location: e.location ?? '', color: e.color, note: e.note ?? ''
    })
  }
  open.value = true
}

// 把 Date 轉成本地時區的 'YYYY-MM-DD'
function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 拖曳事件 → 改日期（單次活動）或改星期（每週課程）
async function onEventDrop(info: EventDropArg) {
  if (!loggedIn.value) {
    info.revert()
    return
  }
  const kind = info.event.extendedProps.kind as 'course' | 'event'
  const refId = info.event.extendedProps.refId as number

  try {
    if (kind === 'event') {
      const e = events.value?.find(x => x.id === refId)
      if (!e || !info.event.start) return
      const newDate = toLocalDateStr(info.event.start)
      await $fetch(`/api/events/${refId}`, {
        method: 'PUT',
        body: { ...e, date: newDate, startTime: e.startTime ?? '', endTime: e.endTime ?? '' }
      })
      await refreshEvents()
      toast.add({ title: `已移到 ${newDate}`, color: 'success' })
    } else {
      const c = courses.value?.find(x => x.id === refId)
      if (!c) return
      // 拖曳移動的天數，換算成新的星期（1=週一 ... 7=週日）
      const deltaDays = info.delta.days
      const newDay = ((c.dayOfWeek - 1 + deltaDays) % 7 + 7) % 7 + 1
      await $fetch(`/api/courses/${refId}`, {
        method: 'PUT',
        body: { ...c, dayOfWeek: newDay }
      })
      await refreshCourses()
      toast.add({ title: `已改到${dayName(newDay)}`, color: 'success' })
    }
  } catch {
    info.revert()
    toast.add({ title: '移動失敗', color: 'error' })
  }
}

// 工具列右側「新增」按鈕（登入才顯示）
function openCreate() {
  resetForm()
  mode.value = 'create'
  formType.value = 'event'
  form.color = 'rose'
  open.value = true
}

async function save() {
  if (!form.title.trim()) {
    toast.add({ title: '請輸入名稱', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (formType.value === 'course') {
      const body = {
        classroom: form.classroom, title: form.title, teacher: form.teacher,
        dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime,
        location: form.location, color: form.color, note: form.note
      }
      if (mode.value === 'create') {
        await $fetch('/api/courses', { method: 'POST', body })
      } else {
        await $fetch(`/api/courses/${editingId.value}`, { method: 'PUT', body })
      }
      await refreshCourses()
    } else {
      const body = {
        classroom: form.classroom, title: form.title, date: form.date,
        startTime: form.startTime, endTime: form.endTime,
        location: form.location, color: form.color, note: form.note
      }
      if (mode.value === 'create') {
        await $fetch('/api/events', { method: 'POST', body })
      } else {
        await $fetch(`/api/events/${editingId.value}`, { method: 'PUT', body })
      }
      await refreshEvents()
    }
    toast.add({ title: '已儲存', color: 'success' })
    open.value = false
  } catch {
    toast.add({ title: '儲存失敗', description: '請檢查欄位內容', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (mode.value !== 'edit' || editingId.value === null) return
  if (!confirm(`確定刪除「${form.title}」？`)) return
  try {
    if (formType.value === 'course') {
      await $fetch(`/api/courses/${editingId.value}`, { method: 'DELETE' })
      await refreshCourses()
    } else {
      await $fetch(`/api/events/${editingId.value}`, { method: 'DELETE' })
      await refreshEvents()
    }
    toast.add({ title: '已刪除', color: 'success' })
    open.value = false
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}

const modalTitle = computed(() => {
  const t = formType.value === 'course' ? '每週課程' : '單次活動'
  return (mode.value === 'create' ? '新增' : '編輯') + t
})
</script>

<template>
  <UContainer class="py-8">
    <div class="flex items-center justify-between gap-4 mb-4">
      <UTabs
        v-model="classroom"
        :items="tabItems"
        class="flex-1"
      />
      <UButton
        v-if="loggedIn"
        icon="i-lucide-plus"
        class="shrink-0"
        @click="openCreate"
      >
        新增
      </UButton>
    </div>

    <p v-if="loggedIn" class="text-sm text-muted mb-4">
      <UIcon name="i-lucide-mouse-pointer-click" class="size-4 align-text-bottom" />
      點空白日期可新增、點課程／活動可編輯、直接拖曳可改日期（活動）或星期（每週課程）。
    </p>

    <div class="schedule-calendar" :class="{ 'is-editable': loggedIn }">
      <ClientOnly>
        <FullCalendar :options="calendarOptions" />
        <template #fallback>
          <div class="text-muted py-16 text-center">
            月曆載入中…
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- 新增 / 編輯視窗 -->
    <UModal v-model:open="open" :title="modalTitle">
      <template #body>
        <div class="space-y-4">
          <!-- 類型切換（只有新增時可改） -->
          <UFormField v-if="mode === 'create'" label="類型">
            <UTabs v-model="formType" :items="typeItems" size="sm" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="教室">
              <USelect v-model="form.classroom" :items="tabItems" class="w-full" />
            </UFormField>
            <UFormField :label="formType === 'course' ? '課程名稱' : '活動名稱'">
              <UInput v-model="form.title" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- 每週課程：選星期；單次活動：選日期 -->
            <UFormField v-if="formType === 'course'" label="星期">
              <USelect v-model="form.dayOfWeek" :items="dayItems" class="w-full" />
            </UFormField>
            <UFormField v-else label="日期">
              <UInput v-model="form.date" type="date" class="w-full" />
            </UFormField>

            <UFormField label="教室 / 地點">
              <UInput v-model="form.location" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="formType === 'event' ? '開始（留空＝整天）' : '開始'">
              <UInput v-model="form.startTime" type="time" class="w-full" />
            </UFormField>
            <UFormField label="結束">
              <UInput v-model="form.endTime" type="time" class="w-full" />
            </UFormField>
          </div>

          <UFormField v-if="formType === 'course'" label="老師">
            <UInput v-model="form.teacher" class="w-full" />
          </UFormField>

          <UFormField label="顏色">
            <USelect v-model="form.color" :items="colorItems" class="w-full" />
          </UFormField>

          <UFormField label="備註">
            <UTextarea v-model="form.note" class="w-full" :rows="2" />
          </UFormField>

          <div class="flex items-center justify-between pt-2">
            <UButton
              v-if="mode === 'edit'"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="remove"
            >
              刪除
            </UButton>
            <div class="flex gap-2 ml-auto">
              <UButton color="neutral" variant="ghost" @click="open = false">
                取消
              </UButton>
              <UButton :loading="saving" @click="save">
                儲存
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<style scoped>
/* 讓 FullCalendar 配合 Nuxt UI 的明暗色與字級 */
.schedule-calendar :deep(.fc) {
  --fc-border-color: var(--ui-border);
  --fc-today-bg-color: color-mix(in oklab, var(--ui-primary) 12%, transparent);
  --fc-page-bg-color: transparent;
  font-size: 0.875rem;
}
.schedule-calendar :deep(.fc .fc-button-primary) {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}
.schedule-calendar :deep(.fc .fc-button-primary:disabled) {
  opacity: 0.5;
}
.schedule-calendar :deep(.fc-daygrid-event) {
  white-space: normal;
}
/* 登入後：日期格子與事件顯示可點游標 */
.schedule-calendar.is-editable :deep(.fc-daygrid-day),
.schedule-calendar.is-editable :deep(.fc-event) {
  cursor: pointer;
}
</style>
