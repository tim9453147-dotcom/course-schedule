<script setup lang="ts">
// 需登入才能看到此頁
definePageMeta({ middleware: 'auth' })

const toast = useToast()

// deep: true → 名單清單為深層響應式，inline 樂觀更新（c[key]=value、Object.assign）
// 才會即時反映到畫面。Nuxt 4 的 useFetch 預設是 shallow，不加會「送了 API 但畫面不動」。
const { data: contacts, refresh: refreshContacts } = await useFetch<Contact[]>('/api/contacts', { deep: true })

/* ---------- 篩選 / 搜尋 ---------- */
const search = ref('')
// 'all' = 不限；reka-ui 的 SelectItem 不允許空字串值，故用 'all' 當哨兵
const stepFilter = ref<StepKey | 'all'>('all') // 只看完成某階段的人
const freqFilter = ref('all')
const overdueOnly = ref(false)
const sortByNext = ref(false)

const stepFilterItems = [
  { label: '全部階段', value: 'all' },
  ...FUNNEL_STEPS.map(s => ({ label: `已完成「${s.label}」`, value: s.key }))
]
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
      || (c.contact ?? '').toLowerCase().includes(q)
      || (c.location ?? '').toLowerCase().includes(q)
    )
  }
  if (stepFilter.value !== 'all') list = list.filter(c => c[stepFilter.value as StepKey])
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
  const steps = FUNNEL_STEPS.map(s => ({
    label: s.label,
    key: s.key,
    count: list.filter(c => c[s.key]).length
  }))
  const overdue = list.filter(c => isOverdue(c.nextFollowUp)).length
  return { total: list.length, steps, overdue }
})

/* ---------- inline 即時更新 ---------- */
async function toggleStep(c: Contact, key: StepKey, value: boolean) {
  const prev = c[key]
  c[key] = value // 樂觀更新（畫面立即打勾）
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { [key]: value }
    })
    Object.assign(c, updated) // 同步後端結果
  } catch {
    c[key] = prev // 失敗還原
    toast.add({ title: '更新失敗', color: 'error' })
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
    toast.add({ title: '更新失敗', color: 'error' })
    await refreshContacts()
  }
}

// inline 文字欄位（姓名／位置／聯絡方式）即時更新
async function patchField(c: Contact, key: 'name' | 'location' | 'contact') {
  try {
    const updated = await $fetch<Contact>(`/api/contacts/${c.id}`, {
      method: 'PATCH',
      body: { [key]: c[key] ?? '' }
    })
    Object.assign(c, updated)
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    toast.add({ title: '更新失敗', description: msg, color: 'error' })
    await refreshContacts() // 還原成後端資料（例如姓名被清空遭拒）
  }
}

/* ---------- 新增名單 ---------- */
const formOpen = ref(false)
const saving = ref(false)
const form = reactive({
  name: '',
  location: '',
  stepBreak: false,
  step2: false,
  step336: false,
  stepJoined: false,
  step28: false,
  contact: '',
  followUpFreq: '',
  lastFollowUp: '',
  note: ''
})

function openCreate() {
  Object.assign(form, {
    name: '',
    location: '',
    stepBreak: false,
    step2: false,
    step336: false,
    stepJoined: false,
    step28: false,
    contact: '',
    followUpFreq: '',
    lastFollowUp: '',
    note: ''
  })
  formOpen.value = true
}

