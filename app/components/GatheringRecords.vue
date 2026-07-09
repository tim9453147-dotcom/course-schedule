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

// 活動名稱建議：預設「家聚」＋既有活動用過的名稱＋本次新增的名稱；可自由輸入／新增選項。
const createdNames = ref<string[]>([])
const nameItems = computed(() => Array.from(new Set([
  '家聚',
  ...(gatherings.value ?? []).map(g => g.name),
  ...createdNames.value
])))

// 活動名稱下拉是否展開（受控，才能在 Create 後手動收合）。
const nameMenuOpen = ref(false)

// 點下拉的 Create「xxx」：先把名稱加進選項清單再選取它，
// 這樣名稱會填入框內、之後也會出現在右側下拉的選項中；最後主動收合選單。
function onCreateName(v: string) {
  const name = v.trim()
  if (!name) return
  if (!createdNames.value.includes(name)) createdNames.value.push(name)
  form.name = name
  // 元件在此輪事件內可能又把 open 設回 true，故延到下一個 tick 才強制關閉。
  nextTick(() => (nameMenuOpen.value = false))
}

// 活動名稱欄位：聚焦時把預設文字（如「家聚」）整段選取，打字直接取代，
// 避免黏字成「家聚xxx」；要新增名稱仍是打字後點下拉的 Create「xxx」。
function selectAllOnFocus(e: FocusEvent) {
  const t = e.target
  if (t instanceof HTMLInputElement) {
    requestAnimationFrame(() => t.select())
  }
}

// 讓日期／時間欄位「點整格」就展開原生選擇器（不用只點右側 icon）。
function openPicker(e: MouseEvent) {
  const root = e.currentTarget as HTMLElement | null
  if (!root) return
  const input = (root instanceof HTMLInputElement ? root : root.querySelector('input')) as HTMLInputElement | null
  if (input && !input.disabled) {
    try {
      input.showPicker()
    } catch { /* 不支援 showPicker 的瀏覽器：略過，仍可用原生 icon */ }
  }
}

/* ---------- 明細 modal ---------- */
const open = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const showRecipe = ref(false) // 明細內是否展開食譜食材/作法
// 新增時的預設：活動名稱「家聚」、地點「吾心家」、時段 19:00–21:00（編輯既有活動時由 openRow 覆寫）
const blank = () => ({
  name: '家聚', date: '', startTime: '19:00', endTime: '21:00', location: '吾心家', mapUrl: '',
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
              <!-- focusin 冒泡自內層 input：聚焦時整段選取預設值，打字即取代，避免黏字 -->
              <div
                class="w-full"
                @focusin="selectAllOnFocus"
              >
                <UInputMenu
                  v-model="form.name"
                  v-model:open="nameMenuOpen"
                  :items="nameItems"
                  create-item
                  :disabled="!canEdit"
                  placeholder="選擇或輸入"
                  class="w-full"
                  @create="onCreateName"
                />
              </div>
            </UFormField>
            <UFormField label="日期">
              <UInput
                v-model="form.date"
                type="date"
                :disabled="!canEdit"
                class="w-full"
                @click="openPicker"
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
                @click="openPicker"
              />
            </UFormField>
            <UFormField label="結束時間">
              <UInput
                v-model="form.endTime"
                type="time"
                :disabled="!canEdit"
                class="w-full"
                @click="openPicker"
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
