<script setup lang="ts">
// 每日任務（個人名單表）：從總名單挑人放進四個區塊，並融合「今日跟進」智慧提醒與一鍵跟進功能。
// 每一列的姓名與延伸欄位皆來自所引用的 contact；只有這一列自己的「日期」可 inline 修改。
const notify = useNotify()
const confirm = useConfirm()

// deep:true 讓 inline 樂觀更新即時反映；lazy + default 避免分頁延遲掛載時觸發 async setup。
const { data: items, refresh } = useFetch<Prospect[]>('/api/prospects', {
  deep: true,
  lazy: true,
  default: () => []
})
// 加入視窗與計算今日跟進要用的總名單清單
const { data: contactsList, refresh: refreshContacts } = useFetch<Contact[]>('/api/contacts', {
  key: 'global-contacts',
  deep: true,
  lazy: true,
  default: () => []
})

const today = todayStr()

/* ---------- 今日跟進狀態與邏輯 ---------- */
const onlyTodayFollowUp = ref(false)
const marking = ref(new Set<number>())

function reasonColor(kind?: NonNullable<LeadReason>['kind']) {
  return kind === 'overdue' ? 'error' : kind === 'due' ? 'warning' : 'neutral'
}

// 今日需跟進的總名單對象（含所屬區塊資訊，依熱度排序）
const todayFollowUpList = computed(() => {
  const allContacts = contactsList.value ?? []
  const allProspects = items.value ?? []
  return allContacts
    .filter(c => isTodayFollowUp(c, today))
    .map((c) => {
      const pSections = allProspects.filter(p => p.contactId === c.id).map(p => p.section)
      return {
        c,
        score: leadScore(c, today),
        reason: topReason(c, today),
        sections: Array.from(new Set(pSections))
      }
    })
    .sort((a, b) => b.score - a.score)
})

// 一鍵「今天已跟進」
async function markDone(c: Contact) {
  if (marking.value.has(c.id)) return
  marking.value.add(c.id)
  try {
    await $fetch(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: today, content: '' } })
    await refreshContacts()
    await refresh()
    notify.success(`已更新「${c.name}」的今日跟進`)
  } catch {
    notify.error('更新失敗')
    await refreshContacts()
  } finally {
    marking.value.delete(c.id)
  }
}

/* ---------- 依區塊分組（可切換「僅看今日待辦」） ---------- */
const bySection = computed(() => {
  const g: Record<ProspectSection, Prospect[]> = {
    develop: [],
    reserve: [],
    five: [],
    network: []
  }
  for (const p of items.value ?? []) {
    if (!p.contact) continue
    if (onlyTodayFollowUp.value && !isTodayFollowUp(p.contact, today)) {
      continue
    }
    g[p.section]?.push(p)
  }
  return g
})

/* ---------- 從總名單加入 ---------- */
const pickerOpen = ref(false)
const pickerSection = ref<ProspectSection>('develop')
const pickerSearch = ref('')
const selectedIds = ref<number[]>([])
const adding = ref(false)

function openPicker(section: ProspectSection, preselectedContactId?: number) {
  pickerSection.value = section
  pickerSearch.value = ''
  selectedIds.value = preselectedContactId ? [preselectedContactId] : []
  pickerOpen.value = true
}

// 這個區塊尚未加入、且符合搜尋的總名單對象
const pickerCandidates = computed(() => {
  const used = new Set(
    (bySection.value[pickerSection.value] || []).map(p => p.contactId)
  )
  const q = pickerSearch.value.trim().toLowerCase()
  return (contactsList.value ?? []).filter(
    c => !used.has(c.id) && (!q || c.name.toLowerCase().includes(q))
  )
})

function toggleSelected(id: number, on: boolean | 'indeterminate') {
  const has = selectedIds.value.includes(id)
  if (on === true && !has) selectedIds.value = [...selectedIds.value, id]
  else if (on !== true && has)
    selectedIds.value = selectedIds.value.filter(x => x !== id)
}

