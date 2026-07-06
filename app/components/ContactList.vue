<script setup lang="ts">
// 名單頁「總名單」分頁內容（原 /crm 頁面主體，改為元件供分頁載入）。
const notify = useNotify()
const confirm = useConfirm()

// deep: true → 名單清單為深層響應式，inline 樂觀更新（c.xxx=value、Object.assign）
// 才會即時反映到畫面。Nuxt 4 的 useFetch 預設是 shallow，不加會「送了 API 但畫面不動」。
const { data: contacts, refresh: refreshContacts } = await useFetch<Contact[]>('/api/contacts', { deep: true })
// 進度階段（每位使用者各自管理；後端首次為空時會種子預設）
const { data: stages, refresh: refreshStages } = await useFetch<ContactStage[]>('/api/contact-stages', { deep: true })

/* ---------- 篩選 / 搜尋 ---------- */
const search = ref('')
// 'all'=不限；'broached'/'unbroached'=破題狀態；其餘為階段 id（字串）。
// reka-ui 的 SelectItem 不允許空字串值，故用 'all' 當哨兵。
const stepFilter = ref<string>('all')
const freqFilter = ref('all')
const overdueOnly = ref(false)
const sortByNext = ref(false)

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
const freqFormItems = FOLLOW_UP_FREQ_OPTIONS.map(f => ({ label: f, value: f }))

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
  if (freqFilter.value !== 'all') list = list.filter(c => c.followUpFreq === freqFilter.value)
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

