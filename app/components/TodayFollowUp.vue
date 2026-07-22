<script setup lang="ts">
// 名單「今日跟進」分頁：從使用者自己的名單挑出今天該先找的人，用熱度分數排序。
// 純站內、資料範圍與總名單相同（各看各的）；熱度公式來自 shared/utils/leadScore.ts。
const notify = useNotify()

// deep: true → 樂觀更新能即時反映（比照 ContactList）。與 ContactList 共用同一 /api/contacts 快取（useFetch 依 URL 去重）。
const { data: contacts, refresh: refreshContacts } = await useFetch<Contact[]>('/api/contacts', { key: 'global-contacts', deep: true })

const today = todayStr()

// 入列 + 依熱度分數排序（高→低）
const list = computed(() =>
  (contacts.value ?? [])
    .filter(c => isTodayFollowUp(c, today))
    .map(c => ({ c, score: leadScore(c, today), reason: topReason(c, today) }))
    .sort((a, b) => b.score - a.score)
)

function reasonColor(kind?: NonNullable<LeadReason>['kind']) {
  return kind === 'overdue' ? 'error' : kind === 'due' ? 'warning' : 'neutral'
}

// 進行中的「今天已跟進」id：防止連點重複寫入空白跟進紀錄
const marking = ref(new Set<number>())

// 勾「今天已跟進」＝新增一筆今天的跟進紀錄；後端回算 lastFollowUp/nextFollowUp，重新整理後該人離開清單。
async function markDone(c: Contact) {
  if (marking.value.has(c.id)) return
  marking.value.add(c.id)
  try {
    await $fetch(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: today, content: '' } })
    await refreshContacts()
  } catch {
    notify.error('更新失敗')
    await refreshContacts()
  } finally {
    marking.value.delete(c.id)
  }
}

// 明細 modal（重用總名單的 ContactDetailModal）
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
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">
        今日跟進
      </h1>
      <UBadge
        v-if="list.length"
        color="primary"
        variant="subtle"
        size="lg"
      >
        今天有 {{ list.length }} 位待跟進
      </UBadge>
    </div>

    <div
      v-if="!list.length"
      class="text-muted text-center py-16"
    >
      今天沒有待跟進的名單 🎉
    </div>

    <ul
      v-else
      class="space-y-2"
    >
      <li
        v-for="{ c, score, reason } in list"
        :key="c.id"
        class="flex items-center gap-3 border border-default rounded-lg px-4 py-3 hover:bg-elevated/30"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium">{{ c.name }}</span>
            <span
              v-if="c.location"
              class="text-muted text-sm"
            >{{ c.location }}</span>
            <UBadge
              v-if="reason"
              :color="reasonColor(reason.kind)"
              variant="subtle"
              size="sm"
            >
              {{ reason.label }}
            </UBadge>
            <span class="text-dimmed text-xs tabular-nums">熱度 {{ score }}</span>
          </div>
          <div class="text-muted text-sm mt-0.5">
            上次跟進：{{ timeAgo(c.lastFollowUp) }}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            icon="i-lucide-check"
            color="primary"
            variant="soft"
            size="sm"
            :loading="marking.has(c.id)"
            :disabled="marking.has(c.id)"
            @click="markDone(c)"
          >
            <span class="hidden sm:inline">今天已跟進</span>
          </UButton>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            title="明細"
            @click="openMeta(c)"
          />
        </div>
      </li>
    </ul>

    <ContactDetailModal
      v-model:open="metaOpen"
      :contact="metaContact"
      @saved="onMetaSaved"
    />
  </div>
</template>
