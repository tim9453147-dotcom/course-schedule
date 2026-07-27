<script setup lang="ts">
// 名單頁「總名單」分頁內容（原 /crm 頁面主體，改為元件供分頁載入）。
const notify = useNotify()
const confirm = useConfirm()

// deep: true → 名單清單為深層響應式，inline 樂觀更新（c.xxx=value、Object.assign）
// 才會即時反映到畫面。Nuxt 4 的 useFetch 預設是 shallow，不加會「送了 API 但畫面不動」。
const { data: contacts, refresh: refreshContacts } = await useFetch<Contact[]>('/api/contacts', { key: 'global-contacts', deep: true })
// 進度階段（每位使用者各自管理；後端首次為空時會種子預設）
const { data: stages, refresh: refreshStages } = await useFetch<ContactStage[]>('/api/contact-stages', { deep: true })
// 地點選項（每位使用者各自管理；預設只有中壢）
const { data: locationOptions, refresh: refreshLocationOptions } = await useFetch<ContactLocation[]>('/api/contact-locations', { deep: true })

async function addLocationOption(label: string) {
  try {
    const created = await $fetch<ContactLocation>('/api/contact-locations', { method: 'POST', body: { label } })
    if (!(locationOptions.value ?? []).some(o => o.id === created.id)) {
      locationOptions.value = [...(locationOptions.value ?? []), created]
    }
  } catch {
    notify.error('新增地點失敗')
    await refreshLocationOptions()
  }
}

async function removeLocationOption(id: number) {
  const prev = locationOptions.value ?? []
  locationOptions.value = prev.filter(o => o.id !== id) // 樂觀移除
  try {
    await $fetch(`/api/contact-locations/${id}`, { method: 'DELETE' })
  } catch {
    notify.error('刪除地點失敗')
    await refreshLocationOptions()
  }
}

/* ---------- 篩選 / 搜尋 ---------- */
const searchInput = ref('')
const search = ref('')
let _searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (_searchTimer) clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => {
    search.value = v
  }, 400)
})
const LOCATION_NONE = '__none__'

// 'all'=不限；'broached'/'unbroached'=破題狀態；其餘為階段 id（字串）。
// reka-ui 的 SelectItem 不允許空字串值，故用 'all' 當哨兵。
const stepFilter = ref<string>('all')
const freqFilter = ref('all')
const typeFilter = ref<string>('all')
const locationFilter = ref<string>('all')
const overdueOnly = ref(false)
const sortByNext = ref(false)
const mobileFilterOpen = ref(false)

const stepFilterItems = computed(() => [
  { label: '全部進度', value: 'all' },
  { label: '未破題', value: 'unbroached' },
  { label: '破題', value: 'broached' },
  ...(stages.value ?? []).map(s => ({ label: `已完成「${s.label}」`, value: String(s.id) }))
])
const freqFilterItems = [
  { label: '全部頻率', value: 'all' },
  ...FOLLOW_UP_FREQ_OPTIONS.map(f => ({ label: f, value: f }))
]
const typeFilterItems = [
  { label: '全部類型', value: 'all' },
  { label: '顧客', value: 'customer' },
  { label: '準領導人', value: 'leader' }
]
const locationFilterItems = computed(() => [
  { label: '全部地點', value: 'all' },
  { label: '未設定', value: LOCATION_NONE },
  ...(locationOptions.value ?? []).map(o => ({ label: o.label, value: o.label }))
])
const freqFormItems = FOLLOW_UP_FREQ_OPTIONS.map(f => ({ label: f, value: f }))

const hasActiveFilter = computed(() =>
  overdueOnly.value || stepFilter.value !== 'all' || freqFilter.value !== 'all' || typeFilter.value !== 'all' || locationFilter.value !== 'all' || !!searchInput.value
)

function clearAllFilters() {
  searchInput.value = ''
  search.value = ''
  stepFilter.value = 'all'
  freqFilter.value = 'all'
  typeFilter.value = 'all'
  locationFilter.value = 'all'
  overdueOnly.value = false
}

function getAvatarGradient(c: Contact) {
  if (c.contactType === 'leader') {
    return 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold'
  }
  return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold'
}

function stageCount(stageId: number) {
  return (contacts.value ?? []).filter(c => (c.completedStages ?? []).includes(stageId)).length
}

// 點擊「破題」欄位標題：循環 all → broached → unbroached → all
function cycleStepFilter() {
  if (stepFilter.value === 'all') stepFilter.value = 'broached'
  else if (stepFilter.value === 'broached') stepFilter.value = 'unbroached'
  else stepFilter.value = 'all'
}