// Done：勾＝今天跟進過（新增今天的跟進紀錄）；取消＝刪掉今天的紀錄。lastFollowUp/nextFollowUp 由後端回算。
async function toggleDone(c: Contact, value: boolean) {
  const today = todayStr()
  try {
    if (value) {
      await $fetch(`/api/contacts/${c.id}/logs`, {
        method: 'POST',
        body: { date: today, content: '' }
      })
    } else {
      await $fetch(`/api/contacts/${c.id}/done`, {
        method: 'DELETE',
        body: { date: today }
      })
    }
    await refreshContacts()
  } catch {
    notify.error('更新失敗')
    await refreshContacts()
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

// inline 文字欄位（姓名／位置）即時更新
async function patchField(c: Contact, key: 'name' | 'location') {
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
    await $fetch('/api/contacts', { method: 'POST', body: form })
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

/* ---------- 跟進紀錄抽屜 ---------- */
const detailOpen = ref(false)
const detailContact = ref<Contact | null>(null)
const logs = ref<FollowUpLog[]>([])
const logsLoading = ref(false)
const logForm = reactive({ date: '', content: '' })
const logSaving = ref(false)
const noteDraft = ref('')

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
  if (detailContact.value?.id === updated.id) Object.assign(detailContact.value, updated)
}

async function openDetail(c: Contact) {
  detailContact.value = c
  detailOpen.value = true
  noteDraft.value = c.note ?? ''
  Object.assign(logForm, { date: todayStr(), content: '' })
  await loadLogs(c.id)
}

// 抽屜內編輯備註
async function saveNote() {
  if (!detailContact.value) return
  if ((detailContact.value.note ?? '') === noteDraft.value) return
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${detailContact.value.id}`, {
      method: 'PATCH',
      body: { note: noteDraft.value }
    })
    Object.assign(detailContact.value, updated)
    const row = (contacts.value ?? []).find(x => x.id === updated.id)
    if (row) Object.assign(row, updated)
  } catch {
    notify.error('更新失敗')
  }
}

async function loadLogs(id: number) {
  logsLoading.value = true
  try {
    logs.value = await $fetch<FollowUpLog[]>(`/api/contacts/${id}/logs`)
  } finally {
    logsLoading.value = false
  }
}

async function addLog() {
  if (!detailContact.value) return
  if (!logForm.date) {
    notify.error('請選擇日期')
    return
  }
  logSaving.value = true
  try {
    await $fetch(`/api/contacts/${detailContact.value.id}/logs`, {
      method: 'POST',
      body: { date: logForm.date, content: logForm.content }
    })
    notify.success('已記錄跟進')
    logForm.content = ''
    await Promise.all([loadLogs(detailContact.value.id), refreshContacts()])
    // 同步抽屜上方顯示的名單資料
    const fresh = (contacts.value ?? []).find(x => x.id === detailContact.value?.id)
    if (fresh) detailContact.value = fresh
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('記錄失敗', msg)
  } finally {
    logSaving.value = false
  }
}

async function removeLog(log: FollowUpLog) {
  if (!(await confirm({ title: '刪除紀錄', description: '確定刪除這筆跟進紀錄？', danger: true }))) return
  try {
    await $fetch(`/api/contacts/${log.contactId}/logs/${log.id}`, { method: 'DELETE' })
    if (detailContact.value) {
      await Promise.all([loadLogs(detailContact.value.id), refreshContacts()])
      const fresh = (contacts.value ?? []).find(x => x.id === detailContact.value?.id)
      if (fresh) detailContact.value = fresh
    }
  } catch {
    notify.error('刪除失敗')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold">
        客戶名單 CRM
      </h1>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-list-checks"
          color="neutral"
          variant="outline"
          @click="stagesModalOpen = true"
        >
          <span class="hidden sm:inline">管理階段</span>
        </UButton>
        <UButton
          icon="i-lucide-user-plus"
          @click="openCreate"
        >
          <span class="hidden sm:inline">新增名單</span>
        </UButton>
      </div>
    </div>

    <!-- 進度統計 + 逾期提醒 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <UBadge
        color="neutral"
        variant="subtle"
        size="lg"
      >
        總名單 {{ stats.total }}
      </UBadge>
      <UIcon
        name="i-lucide-chevrons-right"
        class="text-muted"
      />
      <UButton
        size="sm"
        :color="stepFilter === 'broached' ? 'primary' : 'neutral'"
        :variant="stepFilter === 'broached' ? 'soft' : 'outline'"
        @click="stepFilter = stepFilter === 'broached' ? 'all' : 'broached'"
      >
        破題 {{ stats.broached }}
      </UButton>
      <UIcon
        v-if="stats.steps.length"
        name="i-lucide-arrow-right"
        class="text-muted"
      />
      <template
        v-for="(s, i) in stats.steps"
        :key="s.id"
      >
        <UButton
          size="sm"
          :color="stepFilter === String(s.id) ? 'primary' : 'neutral'"
          :variant="stepFilter === String(s.id) ? 'soft' : 'outline'"
          @click="stepFilter = stepFilter === String(s.id) ? 'all' : String(s.id)"
        >
          {{ s.label }} {{ s.count }}
        </UButton>
        <UIcon
          v-if="i < stats.steps.length - 1"
          name="i-lucide-arrow-right"
          class="text-muted"
        />
      </template>

      <UButton
        v-if="stats.overdue > 0"
        class="ml-auto"
        icon="i-lucide-alarm-clock"
        color="error"
        :variant="overdueOnly ? 'solid' : 'soft'"
        @click="overdueOnly = !overdueOnly"
      >
        {{ stats.overdue }} 位逾期待跟進
      </UButton>
    </div>

    <!-- 工具列 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="搜尋姓名／位置"
        class="w-64"
      />
      <USelect
        v-model="stepFilter"
        :items="stepFilterItems"
        class="w-40"
      />
      <USelect
        v-model="freqFilter"
        :items="freqFilterItems"
        class="w-36"
      />
      <UButton
        :color="sortByNext ? 'primary' : 'neutral'"
        :variant="sortByNext ? 'soft' : 'outline'"
        icon="i-lucide-arrow-down-narrow-wide"
        @click="sortByNext = !sortByNext"
      >
        依下次跟進日排序
      </UButton>
      <UButton
        v-if="overdueOnly || stepFilter !== 'all' || freqFilter !== 'all' || search"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="search = ''; stepFilter = 'all'; freqFilter = 'all'; overdueOnly = false"
      >
        清除篩選
      </UButton>
    </div>

    <!-- 名單表格 -->
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
        <thead class="bg-elevated/50 text-muted">
          <tr>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              姓名
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              位置
            </th>
            <th
              :colspan="(stages?.length ?? 0) + 1"
              class="font-medium px-2 py-2 text-center whitespace-nowrap"
            >
              進度
            </th>
            <th class="font-medium px-3 py-2 text-center whitespace-nowrap">
              Done
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              跟進頻率
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              上次跟進
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
                class="w-32 font-medium"
                @update:model-value="c.name = ($event as string)"
                @change="patchField(c, 'name')"
              />
            </td>
            <td class="px-2 py-1 whitespace-nowrap">
              <UInput
                :model-value="c.location ?? ''"
                variant="ghost"
                size="sm"
                placeholder="—"
                class="w-28"
                @update:model-value="c.location = ($event as string)"
                @change="patchField(c, 'location')"
              />
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
            <!-- Done：勾＝今天已跟進 -->
            <td class="px-3 py-2 text-center">
              <UCheckbox
                :model-value="c.lastFollowUp === todayStr()"
                @update:model-value="toggleDone(c, $event === true)"
              />
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
                  icon="i-lucide-history"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="跟進紀錄／備註"
                  @click="openDetail(c)"
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
              <UInput
                v-model="form.location"
                class="w-full"
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

    <!-- 跟進紀錄抽屜 -->
    <USlideover
      v-model:open="detailOpen"
      :title="`跟進紀錄 — ${detailContact?.name ?? ''}`"
    >
      <template #body>
        <div
          v-if="detailContact"
          class="space-y-5"
        >
          <!-- 名單摘要 -->
          <div class="text-sm space-y-1">
            <div>
              <span class="text-muted">跟進頻率：</span>{{ detailContact.followUpFreq || '未設定' }}
            </div>
            <div>
              <span class="text-muted">上次跟進：</span>{{ timeAgo(detailContact.lastFollowUp) }}
            </div>
            <div>
              <span class="text-muted">下次跟進：</span>
              <span :class="isOverdue(detailContact.nextFollowUp) ? 'text-error font-medium' : ''">
                {{ detailContact.nextFollowUp || '—' }}
                <template v-if="isOverdue(detailContact.nextFollowUp)">（已逾期）</template>
              </span>
            </div>
          </div>

          <!-- 備註（可編輯） -->
          <UFormField label="備註">
            <UTextarea
              v-model="noteDraft"
              class="w-full"
              :rows="2"
              placeholder="關於這位客戶的備註…"
              @change="saveNote"
            />
          </UFormField>

          <!-- 新增跟進 -->
          <div class="border border-default rounded-lg p-3 space-y-3">
            <div class="font-medium text-sm">
              記錄一次跟進
            </div>
            <div class="flex gap-2">
              <UInput
                v-model="logForm.date"
                type="date"
                class="w-40"
              />
            </div>
            <UTextarea
              v-model="logForm.content"
              class="w-full"
              :rows="2"
              placeholder="這次聊了什麼？（可留空）"
            />
            <div class="flex justify-end">
              <UButton
                size="sm"
                icon="i-lucide-plus"
                :loading="logSaving"
                @click="addLog"
              >
                新增紀錄
              </UButton>
            </div>
          </div>

          <!-- 時間軸 -->
          <div>
            <div class="font-medium text-sm mb-2">
              歷史紀錄
            </div>
            <div
              v-if="logsLoading"
              class="text-muted text-sm py-4 text-center"
            >
              載入中…
            </div>
            <div
              v-else-if="!logs.length"
              class="text-muted text-sm py-4 text-center"
            >
              還沒有跟進紀錄。
            </div>
            <ul
              v-else
              class="space-y-2"
            >
              <li
                v-for="log in logs"
                :key="log.id"
                class="flex items-start gap-3 border-l-2 border-primary/40 pl-3 py-1 group"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium tabular-nums">
                    {{ log.date }}
                  </div>
                  <div
                    v-if="log.content"
                    class="text-sm text-muted whitespace-pre-wrap break-words"
                  >
                    {{ log.content }}
                  </div>
                </div>
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  class="opacity-0 group-hover:opacity-100"
                  @click="removeLog(log)"
                />
              </li>
            </ul>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- 個人名單表明細編輯（每日任務用欄位） -->
    <ContactDetailModal
      v-model:open="metaOpen"
      :contact="metaContact"
      @saved="onMetaSaved"
    />
  </div>
</template>
