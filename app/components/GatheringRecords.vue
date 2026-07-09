<script setup lang="ts">
// 家聚點「活動紀錄」分頁（spec 0021）。人人可看；有 gathering 權才能編輯。
// 操鍋/助手/採買以 UInputMenu 提供名單建議＋可自由輸入（存人名文字）。
// 明細中點食譜名稱可展開該食譜的食材／作法（需有食譜讀取權才抓得到）。
const canEdit = useCanEdit('gathering')
const notify = useNotify()
const confirm = useConfirm()

const { data: gatherings, refresh } = await useFetch<Gathering[]>('/api/gatherings', { deep: true })

// 名單（操鍋/助手/採買下拉建議）：best-effort，無 crm 權時為空，退回自由輸入。
const { data: contacts } = await useFetch<Contact[]>('/api/contacts', { default: () => [] })
const contactNames = computed(() => Array.from(new Set((contacts.value ?? []).map(c => c.name))))

// 食譜（引用用）：best-effort，無食譜權時為空。
const { data: recipes } = await useFetch<Recipe[]>('/api/recipes', { default: () => [] })
const recipeItems = computed(() => (recipes.value ?? []).map(r => ({ label: r.name, value: r.id })))
function recipeById(id: number | null) {
  return id == null ? null : (recipes.value ?? []).find(r => r.id === id) ?? null
}

/* ---------- 明細 modal ---------- */
const open = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const showRecipe = ref(false) // 明細內是否展開食譜食材/作法
const blank = () => ({
  name: '', date: '', startTime: '', endTime: '', location: '', mapUrl: '',
  cook: '', assistant: '', shopper: '', process: '', attendees: '',
  recipeId: null as number | null, note: ''
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  showRecipe.value = false
  open.value = true
}
function openRow(g: Gathering) {
  editingId.value = g.id
  Object.assign(form, {
    name: g.name, date: g.date, startTime: g.startTime ?? '', endTime: g.endTime ?? '',
    location: g.location ?? '', mapUrl: g.mapUrl ?? '', cook: g.cook ?? '',
    assistant: g.assistant ?? '', shopper: g.shopper ?? '', process: g.process ?? '',
    attendees: g.attendees ?? '', recipeId: g.recipeId, note: g.note ?? ''
  })
  showRecipe.value = false
  open.value = true
}

const selectedRecipe = computed(() => recipeById(form.recipeId))

async function save() {
  if (!form.name.trim()) return notify.error('請輸入活動名稱')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return notify.error('請選擇日期')
  saving.value = true
  try {
    const url = editingId.value ? `/api/gatherings/${editingId.value}` : '/api/gatherings'
    await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body: { ...form } })
    open.value = false
    await refresh()
    notify.success(editingId.value ? '已更新活動' : '已新增活動')
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">
        活動紀錄
      </h2>
      <UButton
        v-if="canEdit"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        新增活動
      </UButton>
    </div>

    <div
      v-if="!gatherings?.length"
      class="text-muted py-12 text-center"
    >
      目前沒有家聚活動
    </div>

    <div class="space-y-2">
      <button
        v-for="g in gatherings"
        :key="g.id"
        type="button"
        class="hover:bg-elevated/50 flex w-full items-center gap-3 rounded-lg border border-default px-4 py-3 text-left transition"
        @click="openRow(g)"
      >
        <span class="text-primary font-mono text-sm tabular-nums">{{ g.date }}</span>
        <span class="font-medium">{{ g.name }}</span>
        <span
          v-if="g.location"
          class="text-muted ml-auto text-sm"
        >{{ g.location }}</span>
      </button>
    </div>

    <UModal
      :open="open"
      :title="editingId ? (canEdit ? '編輯活動' : '活動明細') : '新增活動'"
      :ui="{ content: 'max-w-2xl' }"
      @update:open="open = $event"
    >
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="活動名稱">
              <UInput
                v-model="form.name"
                :disabled="!canEdit"
                class="w-full"
              />
            </UFormField>
            <UFormField label="日期">
              <UInput
                v-model="form.date"
                type="date"
                :disabled="!canEdit"
                class="w-full"
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
              />
            </UFormField>
            <UFormField label="結束時間">
              <UInput
                v-model="form.endTime"
                type="time"
                :disabled="!canEdit"
                class="w-full"
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
          <a
            v-if="!canEdit && form.mapUrl"
            :href="form.mapUrl"
            target="_blank"
            rel="noopener"
            class="text-primary inline-flex items-center gap-1 text-sm"
          >
            <UIcon name="i-lucide-map-pin" />開啟地圖
          </a>

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

          <div class="flex items-center justify-between pt-2">
            <UButton
              v-if="canEdit && editingId"
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
                {{ canEdit ? '取消' : '關閉' }}
              </UButton>
              <UButton
                v-if="canEdit"
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
