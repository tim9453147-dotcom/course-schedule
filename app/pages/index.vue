<script setup lang="ts">
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type { CalendarOptions, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'

// 是否能編輯課表（需有 calendar 頁權限；超級管理員全通）
const canEdit = useCanEdit('calendar')
const toast = useToast()
const { loggedIn, session } = useUserSession()

const { data: courses, refresh: refreshCourses } = await useFetch<Course[]>('/api/courses')
const { data: events, refresh: refreshEvents } = await useFetch<CalEvent[]>('/api/events')

// 這個瀏覽者看得到哪些教室：超管全部、登入者看其被授權的、未登入或未設定則只看中壢
const visibleClassrooms = computed<string[]>(() => {
  if (session.value?.isSuperAdmin) return CLASSROOMS
  const allowed = sanitizeClassrooms(session.value?.classrooms)
  return loggedIn.value && allowed.length ? allowed : DEFAULT_CLASSROOMS
})

// 目前選到的教室分頁（visibleClassrooms 永遠非空，故 [0] 必有值）
const classroom = ref<string>(visibleClassrooms.value[0] ?? CLASSROOMS[0]!)
const tabItems = computed(() => visibleClassrooms.value.map(name => ({ label: name, value: name })))

// 可看教室變動（登入狀態載入後）時，確保目前分頁仍合法
watch(visibleClassrooms, (list) => {
  if (!list.includes(classroom.value)) classroom.value = list[0] ?? CLASSROOMS[0]!
}, { immediate: true })

const colorItems = COLOR_OPTIONS.map(c => ({ label: c.label, value: c.value }))
const kindItems = KIND_OPTIONS
const repeatItems = REPEAT_OPTIONS

// 手機版（< 640px）精簡顯示：星期日開頭、單字星期（日一二）、格子只顯示數字、事件不顯示時間。
// FullCalendar 只在 client 端掛載，SSR 時預設 false 不影響。
const isMobile = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(max-width: 640px)')
  const update = () => (isMobile.value = mq.matches)
  update()
  mq.addEventListener('change', update)
  onUnmounted(() => mq.removeEventListener('change', update))
})

// 把「每週固定課」+「單次活動」都轉成 FullCalendar 的事件（只取目前教室）
const calendarEvents = computed(() => {
  const recurring = (courses.value ?? [])
    .filter(c => c.classroom === classroom.value)
    .map(c => ({
      title: c.title,
      // FullCalendar 的星期：0=週日 ... 6=週六，我們的 7=週日要轉成 0
      daysOfWeek: [c.dayOfWeek % 7],
      startTime: c.startTime,
      endTime: c.endTime,
      color: colorHex(c.color),
      extendedProps: { source: 'course', refId: c.id }
    }))

  const oneOff = (events.value ?? [])
    .filter(e => e.classroom === classroom.value)
    .map(e => ({
      title: e.title,
      start: e.startTime ? `${e.date}T${e.startTime}` : e.date,
      end: e.endTime ? `${e.date}T${e.endTime}` : undefined,
      allDay: !e.startTime,
      color: colorHex(e.color),
      extendedProps: { source: 'event', refId: e.id }
    }))

  return [...recurring, ...oneOff]
})

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhTwLocale,
  // 週日開頭（0）
  firstDay: 0,
  // 星期標題只顯示單字（日／一／二…），去掉「週」
  dayHeaderFormat: { weekday: 'narrow' },
  // 格子只顯示日期數字（去掉「日」字）
  dayCellContent: (arg: { date: Date }) => String(arg.date.getDate()),
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
  },
  buttonText: { today: '今天' },
  height: 'auto',
  events: calendarEvents.value,
  // 手機版不顯示事件時間，只顯示名稱
  displayEventTime: !isMobile.value,
  // 有編輯權限才能點選與拖曳
  editable: canEdit.value,
  eventStartEditable: canEdit.value,
  eventDurationEditable: false, // 不允許用拖拉改長度（時間請用編輯視窗）
  eventClick: onEventClick,
  dateClick: onDateClick,
  eventDrop: onEventDrop
}))