async function save() {
  if (!form.name.trim()) {
    toast.add({ title: '請輸入姓名', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/contacts', { method: 'POST', body: form })
    toast.add({ title: '已新增', color: 'success' })
    formOpen.value = false
    await refreshContacts()
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    toast.add({ title: '新增失敗', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(c: Contact) {
  if (!confirm(`確定刪除「${c.name}」？相關跟進紀錄也會一併刪除。`)) return
  try {
    await $fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })
    toast.add({ title: '已刪除', color: 'success' })
    await refreshContacts()
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
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
    toast.add({ title: '更新失敗', color: 'error' })
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
    toast.add({ title: '請選擇日期', color: 'error' })
    return
  }
  logSaving.value = true
  try {
    await $fetch(`/api/contacts/${detailContact.value.id}/logs`, {
      method: 'POST',
      body: { date: logForm.date, content: logForm.content }
    })
    toast.add({ title: '已記錄跟進', color: 'success' })
    logForm.content = ''
    await Promise.all([loadLogs(detailContact.value.id), refreshContacts()])
    // 同步抽屜上方顯示的名單資料
    const fresh = (contacts.value ?? []).find(x => x.id === detailContact.value?.id)
    if (fresh) detailContact.value = fresh
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    toast.add({ title: '記錄失敗', description: msg, color: 'error' })
  } finally {
    logSaving.value = false
  }
}

async function removeLog(log: FollowUpLog) {
  if (!confirm('確定刪除這筆跟進紀錄？')) return
  try {
    await $fetch(`/api/contacts/${log.contactId}/logs/${log.id}`, { method: 'DELETE' })
    if (detailContact.value) {
      await Promise.all([loadLogs(detailContact.value.id), refreshContacts()])
      const fresh = (contacts.value ?? []).find(x => x.id === detailContact.value?.id)
      if (fresh) detailContact.value = fresh
    }
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold">
        客戶名單 CRM
      </h1>
      <UButton
        icon="i-lucide-user-plus"
        @click="openCreate"
      >
        新增名單
      </UButton>
    </div>

    <!-- 漏斗統計 + 逾期提醒 -->
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
      <template
        v-for="(s, i) in stats.steps"
        :key="s.key"
      >
        <UButton
          size="sm"
          :color="stepFilter === s.key ? 'primary' : 'neutral'"
          :variant="stepFilter === s.key ? 'soft' : 'outline'"
          @click="stepFilter = stepFilter === s.key ? 'all' : s.key"
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
        placeholder="搜尋姓名／聯絡方式／位置"
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
              :colspan="FUNNEL_STEPS.length"
              class="font-medium px-2 py-2 text-center whitespace-nowrap"
            >
              漏斗階段（依序）
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              聯絡方式
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              跟進頻率
            </th>
            <th class="text-left font-medium px-3 py-2 whitespace-nowrap">
              下次跟進
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
            <td
              v-for="s in FUNNEL_STEPS"
              :key="s.key"
              class="px-1.5 py-1.5 text-center"
            >
              <button
                type="button"
                class="mx-auto flex h-8 w-full min-w-16 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                :class="c[s.key]
                  ? 'border-primary bg-primary text-inverted shadow-sm'
                  : 'border-dashed border-default text-dimmed hover:border-primary/60 hover:text-primary hover:bg-primary/5'"
                :aria-pressed="c[s.key]"
                :title="(c[s.key] ? '取消標記：' : '標記完成：') + s.label"
                @click="toggleStep(c, s.key, !c[s.key])"
              >
                <UIcon
                  v-if="c[s.key]"
                  name="i-lucide-check"
                  class="size-3.5 shrink-0"
                />
                {{ s.label }}
              </button>
            </td>
            <td class="px-2 py-1 whitespace-nowrap">
              <UInput
                :model-value="c.contact ?? ''"
                variant="ghost"
                size="sm"
                placeholder="電話 / LINE"
                class="w-36"
                @update:model-value="c.contact = ($event as string)"
                @change="patchField(c, 'contact')"
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
            <td class="px-3 py-2 whitespace-nowrap">
              <span
                v-if="!c.nextFollowUp"
                class="text-dimmed"
              >—</span>
              <UBadge
                v-else
                :color="isOverdue(c.nextFollowUp) ? 'error' : 'neutral'"
                :variant="isOverdue(c.nextFollowUp) ? 'solid' : 'subtle'"
                class="tabular-nums"
              >
                {{ c.nextFollowUp }}
              </UBadge>
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-right">
              <div class="flex justify-end gap-1">
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

          <UFormField label="漏斗階段">
            <div class="flex flex-wrap gap-4">
              <UCheckbox
                v-model="form.stepBreak"
                label="破題"
              />
              <UCheckbox
                v-model="form.step2"
                label="2"
              />
              <UCheckbox
                v-model="form.step336"
                label="336"
              />
              <UCheckbox
                v-model="form.stepJoined"
                label="加入"
              />
              <UCheckbox
                v-model="form.step28"
                label="28"
              />
            </div>
          </UFormField>

          <UFormField label="聯絡方式">
            <UInput
              v-model="form.contact"
              class="w-full"
              placeholder="電話 / LINE / Email"
            />
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
              <span class="text-muted">聯絡方式：</span>{{ detailContact.contact || '—' }}
            </div>
            <div>
              <span class="text-muted">跟進頻率：</span>{{ detailContact.followUpFreq || '未設定' }}
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
  </UContainer>
</template>
