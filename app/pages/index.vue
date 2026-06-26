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

// FullCalendar 目前可見的日期範圍（含前後補格；end 為「不含」上界）。
// 每週課改為「手動展開」成個別日期實例（才能套用 startDate/endDate/exDates），
// 故需要知道要展開到哪段範圍；datesSet 會在初次渲染與換月時更新它。
// 初始給今天 ±60 天的緩衝，確保 datesSet 觸發前也有合理範圍。
const viewRange = ref<{ start: string, end: string }>((() => {
  const today = new Date()
  const lo = new Date(today)
  lo.setDate(today.getDate() - 60)
  const hi = new Date(today)
  hi.setDate(today.getDate() + 60)
  return { start: toLocalDateStr(lo), end: toLocalDateStr(hi) }
})())

function onDatesSet(arg: { startStr: string, endStr: string }) {
  viewRange.value = { start: arg.startStr.slice(0, 10), end: arg.endStr.slice(0, 10) }
}

// 把一門每週課展開成「可見範圍內」符合星期、且未被排除的個別日期（"YYYY-MM-DD"）。
// 套用 startDate（含端點下界）、endDate（含端點上界）、exDates（例外日）。
function expandCourse(c: Course): string[] {
  const out: string[] = []
  const { start: vStart, end: vEnd } = viewRange.value
  if (!vStart || !vEnd) return out
  // 起算日：可見範圍起點與課程 startDate 取較晚者
  const lower = c.startDate && c.startDate > vStart ? c.startDate : vStart
  const [ly, lm, ld] = lower.split('-').map(Number)
  const cur = new Date(ly!, lm! - 1, ld!)
  // 移到第一個符合星期的日子（我們 7=週日 → JS 的 0）
  const targetDow = c.dayOfWeek % 7
  while (cur.getDay() !== targetDow) cur.setDate(cur.getDate() + 1)
  const exSet = new Set(c.exDates ?? [])
  for (;;) {
    const ds = toLocalDateStr(cur)
    if (ds >= vEnd) break // 超出可見範圍（vEnd 為不含上界）
    if (c.endDate && ds > c.endDate) break // 超出課程結束日（含端點）
    if (!exSet.has(ds)) out.push(ds)
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

// 把「每週固定課」+「單次活動」都轉成 FullCalendar 的事件（只取目前教室）
const calendarEvents = computed(() => {
  const recurring = (courses.value ?? [])
    .filter(c => c.classroom === classroom.value)
    .flatMap(c =>
      expandCourse(c).map(ds => ({
        title: c.title,
        start: c.startTime ? `${ds}T${c.startTime}` : ds,
        end: c.endTime ? `${ds}T${c.endTime}` : undefined,
        allDay: !c.startTime,
        color: colorHex(c.color),
        // occDate 記住「這是哪一次」，編輯時才知道要拆哪一天
        extendedProps: { source: 'course', refId: c.id, occDate: ds }
      }))
    )

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
  // 月曆事件只顯示名稱，不顯示時間
  displayEventTime: false,
  // 有編輯權限才能點選與拖曳
  editable: canEdit.value,
  eventStartEditable: canEdit.value,
  eventDurationEditable: false, // 不允許用拖拉改長度（時間請用編輯視窗）
  eventClick: onEventClick,
  dateClick: onDateClick,
  eventDrop: onEventDrop,
  // 換月／初次渲染時更新可見範圍，重新展開每週課
  datesSet: onDatesSet
}))

/* ---------- 新增 / 編輯視窗 ---------- */
// kind   = 分類（活動 / 課程）→ 只影響預設顏色、標題、是否顯示老師欄
// repeat = 重複方式（不重複 / 每週重複）→ 決定要存到 events 還是 courses
const open = ref(false)
const mode = ref<'create' | 'edit'>('create')
// 編輯時記住這筆原本來自哪張表，存檔時若 repeat 改了就要在兩表之間搬移
const editingSource = ref<'event' | 'course'>('event')
const editingId = ref<number | null>(null)
// 編輯每週課時，記住點到的是「哪一次」（用於 Google 日曆式的拆段／排除）
const editingOccurrenceDate = ref('')
const saving = ref(false)

// 修改範圍（像 Google 日曆）：僅這一次 / 這次及之後 / 全部
const scopeOpen = ref(false)
const editScope = ref<'this' | 'following' | 'all'>('this')
const editScopeItems = [
  { value: 'this', label: '僅這一次', description: '只改這一天，其餘維持原樣' },
  { value: 'following', label: '這次及之後', description: '從這一天起的所有重複都改' },
  { value: 'all', label: '全部（包含先前）', description: '整個系列（含先前）都改' }
]

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
    // 點到的那一次（展開後每個實例都帶 occDate）；保險起見 fallback 用事件起始日
    const occ = (info.event.extendedProps.occDate as string) || info.event.startStr.slice(0, 10)
    editingOccurrenceDate.value = occ
    Object.assign(form, {
      kind: c.kind ?? 'course', repeat: 'weekly',
      classroom: c.classroom, title: c.title,
      host: c.host ?? '', sharer: c.sharer ?? '', summarizer: c.summarizer ?? '', pm: c.pm ?? '',
      date: occ, startTime: c.startTime, endTime: c.endTime,
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

  // 編輯既有「每週重複」課程 → 先問修改範圍（像 Google 日曆），不直接存
  if (mode.value === 'edit' && editingSource.value === 'course' && form.repeat === 'weekly') {
    editScope.value = 'this'
    scopeOpen.value = true
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

// 某日的前一天（"YYYY-MM-DD"）
function dayBefore(ds: string) {
  const [y, m, d] = ds.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() - 1)
  return toLocalDateStr(dt)
}

// 依使用者選的修改範圍套用每週課的編輯（像 Google 日曆）
async function applyCourseEdit(scope: 'this' | 'following' | 'all') {
  const orig = courses.value?.find(c => c.id === editingId.value)
  if (!orig) return
  const occ = editingOccurrenceDate.value || form.date

  // 表單目前的「新內容」（套用到課程）
  const courseBody = {
    classroom: form.classroom, kind: form.kind, title: form.title,
    host: form.host, sharer: form.sharer, summarizer: form.summarizer, pm: form.pm,
    dayOfWeek: weekdayOf(form.date), startTime: form.startTime, endTime: form.endTime,
    location: form.location, color: form.color, note: form.note
  }
  // 原課程的內容欄位（拆段時，被保留的那一段維持原樣）
  const origBody = {
    classroom: orig.classroom, kind: orig.kind, title: orig.title,
    host: orig.host, sharer: orig.sharer, summarizer: orig.summarizer, pm: orig.pm,
    dayOfWeek: orig.dayOfWeek, startTime: orig.startTime, endTime: orig.endTime,
    location: orig.location, color: orig.color, note: orig.note
  }
  const origEx = orig.exDates ?? []

  saving.value = true
  try {
    if (scope === 'all') {
      // 全部：只改內容，重複範圍／例外日不動
      await $fetch(`/api/courses/${orig.id}`, {
        method: 'PUT',
        body: { ...courseBody, startDate: orig.startDate ?? '', endDate: orig.endDate ?? '', exDates: origEx }
      })
    } else if (scope === 'following') {
      // 這次及之後：原課結束於 occ 前一天；自 occ 起新建一段套用新內容
      await $fetch(`/api/courses/${orig.id}`, {
        method: 'PUT',
        body: { ...origBody, startDate: orig.startDate ?? '', endDate: dayBefore(occ), exDates: origEx.filter(d => d < occ) }
      })
      await $fetch('/api/courses', {
        method: 'POST',
        body: { ...courseBody, startDate: occ, endDate: orig.endDate ?? '', exDates: origEx.filter(d => d >= occ) }
      })
    } else {
      // 僅這一次：把 occ 加進原課例外日，並在該日建立單次活動覆寫
      const exDates = Array.from(new Set([...origEx, occ]))
      await $fetch(`/api/courses/${orig.id}`, {
        method: 'PUT',
        body: { ...origBody, startDate: orig.startDate ?? '', endDate: orig.endDate ?? '', exDates }
      })
      await $fetch('/api/events', {
        method: 'POST',
        body: {
          classroom: form.classroom, kind: form.kind, title: form.title,
          host: form.host, sharer: form.sharer, summarizer: form.summarizer, pm: form.pm,
          date: occ, startTime: form.startTime, endTime: form.endTime,
          location: form.location, color: form.color, note: form.note
        }
      })
    }
    await Promise.all([refreshCourses(), refreshEvents()])
    toast.add({ title: '已儲存', color: 'success' })
    scopeOpen.value = false
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

/* ---------- 匯入課表（貼上 JSON 批次依日期匯入單次活動）---------- */
const importOpen = ref(false)
const importing = ref(false)
const importClassroom = ref(classroom.value)
const importMode = ref<'append' | 'replace'>('append')
const importText = ref('')
const importProgress = ref('')

const importModeItems = [
  { value: 'append', label: '附加', description: '保留此教室原本的活動，匯入的直接新增上去' },
  { value: 'replace', label: '覆蓋此區間', description: '先刪除此教室在匯入日期範圍內的活動，再匯入' }
]

// 餵給 AI 把課表圖片轉成 JSON 的指令（「複製 AI 指令」按鈕用）
const AI_PROMPT = '把這張課表圖片轉成 JSON 陣列，每筆一個物件，欄位：title、date（西元日期 YYYY-MM-DD）、startTime/endTime（24 小時 HH:MM，整天留空）、host/sharer/summarizer/pm、location、note。只輸出 JSON，不要其他文字。'

const importPlaceholder = '[ { "title": "超凡訓練", "date": "2026-06-04", "startTime": "19:30", "endTime": "21:00" } ]'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface ParsedRow {
  title: string
  date: string
  startTime: string
  endTime: string
  host: string
  sharer: string
  summarizer: string
  pm: string
  location: string
  note: string
}

// 時間正規化：'8:5'→'08:05'、空→''、格式不符回原字串（讓預覽標錯）
function normalizeTime(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  if (!s) return ''
  const m = s.match(/^(\d{1,2}):(\d{1,2})$/)
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]!.padStart(2, '0')}` : s
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

// 解析貼上的 JSON → 預覽列 + 錯誤清單
const importParsed = ref<{ rows: ParsedRow[], errors: string[] } | null>(null)

function parseImport() {
  importProgress.value = ''
  let data: unknown
  try {
    data = JSON.parse(importText.value)
  } catch (e) {
    importParsed.value = { rows: [], errors: [`JSON 格式錯誤：${(e as Error).message}`] }
    return
  }
  if (!Array.isArray(data)) {
    importParsed.value = { rows: [], errors: ['最外層必須是陣列 [ … ]'] }
    return
  }
  const rows: ParsedRow[] = []
  const errors: string[] = []
  data.forEach((raw, i) => {
    const n = i + 1
    if (!raw || typeof raw !== 'object') {
      errors.push(`第 ${n} 筆不是物件`)
      return
    }
    const it = raw as Record<string, unknown>
    const title = str(it.title)
    if (!title) errors.push(`第 ${n} 筆缺少名稱`)
    const date = str(it.date)
    if (!DATE_RE.test(date)) errors.push(`第 ${n} 筆日期格式需為 YYYY-MM-DD（${date || '空白'}）`)
    const startTime = normalizeTime(it.startTime)
    const endTime = normalizeTime(it.endTime)
    if (startTime && !TIME_RE.test(startTime)) errors.push(`第 ${n} 筆開始時間格式錯誤（${startTime}）`)
    if (endTime && !TIME_RE.test(endTime)) errors.push(`第 ${n} 筆結束時間格式錯誤（${endTime}）`)
    rows.push({
      title,
      date,
      startTime,
      endTime,
      host: str(it.host),
      sharer: str(it.sharer),
      summarizer: str(it.summarizer),
      pm: str(it.pm),
      location: str(it.location),
      note: str(it.note)
    })
  })
  importParsed.value = { rows, errors }
}

// 貼上內容一變動就清掉舊預覽，避免拿舊預覽去匯入
watch(importText, () => {
  importParsed.value = null
})

async function copyAiPrompt() {
  try {
    await navigator.clipboard.writeText(AI_PROMPT)
    toast.add({ title: '已複製 AI 指令', color: 'success' })
  } catch {
    toast.add({ title: '複製失敗，請手動選取', color: 'error' })
  }
}

function openImport() {
  importClassroom.value = classroom.value
  importMode.value = 'append'
  importText.value = ''
  importParsed.value = null
  importProgress.value = ''
  importOpen.value = true
}

async function confirmImport() {
  const parsed = importParsed.value
  if (!parsed || !parsed.rows.length) {
    toast.add({ title: '請先貼上資料並解析預覽', color: 'error' })
    return
  }
  if (parsed.errors.length) {
    toast.add({ title: '資料有誤，請先修正', description: parsed.errors[0], color: 'error' })
    return
  }
  const CHUNK = 40 // D1 免費方案 50 query/次，留邊；超過就切多次請求
  const rows = parsed.rows
  // 覆蓋模式只清除整批 items 的日期區間（min/max），避免清掉其他月份
  const dates = rows.map(r => r.date).sort()
  const replaceFrom = dates[0]
  const replaceTo = dates[dates.length - 1]
  importing.value = true
  let done = 0
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      // 覆蓋模式只在第一塊刪除該區間，其餘塊一律附加
      const chunkMode = importMode.value === 'replace' && i === 0 ? 'replace' : 'append'
      await $fetch('/api/events/import', {
        method: 'POST',
        body: { classroom: importClassroom.value, mode: chunkMode, replaceFrom, replaceTo, items: chunk }
      })
      done += chunk.length
      if (rows.length > CHUNK) importProgress.value = `已匯入 ${done} / ${rows.length}…`
    }
    await refreshEvents()
    toast.add({ title: `已匯入 ${done} 筆到 ${importClassroom.value}`, color: 'success' })
    importOpen.value = false
  } catch {
    const desc = done > 0 ? `已成功寫入 ${done} 筆，後續中斷` : '請檢查資料內容'
    toast.add({ title: '匯入失敗', description: desc, color: 'error' })
  } finally {
    importing.value = false
  }
}
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
      <div v-if="canEdit" class="flex shrink-0 gap-2">
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          @click="openImport"
        >
          匯入
        </UButton>
        <UButton
          icon="i-lucide-plus"
          @click="openCreate"
        >
          新增
        </UButton>
      </div>
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

    <!-- 修改範圍（每週重複項目按儲存時詢問，像 Google 日曆） -->
    <UModal v-model:open="scopeOpen" title="要修改哪些活動？">
      <template #body>
        <div class="space-y-4">
          <URadioGroup v-model="editScope" :items="editScopeItems" />
          <div class="flex gap-2 justify-end pt-2">
            <UButton color="neutral" variant="ghost" @click="scopeOpen = false">
              取消
            </UButton>
            <UButton :loading="saving" @click="applyCourseEdit(editScope)">
              確認
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 匯入課表（選教室＋貼上 JSON＋預覽確認，批次依日期匯入單次活動） -->
    <UModal v-model:open="importOpen" title="匯入課表" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="匯入到教室">
              <USelect v-model="importClassroom" :items="tabItems" class="w-full" />
            </UFormField>
            <UFormField label="模式">
              <URadioGroup v-model="importMode" :items="importModeItems" />
            </UFormField>
          </div>

          <UFormField label="課表 JSON">
            <template #help>
              <span>貼上 AI 從課表圖片轉出的 JSON 陣列。</span>
              <UButton variant="link" size="xs" class="p-0 align-baseline" @click="copyAiPrompt">
                複製 AI 指令
              </UButton>
            </template>
            <UTextarea
              v-model="importText"
              class="w-full font-mono text-xs"
              :rows="8"
              :placeholder="importPlaceholder"
            />
          </UFormField>

          <!-- 解析後預覽 -->
          <div v-if="importParsed" class="space-y-2">
            <div v-if="importParsed.errors.length" class="text-sm text-error space-y-1">
              <p v-for="(e, i) in importParsed.errors" :key="i">
                ⚠ {{ e }}
              </p>
            </div>
            <p class="text-sm text-muted">
              共 {{ importParsed.rows.length }} 筆<span v-if="importMode === 'replace'">（將覆蓋 {{ importClassroom }} 在此日期範圍內的活動）</span>
            </p>
            <div v-if="importParsed.rows.length" class="max-h-56 overflow-auto rounded border border-default text-sm">
              <table class="w-full">
                <thead class="bg-elevated text-muted">
                  <tr>
                    <th class="text-left px-2 py-1">
                      名稱
                    </th>
                    <th class="text-left px-2 py-1">
                      日期
                    </th>
                    <th class="text-left px-2 py-1">
                      時間
                    </th>
                    <th class="text-left px-2 py-1">
                      角色
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in importParsed.rows" :key="i" class="border-t border-default">
                    <td class="px-2 py-1">
                      {{ r.title || '—' }}
                    </td>
                    <td class="px-2 py-1">
                      {{ r.date || '？' }}
                    </td>
                    <td class="px-2 py-1">
                      {{ r.startTime ? `${r.startTime}–${r.endTime || ''}` : '整天' }}
                    </td>
                    <td class="px-2 py-1">
                      {{ [r.host, r.sharer, r.summarizer, r.pm].filter(Boolean).join('/') || '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p v-if="importProgress" class="text-sm text-muted">
            {{ importProgress }}
          </p>

          <div class="flex gap-2 justify-end pt-2">
            <UButton color="neutral" variant="ghost" @click="importOpen = false">
              取消
            </UButton>
            <UButton v-if="!importParsed" @click="parseImport">
              解析預覽
            </UButton>
            <template v-else>
              <UButton color="neutral" variant="outline" @click="parseImport">
                重新解析
              </UButton>
              <UButton
                :loading="importing"
                :disabled="!importParsed.rows.length || !!importParsed.errors.length"
                @click="confirmImport"
              >
                確認匯入
              </UButton>
            </template>
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