async function confirmAdd() {
  const ids = [...selectedIds.value]
  if (!ids.length) {
    pickerOpen.value = false
    return
  }
  adding.value = true
  try {
    const created: Prospect[] = []
    for (const contactId of ids) {
      const row = await $fetch<Prospect>('/api/prospects', {
        method: 'POST',
        body: { section: pickerSection.value, contactId }
      })
      created.push(row)
    }
    items.value = [...(items.value ?? []), ...created]
    pickerOpen.value = false
  } catch {
    notify.error('加入失敗')
    await refresh()
  } finally {
    adding.value = false
  }
}

/* ---------- 這一列自己的日期 ---------- */
async function patchDate(p: Prospect) {
  try {
    const updated = await $fetch<Prospect>(`/api/prospects/${p.id}`, {
      method: 'PATCH',
      body: { date: p.date ?? '' }
    })
    Object.assign(p, updated)
  } catch {
    notify.error('更新失敗')
    await refresh()
  }
}

/* ---------- 移出區塊（不刪除總名單的人） ---------- */
async function removeRow(p: Prospect) {
  if (
    !(await confirm({
      title: '從此區塊移除',
      description: `確定把「${p.contact.name}」從「${PROSPECT_SECTION_META[p.section].title}」移除？（不會刪除總名單的資料）`,
      danger: true
    }))
  )
    return
  try {
    await $fetch(`/api/prospects/${p.id}`, { method: 'DELETE' })
    items.value = (items.value ?? []).filter(x => x.id !== p.id)
  } catch {
    notify.error('移除失敗')
  }
}

/* ---------- 編輯明細（改的是 contact，回寫到所有引用列） ---------- */
const detailOpen = ref(false)
const detailContact = ref<Contact | null>(null)

function openDetail(c: Contact) {
  detailContact.value = c
  detailOpen.value = true
}

