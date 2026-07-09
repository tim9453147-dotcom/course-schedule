<script setup lang="ts">
// 家聚點「收支紀錄」分頁（spec 0021）。需 gathering-finance 權才會顯示此分頁。
// 列出全部活動，顯示 日期｜名稱｜盈餘(+綠/−紅)；點入編輯人數/收費/支出，收入與盈餘自動算。
const notify = useNotify()

const { data: rows, refresh } = await useFetch<GatheringFinanceRow[]>('/api/gathering-finances', { deep: true })

/* ---------- 明細 modal ---------- */
const open = ref(false)
const editing = ref<GatheringFinanceRow | null>(null)
const saving = ref(false)
// 表單值以字串存放（UInput 的 v-model 為字串），儲存時再轉數字。
const form = reactive({ headcount: '', fee: '', expense: '' })

// 表單即時預覽收入/盈餘
const preview = computed(() => {
  const h = Number(form.headcount) || 0
  const f = Number(form.fee) || 0
  const e = Number(form.expense) || 0
  return { income: h * f, profit: h * f - e }
})

function openRow(r: GatheringFinanceRow) {
  editing.value = r
  form.headcount = r.headcount == null ? '' : String(r.headcount)
  form.fee = r.fee == null ? '' : String(r.fee)
  form.expense = r.expense == null ? '' : String(r.expense)
  open.value = true
}

// UInput type="number" 會把值轉成數字（looseToNumber），故這裡同時容納數字與字串：
// 空字串／null → null，否則轉數字。
function toNull(v: number | string | null) {
  const s = String(v ?? '').trim()
  return s === '' ? null : Number(s)
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    await $fetch(`/api/gathering-finances/${editing.value.id}`, {
      method: 'PUT',
      body: { headcount: toNull(form.headcount), fee: toNull(form.fee), expense: toNull(form.expense) }
    })
    open.value = false
    await refresh()
    notify.success('已更新收支')
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('儲存失敗', msg)
  } finally {
    saving.value = false
  }
}

const money = (n: number) => n.toLocaleString('zh-TW')
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold">
      收支紀錄
    </h2>
    <p class="text-muted text-sm">
      新增活動請至「活動紀錄」分頁；這裡填每場活動的財務。
    </p>

    <div
      v-if="!rows?.length"
      class="text-muted py-12 text-center"
    >
      目前沒有家聚活動
    </div>

    <div class="space-y-2">
      <button
        v-for="r in rows"
        :key="r.id"
        type="button"
        class="hover:bg-elevated/50 flex w-full items-center gap-3 rounded-lg border border-default px-4 py-3 text-left transition"
        @click="openRow(r)"
      >
        <span class="text-primary font-mono text-sm tabular-nums">{{ r.date }}</span>
        <span class="font-medium">{{ r.name }}</span>
        <span
          class="ml-auto font-mono font-semibold tabular-nums"
          :class="r.profit >= 0 ? 'text-success' : 'text-error'"
        >
          {{ r.profit >= 0 ? '+' : '−' }}{{ money(Math.abs(r.profit)) }}
        </span>
      </button>
    </div>

    <UModal
      :open="open"
      :title="`收支 — ${editing?.name ?? ''}`"
      @update:open="open = $event"
    >
      <template #body>
        <div class="space-y-4">
          <div class="text-muted text-sm">
            日期：{{ editing?.date }}
          </div>
          <div class="grid grid-cols-3 gap-4">
            <UFormField label="人數">
              <UInput
                v-model="form.headcount"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="收費（每人）">
              <UInput
                v-model="form.fee"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="支出">
              <UInput
                v-model="form.expense"
                type="number"
                min="0"
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
                {{ money(preview.income) }}
              </div>
            </div>
            <div>
              <div class="text-muted text-xs">
                盈餘（收入−支出）
              </div>
              <div
                class="font-mono text-lg font-semibold tabular-nums"
                :class="preview.profit >= 0 ? 'text-success' : 'text-error'"
              >
                {{ money(preview.profit) }}
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="open = false"
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
  </div>
</template>
