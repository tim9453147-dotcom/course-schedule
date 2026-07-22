<script setup lang="ts">
// 可挑/可加/可刪的人名輸入（UInputMenu 包裝），用於名單明細「誰的朋友／開發夥伴」。
// 存純文字人名；選項清單由父層（ContactDetailModal）持有並持久化，本元件只呈現與發事件。
const props = defineProps<{ modelValue: string, options: ContactOption[] }>()
const emit = defineEmits<{
  'update:modelValue': [string]
  'add': [string] // 使用者輸入的新名稱，父層負責 POST 持久化
  'delete': [number] // 要刪除的選項 id，父層負責 DELETE
}>()

// UInputMenu 以字串清單呈現即可（人名唯一）；刪除時用 label 反查 id。
const items = computed(() => props.options.map(o => o.label))

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v ?? '')
})

// UInputMenu 的 item slot 對字串項目可能傳字串、也可能傳正規化後的物件；兩者都取得到 label。
function itemLabel(item: unknown): string {
  return typeof item === 'string' ? item : String((item as { label?: string })?.label ?? '')
}

function onCreate(label: string) {
  emit('add', label)
  emit('update:modelValue', label)
}

function onDelete(item: unknown) {
  const label = itemLabel(item)
  const opt = props.options.find(o => o.label === label)
  if (opt) emit('delete', opt.id)
}
</script>

<template>
  <UInputMenu
    v-model="value"
    :items="items"
    create-item
    placeholder="選擇或輸入"
    class="w-full"
    @create="onCreate"
  >
    <template #item-trailing="{ item }">
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`刪除選項 ${itemLabel(item)}`"
        @pointerdown.stop.prevent
        @click.stop.prevent="onDelete(item)"
      />
    </template>
  </UInputMenu>
</template>
