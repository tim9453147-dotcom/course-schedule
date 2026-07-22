<script setup lang="ts">
// 家聚點「食譜列表」分頁（spec 0021）。需 gathering-recipe 權才會顯示此分頁。
// 有此分頁權者即可讀寫食譜（名稱／食材／作法／備註）。
const notify = useNotify()
const confirm = useConfirm()

const { data: recipes, refresh } = await useFetch<Recipe[]>('/api/recipes', { key: 'global-recipes', deep: true })

/* ---------- 明細 modal ---------- */
const open = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = reactive({ name: '', ingredients: '', steps: '', note: '' })

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', ingredients: '', steps: '', note: '' })
  open.value = true
}
function openRow(r: Recipe) {
  editingId.value = r.id
  Object.assign(form, {
    name: r.name, ingredients: r.ingredients ?? '', steps: r.steps ?? '', note: r.note ?? ''
  })
  open.value = true
}

async function save() {
  if (!form.name.trim()) return notify.error('請輸入料理名稱')
  saving.value = true
  try {
    const url = editingId.value ? `/api/recipes/${editingId.value}` : '/api/recipes'
    await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body: { ...form } })
    open.value = false
    await refresh()
    notify.success(editingId.value ? '已更新食譜' : '已新增食譜')
  } catch (err: unknown) {
    const msg = (err as { statusMessage?: string })?.statusMessage ?? '請檢查欄位內容'
    notify.error('儲存失敗', msg)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!editingId.value) return
  const ok = await confirm({ title: '刪除食譜', description: '確定刪除這道食譜？引用它的活動會取消引用。', confirmLabel: '刪除', danger: true })
  if (!ok) return
  try {
    await $fetch(`/api/recipes/${editingId.value}`, { method: 'DELETE' })
    open.value = false
    await refresh()
    notify.success('已刪除食譜')
  } catch {
    notify.error('刪除失敗')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold">
        食譜列表
      </h2>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        新增食譜
      </UButton>
    </div>

    <div
      v-if="!recipes?.length"
      class="text-muted py-12 text-center"
    >
      目前沒有食譜
    </div>

    <div class="space-y-2">
      <button
        v-for="r in recipes"
        :key="r.id"
        type="button"
        class="hover:bg-elevated/50 flex w-full items-center gap-3 rounded-lg border border-default px-4 py-3 text-left transition"
        @click="openRow(r)"
      >
        <UIcon
          name="i-lucide-chef-hat"
          class="text-primary"
        />
        <span class="font-medium">{{ r.name }}</span>
        <span
          v-if="r.ingredients"
          class="text-muted ml-auto truncate text-sm"
        >{{ r.ingredients }}</span>
      </button>
    </div>

    <UModal
      :open="open"
      :title="editingId ? '編輯食譜' : '新增食譜'"
      @update:open="open = $event"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="料理名稱">
            <UInput
              v-model="form.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="食材">
            <UTextarea
              v-model="form.ingredients"
              :rows="4"
              class="w-full"
            />
          </UFormField>
          <UFormField label="作法">
            <UTextarea
              v-model="form.steps"
              :rows="6"
              class="w-full"
            />
          </UFormField>
          <UFormField label="備註">
            <UTextarea
              v-model="form.note"
              :rows="2"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-between pt-2">
            <UButton
              v-if="editingId"
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
        </div>
      </template>
    </UModal>
  </div>
</template>