// 點擊「跟進頻率」欄位標題：循環各頻率選項
function cycleFreqFilter() {
  const opts = ['all', ...FOLLOW_UP_FREQ_OPTIONS]
  const idx = opts.indexOf(freqFilter.value)
  freqFilter.value = opts[(idx + 1) % opts.length]!
}

const filtered = computed(() => {
  let list = contacts.value ?? []
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(q)
      || (c.location ?? '').toLowerCase().includes(q)
    )
  }
  if (stepFilter.value === 'broached') list = list.filter(c => c.broached)
  else if (stepFilter.value === 'unbroached') list = list.filter(c => !c.broached)
  else if (stepFilter.value !== 'all') {
    const sid = Number(stepFilter.value)
    list = list.filter(c => (c.completedStages ?? []).includes(sid))
  }
  if (typeFilter.value !== 'all') list = list.filter(c => c.contactType === typeFilter.value)
  if (freqFilter.value !== 'all') list = list.filter(c => c.followUpFreq === freqFilter.value)
  if (locationFilter.value === LOCATION_NONE) list = list.filter(c => !c.location)
  else if (locationFilter.value !== 'all') list = list.filter(c => c.location === locationFilter.value)
  if (overdueOnly.value) list = list.filter(c => isOverdue(c.nextFollowUp))

  if (sortByNext.value) {
    // 有下次跟進日的排前面（愈早愈前），沒有的排最後
    list = [...list].sort((a, b) => {
      if (!a.nextFollowUp) return 1
      if (!b.nextFollowUp) return -1
      return a.nextFollowUp < b.nextFollowUp ? -1 : 1
    })
  }
  return list
})

/* ---------- 統計 ---------- */
const stats = computed(() => {
  const list = contacts.value ?? []
  const broached = list.filter(c => c.broached).length
  const steps = (stages.value ?? []).map(s => ({
    label: s.label,
    id: s.id,
    count: list.filter(c => (c.completedStages ?? []).includes(s.id)).length
  }))
  const overdue = list.filter(c => isOverdue(c.nextFollowUp)).length
  return { total: list.length, broached, steps, overdue }
})

/* ---------- inline 即時更新 ---------- */
// 破題與否（二選一切換）
async function setBroached(c: Contact, value: boolean) {
  if (c.broached === value) return
  const prev = c.broached
  c.broached = value // 樂觀更新
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { broached: value }
    })
    Object.assign(c, updated)
  } catch {
    c.broached = prev
    notify.error('更新失敗')
  }
}

// 名單類型（顧客／準領導人，二選一切換）
async function setContactType(c: Contact, value: 'customer' | 'leader') {
  if (c.contactType === value) return
  const prev = c.contactType
  c.contactType = value // 樂觀更新
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { contactType: value }
    })
    Object.assign(c, updated)
  } catch {
    c.contactType = prev
    notify.error('更新失敗')
  }
}

// 切換某個進度階段是否完成
async function toggleStage(c: Contact, stageId: number) {
  const prev = [...(c.completedStages ?? [])]
  const next = prev.includes(stageId)
    ? prev.filter(id => id !== stageId)
    : [...prev, stageId]
  c.completedStages = next // 樂觀更新
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { completedStages: next }
    })
    Object.assign(c, updated)
  } catch {
    c.completedStages = prev
    notify.error('更新失敗')
  }
}

async function changeFreq(c: Contact, value: string) {
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { followUpFreq: value || null }
    })
    Object.assign(c, updated) // 同步後端重算後的 nextFollowUp
  } catch {
    notify.error('更新失敗')
    await refreshContacts()
  }
}

async function changeLocation(c: Contact, value: string) {
  const nextVal = value.trim() || null
  if ((c.location ?? null) === nextVal) return
  const prev = c.location
  c.location = nextVal // 樂觀更新
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { location: nextVal ?? '' }
    })
    Object.assign(c, updated)
  } catch {
    c.location = prev
    notify.error('更新地點失敗')
  }
}

// inline 文字欄位（姓名）即時更新
async function patchField(c: Contact, key: 'name') {
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { [key]: c[key] ?? '' }
    })
    Object.assign(c, updated)
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('更新失敗', msg)
    await refreshContacts() // 還原成後端資料（例如姓名被清空遭拒）
  }
}

/* ---------- 管理進度階段 ---------- */
const stagesModalOpen = ref(false)
const newStageLabel = ref('')
const stageSaving = ref(false)