/* ---------- 新增 / 編輯視窗 ---------- */
// kind   = 分類（活動 / 課程）→ 只影響預設顏色、標題、是否顯示老師欄
// repeat = 重複方式（不重複 / 每週重複）→ 決定要存到 events 還是 courses
const open = ref(false)
const mode = ref<'create' | 'edit'>('create')
// 編輯時記住這筆原本來自哪張表，存檔時若 repeat 改了就要在兩表之間搬移
const editingSource = ref<'event' | 'course'>('event')
const editingId = ref<number | null>(null)
const saving = ref(false)

const form = reactive({
  kind: 'activity',
  repeat: 'none' as 'none' | 'weekly',
  classroom: CLASSROOMS[0],
  title: '',
  host: '',
  sharer: '',
  summarizer: '',
  pm: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  color: KIND_DEFAULT_COLOR.activity,
  note: ''
})

function resetForm() {
  Object.assign(form, {
    kind: 'activity',
    repeat: 'none',
    classroom: classroom.value,
    title: '',
    host: '',
    sharer: '',
    summarizer: '',
    pm: '',
    date: todayStr(),
    startTime: '',
    endTime: '',
    // 地點預設為目前教室名稱，例如「中壢教室」
    location: `${classroom.value}教室`,
    color: KIND_DEFAULT_COLOR.activity,
    note: ''
  })
}

// 切換分類時帶入該分類的預設顏色（只在使用者點選時觸發，載入既有資料不會蓋掉）
function onKindChange(value: string | number) {
  form.kind = String(value)
  form.color = KIND_DEFAULT_COLOR[form.kind] ?? form.color
}

// 把 'YYYY-MM-DD' 轉成我們的星期（1=週一 ... 7=週日）
function weekdayOf(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay() // 0=週日 ... 6=週六
  return js === 0 ? 7 : js
}

// 今天的 'YYYY-MM-DD'（本地時區）
function todayStr() {
  return toLocalDateStr(new Date())
}

// 給「每週」用的代表日期：本週內符合該星期的日期（編輯既有課程時，DB 只存星期，補一個日期讓日期選擇器有值）
function dateForWeekday(dow: number) {
  const today = new Date()
  const todayDow = today.getDay() === 0 ? 7 : today.getDay()
  const d = new Date(today)
  d.setDate(today.getDate() + (dow - todayDow))
  return toLocalDateStr(d)
}

// 編輯視窗裡，每週重複時顯示是週幾
const weeklyDayLabel = computed(() =>
  form.date ? dayName(weekdayOf(form.date)) : ''
)

// Reka UI 的 Select 不允許 value 為空字串，所以「不指定（整天）」用哨兵值表示，
// 對外仍存空字串 ''（維持原本資料格式）。
const ALL_DAY = '__allday__'

// 小時下拉開頭多一個「不指定」；分鐘維持 00/15/30/45
const hourItems = [{ label: '不指定', value: ALL_DAY }, ...HOUR_OPTIONS]
const minuteItems = MINUTE_OPTIONS

// 把 form.startTime / form.endTime（'HH:MM' 或 ''）拆成小時、分鐘兩個下拉的 v-model
function hourModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[0]! : ALL_DAY,
    set: (v: string) => {
      // 選「不指定」→ 整天（存空字串）；否則保留原本分鐘、沒有就補 00
      form[key] = v === ALL_DAY ? '' : `${v}:${form[key] ? form[key].split(':')[1] : '00'}`
    }
  })
}
function minuteModel(key: 'startTime' | 'endTime') {
  return computed({
    get: () => form[key] ? form[key].split(':')[1]! : '00',
    set: (v: string) => {
      // 改分鐘時保留原本小時，沒有就補 00（不會用在「不指定」狀態，分鐘欄會停用）
      form[key] = `${form[key] ? form[key].split(':')[0] : '00'}:${v}`
    }
  })
}
const startHour = hourModel('startTime')
const startMinute = minuteModel('startTime')
const endHour = hourModel('endTime')
const endMinute = minuteModel('endTime')