function onDetailSaved(updated: Contact) {
  for (const p of items.value ?? []) {
    if (p.contactId === updated.id) p.contact = updated
  }
  const c = (contactsList.value ?? []).find(x => x.id === updated.id)
  if (c) Object.assign(c, updated)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 今日跟進焦點看板 Top Banner -->
    <div class="border border-default rounded-xl p-4 sm:p-5 bg-gradient-to-r from-primary-500/5 via-elevated/40 to-elevated/10 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <UIcon
              name="i-lucide-flame"
              class="w-5 h-5"
            />
          </div>
          <div>
            <h2 class="font-bold text-lg leading-tight flex items-center gap-2">
              今日跟進焦點
              <UBadge
                v-if="todayFollowUpList.length"
                color="primary"
                variant="soft"
                size="sm"
              >
                {{ todayFollowUpList.length }} 位待處理
              </UBadge>
            </h2>
            <p class="text-xs text-muted">
              包含逾期、今天到期與待啟動名單，依熱度排序
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            :color="onlyTodayFollowUp ? 'primary' : 'neutral'"
            :variant="onlyTodayFollowUp ? 'solid' : 'outline'"
            size="sm"
            icon="i-lucide-filter"
            @click="onlyTodayFollowUp = !onlyTodayFollowUp"
          >
            {{ onlyTodayFollowUp ? '顯示全部名單' : `僅看今日待辦 (${todayFollowUpList.length})` }}
          </UButton>
        </div>
      </div>

      <!-- 待跟進對象卡片列表 -->
      <div
        v-if="!todayFollowUpList.length"
        class="text-muted text-sm py-4 text-center"
      >
        今天沒有待跟進的名單 🎉 保持好習慣，繼續加油！
      </div>

      <div
        v-else
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1"
      >
        <div
          v-for="{ c, score, reason, sections } in todayFollowUpList"
          :key="c.id"
          class="flex flex-col justify-between p-3 rounded-lg border border-default bg-elevated/40 hover:border-primary/50 transition-colors gap-2"
        >
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-1">
              <span class="font-bold text-base truncate">{{ c.name }}</span>
              <span class="text-dimmed text-xs tabular-nums shrink-0">熱度 {{ score }}</span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <UBadge
                v-if="reason"
                :color="reasonColor(reason.kind)"
                variant="subtle"
                size="xs"
              >
                {{ reason.label }}
              </UBadge>

              <template v-if="sections.length">
                <UBadge
                  v-for="s in sections"
                  :key="s"
                  color="neutral"
                  variant="outline"
                  size="xs"
                >
                  {{ PROSPECT_SECTION_META[s]?.title }}
                </UBadge>
              </template>
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                size="xs"
              >
                未歸類
              </UBadge>

              <span
                v-if="c.location"
                class="text-xs text-muted"
              >· {{ c.location }}</span>
            </div>
            <div class="text-xs text-muted">
              上次跟進：{{ timeAgo(c.lastFollowUp) }}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-2 border-t border-default/50 mt-1">
            <div>
              <UButton
                v-if="!sections.length"
                icon="i-lucide-user-plus"
                color="neutral"
                variant="ghost"
                size="xs"
                title="加入每日任務區塊"
                @click="openPicker('develop', c.id)"
              >
                加入區塊
              </UButton>
            </div>

            <div class="flex items-center gap-1.5 ml-auto">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                title="編輯明細"
                @click="openDetail(c)"
              />
              <UButton
                icon="i-lucide-check"
                color="primary"
                variant="soft"
                size="xs"
                :loading="marking.has(c.id)"
                :disabled="marking.has(c.id)"
                @click="markDone(c)"
              >
                今天已跟進
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 開發名單 -->
    <section>
      <div class="flex items-end justify-between mb-2">
        <div>
          <h2 class="font-bold text-base flex items-center gap-2">
            {{ PROSPECT_SECTION_META.develop.title }}
            <span class="text-xs text-muted font-normal">({{ bySection.develop.length }} 人)</span>
          </h2>
        </div>
        <UButton
          icon="i-lucide-user-plus"
          size="sm"
          variant="soft"
          @click="openPicker('develop')"
        />
      </div>
      <div class="overflow-x-auto border border-default rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-elevated/50 text-muted">
            <tr>
              <th class="w-8 px-2 py-2 text-center font-medium">
                #
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                日期
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                姓名
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                誰的朋友
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                開發夥伴
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                聯絡方式
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                新人資訊
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                等級
              </th>
              <th class="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="!bySection.develop.length"
              class="border-t border-default"
            >
              <td
                colspan="9"
                class="text-muted text-center py-8"
              >
                {{ onlyTodayFollowUp ? '此區塊今天沒有待跟進的名單。' : '還沒有名單，點右上角「從總名單加入」開始。' }}
              </td>
            </tr>
            <tr
              v-for="(p, i) in bySection.develop"
              :key="p.id"
              class="border-t border-default hover:bg-elevated/30"
              :class="isTodayFollowUp(p.contact, today) ? 'bg-primary-500/5' : ''"
            >
              <td class="px-2 py-1 text-center text-muted tabular-nums">
                {{ i + 1 }}
              </td>
              <td class="px-1 py-1">
                <UInput
                  :model-value="p.date ?? ''"
                  type="date"
                  variant="ghost"
                  size="sm"
                  class="w-36"
                  @update:model-value="p.date = $event as string"
                  @change="patchDate(p)"
                />
              </td>
              <td class="px-2 py-1 font-medium whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <span>{{ p.contact.name }}</span>
                  <UBadge
                    v-if="isTodayFollowUp(p.contact, today) && topReason(p.contact, today)"
                    :color="reasonColor(topReason(p.contact, today)?.kind)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ topReason(p.contact, today)?.label }}
                  </UBadge>
                </div>
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <span :class="p.contact.friendOf ? '' : 'text-dimmed'">{{
                  p.contact.friendOf || "—"
                }}</span>
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <span :class="p.contact.devPartner ? '' : 'text-dimmed'">{{
                  p.contact.devPartner || "—"
                }}</span>
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <span :class="p.contact.contact ? '' : 'text-dimmed'">{{
                  p.contact.contact || "—"
                }}</span>
              </td>
              <td class="px-2 py-1 max-w-48 truncate">
                <span :class="p.contact.info ? '' : 'text-dimmed'">{{
                  p.contact.info || "—"
                }}</span>
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <UBadge
                  v-if="p.contact.level"
                  :color="levelColor(p.contact.level)"
                  variant="subtle"
                  size="sm"
                >
                  {{ p.contact.level }}
                </UBadge>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
              <td class="px-1 py-1 text-right whitespace-nowrap">
                <UButton
                  v-if="isTodayFollowUp(p.contact, today)"
                  icon="i-lucide-check"
                  color="primary"
                  variant="soft"
                  size="xs"
                  title="今天已跟進"
                  :loading="marking.has(p.contact.id)"
                  :disabled="marking.has(p.contact.id)"
                  @click="markDone(p.contact)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  title="編輯明細"
                  @click="openDetail(p.contact)"
                />
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  title="從此區塊移除"
                  @click="removeRow(p)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 預備名單 / 五人名單（並排） -->
    <div class="grid gap-6 md:grid-cols-2">
      <section
        v-for="key in ['reserve', 'five'] as ProspectSection[]"
        :key="key"
      >
        <div class="flex items-end justify-between mb-2">
          <div>
            <h2 class="font-bold text-base flex items-center gap-2">
              {{ PROSPECT_SECTION_META[key].title }}
              <span class="text-xs text-muted font-normal">({{ bySection[key].length }} 人)</span>
            </h2>
          </div>
          <UButton
            icon="i-lucide-user-plus"
            size="sm"
            variant="soft"
            @click="openPicker(key)"
          />
        </div>
        <div class="overflow-x-auto border border-default rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-elevated/50 text-muted">
              <tr>
                <th class="w-10 px-2 py-2 text-center font-medium">
                  #
                </th>
                <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                  日期
                </th>
                <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                  姓名
                </th>
                <th class="w-24 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="!bySection[key].length"
                class="border-t border-default"
              >
                <td
                  colspan="4"
                  class="text-muted text-center py-8"
                >
                  {{ onlyTodayFollowUp ? '此區塊今天沒有待跟進的名單。' : '還沒有名單。' }}
                </td>
              </tr>
              <tr
                v-for="(p, i) in bySection[key]"
                :key="p.id"
                class="border-t border-default hover:bg-elevated/30"
                :class="isTodayFollowUp(p.contact, today) ? 'bg-primary-500/5' : ''"
              >
                <td class="px-2 py-1 text-center text-muted tabular-nums">
                  {{ i + 1 }}
                </td>
                <td class="px-1 py-1">
                  <UInput
                    :model-value="p.date ?? ''"
                    type="date"
                    variant="ghost"
                    size="sm"
                    class="w-36"
                    @update:model-value="p.date = $event as string"
                    @change="patchDate(p)"
                  />
                </td>
                <td class="px-2 py-1 font-medium">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span>{{ p.contact.name }}</span>
                    <UBadge
                      v-if="isTodayFollowUp(p.contact, today) && topReason(p.contact, today)"
                      :color="reasonColor(topReason(p.contact, today)?.kind)"
                      variant="subtle"
                      size="xs"
                    >
                      {{ topReason(p.contact, today)?.label }}
                    </UBadge>
                  </div>
                </td>
                <td class="px-1 py-1 text-right whitespace-nowrap">
                  <UButton
                    v-if="isTodayFollowUp(p.contact, today)"
                    icon="i-lucide-check"
                    color="primary"
                    variant="soft"
                    size="xs"
                    title="今天已跟進"
                    :loading="marking.has(p.contact.id)"
                    :disabled="marking.has(p.contact.id)"
                    @click="markDone(p.contact)"
                  />
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    title="編輯明細"
                    @click="openDetail(p.contact)"
                  />
                  <UButton
                    icon="i-lucide-x"
                    color="error"
                    variant="ghost"
                    size="xs"
                    title="從此區塊移除"
                    @click="removeRow(p)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 織網表 -->
    <section>
      <div class="flex items-end justify-between mb-2">
        <div>
          <h2 class="font-bold text-base flex items-center gap-2">
            {{ PROSPECT_SECTION_META.network.title }}
            <span class="text-xs text-muted font-normal">({{ bySection.network.length }} 人)</span>
          </h2>
        </div>
        <UButton
          icon="i-lucide-user-plus"
          size="sm"
          variant="soft"
          @click="openPicker('network')"
        />
      </div>
      <div class="overflow-x-auto border border-default rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-elevated/50 text-muted">
            <tr>
              <th class="w-8 px-2 py-2 text-center font-medium">
                #
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                姓名
              </th>
              <th class="px-2 py-2 text-left font-medium whitespace-nowrap">
                狀態
              </th>
              <th class="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="!bySection.network.length"
              class="border-t border-default"
            >
              <td
                colspan="4"
                class="text-muted text-center py-8"
              >
                {{ onlyTodayFollowUp ? '此區塊今天沒有待跟進的名單。' : '還沒有名單。' }}
              </td>
            </tr>
            <tr
              v-for="(p, i) in bySection.network"
              :key="p.id"
              class="border-t border-default hover:bg-elevated/30"
              :class="isTodayFollowUp(p.contact, today) ? 'bg-primary-500/5' : ''"
            >
              <td class="px-2 py-1 text-center text-muted tabular-nums">
                {{ i + 1 }}
              </td>
              <td class="px-2 py-1 font-medium whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <span>{{ p.contact.name }}</span>
                  <UBadge
                    v-if="isTodayFollowUp(p.contact, today) && topReason(p.contact, today)"
                    :color="reasonColor(topReason(p.contact, today)?.kind)"
                    variant="subtle"
                    size="xs"
                  >
                    {{ topReason(p.contact, today)?.label }}
                  </UBadge>
                </div>
              </td>
              <td class="px-2 py-1">
                <span :class="p.contact.status ? '' : 'text-dimmed'">{{
                  p.contact.status || "—"
                }}</span>
              </td>
              <td class="px-1 py-1 text-right whitespace-nowrap">
                <UButton
                  v-if="isTodayFollowUp(p.contact, today)"
                  icon="i-lucide-check"
                  color="primary"
                  variant="soft"
                  size="xs"
                  title="今天已跟進"
                  :loading="marking.has(p.contact.id)"
                  :disabled="marking.has(p.contact.id)"
                  @click="markDone(p.contact)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  title="編輯明細"
                  @click="openDetail(p.contact)"
                />
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  title="從此區塊移除"
                  @click="removeRow(p)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 從總名單加入 Modal -->
    <UModal
      v-model:open="pickerOpen"
      :title="`加入到「${PROSPECT_SECTION_META[pickerSection].title}」`"
    >
      <template #body>
        <div class="space-y-3">
          <UInput
            v-model="pickerSearch"
            icon="i-lucide-search"
            placeholder="搜尋姓名"
            class="w-full"
          />
          <div
            v-if="!pickerCandidates.length"
            class="text-muted text-sm text-center py-8"
          >
            {{
              (contactsList?.length ?? 0)
                ? "沒有可加入的對象（可能都已在此區塊或不符合搜尋）。"
                : "總名單還沒有人，請先到「總名單」新增。"
            }}
          </div>
          <ul
            v-else
            class="max-h-80 overflow-y-auto divide-y divide-default border border-default rounded-lg"
          >
            <li
              v-for="c in pickerCandidates"
              :key="c.id"
              class="flex items-center gap-3 px-3 py-2 hover:bg-elevated/30 cursor-pointer"
              @click="toggleSelected(c.id, !selectedIds.includes(c.id))"
            >
              <UCheckbox
                :model-value="selectedIds.includes(c.id)"
                @update:model-value="toggleSelected(c.id, $event)"
                @click.stop
              />
              <span class="font-medium">{{ c.name }}</span>
              <span
                v-if="c.location"
                class="text-xs text-muted"
              >{{
                c.location
              }}</span>
              <UBadge
                v-if="isTodayFollowUp(c, today) && topReason(c, today)"
                :color="reasonColor(topReason(c, today)?.kind)"
                variant="subtle"
                size="xs"
              >
                {{ topReason(c, today)?.label }}
              </UBadge>
              <UBadge
                v-if="c.level"
                :color="levelColor(c.level)"
                variant="subtle"
                size="sm"
                class="ml-auto"
              >
                {{ c.level }}
              </UBadge>
            </li>
          </ul>
          <div class="flex items-center justify-end gap-2 pt-2">
            <span
              v-if="selectedIds.length"
              class="text-sm text-muted mr-auto"
            >已選 {{ selectedIds.length }} 位</span>
            <UButton
              color="neutral"
              variant="ghost"
              @click="pickerOpen = false"
            >
              取消
            </UButton>
            <UButton
              icon="i-lucide-plus"
              :loading="adding"
              :disabled="!selectedIds.length"
              @click="confirmAdd"
            >
              加入
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 編輯明細（改 contact） -->
    <ContactDetailModal
      v-model:open="detailOpen"
      :contact="detailContact"
      @saved="onDetailSaved"
    />
  </div>
</template>