async function addStage() {
  const label = newStageLabel.value.trim()
  if (!label) return
  stageSaving.value = true
  try {
    await $fetch('/api/contact-stages', { method: 'POST', body: { label } })
    newStageLabel.value = ''
    await refreshStages()
  } catch {
    notify.error('新增階段失敗')
  } finally {
    stageSaving.value = false
  }
}

// 改名（model-value 已樂觀寫回 s.label，這裡把結果存到後端）
async function renameStage(s: ContactStage) {
  const v = s.label.trim()
  if (!v) {
    await refreshStages() // 清空不允許，還原
    return
  }
  try {
    await $fetch(`/api/contact-stages/${s.id}`, { method: 'PATCH', body: { label: v } })
  } catch {
    notify.error('改名失敗')
    await refreshStages()
  }
}

// 上／下移：與相鄰階段交換 sortOrder
async function moveStage(index: number, dir: -1 | 1) {
  const list = stages.value ?? []
  const j = index + dir
  if (j < 0 || j >= list.length) return
  const a = list[index]!
  const b = list[j]!
  try {
    await Promise.all([
      $fetch(`/api/contact-stages/${a.id}`, { method: 'PATCH', body: { sortOrder: b.sortOrder } }),
      $fetch(`/api/contact-stages/${b.id}`, { method: 'PATCH', body: { sortOrder: a.sortOrder } })
    ])
    await refreshStages()
  } catch {
    notify.error('排序失敗')
    await refreshStages()
  }
}

async function deleteStage(s: ContactStage) {
  if (!(await confirm({ title: '刪除階段', description: `確定刪除階段「${s.label}」？已標記此階段的名單會失去這個標記。`, danger: true }))) return
  try {
    await $fetch(`/api/contact-stages/${s.id}`, { method: 'DELETE' })
    await Promise.all([refreshStages(), refreshContacts()])
  } catch {
    notify.error('刪除失敗')
  }
}

/* ---------- 新增名單 ---------- */
const formOpen = ref(false)
const saving = ref(false)
const form = reactive({
  name: '',
  location: '',
  broached: false,
  contactType: 'customer' as 'customer' | 'leader',
  completedStages: [] as number[],
  followUpFreq: '',
  lastFollowUp: '',
  note: ''
})

function toggleFormStage(id: number, val: boolean | 'indeterminate') {
  const on = val === true
  const has = form.completedStages.includes(id)
  if (on && !has) form.completedStages.push(id)
  else if (!on && has) form.completedStages = form.completedStages.filter(x => x !== id)
}

function openCreate() {
  Object.assign(form, {
    name: '',
    location: '',
    broached: false,
    contactType: 'customer',
    completedStages: [],
    followUpFreq: '',
    lastFollowUp: '',
    note: ''
  })
  formOpen.value = true
}

async function save() {
  if (!form.name.trim()) {
    notify.error('請輸入姓名')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      location: form.location.trim() || null
    }
    await $fetch('/api/contacts', { method: 'POST', body: payload })
    notify.success('已新增')
    formOpen.value = false
    await refreshContacts()
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('新增失敗', msg)
  } finally {
    saving.value = false
  }
}

async function remove(c: Contact) {
  if (!(await confirm({ title: '刪除名單', description: `確定刪除「${c.name}」？相關跟進紀錄也會一併刪除。`, danger: true }))) return
  try {
    await $fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
    notify.success('已刪除')
    await refreshContacts()
  } catch {
    notify.error('刪除失敗')
  }
}