// 點空白日期 → 新增（預設：活動、不重複，日期帶入點選的那天）
function onDateClick(info: DateClickArg) {
  if (!canEdit.value) return
  resetForm()
  mode.value = 'create'
  form.date = info.dateStr
  open.value = true
}

// 點現有事件 → 編輯
function onEventClick(info: EventClickArg) {
  if (!canEdit.value) return
  const source = info.event.extendedProps.source as 'course' | 'event'
  const refId = info.event.extendedProps.refId as number
  mode.value = 'edit'
  editingId.value = refId
  editingSource.value = source

  if (source === 'course') {
    const c = courses.value?.find(x => x.id === refId)
    if (!c) return
    Object.assign(form, {
      kind: c.kind ?? 'course', repeat: 'weekly',
      classroom: c.classroom, title: c.title,
      host: c.host ?? '', sharer: c.sharer ?? '', summarizer: c.summarizer ?? '', pm: c.pm ?? '',
      date: dateForWeekday(c.dayOfWeek), startTime: c.startTime, endTime: c.endTime,
      location: c.location ?? '', color: c.color, note: c.note ?? ''
    })
  } else {
    const e = events.value?.find(x => x.id === refId)
    if (!e) return
    Object.assign(form, {
      kind: e.kind ?? 'activity', repeat: 'none',
      classroom: e.classroom, title: e.title,
      host: e.host ?? '', sharer: e.sharer ?? '', summarizer: e.summarizer ?? '', pm: e.pm ?? '',
      date: e.date, startTime: e.startTime ?? '', endTime: e.endTime ?? '',
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
  if (!canEdit.value) {
    info.revert()
    return
  }
  const source = info.event.extendedProps.source as 'course' | 'event'
  const refId = info.event.extendedProps.refId as number

  try {
    if (source === 'event') {
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
  open.value = true
}

async function save() {
  if (!form.title.trim()) {
    toast.add({ title: '請輸入名稱', color: 'error' })
    return
  }
  if (!form.date) {
    toast.add({ title: '請選擇日期', color: 'error' })
    return
  }
  // 每週重複需要明確的開始與結束時間
  if (form.repeat === 'weekly' && (!form.startTime || !form.endTime)) {
    toast.add({ title: '每週重複需填開始與結束時間', color: 'error' })
    return
  }

  // repeat 決定要存到哪張表：weekly → courses、none → events
  const target = form.repeat === 'weekly' ? 'course' : 'event'
  saving.value = true
  try {
    if (target === 'course') {
      const body = {
        classroom: form.classroom, kind: form.kind, title: form.title,
        host: form.host, sharer: form.sharer, summarizer: form.summarizer, pm: form.pm,
        dayOfWeek: weekdayOf(form.date), startTime: form.startTime, endTime: form.endTime,
        location: form.location, color: form.color, note: form.note
      }
      if (mode.value === 'create') {
        await $fetch('/api/courses', { method: 'POST', body })
      } else if (editingSource.value === 'course') {
        await $fetch(`/api/courses/${editingId.value}`, { method: 'PUT', body })
      } else {
        // 原本是單次活動，改成每週 → 在 courses 新增、刪掉舊的 event
        await $fetch('/api/courses', { method: 'POST', body })
        await $fetch(`/api/events/${editingId.value}`, { method: 'DELETE' })
      }
    } else {
      const body = {
        classroom: form.classroom, kind: form.kind, title: form.title,
        host: form.host, sharer: form.sharer, summarizer: form.summarizer, pm: form.pm,
        date: form.date, startTime: form.startTime, endTime: form.endTime,
        location: form.location, color: form.color, note: form.note
      }
      if (mode.value === 'create') {
        await $fetch('/api/events', { method: 'POST', body })
      } else if (editingSource.value === 'event') {
        await $fetch(`/api/events/${editingId.value}`, { method: 'PUT', body })
      } else {
        // 原本是每週課程，改成不重複 → 在 events 新增、刪掉舊的 course
        await $fetch('/api/events', { method: 'POST', body })
        await $fetch(`/api/courses/${editingId.value}`, { method: 'DELETE' })
      }
    }
    await Promise.all([refreshCourses(), refreshEvents()])
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
    if (editingSource.value === 'course') {
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
  const t = form.kind === 'course' ? '課程' : '活動'
  return (mode.value === 'create' ? '新增' : '編輯') + t
})
</script>

<template>
  <!-- 手機版縮小左右 padding 讓課表接近滿版、日期欄位更寬；桌機維持原本留白 -->
  <UContainer class="py-8 px-1.5 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between gap-4 mb-4">
      <UTabs
        v-model="classroom"
        :items="tabItems"
        class="flex-1"
      />
      <UButton
        v-if="canEdit"
        icon="i-lucide-plus"
        class="shrink-0"
        @click="openCreate"
      >
        新增
      </UButton>
    </div>

    <p v-if="canEdit" class="text-sm text-muted mb-4">
      <UIcon name="i-lucide-mouse-pointer-click" class="size-4 align-text-bottom" />
      點空白日期可新增、點項目可編輯、直接拖曳可改日期（不重複）或星期（每週重複）。
    </p>

    <div class="schedule-calendar" :class="{ 'is-editable': canEdit }">
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
          <!-- 類型（活動 / 課程）：只是分類，會帶入不同預設顏色 -->
          <UFormField label="類型">
            <UTabs :model-value="form.kind" :items="kindItems" size="sm" @update:model-value="onKindChange" />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="教室">
              <USelect v-model="form.classroom" :items="tabItems" class="w-full" />
            </UFormField>
            <UFormField :label="form.kind === 'course' ? '課程名稱' : '活動名稱'">
              <UInput v-model="form.title" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="日期">
              <UInput v-model="form.date" type="date" class="w-full" />
            </UFormField>
            <UFormField label="教室 / 地點">
              <UInput v-model="form.location" class="w-full" />
            </UFormField>
          </div>

          <!-- 重複方式（像 Google 日曆）：不重複＝單次、每週重複＝每週同一天 -->
          <UFormField label="重複">
            <USelect v-model="form.repeat" :items="repeatItems" class="w-full" />
            <template #help>
              <span v-if="form.repeat === 'weekly'">每週{{ weeklyDayLabel }}重複</span>
            </template>
          </UFormField>

          <UFormField :label="form.repeat === 'none' ? '開始（不指定＝整天）' : '開始'">
            <div class="grid grid-cols-2 gap-2">
              <USelect v-model="startHour" :items="hourItems" placeholder="時" class="w-full" />
              <USelect v-model="startMinute" :items="minuteItems" :disabled="startHour === ALL_DAY" placeholder="分" class="w-full" />
            </div>
          </UFormField>
          <UFormField label="結束">
            <div class="grid grid-cols-2 gap-2">
              <USelect v-model="endHour" :items="hourItems" placeholder="時" class="w-full" />
              <USelect v-model="endMinute" :items="minuteItems" :disabled="endHour === ALL_DAY" placeholder="分" class="w-full" />
            </div>
          </UFormField>

          <!-- 課程角色（只在類型=課程時顯示，皆可留空） -->
          <div v-if="form.kind === 'course'" class="grid grid-cols-2 gap-4">
            <UFormField label="主持">
              <UInput v-model="form.host" class="w-full" />
            </UFormField>
            <UFormField label="分享">
              <UInput v-model="form.sharer" class="w-full" />
            </UFormField>
            <UFormField label="總結">
              <UInput v-model="form.summarizer" class="w-full" />
            </UFormField>
            <UFormField label="PM">
              <UInput v-model="form.pm" class="w-full" />
            </UFormField>
          </div>

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

/* 事件：字略小、行高緊湊、可換行 */
.schedule-calendar :deep(.fc-daygrid-event) {
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: normal;
}

/* 登入後：日期格子與事件顯示可點游標 */
.schedule-calendar.is-editable :deep(.fc-daygrid-day),
.schedule-calendar.is-editable :deep(.fc-event) {
  cursor: pointer;
}
</style>