// 個人名單表明細編輯 modal（誰的朋友、開發夥伴、聯絡方式、新人資訊、等級、狀態）
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
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold">
          客戶名單 CRM
        </h1>
        <div class="flex items-center gap-1.5 text-xs text-muted">
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ stats.total }} 人
          </UBadge>
          <span
            v-if="stats.overdue > 0"
            class="text-error font-medium"
          >· {{ stats.overdue }} 位逾期</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <UButton
          icon="i-lucide-list-checks"
          color="neutral"
          variant="outline"
          size="sm"
          @click="stagesModalOpen = true"
        >
          <span class="text-xs sm:text-sm">管理階段</span>
        </UButton>
        <UButton
          icon="i-lucide-user-plus"
          size="sm"
          @click="openCreate"
        >
          <span class="text-xs sm:text-sm">新增名單</span>
        </UButton>
      </div>
    </div>

    <!-- 篩選摘要（當有篩選條件時顯示） -->
    <div
      v-if="hasActiveFilter"
      class="flex items-center gap-2 mb-3 text-sm"
    >
      <UBadge
        color="primary"
        variant="subtle"
        size="sm"
      >
        <UIcon
          name="i-lucide-filter"
          class="size-3 mr-1"
        />
        {{ filtered.length }} / {{ stats.total }} 筆
      </UBadge>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-x"
        @click="clearAllFilters"
      >
        清除所有篩選
      </UButton>
    </div>

    <!-- ===== 手機版卡片佈局 ===== -->
    <div class="sm:hidden space-y-3">
      <!-- 手機頂部快捷標籤列 (Horizontal Scrollable Quick Filter Chips) -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none text-xs">
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="stepFilter === 'all' && freqFilter === 'all' && typeFilter === 'all' && !overdueOnly
            ? 'bg-primary text-inverted border-primary font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-primary/40'"
          @click="clearAllFilters"
        >
          全部 ({{ stats.total }})
        </button>

        <button
          v-if="stats.overdue > 0"
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border flex items-center gap-1"
          :class="overdueOnly
            ? 'bg-error text-inverted border-error font-semibold shadow-2xs'
            : 'bg-error/10 text-error border-error/30 hover:bg-error/20'"
          @click="overdueOnly = !overdueOnly"
        >
          <UIcon
            name="i-lucide-alarm-clock"
            class="size-3.5"
          />
          逾期 ({{ stats.overdue }})
        </button>

        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="typeFilter === 'customer'
            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-emerald-500/40'"
          @click="typeFilter = typeFilter === 'customer' ? 'all' : 'customer'"
        >
          顧客
        </button>

        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="typeFilter === 'leader'
            ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-indigo-500/40'"
          @click="typeFilter = typeFilter === 'leader' ? 'all' : 'leader'"
        >
          準領導人
        </button>

        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="stepFilter === 'unbroached'
            ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-amber-500/40'"
          @click="stepFilter = stepFilter === 'unbroached' ? 'all' : 'unbroached'"
        >
          未破題
        </button>

        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="stepFilter === 'broached'
            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-emerald-500/40'"
          @click="stepFilter = stepFilter === 'broached' ? 'all' : 'broached'"
        >
          已破題
        </button>

        <button
          v-for="s in (stages ?? [])"
          :key="s.id"
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border"
          :class="stepFilter === String(s.id)
            ? 'bg-primary text-inverted border-primary font-semibold shadow-2xs'
            : 'bg-elevated/40 text-muted border-default hover:border-primary/40'"
          @click="stepFilter = stepFilter === String(s.id) ? 'all' : String(s.id)"
        >
          {{ s.label }} ({{ stageCount(s.id) }})
        </button>
      </div>

      <!-- 手機搜尋 + 篩選按鈕 -->
      <div class="flex items-center gap-2">
        <UInput
          v-model="searchInput"
          icon="i-lucide-search"
          placeholder="搜尋姓名／位置"
          class="flex-1"
          size="sm"
        />
        <UButton
          :color="hasActiveFilter ? 'primary' : 'neutral'"
          :variant="hasActiveFilter ? 'soft' : 'outline'"
          icon="i-lucide-sliders-horizontal"
          size="sm"
          @click="mobileFilterOpen = !mobileFilterOpen"
        >
          進階篩選
        </UButton>
      </div>

      <!-- 手機篩選面板（展開） -->
      <div
        v-if="mobileFilterOpen"
        class="p-3.5 border border-default rounded-xl bg-elevated/40 space-y-3 shadow-xs"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold flex items-center gap-1.5">
            <UIcon
              name="i-lucide-filter"
              class="size-4 text-primary"
            />
            進階篩選條件
          </span>
          <UButton
            v-if="hasActiveFilter"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-rotate-ccw"
            @click="clearAllFilters"
          >
            重設篩選
          </UButton>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <span class="text-xs text-muted font-medium">進度階段</span>
            <USelect
              v-model="stepFilter"
              :items="stepFilterItems"
              size="sm"
              class="w-full"
            />
          </div>
          <div class="space-y-1">
            <span class="text-xs text-muted font-medium">跟進頻率</span>
            <USelect
              v-model="freqFilter"
              :items="freqFilterItems"
              size="sm"
              class="w-full"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <span class="text-xs text-muted font-medium">名單類型</span>
            <USelect
              v-model="typeFilter"
              :items="typeFilterItems"
              size="sm"
              class="w-full"
            />
          </div>
          <div class="space-y-1">
            <span class="text-xs text-muted font-medium">地點</span>
            <USelect
              v-model="locationFilter"
              :items="locationFilterItems"
              size="sm"
              class="w-full"
            />
          </div>
        </div>
        <div class="flex justify-end pt-1">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-colors h-8"
            :class="sortByNext
              ? 'border-primary bg-primary/10 text-primary font-semibold'
              : 'border-default text-muted hover:border-primary/40'"
            @click="sortByNext = !sortByNext"
          >
            <UIcon
              name="i-lucide-arrow-down-narrow-wide"
              class="size-3.5"
            />
            依跟進日排序
          </button>
        </div>
      </div>

      <!-- 手機空狀態 -->
      <div
        v-if="!filtered.length"
        class="text-muted text-center py-16 border border-dashed border-default rounded-xl bg-elevated/20"
      >
        <UIcon
          name="i-lucide-user-x"
          class="size-8 mx-auto mb-2 text-dimmed"
        />
        <p>{{ (contacts?.length ?? 0) ? '沒有符合篩選的名單。' : '還沒有名單，點右上角「新增名單」開始。' }}</p>
        <UButton
          v-if="hasActiveFilter"
          color="neutral"
          variant="ghost"
          size="sm"
          class="mt-2"
          @click="clearAllFilters"
        >
          清除所有篩選
        </UButton>
      </div>

      <!-- 手機卡片列表 -->
      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="c in filtered"
          :key="c.id"
          class="bg-surface/card border border-default rounded-xl p-3.5 shadow-2xs hover:border-primary/40 transition-all space-y-3"
        >
          <!-- 卡片第一層：頭像 + 姓名/位置 + 類型切換 + 功能選單 -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <!-- 彩色雙字頭像 -->
              <div
                class="size-10 rounded-full flex items-center justify-center text-sm shrink-0 cursor-pointer shadow-2xs"
                :class="getAvatarGradient(c)"
                title="點擊編輯明細"
                @click="openMeta(c)"
              >
                {{ (c.name || '?').slice(0, 1).toUpperCase() }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UInput
                    :model-value="c.name"
                    variant="ghost"
                    size="sm"
                    class="font-bold text-base p-0 h-auto focus:bg-elevated/50 rounded max-w-32"
                    @update:model-value="c.name = ($event as string)"
                    @change="patchField(c, 'name')"
                  />
                  <UBadge
                    v-if="isOverdue(c.nextFollowUp)"
                    color="error"
                    variant="solid"
                    size="xs"
                    class="shrink-0"
                  >
                    逾期
                  </UBadge>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted mt-0.5">
                  <UIcon
                    name="i-lucide-map-pin"
                    class="size-3 text-dimmed shrink-0"
                  />
                  <LocationSelect
                    :model-value="c.location ?? ''"
                    :options="locationOptions ?? []"
                    class="w-32"
                    @update:model-value="changeLocation(c, $event)"
                    @add="addLocationOption"
                    @delete="removeLocationOption"
                  />
                </div>
              </div>
            </div>

            <!-- 右上角：顧客/準領導人 切換與操作 -->
            <div class="flex items-center gap-1 shrink-0">
              <div class="inline-flex rounded-full border border-default p-0.5 bg-elevated/40 text-xs font-medium">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-full cursor-pointer transition-all text-xs"
                  :class="c.contactType === 'customer' ? 'bg-emerald-600 text-white font-semibold shadow-2xs' : 'text-dimmed hover:text-foreground'"
                  @click="setContactType(c, 'customer')"
                >
                  顧客
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-full cursor-pointer transition-all text-xs"
                  :class="c.contactType === 'leader' ? 'bg-indigo-600 text-white font-semibold shadow-2xs' : 'text-dimmed hover:text-foreground'"
                  @click="setContactType(c, 'leader')"
                >
                  準領導人
                </button>
              </div>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                title="編輯明細"
                @click="openMeta(c)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                title="刪除"
                @click="remove(c)"
              />
            </div>
          </div>

          <!-- 卡片第二層：破題狀態與進度階段區塊 -->
          <div class="bg-elevated/20 rounded-lg p-2.5 space-y-2 border border-default/40">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="text-dimmed font-medium">破題：</span>
                <div class="inline-flex rounded-full border border-default p-0.5 bg-elevated/60 text-xs font-medium">
                  <button
                    type="button"
                    class="px-2.5 py-0.5 rounded-full cursor-pointer transition-all"
                    :class="!c.broached ? 'bg-amber-500 text-white font-medium shadow-2xs' : 'text-dimmed hover:text-foreground'"
                    @click="setBroached(c, false)"
                  >
                    未破題
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-0.5 rounded-full cursor-pointer transition-all"
                    :class="c.broached ? 'bg-emerald-500 text-white font-medium shadow-2xs' : 'text-dimmed hover:text-foreground'"
                    @click="setBroached(c, true)"
                  >
                    已破題
                  </button>
                </div>
              </div>
              <span
                v-if="stages?.length"
                class="text-xs text-muted font-medium"
              >
                完成 {{ (c.completedStages ?? []).length }} / {{ stages.length }} 階段
              </span>
            </div>

            <!-- 可點擊切換的進度階段 Chips -->
            <div
              v-if="stages?.length"
              class="flex flex-wrap items-center gap-1.5 pt-1"
            >
              <button
                v-for="s in stages"
                :key="s.id"
                type="button"
                class="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all active:scale-95"
                :class="(c.completedStages ?? []).includes(s.id)
                  ? 'bg-primary text-inverted shadow-2xs font-semibold'
                  : 'bg-elevated/60 text-muted hover:bg-elevated hover:text-foreground border border-default/70'"
                @click="toggleStage(c, s.id)"
              >
                <UIcon
                  :name="(c.completedStages ?? []).includes(s.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                  class="size-3.5 shrink-0"
                  :class="(c.completedStages ?? []).includes(s.id) ? 'text-inverted' : 'text-dimmed'"
                />
                {{ s.label }}
              </button>
            </div>
          </div>

          <!-- 卡片第三層：跟進資訊 -->
          <div class="flex items-center justify-between text-xs pt-1 border-t border-default/40">
            <div class="flex items-center gap-1.5 text-muted">
              <UIcon
                name="i-lucide-refresh-cw"
                class="size-3.5 text-dimmed shrink-0"
              />
              <USelect
                :model-value="c.followUpFreq ?? ''"
                :items="freqFormItems"
                placeholder="設定頻率"
                size="xs"
                class="w-28"
                @update:model-value="changeFreq(c, $event as string)"
              />
            </div>
            <div class="flex items-center gap-1 text-xs text-muted">
              <UIcon
                name="i-lucide-clock"
                class="size-3.5 text-dimmed"
              />
              <span>上次跟進：</span>
              <span :class="c.lastFollowUp ? 'font-medium text-foreground' : 'text-dimmed'">
                {{ timeAgo(c.lastFollowUp) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 桌面版表格佈局 ===== -->
    <div class="hidden sm:block">
      <!-- 桌面空狀態 -->
      <div
        v-if="!filtered.length"
        class="text-muted text-center py-16"
      >
        {{ (contacts?.length ?? 0) ? '沒有符合篩選的名單。' : '還沒有名單，點右上角「新增名單」開始。' }}
      </div>

      <div
        v-else
        class="overflow-x-auto border border-default rounded-lg"
      >
        <table class="w-full text-sm">
          <thead class="bg-elevated/50">
            <tr class="text-muted">
              <th
                class="text-left font-medium px-3 py-2 whitespace-nowrap"
                colspan="2"
              >
                <div class="flex items-center gap-1.5">
                  <UInput
                    v-model="searchInput"
                    icon="i-lucide-search"
                    placeholder="搜尋姓名／位置…"
                    size="xs"
                    variant="ghost"
                    class="w-full max-w-44"
                  />
                </div>
              </th>
              <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
                類型
              </th>
              <th class="font-medium px-2 py-2 text-center whitespace-nowrap">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  :class="stepFilter === 'broached' || stepFilter === 'unbroached' ? 'text-primary font-semibold' : ''"
                  @click="cycleStepFilter"
                >
                  破題
                  <UIcon
                    v-if="stepFilter === 'broached' || stepFilter === 'unbroached'"
                    name="i-lucide-filter"
                    class="size-3 text-primary"
                  />
                </button>
              </th>
              <th
                v-for="s in (stages ?? [])"
                :key="s.id"
                class="font-medium px-1.5 py-2 text-center whitespace-nowrap"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  :class="stepFilter === String(s.id) ? 'text-primary font-semibold' : ''"
                  @click="stepFilter = stepFilter === String(s.id) ? 'all' : String(s.id)"
                >
                  {{ s.label }}
                  <span class="text-xs font-normal opacity-70">{{ stageCount(s.id) }}</span>
                  <UIcon
                    v-if="stepFilter === String(s.id)"
                    name="i-lucide-filter"
                    class="size-3 text-primary"
                  />
                </button>
              </th>
              <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                  :class="freqFilter !== 'all' ? 'text-primary font-semibold' : ''"
                  @click="cycleFreqFilter"
                >
                  跟進頻率
                  <UIcon
                    v-if="freqFilter !== 'all'"
                    name="i-lucide-filter"
                    class="size-3 text-primary"
                  />
                </button>
              </th>
              <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                    :class="sortByNext ? 'text-primary font-semibold' : ''"
                    title="依下次跟進日排序"
                    @click="sortByNext = !sortByNext"
                  >
                    上次跟進
                    <UIcon
                      name="i-lucide-arrow-down-narrow-wide"
                      class="size-3"
                      :class="sortByNext ? 'text-primary' : 'text-muted'"
                    />
                  </button>
                  <button
                    v-if="stats.overdue > 0"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors"
                    :class="overdueOnly
                      ? 'bg-error text-inverted'
                      : 'bg-error/10 text-error hover:bg-error/20'"
                    @click="overdueOnly = !overdueOnly"
                  >
                    <UIcon
                      name="i-lucide-alarm-clock"
                      class="size-3"
                    />
                    {{ stats.overdue }}
                  </button>
                </div>
              </th>
              <th class="px-3 py-2 whitespace-nowrap text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in filtered"
              :key="c.id"
              class="border-t border-default hover:bg-elevated/30"
            >
              <td class="px-2 py-1 whitespace-nowrap">
                <UInput
                  :model-value="c.name"
                  variant="ghost"
                  size="sm"
                  class="w-20 font-medium"
                  @update:model-value="c.name = ($event as string)"
                  @change="patchField(c, 'name')"
                />
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <LocationSelect
                  :model-value="c.location ?? ''"
                  :options="locationOptions ?? []"
                  class="w-32"
                  @update:model-value="changeLocation(c, $event)"
                  @add="addLocationOption"
                  @delete="removeLocationOption"
                />
              </td>
              <!-- 名單類型：顧客／準領導人 二選一切換 -->
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div class="inline-flex rounded-full border border-default overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    class="px-2.5 py-1 cursor-pointer transition-colors"
                    :class="c.contactType === 'customer' ? 'bg-primary text-inverted' : 'text-dimmed hover:bg-elevated'"
                    @click="setContactType(c, 'customer')"
                  >
                    顧客
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 cursor-pointer transition-colors"
                    :class="c.contactType === 'leader' ? 'bg-primary text-inverted' : 'text-dimmed hover:bg-elevated'"
                    @click="setContactType(c, 'leader')"
                  >
                    準領導人
                  </button>
                </div>
              </td>
              <!-- 破題與否：二選一切換 -->
              <td class="px-2 py-1.5 whitespace-nowrap">
                <div class="inline-flex rounded-full border border-default overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    class="px-2.5 py-1 cursor-pointer transition-colors"
                    :class="!c.broached ? 'bg-primary text-inverted' : 'text-dimmed hover:bg-elevated'"
                    @click="setBroached(c, false)"
                  >
                    未破題
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 cursor-pointer transition-colors"
                    :class="c.broached ? 'bg-primary text-inverted' : 'text-dimmed hover:bg-elevated'"
                    @click="setBroached(c, true)"
                  >
                    破題
                  </button>
                </div>
              </td>
              <!-- 可自訂進度階段（勾選累積） -->
              <td
                v-for="s in (stages ?? [])"
                :key="s.id"
                class="px-1.5 py-1.5 text-center"
              >
                <button
                  type="button"
                  class="mx-auto flex h-8 w-full min-w-14 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  :class="(c.completedStages ?? []).includes(s.id)
                    ? 'border-primary bg-primary text-inverted shadow-sm'
                    : 'border-dashed border-default text-dimmed hover:border-primary/60 hover:text-primary hover:bg-primary/5'"
                  :aria-pressed="(c.completedStages ?? []).includes(s.id)"
                  :title="((c.completedStages ?? []).includes(s.id) ? '取消標記：' : '標記完成：') + s.label"
                  @click="toggleStage(c, s.id)"
                >
                  <UIcon
                    v-if="(c.completedStages ?? []).includes(s.id)"
                    name="i-lucide-check"
                    class="size-3.5 shrink-0"
                  />
                  {{ s.label }}
                </button>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <USelect
                  :model-value="c.followUpFreq ?? ''"
                  :items="freqFormItems"
                  placeholder="未設定"
                  size="sm"
                  class="w-28"
                  @update:model-value="changeFreq(c, $event as string)"
                />
              </td>
              <!-- 上次跟進：相對時間 + 逾期標記 -->
              <td class="px-3 py-2 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <span :class="c.lastFollowUp ? 'tabular-nums' : 'text-dimmed'">
                    {{ timeAgo(c.lastFollowUp) }}
                  </span>
                  <UBadge
                    v-if="isOverdue(c.nextFollowUp)"
                    color="error"
                    variant="solid"
                    size="sm"
                  >
                    逾期
                  </UBadge>
                </div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-right">
                <div class="flex justify-end gap-1">
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    title="編輯明細（每日任務欄位）"
                    @click="openMeta(c)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="remove(c)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增名單（編輯改在表格列上直接修改） -->
    <UModal
      v-model:open="formOpen"
      title="新增名單"
    >
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField
              label="姓名"
              required
            >
              <UInput
                v-model="form.name"
                class="w-full"
              />
            </UFormField>
            <UFormField label="位置">
              <LocationSelect
                v-model="form.location"
                :options="locationOptions ?? []"
                @add="addLocationOption"
                @delete="removeLocationOption"
              />
            </UFormField>
          </div>

          <UFormField label="破題狀態">
            <div class="inline-flex rounded-lg border border-default overflow-hidden text-sm font-medium">
              <button
                type="button"
                class="px-4 py-1.5 cursor-pointer transition-colors"
                :class="!form.broached ? 'bg-primary text-inverted' : 'hover:bg-elevated'"
                @click="form.broached = false"
              >
                未破題
              </button>
              <button
                type="button"
                class="px-4 py-1.5 cursor-pointer transition-colors"
                :class="form.broached ? 'bg-primary text-inverted' : 'hover:bg-elevated'"
                @click="form.broached = true"
              >
                破題
              </button>
            </div>
          </UFormField>

          <UFormField label="類型">
            <div class="inline-flex rounded-lg border border-default overflow-hidden text-sm font-medium">
              <button
                type="button"
                class="px-4 py-1.5 cursor-pointer transition-colors"
                :class="form.contactType === 'customer' ? 'bg-primary text-inverted' : 'hover:bg-elevated'"
                @click="form.contactType = 'customer'"
              >
                顧客
              </button>
              <button
                type="button"
                class="px-4 py-1.5 cursor-pointer transition-colors"
                :class="form.contactType === 'leader' ? 'bg-primary text-inverted' : 'hover:bg-elevated'"
                @click="form.contactType = 'leader'"
              >
                準領導人
              </button>
            </div>
          </UFormField>

          <UFormField label="進度階段">
            <div
              v-if="stages?.length"
              class="flex flex-wrap gap-4"
            >
              <UCheckbox
                v-for="s in stages"
                :key="s.id"
                :model-value="form.completedStages.includes(s.id)"
                :label="s.label"
                @update:model-value="toggleFormStage(s.id, $event)"
              />
            </div>
            <p
              v-else
              class="text-muted text-sm"
            >
              還沒有階段，可在「管理階段」新增。
            </p>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="跟進頻率">
              <USelect
                v-model="form.followUpFreq"
                :items="freqFormItems"
                placeholder="未設定"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="最後跟進日"
              help="下次跟進日將依頻率自動計算"
            >
              <UInput
                v-model="form.lastFollowUp"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="備註">
            <UTextarea
              v-model="form.note"
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="formOpen = false"
            >
              取消
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
    </UModal>

    <!-- 管理進度階段 -->
    <UModal
      v-model:open="stagesModalOpen"
      title="管理進度階段"
    >
      <template #body>
        <div class="space-y-3">
          <p class="text-sm text-muted">
            這些階段套用到你所有的名單。刪除階段不會刪除名單，只會移除該標記。
          </p>
          <ul
            v-if="stages?.length"
            class="space-y-2"
          >
            <li
              v-for="(s, i) in stages"
              :key="s.id"
              class="flex items-center gap-2"
            >
              <UInput
                :model-value="s.label"
                size="sm"
                class="flex-1"
                @update:model-value="s.label = ($event as string)"
                @change="renameStage(s)"
              />
              <UButton
                icon="i-lucide-chevron-up"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="i === 0"
                @click="moveStage(i, -1)"
              />
              <UButton
                icon="i-lucide-chevron-down"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="i === stages.length - 1"
                @click="moveStage(i, 1)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="deleteStage(s)"
              />
            </li>
          </ul>
          <p
            v-else
            class="text-muted text-sm"
          >
            還沒有階段。
          </p>
          <div class="flex gap-2 pt-3 border-t border-default">
            <UInput
              v-model="newStageLabel"
              placeholder="新增階段名稱…"
              size="sm"
              class="flex-1"
              @keydown.enter="addStage"
            />
            <UButton
              icon="i-lucide-plus"
              :loading="stageSaving"
              @click="addStage"
            >
              新增
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 個人名單表明細編輯（每日任務用欄位） -->
    <ContactDetailModal
      v-model:open="metaOpen"
      :contact="metaContact"
      @saved="onMetaSaved"
    />
  </div>
</template>
